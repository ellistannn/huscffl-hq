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
