# HUSCFFL Website v24

Latest full release, based on v23.4. Upload the package contents to the root of your GitHub Pages repository. All articles, existing media, and the article publishing workflow are retained.

## What's changed

- My Team page now has two responsive tabs: **Overview** (default on the first visit) and **Roster & Analysis**. Tab state is retained within the browser session; changing franchises preserves the tab. The existing site-wide Back to Top button remains available.
- Overview retains franchise identity, championship stars, official league rank, record, new HPI-F power rank, weekly matchup, head-to-head history, recent transactions and team articles.
- Roster & Analysis is arranged broad to specific: offense/defense graph, positional scoring ranks, Roster Needs Analyzer, rostered players, Player Comparison, and Trade Partner Finder. Section-jump links are included.
- Standings adds the HPI-F Franchise Power Rankings section. HPI-F 0–100 is computed at page load from the latest valid league scoring data and NFL-wide player exports. Rating weights: lineup strength 45%, roster depth 25%, season performance 20%, recent form 10%. All lineups are optimized against 20 legal starting slots, including FLEX, Superflex and IDP FLEX. Franchise ranks are independent of official standings.
- HPI-P individual ratings: scoring 40%, positional value over replacement 30%, consistency 15%, recent form 10%, availability/sample reliability 5%. Players are ranked by true primary position; FLEX slots are *not* ranking positions. Positional rank labels on the Players Database are fixed and calculated from the full selected player pool before text and roster-status filters.
- Unified Player Comparison uses colored ownership rows: blue (selected franchise), orange (another franchise), green (available). Supports simultaneous position buttons, different sort metrics, games played and positional ranks.
- Roster Needs Analyzer identifies relative lineup weaknesses by position and displays the independent bench-depth indicator. Trade Partner Finder highlights complementary roster positions and specific players for managers to investigate. It is not a trade-value or trade-fairness calculator.
- Mobile Constitution navigation section links close the navigation menu and deliberately scroll to target anchors. Section XI manager names are shortened to first name + last initial in BOTH the HTML used on the live site and the Markdown source. Historical tables use 50/50 columns with mirrored alignment and responsive padding. No unrelated Constitution wording was changed.
- The stats workflow retains the same daily GitHub Actions schedule, but the exporter tries three historical unofficial Sleeper endpoints, emits useful errors and refuses to overwrite existing output when a feed is incomplete or unavailable.

## Important limitations / first-run requirements

1. **The NFL-wide Sleeper statistics endpoint is unofficial and may return 404.** The replacement URLs are based on historical client implementations but could not be verified live in the build environment. If they all fail, the workflow will fail safely, and existing stats files will not be overwritten.
2. **Do not overwrite newer `data/player-stats-2025.json` or `data/player-stats-2026.json` files** already generated in your repository: none are included in this archive. New analytics need those generated JSON files to display ratings.
3. HPI estimates are models based on past completed games and current roster ownership, not live NFL projections or dynasty market value. Ratings display an unavailable message instead of fabricating values if player stats, complete roster ownership, or complete matchup data are missing.
4. HPI-F rank movement requires saved historical index snapshots, which are not included in this first release; the display does not claim historical movement until snapshots are available.
5. **Browser validation:** JavaScript syntax and a browser smoke test with synthetic rosters/statistics passed. Endpoint availability and live GitHub Pages rendering still require verification after deployment.

## Updating from v23.4

Replace these files with the ones in this archive:

- `index.html`
- `assets/app.js`
- `assets/styles.css`
- `data/constitution.md`
- `data/constitution.html`
- `scripts/build_player_stats.py`

Your existing `.github/workflows/refresh-player-stats.yml` automatically invokes `scripts/build_player_stats.py`; the workflow itself requires no replacement. The complete archive is also suitable for a fresh install. Leave all newer generated player-stat JSON files untouched.

## Calculating the indices

The ratings recalculate in the browser when refreshed stat exports and current franchise rosters are loaded. Static results are not inserted into the HTML at build time. The current status of player exports is therefore essential. Models use historical fantasy scoring, not external dynasty market values.
