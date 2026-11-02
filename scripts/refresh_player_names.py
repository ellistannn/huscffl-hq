#!/usr/bin/env python3
"""Store Sleeper's public NFL player ID -> full name directory for static site use."""
import json
from pathlib import Path
from urllib.request import Request, urlopen

url = "https://api.sleeper.app/v1/players/nfl"
req = Request(url, headers={"User-Agent": "HUSCFFL-LeagueWebsite/1.0"})
with urlopen(req, timeout=120) as response:
    players = json.load(response)
names = {}
positions = {}
for player_id, player in players.items():
    if not isinstance(player, dict):
        continue
    name = player.get("full_name") or " ".join(filter(None, [player.get("first_name"), player.get("last_name")]))
    if name:
        names[str(player_id)] = name
    if player.get("position"):
        positions[str(player_id)] = player["position"]
if len(names) < 1000:
    raise RuntimeError("Player catalog unexpectedly small; not overwriting valid directory")
out = Path(__file__).resolve().parent.parent / "data" / "player-names.json"
out.write_text(json.dumps({"names": names, "positions": positions}, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
print(f"Saved {len(names)} NFL player names to {out}")
