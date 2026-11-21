#!/usr/bin/env python3
"""Compile user-authored articles/*.md to data/stories.json (standard library only)."""
from pathlib import Path
import json, re, html, datetime

ROOT = Path(__file__).resolve().parents[1]
TEAMS = {t['id'] for t in json.loads((ROOT/'data/config.json').read_text())['teams']}
ALLOWED_TYPES = {'recap', 'preview', 'feature'}

def inline(text):
    s = html.escape(text)
    s = re.sub(r'\[([^\]]+)\]\((https?://[^\s)]+)\)', lambda m: f'<a href="{html.escape(m.group(2), quote=True)}" rel="noopener noreferrer">{m.group(1)}</a>', s)
    s = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', s)
    s = re.sub(r'(?<!\*)\*([^*\n]+)\*(?!\*)', r'<em>\1</em>', s)
    s = re.sub(r'`([^`\n]+)`', r'<code>\1</code>', s)
    return s


WEEK10_STATS = json.loads((ROOT/'data/week10_preview_visuals.json').read_text(encoding='utf-8'))

def week10_chart_html(team_a, team_b):
    """Responsive, accessible historical charts using only validated export data."""
    a, b = WEEK10_STATS[team_a], WEEK10_STATS[team_b]
    tnames = [a['name'], b['name']]
    def bars(entries, maxvalue, kind):
        result = []
        for idx, (label, value) in enumerate(entries):
            width = max(0, min(100, 100 * float(value) / maxvalue))
            cls = "w10-team-a" if idx == 0 else "w10-team-b"
            result.append(
                f'<div class="w10-barrow"><span class="w10-barname">{html.escape(label)}</span>'
                f'<span class="w10-bartrack"><span class="w10-barfill {cls}" style="width:{width:.2f}%"></span></span>'
                f'<strong class="w10-barvalue">{value:.2f}</strong></div>'
            )
        return ''.join(result)
    trend = []
    for week in (7, 8, 9):
        trend.append(f'<div class="w10-subhead">Week {week}</div>')
        trend.append(bars([(tnames[0], a['weekly'][str(week)]), (tnames[1], b['weekly'][str(week)])], 360, 'trend'))
    splits = []
    for label, metric in (("Offensive starters", "offense"), ("Defensive starters", "defense")):
        splits.append(f'<div class="w10-subhead">{label}</div>')
        splits.append(bars([(tnames[0], a[metric]), (tnames[1], b[metric])], 200, metric))
    return (
        '<section class="w10-visuals" aria-label="Week 10 matchup historical scoring visualizations">'
        '<div class="w10-chart"><h4>Recent Scoring Form</h4>'
        '<p class="w10-chart-caption">Fantasy points scored in Weeks 7–9</p>'
        + ''.join(trend) + '</div>'
        '<div class="w10-chart"><h4>Week 9: Offense vs. Defense</h4>'
        '<p class="w10-chart-caption">Points from the 10 offensive and 10 defensive starters</p>'
        + ''.join(splits) + '</div>'
        '<p class="w10-footnote">Historical results only; these are not Week 10 projections.</p>'
        '</section>'
    )


WEEK10_RECAP = json.loads((ROOT/'data/week10_recap_scoring.json').read_text(encoding='utf-8'))

def week10_recap_chart(which):
    items = WEEK10_RECAP
    title = 'WEEK 10 · ALL-TEAM SCORING'
    field = 'score'
    if which == 'offense':
        items = sorted(items, key=lambda x:-x['offense'])[:3]
        field = 'offense'; title = 'WEEK 10 · TOP 3 OFFENSES'
    elif which == 'defense':
        items = sorted(items, key=lambda x:-x['defense'])[:3]
        field = 'defense'; title = 'WEEK 10 · TOP 3 DEFENSES'
    elif which.startswith('matchup:'):
        ident = which[8:]
        pair = {
            '2026-week-10-okc-utah': ('Good Things We OKC!','Utah Yetis'),
            '2026-week-10-noodles-dallas': ('New York Noodles','Dalla Dalla Dallas'),
            '2026-week-10-bunniez-hou': ('NJz Bunniez','HOU You Like That'),
            '2026-week-10-tampa-lalalala': ('Tampa Bay Tyranny','LALALALA'),
            '2026-week-10-seattle-daebak': ('Seattle Supersonics','District of Daebak')
        }.get(ident)
        if pair is None: raise ValueError('Invalid matchup chart '+ident)
        items = [x for n in pair for x in WEEK10_RECAP if x['name']==n]
        title = 'WEEK 10 · MATCHUP SCORING'
    elif which != 'overall':
        raise ValueError('Invalid Week 10 chart '+which)
    maximum = max(x[field] for x in items) * 1.05
    graph = [f'<div class="wk9-chart" role="img" aria-label="{html.escape(title)}"><div class="wk9-chart-title">{html.escape(title)}</div>']
    for item in items:
        v = item[field]
        graph.append(f'<div class="wk9-chart-row"><span class="wk9-chart-name">{html.escape(item["name"])}</span><span class="wk9-chart-track"><span class="wk9-chart-fill" style="width:{100*v/maximum:.2f}%"></span></span><strong class="wk9-chart-value">{v:.2f}</strong></div>')
    graph.append('</div>')
    if which.startswith('matchup:'):
        graph.append('<p><strong>Where the points came from:</strong> Week 10 starting offense and defense.</p>')
        for metric,label in (('offense','OFFENSE'),('defense','DEFENSE')):
            graph.append(f'<div class="wk9-chart"><div class="wk9-chart-title">{label}</div>')
            limit=max(x[metric] for x in items)*1.05
            for item in items:
                v=item[metric]
                graph.append(f'<div class="wk9-chart-row"><span class="wk9-chart-name">{html.escape(item["name"])}</span><span class="wk9-chart-track"><span class="wk9-chart-fill" style="width:{100*v/limit:.2f}%"></span></span><strong class="wk9-chart-value">{v:.2f}</strong></div>')
            graph.append('</div>')
    return ''.join(graph)


WEEK11_PREVIEW = json.loads((ROOT/'data/week11_preview_snapshot.json').read_text(encoding='utf-8'))
WEEK11_MATCHUPS = {
    'noodles-daebak': ('New York Noodles 🍜', 'District of Daebak'),
    'tyranny-seattle': ('Tampa Bay Tyranny ☠️', 'Seattle Supersonics'),
    'hou-lalalala': ('HOU You Like That', 'LALALALA 🍒'),
    'okc-dallas': ('Good Things We OKC!', 'Dalla Dalla Dallas'),
    'bunniez-utah': ('NJz Bunniez', 'Utah Yetis'),
}

def week11_bars(title, rows, ceiling):
    parts=[f'<div class="wk9-chart" role="img" aria-label="{html.escape(title,quote=True)}"><div class="wk9-chart-title">{html.escape(title)}</div>']
    for name, value in rows:
        pct=max(0,min(100,100*value/ceiling))
        parts.append(f'<div class="wk9-chart-row"><span class="wk9-chart-name">{html.escape(name)}</span><span class="wk9-chart-track"><span class="wk9-chart-fill" style="width:{pct:.2f}%"></span></span><strong class="wk9-chart-value">{value:.2f}</strong></div>')
    parts.append('</div>');return ''.join(parts)

def week11_compare(key):
    a,b=WEEK11_MATCHUPS[key]; A,B=WEEK11_PREVIEW[a],WEEK11_PREVIEW[b]
    recent=[]
    for week in [8,9,10]:
        for x in [A,B]:
            v=next(v['points'] for v in x['recent'] if v['week']==week)
            recent.append((f"W{week} · {x['name']}",v))
    out=['<section aria-label="Week 11 preview historical scoring charts">',week11_bars('WEEKS 8–10 · SCORING FORM',recent,340)]
    out.append(week11_bars('WEEK 10 · OFFENSE',[(x['name'],x['offense']) for x in [A,B]],200))
    out.append(week11_bars('WEEK 10 · DEFENSE',[(x['name'],x['defense']) for x in [A,B]],200))
    out.append('<p><em>These are historical scoring comparisons, not Week 11 projections.</em></p></section>')
    return ''.join(out)

def week11_bye_exposure():
    ranked=sorted(WEEK11_PREVIEW.values(),key=lambda v:-len(v['prior_starting_byes']))
    out=[f'<div class="wk9-chart" role="img" aria-label="Bye-exposed Week 10 starters across all 10 franchises"><div class="wk9-chart-title">BYEPOCALYPSE · LAST WEEK’S STARTERS AT RISK</div>']
    for team in ranked:
        n=len(team['prior_starting_byes']);out.append(f'<div class="wk9-chart-row"><span class="wk9-chart-name">{html.escape(team["name"])}</span><span class="wk9-chart-track"><span class="wk9-chart-fill" style="width:{100*n/10:.2f}%"></span></span><strong class="wk9-chart-value">{n} / 20</strong></div>')
    out.append('</div><p><em>Count of players started in Week 10 whose NFL teams are on Week 11 bye. Not a forecast of the submitted Week 11 lineup.</em></p>');return ''.join(out)

def markdown_to_html(text):
    out, paragraph, list_items = [], [], []
    def flush():
        if paragraph:
            out.append('<p>'+inline(' '.join(paragraph))+'</p>'); paragraph.clear()
        if list_items:
            out.append('<ul>'+''.join('<li>'+inline(x)+'</li>' for x in list_items)+'</ul>'); list_items.clear()
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            flush(); continue
        header = re.match(r'^(#{1,4})\s+(.+)$', line)
        if header:
            flush(); out.append(f'<h{len(header.group(1))+1}>{inline(header.group(2))}</h{len(header.group(1))+1}>')
        elif line.startswith('- ') or line.startswith('* '):
            if paragraph: flush()
            list_items.append(line[2:])
        elif line == '{{week9_scoring_chart}}':
            flush()
            bars = [('New York Noodles',302.25),('NJz Bunniez',281.69),('LALALALA',280.81),('Seattle Supersonics',274.74),('Tampa Bay Tyranny',263.10),('Utah Yetis',248.34),('District of Daebak',223.85),('Dalla Dalla Dallas',202.64),('Good Things We OKC!',199.80),('HOU You Like That',198.74)]
            graph = ['<div class="wk9-chart" role="img" aria-label="Week 9 fantasy points scored by each franchise, sorted descending"><div class="wk9-chart-title">WEEK 9 · SCORING RANKINGS</div>']
            for name, value in bars:
                width = 100*value/310
                graph.append(f'<div class="wk9-chart-row"><span class="wk9-chart-name">{html.escape(name)}</span><span class="wk9-chart-track"><span class="wk9-chart-fill" style="width:{width:.2f}%"></span></span><strong class="wk9-chart-value">{value:.2f}</strong></div>')
            graph.append('</div>')
            out.append(''.join(graph))
        elif line == '{{week9_top3_offenses_chart}}':
            flush()
            bars = [('NJz Bunniez',143.04),('Utah Yetis',139.64),('Seattle Supersonics',131.14)]
            graph = ['<div class="wk9-chart" role="img" aria-label="Week 9 top three offensive starter totals"><div class="wk9-chart-title">WEEK 9 · TOP 3 OFFENSES</div>']
            for name, value in bars:
                width = 100*value/150
                graph.append(f'<div class="wk9-chart-row"><span class="wk9-chart-name">{html.escape(name)}</span><span class="wk9-chart-track"><span class="wk9-chart-fill" style="width:{width:.2f}%"></span></span><strong class="wk9-chart-value">{value:.2f}</strong></div>')
            graph.append('</div>')
            out.append(''.join(graph))
        elif line == '{{week9_top3_defenses_chart}}':
            flush()
            bars = [('New York Noodles',181.15),('LALALALA',169.35),('Tampa Bay Tyranny',147.70)]
            graph = ['<div class="wk9-chart" role="img" aria-label="Week 9 top three defensive starter totals"><div class="wk9-chart-title">WEEK 9 · TOP 3 DEFENSES</div>']
            for name, value in bars:
                width = 100*value/190
                graph.append(f'<div class="wk9-chart-row"><span class="wk9-chart-name">{html.escape(name)}</span><span class="wk9-chart-track"><span class="wk9-chart-fill" style="width:{width:.2f}%"></span></span><strong class="wk9-chart-value">{value:.2f}</strong></div>')
            graph.append('</div>')
            out.append(''.join(graph))
        elif line.startswith('{{week10_recap_chart:') and line.endswith('}}'):
            flush()
            out.append(week10_recap_chart(line[len('{{week10_recap_chart:'):-2]))
        elif line.startswith('{{week10_matchup_visual:') and line.endswith('}}'):
            flush()
            team_a, team_b = line[len('{{week10_matchup_visual:'):-2].split(':')
            if team_a not in WEEK10_STATS or team_b not in WEEK10_STATS:
                raise ValueError("Unknown team in Week 10 visual")
            out.append(week10_chart_html(team_a, team_b))
        elif re.fullmatch(r'\{\{week11_compare:([a-z0-9-]+)\}\}',line):
            flush()
            match=re.fullmatch(r'\{\{week11_compare:([a-z0-9-]+)\}\}',line)
            out.append(week11_compare(match.group(1)))
        elif line == '{{week11_bye_exposure}}':
            flush();out.append(week11_bye_exposure())
        elif line.startswith('> '):
            flush(); out.append('<blockquote>'+inline(line[2:])+'</blockquote>')
        elif line in {'---','***'}:
            flush(); out.append('<hr>')
        else:
            if list_items: flush()
            paragraph.append(line)
    flush()
    return '\n'.join(out)

def parse_article(file):
    source = file.read_text(encoding='utf-8')
    if not source.startswith('---\n'):
        raise ValueError('Missing opening --- metadata delimiter')
    parts = source.split('\n---\n', 1)
    if len(parts) != 2:
        raise ValueError('Missing closing --- metadata delimiter')
    metadata, body = parts
    data = {}
    for line in metadata.splitlines()[1:]:
        if not line.strip() or line.lstrip().startswith('#'): continue
        if ':' not in line: raise ValueError(f'Invalid metadata: {line}')
        key, value = line.split(':', 1)
        data[key.strip()] = value.strip().strip('"').strip("'")
    required = ('id','season','week','type','title','summary','date','teams')
    for key in required:
        if not data.get(key): raise ValueError(f'Missing required field: {key}')
    if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', data['id']): raise ValueError('id must be lowercase kebab-case')
    if data['type'] not in ALLOWED_TYPES: raise ValueError('type must be recap, preview, or feature')
    teams = [x.strip() for x in data['teams'].strip('[]').split(',') if x.strip()]
    if not teams or any(t not in TEAMS|{'all'} for t in teams): raise ValueError(f'Invalid teams: {teams}')
    date = datetime.date.fromisoformat(data['date'])
    week = int(data['week']); season = int(data['season'])
    if not (1 <= week <= 18): raise ValueError('week must be 1–18')
    if not body.strip(): raise ValueError('Article body is empty')
    return dict(id=data['id'],season=season,week=week,type=data['type'],title=data['title'],summary=data['summary'],date=date.isoformat(),teams=teams,bodyHtml=markdown_to_html(body.strip()))

def main():
    result = []
    ids = set()
    for file in sorted((ROOT/'articles').glob('*.md')):
        try: article = parse_article(file)
        except Exception as e: raise SystemExit(f'{file.name}: {e}') from e
        if article['id'] in ids: raise SystemExit(f'Duplicate id: {article["id"]}')
        ids.add(article['id']); result.append(article)
    result.sort(key=lambda a:(a['season'],a['week'],a['date'],a['id']), reverse=True)
    target = ROOT/'data/stories.json'
    target.write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    print(f'Published {len(result)} article(s) -> data/stories.json')

if __name__ == '__main__': main()
