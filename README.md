# HUSCFFL Website v24.1

Incremental release based on v24. Upload the package contents to the root of your GitHub Pages repository. All articles, existing media, and the article publishing workflow are retained.

## Changes in v24.1

- Franchise Power Rankings team cells now match the League Standings logo/name formatting, including linked team names that open the selected franchise on My Team.
- Added 0–100 **Season Scoring** and **Last 3 Weeks** component grades alongside Lineup and Depth, using the same components already included in HPI-F. No weighting or rating calculations changed.
- Expanded power-ranking table scrolls horizontally on narrower screens.

### Updating from v24

Replace `index.html`, `assets/app.js`, and `assets/styles.css`. Leave generated player stats, articles, and GitHub Actions files unchanged.

## Existing v24 features

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

## v24.2 — Weekly standings movement

- On Standings, the League Standings and Franchise Power Rankings tables show a compact `▲2`, `▼1`, or `—` beside each numerical rank. Green indicates a climb and red a drop.
- `N/A` means a prior verified completed-week snapshot is not available, the latest snapshot does not match the currently displayed week, or the scoring data cannot be verified.
- New `data/rank-history.json` holds permanent season/week ranking snapshots. The initial file is empty by design; do **not** invent prior weeks' HPI-F ranks based on today's roster.
- A new GitHub Actions workflow `.github/workflows/refresh-rank-history.yml` runs after the **successful** player-statistics export workflow and can be run manually. It executes `scripts/build_rank_history.js`, compares official standings with matchup history, and uses the site's exact HPI-F formulas to record the current completed week's power ranks.
- Previous League Standings ranks can be reconstructed from completed weekly Sleeper matchup records. HPI-F ranks need at least **two successful weekly captures** before movement can appear, because old rosters and HPI-F snapshots weren't previously preserved.
- This workflow does not install dependencies beyond Node.js 22. It fails without modifying the rank history if the player export is missing/incomplete, the Sleeper API is unavailable, roster mapping doesn't match, or the ratings cannot be calculated.
- If `scripts/build_player_stats.py` continues failing to fetch the unofficial NFL-wide stats feed, rank snapshot automation will not run. Fix/verify that export first.

### Minimal upgrade from v24.1
Replace `assets/app.js`, `assets/styles.css` and `README.md` (optional), and **add** `data/rank-history.json`, `scripts/build_rank_history.js`, `.github/workflows/refresh-rank-history.yml`. Keep your newer `player-stats-*.json` files and articles. The new workflow requires GitHub Actions **Read and write permissions** for repository contents.


## v24.3 — Playoff cutoff and confirmed postseason berths

- Home and League Standings visually distinguish current seeds 1–6 (playoff zone) and 7–10 (Toilet Bowl zone), with a subtle line at the sixth/seventh-place cutoff when the table is sorted in standings order. These zone accents **are not clinch markers**.
- The Franchise Power Rankings table uses each franchise's **official standings position** for zone colors and clinch indicators, never HPI-F rank.
- My Team Overview shows a postseason badge only when one of three outcomes has been mathematically proved: **Clinched Bye** (top two), **Clinched Playoffs** (top six), **Clinched Toilet Bowl** (bottom four). A bye replaces, rather than duplicates, the playoff marker.
- Clinch logic uses verified live ten-team standings and the 14-game regular season (Weeks 1–14). Before Week 14 ends, it uses conservative win-equivalent lower/upper bounds and assumes all ties/tiebreaks go against a franchise, so **some true clinches may not yet be displayed**. This avoids unsupported badges. When all 14 games are complete, official standing positions determine badges.
- No changes to HPI-F scoring, ranking-history workflow, official standings ordering, articles, or Constitution.

### Minimal upgrade from v24.2

**Replace ONLY** `index.html`, `assets/app.js`, and `assets/styles.css`. The full ZIP also contains static historical files from the v24.2 baseline, including an empty initial `data/rank-history.json`. **Do not replace your live `data/rank-history.json`, generated `data/player-stats-*.json`, or newly published stories with older copies from this ZIP.** If your GitHub repository contains a more recent history snapshot, preserve it.


## v24.3.1 corrective upgrade

Deploy only `index.html`, `assets/app.js`, and `assets/styles.css` to an existing v24.3 repository. Do not overwrite the live `data/rank-history.json`, generated player statistics, articles, or workflows.

The playoff (1–6) and Toilet Bowl (7–10) zones now shade entire standings rows rather than only the Rank cells. The top of official seed 7 has a clearer cutoff line. The zone for each team in the HPI-F table is based on official standings, not its power rank. No badge is shown for unclinched teams. Clinching uses individual games played, allowing unequal games completed during the current week; the test is intentionally conservative about unknown tiebreaks or unmodeled future fixtures, and may omit some truly clinched teams until final standings. No data or ranking formulas are modified.
