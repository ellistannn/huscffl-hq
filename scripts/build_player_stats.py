"""Build NFL-wide player weekly fantasy scoring using Sleeper's unofficial stats feed.
Fails closed: no fabricated scores, leaves prior data untouched on API failures.
"""
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

ROOT = Path(__file__).resolve().parents[1]
BASE = 'https://api.sleeper.app'
LEAGUES = {'2025':'1246023611291029504','2026':'1309685082163810304'}
WEEKS = {'2025':16,'2026':17}

def get(url):
    with urlopen(Request(url,headers={'User-Agent':'HUSCFFL-Score-Exporter/1.0','Accept':'application/json'}),timeout=45) as res:
        return json.load(res)

def get_week_stats(year, week):
    # These are unofficial Sleeper endpoints; availability is not guaranteed.
    candidates = [
        f'https://api.sleeper.app/v1/stats/nfl/regular/{year}/{week}',
        f'https://api.sleeper.com/stats/nfl/{year}/{week}?season_type=regular',
        f'https://api.sleeper.app/stats/nfl/{year}/{week}?season_type=regular',
    ]
    failures = []
    for url in candidates:
        try:
            payload = get(url)
            entries = list(unwrap(payload))
            if len(entries) < 50:
                failures.append(f'{url}: returned {len(entries)} records')
                continue
            print(f'Using player stats: {url} ({len(entries)} records)', flush=True)
            return entries
        except (HTTPError, URLError, ValueError, TimeoutError) as exc:
            failures.append(f'{url}: {exc}')
    raise RuntimeError(
        f'No usable unofficial Sleeper stats feed for {year} week {week}. '
        + ' | '.join(failures)
        + '. Sleeper does not officially support these NFL-wide stats endpoints.'
    )

def normalize_position(p):
    p=str(p or '').upper()
    if p in {'QB','RB','WR','TE','LB'}: return p
    if p in {'DL','DE','DT','EDGE'}: return 'DL'
    if p in {'DB','CB','S','FS','SS'}: return 'DB'
    return None

def scored(stats, weights):
    # Sleeper league scoring keys correspond to raw stats keys in its stat feed.
    return round(sum(float(stats.get(k,0) or 0)*float(v or 0) for k,v in weights.items() if isinstance(stats.get(k,0),(int,float))),4)

def unwrap(payload):
    if isinstance(payload,dict):
        if 'data' in payload and isinstance(payload['data'],(dict,list)):payload=payload['data']
        if isinstance(payload,dict):return payload.items()
    if isinstance(payload,list):return [(str(x.get('player_id') or x.get('id')),x) for x in payload if isinstance(x,dict)]
    raise ValueError('Unsupported stats response format')

def main():
    players=get(BASE+'/v1/players/nfl')
    nfl=get(BASE+'/v1/state/nfl')
    for year,league_id in LEAGUES.items():
        league=get(BASE+'/v1/league/'+league_id)
        weights=league['scoring_settings']
        completed=WEEKS[year] if int(year)<int(nfl.get('season',year)) else max(0,int(nfl.get('week',1))-1) if int(year)==int(nfl.get('season',year)) and nfl.get('season_type')=='regular' else WEEKS[year] if int(year)==int(nfl.get('season',year)) and nfl.get('season_type')!='regular' else 0
        completed=min(completed,WEEKS[year]);out={'year':year,'weeks':completed,'players':{},'updated':datetime.now(timezone.utc).isoformat(timespec='seconds'),'source':'Sleeper weekly stats (unofficial)','scoring':'League scoring_settings'}
        if not completed: continue
        for week in range(1,completed+1):
            records=get_week_stats(year,week)
            count=0
            for pid,record in records:
                pid=str(pid)
                if not isinstance(record,dict):continue
                info=players.get(pid,{})
                pos=normalize_position(info.get('position') or record.get('position'))
                if not pos:continue
                stats=record.get('stats',record)
                if not isinstance(stats,dict):continue
                val=scored(stats,weights)
                # GP should count actual appearances, not bye weeks. Use gp if present,
                # otherwise count recorded active game statistics (zero-point games possible).
                played=bool(stats.get('gp',0) or stats.get('gs',0) or stats.get('off_snp',0) or stats.get('def_snp',0) or any(v for k,v in stats.items() if not k.startswith('pts_') and isinstance(v,(int,float))))
                row=out['players'].setdefault(pid,{'name':info.get('full_name') or ' '.join(filter(None,[info.get('first_name'),info.get('last_name')])) or pid,'position':pos,'team':info.get('team'),'weeks':{}})
                row['weeks'][str(week)]={'points':val,'played':played}
                count+=1
            if count<50:raise ValueError(f'Stat feed returned only {count} position players for {year} week {week}; refusing partial export')
            print(year,week,count,flush=True)
        path=ROOT/'data'/f'player-stats-{year}.json'
        temp=path.with_suffix('.tmp');temp.write_text(json.dumps(out,separators=(',',':')));temp.replace(path)
        print('saved',path, len(out['players']))

if __name__=='__main__': main()
