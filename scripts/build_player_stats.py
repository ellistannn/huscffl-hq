"""HUSCFFL NFL-wide player stat exporter.

Sleeper NFL-wide statistics endpoints are unofficial, and may disappear without
notice. Try documented historical alternatives; validate every week's payload;
never replace an existing good export with missing or partial data.
"""
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
BASE = 'https://api.sleeper.app'
LEAGUES = {'2025': '1246023611291029504', '2026': '1309685082163810304'}
WEEKS = {'2025': 16, '2026': 17}


def get(url):
    request = Request(url, headers={'User-Agent': 'HUSCFFL-Score-Exporter/2.0',
                                    'Accept': 'application/json'})
    with urlopen(request, timeout=45) as response:
        return json.load(response)


def unwrap(payload):
    if isinstance(payload, dict) and isinstance(payload.get('data'), (dict, list)):
        payload = payload['data']
    if isinstance(payload, dict):
        return list(payload.items())
    if isinstance(payload, list):
        return [(str(item.get('player_id') or item.get('id')), item)
                for item in payload if isinstance(item, dict)]
    raise ValueError('Unsupported statistics payload')


def get_week_stats(year, week):
    # Unsupported endpoints: these candidates are not guaranteed to be live.
    urls = [
        f'{BASE}/v1/stats/nfl/regular/{year}/{week}',
        f'https://api.sleeper.com/stats/nfl/{year}/{week}?season_type=regular',
        f'{BASE}/stats/nfl/regular/{year}/{week}',
    ]
    errors = []
    for url in urls:
        try:
            entries = unwrap(get(url))
            valid = [(pid, row) for pid, row in entries
                     if isinstance(row, dict) and isinstance(row.get('stats', row), dict)]
            if len(valid) < 50:
                raise ValueError(f'only {len(valid)} player-like rows')
            print(f'{year} week {week}: {len(valid)} rows via {url}', flush=True)
            return valid
        except (HTTPError, URLError, ValueError, TimeoutError, OSError) as exc:
            errors.append(f'{url}: {exc}')
    raise RuntimeError(f'NFL-wide statistics unavailable for {year} week {week}. '
                       + ' | '.join(errors))


def normalize_position(position):
    pos = str(position or '').upper()
    if pos in {'QB', 'RB', 'WR', 'TE', 'LB'}:
        return pos
    if pos in {'DL', 'DE', 'DT', 'EDGE'}:
        return 'DL'
    if pos in {'DB', 'CB', 'S', 'FS', 'SS'}:
        return 'DB'
    return None


def scored(stats, scoring):
    return round(sum(float(stats.get(key, 0) or 0) * float(weight or 0)
                     for key, weight in scoring.items()
                     if isinstance(stats.get(key, 0), (int, float))), 4)


def completed_weeks(year, nfl):
    season = str(nfl.get('season', year))
    if int(year) < int(season):
        return WEEKS[year]
    if int(year) > int(season):
        return 0
    if nfl.get('season_type') != 'regular':
        return WEEKS[year]
    return max(0, min(WEEKS[year], int(nfl.get('week', 1)) - 1))


def main():
    players = get(BASE + '/v1/players/nfl')
    nfl = get(BASE + '/v1/state/nfl')
    if not isinstance(players, dict) or len(players) < 100:
        raise RuntimeError('Sleeper player directory unavailable; no output written')
    prepared = {}
    for year, league_id in LEAGUES.items():
        completed = completed_weeks(year, nfl)
        if not completed:
            continue
        league = get(BASE + '/v1/league/' + league_id)
        weights = league.get('scoring_settings')
        if not isinstance(weights, dict) or not weights:
            raise RuntimeError(f'League scoring not available for {year}')
        result = {'year': year, 'weeks': completed, 'players': {},
                  'updated': datetime.now(timezone.utc).isoformat(timespec='seconds'),
                  'source': 'Sleeper weekly stats (unofficial)',
                  'scoring': 'League scoring_settings'}
        for week in range(1, completed + 1):
            entries = get_week_stats(year, week)
            count = 0
            for player_id, record in entries:
                player_id = str(player_id)
                info = players.get(player_id, {})
                if not isinstance(info, dict):
                    continue
                position = normalize_position(info.get('position') or record.get('position'))
                if not position:
                    continue
                stats = record.get('stats', record)
                if not isinstance(stats, dict):
                    continue
                points = scored(stats, weights)
                played = bool(stats.get('gp', 0) or stats.get('gs', 0) or
                              stats.get('off_snp', 0) or stats.get('def_snp', 0) or
                              any(value for key, value in stats.items()
                                  if not key.startswith('pts_') and isinstance(value, (int, float))))
                name = info.get('full_name') or ' '.join(filter(None,
                       [info.get('first_name'), info.get('last_name')])) or player_id
                row = result['players'].setdefault(player_id, {
                    'name': name, 'position': position, 'team': info.get('team'), 'weeks': {}})
                row['weeks'][str(week)] = {'points': points, 'played': played}
                count += 1
            if count < 50:
                raise RuntimeError(f'{year} week {week}: only {count} eligible player rows; refusing partial export')
        if len(result['players']) < 50:
            raise RuntimeError(f'Insufficient player coverage for {year}; refusing incomplete export')
        prepared[year] = result
    # All years must pass validation before replacing any existing file.
    for year, result in prepared.items():
        target = ROOT / 'data' / f'player-stats-{year}.json'
        tmp = target.with_suffix('.tmp')
        tmp.write_text(json.dumps(result, separators=(',', ':')), encoding='utf-8')
        tmp.replace(target)
        print(f'Saved {target} ({len(result["players"])} players, {result["weeks"]} weeks)', flush=True)


if __name__ == '__main__':
    main()
