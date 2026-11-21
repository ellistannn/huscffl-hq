# HUSCFFL Week 11 Editorial Release

Base: Week 10 Power Rankings safeguarded ZIP, retaining original v24.2 Power Rankings application and rank-history workflow.

Added 6 Markdown articles (1 rivalry roundup and 5 individual matchup previews); rebuilt stories.json (44 total). Added week11_preview_snapshot.json and chart compiler logic.

All Week 11 bye exposure values reflect Week 10 STARTERS ONLY, not final Week 11 lineup submissions. NFL news as of Nov 20, 2026. No forecast values are claimed.

Do not remove live-generated data/player-stats-2026.json or data/rank-history.json during upload. The archive intentionally omits both. Upload/merge the archive contents without deleting files already in the GitHub repository.

This is an editorial update; the base website ranking computation is unchanged. Check Power Rankings with the live generated player-stats file after deployment.
\n### Article archive filter correction\n- League-wide roundups/previews tagged `all` display when All teams is selected, not under every individual franchise.\n- Specific matchup previews/recaps appear when either participating franchise is selected.\n- Article type (`recap`, `preview`, `feature`) persists in query-string navigation and refresh.\n- Verified 44 articles and Week 10/11 franchise filters with `node scripts/test_article_filters.js`.\n