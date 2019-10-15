import ChildProcess, { StdioOptions } from 'child_process';
import split from 'split';
import request from 'request';
import { ChromeDriverOptions } from './module';
import path from 'path';

export class ChromeDriver {
    host: string;
    port: number;
    nodePath: string;
    startTimeout: number;
    workingDirectory: string;
    chromeDriverLogPath: string;

    path: string = path.join(__dirname, 'electron_chromedriver.js');
    urlBase: string = '/wd/hub';
    statusUrl: string;
    logLines: string[] = [];
    process: ChildProcess.ChildProcess;
    exitHandler: () => void =  () => {
        this.stop();
    };

    constructor(options: ChromeDriverOptions) {
        this.host = options.host;
        this.port = options.port;
        this.nodePath = options.nodePath;
        this.startTimeout = options.startTimeout;
        this.workingDirectory = options.workingDirectory;
        this.chromeDriverLogPath = options.chromeDriverLogPath;

        this.statusUrl = 'http://' + this.host + ':' + this.port + this.urlBase + '/status';
    }

    public start(): Promise<void> {
        const self = this;

        if (self.process)
            throw new Error('ChromeDriver already started');

        let args = [
            this.path,
            '--port=' + this.port,
            '--url-base=' + this.urlBase
        ];
        if (this.chromeDriverLogPath) {
            args.push('--verbose');
            args.push('--log-path=' + this.chromeDriverLogPath);
        }

        const options = {
            cwd: this.workingDirectory,
            env: this.getEnvironment(),
            stdio: <StdioOptions>'pipe'
        };

        const driverProcess = ChildProcess.spawn(this.nodePath, args, options);

        self.process = driverProcess;

        global.process.on('exit', self.exitHandler);

        self.setupLogs();

        return this.waitUntilRunning();
    }

    private waitUntilRunning(): Promise<void> {
        const self = this;
        let checkIfRunning: () => void;

        return new Promise((resolve, reject) => {
            const startTime = Date.now();

            let counter = 0;
            checkIfRunning = () => {
                self.isRunning(running => {
                    if (!self.process) {
                        return reject(Error('ChromeDriver has been stopped'));
                    }

                    if (running) {
                        return resolve();
                    }

                    var elapsedTime = Date.now() - startTime;
                    if (elapsedTime > self.startTimeout) {
                        return reject(Error('ChromeDriver did not start within ' + self.startTimeout + 'ms'));
                    }

                    global.setTimeout(checkIfRunning, 100);
                });
            };
            checkIfRunning();
        });
    }

    private isRunning(callback: (running: boolean) => void): void {
        const requestOptions = {
            uri: this.statusUrl,
            json: true,
            followAllRedirects: true
        };
        request(requestOptions, (error, response, body) => {
            if (error) {
                callback(false);
                return;
            }
            if (response.statusCode !== 200) {
                callback(false);
                return;
            }
            callback(body && body.value.ready);
        });
    }

    public stop(): void {
        const self = this;

        if (self.process) {
            self.process.removeListener('exit', self.stop);
            self.process.removeListener('SIGTERM', self.stop);
            self.process.kill();
            self.process = null;
        }

        self.clearLogs();
    }

    private getEnvironment(): NodeJS.ProcessEnv {
        var env = {};

        for (let key in process.env) {
            env[key] = process.env[key];
        }

        if (process.platform === 'win32') {
            env['SPECTRON_NODE_PATH'] = process.execPath;
            env['SPECTRON_LAUNCHER_PATH'] = path.join(__dirname, 'electron_launcher.js');
        }

        return env;
    }

    private setupLogs(): void {
        const linesToIgnore = 2; // First two lines are ChromeDriver specific
        let lineCount = 0;

        this.logLines = [];

        this.process.stdout.pipe(split()).on('data', line => {
            if (lineCount < linesToIgnore) {
                lineCount++;
                return;
            }
            console.log(line);
            this.logLines.push(line);
        });
    }

    get Logs(): string[] {
        return this.logLines.slice();
    }

    private clearLogs(): void {
        this.logLines = [];
    }
}