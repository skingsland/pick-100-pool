# CLAUDE.md

See `README.md` for how to build, test, run, and deploy the app.

## Picking Algorithm

See [`picking-algorithm.md`](picking-algorithm.md) for the EP-based team selection algorithm (conflict-adjusted expected points + beam search, based on [willmoorefyi/pick100-pool-optimizer](https://github.com/willmoorefyi/pick100-pool-optimizer)).

## Cache Busting

When committing changes to files under `client/`, bump the `?v=N` query parameter on the corresponding `<link>` or `<script>` tag in `client/index.html`. For Angular template partials loaded via `ng-include`, bump the `?version=N` parameter on the template URL. This forces browsers to fetch the new version instead of serving a stale cached copy.

## Mobile Screenshots with Playwright

Use Playwright to verify mobile layout changes without deploying. See `mobile-screenshots.js` for a working example.

Key points:
- Scripts must live in the project root (not `/tmp`) so `require('playwright')` resolves from `node_modules/`
- Use `isMobile: true` and `deviceScaleFactor: 3` for realistic rendering
- Common viewports: iPhone SE `375x667`, iPhone 17 Air `393x852`
- Wait for Firebase data to settle: `await page.waitForTimeout(2000)` after selector waits
- Screenshot specific elements via `page.locator('.selector').screenshot()`, save to `/tmp/`, then view with the `Read` tool
- Use `page.evaluate()` to inspect computed column widths, display properties, etc.
- Always take a desktop screenshot (1280px) too to verify no regression

### CSS Pitfalls

- A rule outside a `@media` block that comes AFTER the media block overrides it at the same specificity. Default styles must be defined BEFORE the media query.
- `min-width` on `<th>` is unreliable with `table-layout: auto` when cells are empty; the table algorithm can still collapse the column.
