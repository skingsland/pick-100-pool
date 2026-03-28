# CLAUDE.md

## Project Overview

AngularJS + Firebase March Madness bracket pool app. Static client files served from `client/`, with an Express backend (`web.js`) for score fetching.

## Development

### Local Server

```
npx http-server client -p 5001 -s
```

Then visit `http://localhost:5001`. No backend needed for UI work.

### Test Tournaments

Append `?tournament=<name>` to load test data (set up via `node e2e/fixtures/setup-scenario-tournaments.js`):

- `Testing_PreTourney` ; before tournament starts (no scores, no ceiling)
- `Testing_Day1` ; day 1, no games played yet
- `Testing` ; after Round 2 (mid-tournament)
- `Testing_Round5` ; after Round 5 (near end)
- `Testing_Final` ; tournament complete (all rounds scored)
- `Testing_2025` ; 2025 tournament data

Example: `http://localhost:5001/?tournament=Testing_Final#/pools/e2eTestPoolA`

Direct bracket view: `http://localhost:5001/?tournament=Testing_Final#/pools/e2eTestPoolA/brackets/e2eBracket1`

### E2E Tests

```
npx playwright test
```

Requires `E2E_TEST_PASSWORD` env var (see `.env.example`).

## Taking Mobile Screenshots with Playwright

Use Playwright to take screenshots at mobile viewport sizes. This is the reliable way to verify mobile layout changes without deploying.

### Prerequisites

1. Start the local server: `npx http-server client -p 5001 -s &`
2. Playwright and Chromium are already installed as project dependencies

### Process

1. Write a Playwright script (must live in the project root so `require('playwright')` resolves from `node_modules`; scripts in `/tmp` won't find the module).

2. Create a browser context with mobile viewport settings:
   - iPhone SE: `{ width: 375, height: 667 }`
   - iPhone 17 Air: `{ width: 393, height: 852 }`
   - Set `deviceScaleFactor: 3` and `isMobile: true` for realistic rendering

3. Navigate to a test tournament URL, wait for data to load:
   - Wait for `.bracketTable tbody tr` (or whatever dynamic content) with a timeout
   - Add `page.waitForTimeout(2000)` after the selector wait to let Firebase data settle

4. Screenshot specific elements (preferred over full-page for reviewing components):
   ```
   const table = page.locator('.table-responsive').first();
   await table.screenshot({ path: '/tmp/bracket-mobile.png' });
   ```

5. Save screenshots to `/tmp/` and view them with the `Read` tool (which renders images).

6. To debug column widths or computed styles, use `page.evaluate()`:
   ```
   const dims = await page.evaluate(() => {
       const ths = [...document.querySelectorAll('.bracketTable thead th')];
       return ths.map(th => ({
           text: th.textContent.trim().split('\n')[0],
           width: th.offsetWidth,
           display: window.getComputedStyle(th).display,
       }));
   });
   ```

### Common Pitfalls

- Scripts MUST run from the project root. Playwright's `require('playwright')` resolves via `node_modules/`.
- CSS rule ordering matters: a rule outside a `@media` block that comes AFTER the media block will override it at the same specificity. Default styles must be defined BEFORE the media query.
- `table-layout: fixed` gives predictable column widths but looks unnatural; prefer `table-layout: auto` with `min-width`/`max-width` constraints.
- `min-width` on `<th>` is unreliable with auto table layout when cells are empty; the table algorithm can still collapse the column. Use `table-layout: fixed` only if you need guaranteed minimum widths.
- Take a desktop screenshot too (1280px viewport) to verify no regression.

### Example Script

See `mobile-screenshots.js` in the project root.
