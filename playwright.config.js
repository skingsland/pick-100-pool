require('dotenv').config();
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './e2e',
    timeout: 30000,
    use: {
        // Tests must use page.goto('#/route'), NOT page.goto('/#/route').
        // A leading '/' resolves against the origin, dropping the ?tournament= query param.
        baseURL: 'http://localhost:5001/?tournament=Testing',
        screenshot: 'only-on-failure',
    },
    webServer: {
        command: 'npx http-server client -p 5001 -s',
        port: 5001,
        reuseExistingServer: true,
    },
});
