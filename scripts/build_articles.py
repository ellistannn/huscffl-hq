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
