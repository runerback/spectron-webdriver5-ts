import { BrowserObject, remote } from "webdriverio";
import { WebDriverLogTypes } from "webdriver";
import { ChromeDriver } from "./chrome_driver";
import path from 'path';
import DevNull from 'dev-null';
import fs from 'fs';
import { ApplicationOptions } from './module';

export class Application {
    host: string;
    port: number;
    path: string;
    args: string[];
    workingDirectory: string;
    quitTimeout: number;
    startTimeout: number;
    waitTimeout: number;
    connectionRetryCount: number;
    connectionRetryTimeout: number;
    chromeDriverArgs: string[];
    chromeDriverLogPath: string;
    nodePath: string;
    chromeDriver: ChromeDriver;
    env: NodeJS.ProcessEnv;
    debuggerAddress: string;
    webdriverLogPath: string;
    webdriverOptions: object;
    client: BrowserObject;
    running: boolean;
    chromeDriverRunning: boolean = false;

    constructor(options: ApplicationOptions) {
        this.host = options.host || '127.0.0.1';
        this.port = options.port || 9515;
        this.quitTimeout = options.quitTimeout || 1000;
        this.startTimeout = options.startTimeout || 5000;
        this.waitTimeout = options.waitTimeout || 5000;
        this.connectionRetryCount = options.connectionRetryCount || 10;
        this.connectionRetryTimeout = options.connectionRetryTimeout || 30000;
        this.nodePath = options.nodePath || process.execPath;
        this.env = options.env || {};
        this.chromeDriverArgs = options.chromeDriverArgs || [];
        this.debuggerAddress = options.debuggerAddress;
        this.webdriverLogPath = options.webdriverLogPath;
        this.webdriverOptions = options.webdriverOptions || {}

        this.path = options.path;
        this.args = options.args;
        this.workingDirectory = options.workingDirectory || process.cwd();
        this.startTimeout = options.startTimeout;
        this.chromeDriverLogPath = options.chromeDriverLogPath;
    }

    public async start(): Promise<void> {
        await this.appExists();
        await this.startChromeDriver();
        await this.createClient();
        await this.setTimeout();
        this.running = true;
    }

    public async stop(): Promise<void> {
        if(this.chromeDriverRunning) {
            this.chromeDriver.stop();
            this.chromeDriverRunning = false;
        }

        if (!this.isRunning())
            return;
        
        await this.client.closeWindow();
        await new Promise((resolve, reject) => {
            global.setTimeout(async () => {
                try {
                    await this.client.shutdown();
                    resolve();
                } catch (error) {
                    reject(error);
                }
            }, this.quitTimeout);
        });

        this.running = false;
    }

    public async restart(): Promise<void> {
        await this.stop();
        await this.start();
    }

    public isRunning(): boolean {
        return this.running;
    }

    get Client(): BrowserObject {
        if (!this.isRunning())
            return null;
        return this.client;
    }

    private async startChromeDriver(): Promise<void> {
        this.chromeDriver = new ChromeDriver({
            host: this.host,
            port: this.port,
            nodePath: this.nodePath,
            startTimeout: this.startTimeout,
            workingDirectory: this.workingDirectory,
            chromeDriverLogPath: this.chromeDriverLogPath
        });
        await this.chromeDriver.start();
        this.chromeDriverRunning = true;
    }

    private createClient(): void {
        let self = this;
        
        let args = [];

        args.push('spectron-path=' + self.path);
        self.args.forEach(function (arg, index) {
            args.push('spectron-arg' + index + '=' + arg);
        });

        for (var name in self.env) {
            args.push('spectron-env-' + name + '=' + self.env[name]);
        }

        self.chromeDriverArgs.forEach(function (arg) {
            args.push(arg);
        });

        var isWin = process.platform === 'win32';
        var launcherPath = path.join(__dirname, isWin ? 
            'electron_launcher.bat' : 'electron_launcher.js');

        if (process.env.APPVEYOR) {
            args.push('no-sandbox');
        }

        let options = {
            hostname: self.host,
            port: self.port,
            waitforTimeout: self.waitTimeout,
            connectionRetryCount: self.connectionRetryCount,
            connectionRetryTimeout: self.connectionRetryTimeout,
            capabilities: {
                browserName: 'chrome',
                'goog:chromeOptions': {
                    binary: launcherPath,
                    args: args,
                    debuggerAddress: self.debuggerAddress,
                    windowTypes: ['app', 'webview']
                }
            },
            logOutput: DevNull(),
            logLevel: <WebDriverLogTypes>"silent"
        };
        if (self.webdriverLogPath) {
            options.logOutput = self.webdriverLogPath;
            options.logLevel = <WebDriverLogTypes>'verbose';
        }

        Object.assign(options, self.webdriverOptions);

        self.client = remote(options);
    }

    private async setTimeout(): Promise<void> {
        await this.client.setTimeouts('script', this.waitTimeout);
    }

    private async appExists(): Promise<void> {
        if (this.debuggerAddress) {
            return;
        }
        if (!this.path || this.path.length === 0) {
            throw new Error('Application path must be a string');
        }

        await new Promise<void>((resolve, reject) => {
            fs.stat(this.path, (error, stats) => {
                if (error)
                    reject(error);
                if (!stats.isFile())
                    reject(`Application path specified is not a file: ${this.path}`);

                resolve();
            });
        });
    }
}