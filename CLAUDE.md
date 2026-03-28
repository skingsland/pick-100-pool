# CLAUDE.md

See `README.md` for how to build, test, run, and deploy the app.

## Firebase Access

Firebase data requires authentication. If you need to read production data (e.g. to verify bracket/team state for MarchMadness2026), don't just give up when you get "Permission denied". Ask the user for login credentials. For automated access (Playwright scripts, E2E tests), use the e2e test account: `e2e-tests@pick100pool.com` (ask the user for the password if you don't have it). If you need admin/write access to Firebase, ask the user.

## Picking Algorithm

See [`picking-algorithm.md`](picking-algorithm.md) for the EP-based team selection algorithm (conflict-adjusted expected points + beam search, based on [willmoorefyi/pick100-pool-optimizer](https://github.com/willmoorefyi/pick100-pool-optimizer)).

## Cache Busting

When committing changes to files under `client/`, bump the `?v=N` query parameter on the corresponding `<link>` or `<script>` tag in `client/index.html`. For Angular template partials loaded via `ng-include`, bump the `?version=N` parameter on the template URL. This forces browsers to fetch the new version instead of serving a stale cached copy.

## Verifying UI Changes

**ALWAYS take a Playwright screenshot to verify CSS/layout changes before claiming they work.** Do not rely on reading CSS alone; render it and look at the result with the `Read` tool.

Use `deviceScaleFactor: 2` (or 3 for mobile) so text, colors, and strikethrough are clearly visible. Screenshot specific elements via `page.locator('.selector').screenshot()` rather than full-page screenshots which are too small to read.

## Screenshots with Playwright

Use Playwright to verify layout changes without deploying. See `mobile-screenshots.js` for a working example.

Key points:
- Scripts must live in the project root (not `/tmp`) so `require('playwright')` resolves from `node_modules/`
- Use `isMobile: true` and `deviceScaleFactor: 3` for realistic mobile rendering
- Use `deviceScaleFactor: 2` for desktop screenshots so details are legible
- Common viewports: iPhone SE `375x667`, iPhone 17 Air `393x852`
- Wait for Firebase data to settle: `await page.waitForTimeout(2000)` after selector waits
- Screenshot specific elements via `page.locator('.selector').screenshot()`, save to `/tmp/`, then view with the `Read` tool
- Use `page.evaluate()` to inspect computed column widths, display properties, etc.
- Always take a desktop screenshot (1280px) too to verify no regression

### CSS Pitfalls

- A rule outside a `@media` block that comes AFTER the media block overrides it at the same specificity. Default styles must be defined BEFORE the media query.
- `min-width` on `<th>` is unreliable with `table-layout: auto` when cells are empty; the table algorithm can still collapse the column.
