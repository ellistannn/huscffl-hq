# HUSCFFL League Headquarters

A free, mobile-friendly fantasy football league website for **GitHub Pages**. No build step, paid hosting, API key, or framework required.

## Publish the website

1. Create a **public** GitHub repository named `huscffl-hq` (or another name).
2. Upload **the contents of this folder** to the root of the repository. Be sure `index.html`, `assets/`, and `data/` are at the top level.
3. Go to **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, branch **main**, folder **/(root)**, then **Save**.
4. Visit `https://YOUR-GITHUB-USERNAME.github.io/huscffl-hq/` once GitHub reports deployment. You can also use a custom domain later.

## Content management

Edit `data/stories.json` to create and publish an article. Each article is a JSON object within the array, for example:

```json
{
  "id": "week-8-recap",
  "season": 2026,
  "week": 8,
  "type": "recap",
  "title": "Week 8 Recap: A New Contender Emerges",
  "summary": "The key storylines from Week 8.",
  "date": "2026-11-03",
  "teams": ["new-york-noodles", "utah-yetis"],
  "paragraphs": [
    "The opening paragraph goes here.",
    "Add each additional paragraph as a new string."
  ]
}
```

Separate adjacent article objects with commas. Valid types are `recap`, `preview`, and `feature`. Use the special team ID `all` for league-wide articles. For articles concerning multiple teams, add all relevant team IDs; **otherwise the article will not appear under those teams' filters**. JSON validation is required; invalid JSON will prevent the site from loading.

## Connect Sleeper data

In `data/config.json`, `leagueId` is prefilled with the known HUSCFFL ID `1309685082163810304`. Confirm this is the **current-season** league ID; Sleeper may assign a new ID on renewal.

The site automatically loads league users and rosters from Sleeper for standings, team records, PF and PA. It tries to match each roster's Sleeper team name with the team names in `data/config.json`.

**Important:** If a team's public Sleeper name differs from the configured site name, add an explicit entry to `rosterOverrides`:

```json
"rosterOverrides": {
  "new-york-noodles": 3,
  "utah-yetis": 7
}
```

Numbers above are **examples, not real IDs**. Find the real `roster_id` for each franchise from `https://api.sleeper.app/v1/league/YOUR_LEAGUE_ID/rosters`, then match each roster's `owner_id` with a user in `https://api.sleeper.app/v1/league/YOUR_LEAGUE_ID/users`. This avoids silently attributing incorrect records to a team.

When Sleeper is temporarily unavailable, the site still shows all published stories, and unavailable numeric stats show dashes.

## Team and article links

- All teams: `?view=teams`
- A specific team: `?team=new-york-noodles`
- An archive filtered by team and week: `?view=archive&team=utah-yetis&week=8`
- Direct article link: `?article=week-8-recap`

Filters and articles can be bookmarked and shared.

## Current scope and next enhancements

- Included: responsive design, article archive, week/team/content-type filters, personalized franchise panels, live Sleeper standings, records and PF/PA, standalone article pages, shareable URLs.
- Not included yet: automatic generation or publishing of articles, player-name mapping for starting lineups, Max PF, historical charts, complete weekly scoreboards, detailed roster pages, all-time league history, or a publishing admin form.
- This is static public hosting: **do not store secrets or private information in the repository**.
- The included welcome article is explicitly placeholder content, not a real game recap.

## Preview locally

Run `python3 -m http.server 8000` from this directory, then open `http://localhost:8000`. Opening `index.html` directly via `file://` will not reliably load the JSON files.

## Reference

- Sleeper official API: https://docs.sleeper.com/
- GitHub Pages publishing: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
