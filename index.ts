import { Application } from "./webdriver/application";
import * as assert from "assert";
import path from "path";
require("dotenv").config();
import '@babel/polyfill';

const initialiseWebDriverClient = () => {
    const appPath = process.env.APP_PATH;

    const env = {
        ELECTRON_ENABLE_LOGGING: process.env.ELECTRON_ENABLE_LOGGING,
        ELECTRON_ENABLE_STACK_DUMPING: process.env.ELECTRON_ENABLE_STACK_DUMPING,
        NODE_ENV: process.env.NODE_ENV
    };

    return new Application({
        path: appPath,
        args: [],
        workingDirectory: path.dirname(appPath),
        env: env,
        chromeDriverArgs: [
            "--force-renderer-accessibility"
        ],
        startTimeout: 60000,
        chromeDriverLogPath: "chromedriverlog.txt"
    });
};

describe("application launch", function() {
    const app = initialiseWebDriverClient();
    const waitForApp = 15; //seconds
    
    before(async function() {
        console.log("*****************before*****************");
        app.start();
        return new Promise((resolve, reject) => {
            global.setTimeout(() => {
                try {
                    assert.equal(true, app.isRunning());
                    resolve();
                } catch (error) {
                    console.log("app stopping . . .");
                    app.stop();
                    reject(error);
                }
            }, waitForApp * 1000);
        });
    });

    after(async function() {
        console.log("*****************after*****************");
        if (app.isRunning()) {
            await app.stop();
        }
        assert.equal(false, app.isRunning());
    });

    it(`a should be 0 after ${waitForApp} second`, async function() {
        let a: number = -1;
        await new Promise(resolve => {
            setTimeout(() => {
                a = 0;
                resolve();
            }, waitForApp * 1000);
        });
        assert.strictEqual(0, a);
    });
});