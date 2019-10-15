
export interface ApplicationOptions {
    host?: string;
    port?: number;
    quitTimeout?: number;
    startTimeout?: number;
    waitTimeout?: number;
    connectionRetryCount?: number;
    connectionRetryTimeout?: number;
    nodePath?: string;
    path: string;
    args?: string[];
    chromeDriverArgs?: string[];
    env?: NodeJS.ProcessEnv;
    workingDirectory?: string;
    debuggerAddress?: string;
    chromeDriverLogPath?: string;
    webdriverLogPath?: string;
    webdriverOptions?: object
}

export interface ChromeDriverOptions {
    host: string;
    port: number;
    nodePath: string;
    startTimeout: number;
    workingDirectory: string;
    chromeDriverLogPath: string;
}
