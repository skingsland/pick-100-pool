const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();

    // iPhone SE viewport (375x667)
    const context = await browser.newContext({
        viewport: { width: 375, height: 667 },
        deviceScaleFactor: 3,
        isMobile: true,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    });
    const page = await context.newPage();

    // Pool page with bracket table (Testing_Final has complete scores)
    await page.goto('http://localhost:5001/?tournament=Testing_Final#/pools/e2eTestPoolA');
    // Wait for bracket table to render with data
    await page.waitForSelector('.bracketTable tbody tr', { timeout: 15000 });
    await page.waitForTimeout(2000); // let Firebase data settle

    // Screenshot the full page
    await page.screenshot({
        path: '/tmp/bracket-mobile-full.png',
        fullPage: true,
    });
    console.log('Saved: /tmp/bracket-mobile-full.png');

    // Screenshot just the first bracket table
    const table = page.locator('.table-responsive').first();
    await table.screenshot({
        path: '/tmp/bracket-mobile-table.png',
    });
    console.log('Saved: /tmp/bracket-mobile-table.png');

    // Also take a direct bracket view (Alice's bracket which has Finals data)
    await page.goto('http://localhost:5001/?tournament=Testing_Final#/pools/e2eTestPoolA/brackets/e2eBracket1');
    await page.waitForSelector('.bracketTable tbody tr', { timeout: 15000 });
    await page.waitForTimeout(2000);

    const bracketTable = page.locator('.table-responsive').first();
    await bracketTable.screenshot({
        path: '/tmp/bracket-mobile-single.png',
    });
    console.log('Saved: /tmp/bracket-mobile-single.png');

    // Now take a desktop comparison (1280px wide)
    const desktopContext = await browser.newContext({
        viewport: { width: 1280, height: 900 },
    });
    const desktopPage = await desktopContext.newPage();
    await desktopPage.goto('http://localhost:5001/?tournament=Testing_Final#/pools/e2eTestPoolA/brackets/e2eBracket1');
    await desktopPage.waitForSelector('.bracketTable tbody tr', { timeout: 15000 });
    await desktopPage.waitForTimeout(2000);

    const desktopTable = desktopPage.locator('.table-responsive').first();
    await desktopTable.screenshot({
        path: '/tmp/bracket-desktop-table.png',
    });
    console.log('Saved: /tmp/bracket-desktop-table.png');

    await browser.close();
})();