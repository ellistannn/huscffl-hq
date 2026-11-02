# HUSCFFL League Headquarters — GitHub Pages

A responsive, static fantasy football league website with team filtering, individual franchise dashboards, current-season head-to-head results, standings from Sleeper, and Markdown recaps and previews.

## 1. Install on GitHub Pages

1. Create a **public** GitHub repository, e.g. `huscffl-hq`.
2. Upload **the contents of `huscffl-site/`** into the repository root. Keep the hidden `.github/workflows/` folder. If you use GitHub's web upload interface, ensure that folder and workflow actually arrive; if not, create `.github/workflows/publish-articles.yml` in the repository using GitHub's Add file menu or push all files using Git.
3. Under **Settings → Pages**, select **Deploy from a branch**, branch `main`, folder `/(root)`.
4. Under **Settings → Actions → General → Workflow permissions**, enable **Read and write permissions**, if your repository allows it, so the publication workflow can commit `data/stories.json`.
5. Confirm the `Publish HUSCFFL articles` workflow is enabled under **Actions**. Its run history will show errors if any article has invalid metadata.
6. Open `https://YOUR-USERNAME.github.io/huscffl-hq/` after deployment. Publishing may take a short while after a commit.

**Note:** Repository branch protection or organization policies might prevent an automatic commit. In that case, use the local fallback in Section 3 and commit the generated `data/stories.json` yourself.

## 2. Publish a ChatGPT-generated recap (normal workflow)

When you ask ChatGPT for a recap or preview, ask for a **HUSCFFL website-ready Markdown (.md) article**, with the metadata format shown below. ChatGPT can supply a downloadable `.md` file. You review it before publication.

1. In your GitHub repository, open the `articles/` folder.
2. Select **Add file → Upload files**, select the Markdown file, and commit to `main`. Alternatively use **Add file → Create new file** and paste the provided content.
3. In **Actions**, check the `Publish HUSCFFL articles` run. It compiles Markdown into the site's `data/stories.json` automatically and commits the update. GitHub Pages then publishes it.
4. To edit a published article, edit its `articles/<name>.md` file and commit. To remove one, delete its `.md` file and commit. There is **no need to hand-edit JSON**.

Give each article a unique `id` and filename. `id` becomes the permanent shareable link (`?article=...`).

### Article format

Use `examples/ARTICLE-TEMPLATE.md` as a model:

```md
---
id: 2026-week-8-recap
season: 2026
week: 8
type: recap
title: Week 8 — Around the League
summary: A short description of the week's biggest storylines.
date: 2026-11-03
teams: all
---

# The Week in Review

Your article text here. **Bold emphasis** and *italics* are supported.

## Key Matchup

- One big performance
- Another headline
```

Supported types: `recap`, `preview`, `feature`. Team tags must be exactly the IDs from `data/config.json`, comma-separated (e.g. `teams: new-york-noodles, tampa-bay-tyranny`). For a general weekly league recap use `teams: all`; it appears in every team's filtered archive. For a team-specific preview, tag the relevant teams. A date must be in `YYYY-MM-DD` format. Use lowercase kebab-case for `id`.

The article body supports paragraphs, `#`–`####` headings, **bold**, *italics*, lists using `-`, blockquotes, horizontal rules, inline code, and HTTP(S) links. It does not support raw HTML or Markdown tables; raw HTML is escaped for safety. The compilation system requires only Python's standard library.

The `articles/welcome-to-huscffl-hq.md` article is an explicitly marked placeholder. Delete or replace it when ready.

## 3. Local fallback / test build

If GitHub Actions is unavailable, or you want to preview a large set of articles locally:

```bash
python3 scripts/build_articles.py
python3 -m http.server 8000
```

Visit `http://localhost:8000`, and commit the updated `data/stories.json` together with the `.md` files. The generated JSON is an output file; treat Markdown as the single source of truth. Invalid metadata exits with an error showing the filename and problem. The site does **not** compile Markdown in the browser.

## 4. Sleeper statistics and head-to-head records

`data/config.json` contains the league ID `1309685082163810304`. **Verify this is the correct current-season Sleeper league ID**, as renewed leagues use new IDs. No API key is needed for public league endpoints.

The website automatically loads standings, team W–L–T, PF/PA, and calculates team-vs-team records from Sleeper's completed weekly matchup data. The head-to-head table covers the **configured season only**, not historical seasons. It includes all completed regular-season and postseason head-to-head matches that Sleeper exposes; current/in-progress weeks are excluded. If some matchup requests fail, the page warns that stats may be incomplete.

**Critical:** Map your franchise names to the right Sleeper roster IDs in `data/config.json` when they don't match Sleeper team names exactly:

```json
"rosterOverrides": {
  "new-york-noodles": 3,
  "utah-yetis": 7
}
```

These numeric IDs are **examples only**. Look up the actual IDs at `https://api.sleeper.app/v1/league/1309685082163810304/rosters` and match roster `owner_id` against `https://api.sleeper.app/v1/league/1309685082163810304/users`. The site intentionally does not guess at ambiguous mappings.

## 5. Filters and links

- League coverage: `?view=archive`
- My team: `?team=new-york-noodles`
- Specific team and week: `?view=archive&team=utah-yetis&week=8`
- Direct article: `?article=2026-week-8-recap`

The team selector filters articles and shows that franchise's dashboard with current-season head-to-head records against each of the other nine teams.

## Current limitations

- Only **real** articles supplied in the `articles/` folder are published; the welcome post is a placeholder.
- Public Sleeper league endpoints must be accessible for live standings and H2H stats; article browsing works independently.
- No all-time multi-season H2H, automated ChatGPT authoring, private admin interface, in-browser publishing, Markdown tables, or player-by-player roster details yet.
- Github Pages is static/public. Do not commit passwords, tokens, private information, or drafts you don't want visible.

Official references: https://docs.sleeper.com/ and https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

## Head-to-head history (2025–present)

The team dashboard's **Head-to-head records** section now has an **All-Time / 2025 / 2026** selector. It fetches completed Sleeper matchups from both seasons (IDs in `data/config.json`, under `leagueIds`). All-Time combines both seasons, including playoffs.

**Important:** Franchise identification is initially based on team names and manager IDs. If the same franchise changed its name or manager between seasons, 2025 records may be incomplete. Add mappings under `historicalRosterOverrides` in `data/config.json` (e.g. `"2025": {"new-york-noodles": 3}`), where `3` is the **2025** roster ID. Set `rosterOverrides` similarly for the active season. The site flags missing mappings rather than attributing matches to the wrong franchise.

The 2025 data is retrieved in the browser when you load the published site; this package does **not** include a pre-verified archival snapshot of the actual results.


## Branding and transactions (v5)

- `assets/huscffl-logo.png` contains the official transparent HUSCFFL shield, displayed in the header and hero. `assets/favicon.png` is used for the browser icon.
- Brand colors are rose, coral, cream, and deep plum; adjust `assets/styles.css` if needed.
- **Transactions** is a new navigation tab. The page queries Sleeper's league `/transactions/{week}` endpoints for both configured seasons, filtering completed transactions and refreshing automatically every five minutes while the page is open. The feed also appears on each mapped team dashboard.
- The site does not use a server, authentication, or GitHub Actions for transaction polling; it requests data directly from Sleeper. New moves become visible when Sleeper exposes them and the browser next refreshes; it is **not** a push-notification feed.
- Team transaction mapping uses franchise name first, owner ID second, and the manual overrides in `data/config.json` when provided. Verify these associations for historical franchise name/ownership changes.
- Player IDs appear as numeric Sleeper IDs when no name catalog has been supplied; the tracker intentionally does not invent names. Draft-pick details are abbreviated.
- The requested logo has not been modified; it is included as provided.

## v6: Player names and home transaction bulletin

The transaction tracker retrieves Sleeper's NFL player dictionary (a multi-megabyte response) only when a transaction player has no saved name. The browser caches the names of relevant players and throttles successful dictionary downloads to once per 24 hours. If Sleeper cannot be reached, the tracker temporarily displays `Player <id>`. The homepage shows the five most recent completed 2026 transactions, respecting the global team selector, with a link to the full tracker. Transactions refresh every five minutes while the site is open.

The cache is browser-local, not a shared server-side database. For consistently fast first loads, a later enhancement could generate a small names JSON file with GitHub Actions.

## v8: Homepage layout and masthead

The masthead displays **HIGH UP SOCIAL CLUB** on its first line and **FANTASY FOOTBALL LEAGUE** on the second, beside the shield. The homepage now shows all ten teams in the standings beside five latest transactions on desktop. Panels stack on narrow screens; standings can scroll horizontally. Live standings require Sleeper access.

## Homepage team filter behavior (v9)

The league-wide standings and recent-transactions two-column summary is visible only when the global team filter is **All teams**. Selecting a specific franchise hides this league summary while retaining its team-specific recent transactions in My Team. Clicking a team tile opens My Team rather than a filtered homepage. Reset the team filter to All teams to restore the league-wide panels.

## Historical 2025 data and season lengths (v10)

- The 2025 league ID is `1246023611291029504`; 2026 is `1309685082163810304`.
- 2025 includes **weeks 1–16**; 2026 includes **weeks 1–17**, defined in `data/config.json` under `seasonWeeks`.
- The **Standings** page now has a season selector to show 2025 or 2026. The homepage standings remain current season (2026).
- Head-to-head history includes both seasons with its existing All-Time/2025/2026 selector; Transactions can show both seasons with its season selector.
- Historical results are **requested live from Sleeper when the page is opened**; no 2025 scores have been fabricated or embedded. Sleeper access is required, and any renamed or transferred franchises may need `historicalRosterOverrides`.
- The weekly recap archive only displays articles you upload; 2025 recap articles have not been generated automatically.


## Week 7 (2026) editorial package

This version contains six verified Week 7 recaps based on the user's `week_7_facts(4).json` export: one league-wide roundup (`teams: all`) and five individual matchup stories (each tagged to exactly the two opposing franchises). Selecting a team shows the league roundup plus that team's matchup recap. The full archive shows all six. Each article is editable at `articles/2026-week-7-*.md`. Run `python scripts/build_articles.py` after editing to regenerate `data/stories.json`. Scores and statistics reflect the source export; later Sleeper stat corrections may change them.


## v12 updates
- Header includes TEP: **Dynasty • Superflex • TEP • IDP**.
- Main coverage toolbar has a season selector, so 2025 shows weeks 1–16 and 2026 shows weeks 1–17. Article filtering is season-aware.
- Team dashboards have a separate 2025/2026 selector for record, league rank, PF, PA and Max PF; head-to-head history remains separately selectable. Historical data depends on correct franchise mapping.
- Standings tables, including all ten home-page teams, include Sleeper Max PF (roster settings `ppts` + `ppts_decimal`). If Sleeper has not provided potential points, the API may show zero.
- Homepage displays five compact transactions; full transaction details remain in Transactions. Desktop: standings left / transactions right; mobile: standings then transactions.
- Constitution page reads `data/constitution.md`. Replace the placeholder there with approved rules and commit the file. Do not remove `data/constitution.md`.


## v13: Full Standings Max PF visibility
- The full Standings view now has a dedicated horizontally scrollable table. The rightmost **Max PF** column is always present in the rendered table, even on smaller screens.
- Versioned CSS/JS URLs help prevent GitHub Pages and browser caches from retaining the old standings renderer.
- If updated code is deployed but numbers show 0.00, verify Sleeper's `ppts` and `ppts_decimal` roster settings for that league season.


## Team logos

This version includes locally hosted franchise logos for all 10 teams under `assets/team-logos/`. They are used in standings, team dashboards, coverage cards, articles, and transactions so branding stays consistent across seasons.


## Matchup article hero

Two-team recap and preview articles now render a prominent versus-style hero at the top of the article with both franchise logos and names. League-wide or multi-team stories keep the standard article header.

## Version 16 updates
- Fixed navigation by defining the missing `change()` action.
- Up to nine latest articles on the homepage.
- Clickable sorting (rank, name, PF, PA, Max PF) on homepage and full standings; W and L remain visible but not sortable. Original league rank is retained.
- 2025 champion trophy overlay on New York Noodles' logo across the site; original image unchanged.

## v17 scoring additions

The My Team page uses the global season/week filters for a season offense/defense line graph or a selected weekly performance report. The new Scoring Statistics navigation page compares all ten teams by total, offensive, defensive, and average points for 2025/2026. Data is calculated in the browser from Sleeper's completed weekly matchup starting lineups; current/future weeks are excluded. Missing or unmapped data remains visibly unavailable. The website requires network access to Sleeper for live scoring. To publish, upload the extracted files to the root of the GitHub Pages repository while preserving custom content.

## v18 update
- Reworked trade summaries to show each franchise's received players and traded picks, with multi-franchise support.
- URL navigation clears selected team when leaving My Team.
- Scoring comparison now has standings rank sorting and Standings-style clickable team names/logos.
- Added a weekly offense/defense scatter comparison with league-average reference lines and selectable team.
- Added My Team league rankings for offense, defense and total scoring.
- Weekly graph hover labels include two decimal places.
- Updated six Week 7 articles and included seven Week 8 previews/features.

### Scatter plot hover labels
The Offense vs. Defense scatter plot shows a prominent tooltip containing the franchise name, average offense, and average defense on pointer hover or keyboard focus. Clicking or tapping a point continues to highlight the team.


## v19 release notes
- Team-logo markers on scoring scatter plot; hover/focus tooltips and click/tap selection preserved.
- Trophy badge moved to overlap the lower-right corner of the New York Noodles team logo.
- Global toolbar hidden from Standings, Scoring Statistics, Transactions and Constitution; their page-specific controls remain.
- Matchup of the Week is a Feature rather than a Preview.
- My Team order: weekly scoring/matchup, head-to-head, league scoring comparison, recent transactions.
- Recent transactions link to a team-prefiltered full Transactions page.
- Footer includes a link to Sleeper.
- Player ID resolution uses a daily generated player-name directory, with live fallback.
- GitHub Actions workflow `refresh-player-names.yml` must be enabled and granted contents:write.

## v20 changes
- My Team: QB/RB/WR/TE/DL/LB/DB starter-only positional contribution rankings, including flex position attribution from the daily Sleeper player directory. Rankings include points per completed week and totals.
- My Team: three most recent tagged articles at the bottom of the dashboard, with a link to the team-filtered archive.
- Floating sitewide Back to Top button (scroll threshold 500px; respects reduced-motion setting).
- After deployment, run **Refresh Sleeper player names** workflow to generate `data/player-names.json` with positions; until then flex players may not be properly attributed.

## v20.1 patch
Fixed positional-ranking metric dropdown becoming unresponsive after the first change. The event handler is now reattached after each render.

## v21: Player Database & top players

A new **Players** navigation tab provides searchable NFL-wide position, team and availability filters, separate season selection, any combination of individual week checkboxes, and cumulative or average points. FLEX / Superflex / IDP FLEX are eligibility-group filters, not extra positions. Rankings are calculated among all eligible NFL players, based on the selected weeks and metric. **My Team > Top Players by Position** uses the same week and metric selection as the Players tab; it also includes bench players.

**Required first-run step:** Open GitHub → Actions → **Refresh NFL-wide fantasy player statistics** → Run workflow. The workflow downloads the NFL player directory, league scoring settings and weekly raw player statistics, generating `data/player-stats-2025.json` and `data/player-stats-2026.json`. This endpoint is undocumented, so it can fail or change. If it fails, the website reports data unavailable rather than claiming points are correct. Check Actions logs and verify a sample of scores in Sleeper before relying on the rankings. The workflow reruns daily. Set Actions workflow permissions to Read and write if the commit is rejected.

Player ownership comes from the selected season's Sleeper rosters; if franchise mapping cannot be identified, it displays roster ID rather than guessing. In 2025 renamed franchises may need historical overrides. Historical roster status represents the latest roster in that season rather than week-specific historical ownership. Raw weekly stat feed is used to calculate custom fantasy points; unusual bonus/conditional scoring may require validation against Sleeper totals. Games played is inferred from game stats and may be imperfect for 0-stat appearances. No fabricated NFL player scores are bundled in this ZIP.


## v22 updates
- Available (unrostered) NFL players have pale green rows in the Player Database, including in filtered/paginated views.
- My Team → Rostered Players by Position now shows all rostered players with scoring data at each position rather than only three; this uses the current league roster (including IR and taxi) even when viewing prior-season scores.
- Replaces Tampa Bay Tyranny's logo with the new uploaded image.
- Note: Players absent from the exported NFL scoring dataset are not shown in the scoring rankings; their roster ownership remains available via Sleeper.


## v22.1 filter update
Players and My Team roster lists have compact, checkbox-based dropdowns for seasons, scoring weeks, and positions. The Players page also supports selecting multiple franchises. Empty position/team selections mean all. At least one season is required. Combined season scoring sums the selected calendar-numbered weeks in each chosen season; average is based on total games played. Ownership and Available status refer to the latest selected season, not historical ownership. The two 2025/2026 stats JSON exports must already exist in `data/` on GitHub Pages.


## v22.2 fixes
- Reconcile roster ownership when rosters, current franchise mappings or historical mappings load in any order.
- Reset scroll position when selecting a team or navigating between sections/articles; filter adjustments preserve scroll position.
- Add positional scoring comparison of all ten teams on the Scoring Statistics page using starting lineup points by actual position.

- 2026 roster-ID overrides populated from the supplied Week 7 facts export; verify if franchises change ownership.
