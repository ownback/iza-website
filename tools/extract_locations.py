#!/usr/bin/env python3
"""Cluster GPS points from manifest.json, reverse-geocode cities via Nominatim
(free, no key), write assets/cities.json used by the map + photo books.
Photos/videos without GPS land in the Tuttlingen book."""
import json, os, time, urllib.request, urllib.parse
from datetime import datetime

MANIFEST = "/home/ownback/Work/iza/app/assets/travel/manifest.json"
OUT = "/home/ownback/Work/iza/app/assets/cities.json"
CACHE = "/home/ownback/Work/iza/tools/geocache.json"
HOME_CITY = "Tuttlingen"
UA = "Iza-Love-Site/1.0 (personal gift site)"

def geocode(lat, lon, cache):
    key = f"{round(lat, 2)},{round(lon, 2)}"
    if key in cache:
        return cache[key]
    url = (f"https://nominatim.openstreetmap.org/reverse?lat={lat}&lon={lon}"
           f"&zoom=10&accept-language=de&format=jsonv2")
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            data = json.loads(r.read())
        a = data.get("address", {})
        city = (a.get("city") or a.get("town") or a.get("village")
                or a.get("municipality") or a.get("county") or "Unbekannt")
        cache[key] = city
        time.sleep(1.1)  # Nominatim usage policy: max 1 req/s
        return city
    except Exception as e:
        print(f"geocode failed for {key}: {e}", flush=True)
        cache[key] = HOME_CITY
        time.sleep(2)
        return cache[key]

def main():
    with open(MANIFEST) as fh:
        entries = json.load(fh)
    cache = {}
    if os.path.exists(CACHE):
        with open(CACHE) as fh:
            cache = json.load(fh)

    cities = {}
    uncached = 0
    for e in entries:
        gps = e.get("gps")
        if gps:
            key = f"{round(gps[0], 2)},{round(gps[1], 2)}"
            if key not in cache:
                uncached += 1
    print(f"{uncached} unique points to geocode..." if uncached else "all cached")

    for e in entries:
        gps = e.get("gps")
        if gps:
            city = geocode(gps[0], gps[1], cache)
            lat, lon = gps
        else:
            city, lat, lon = HOME_CITY, None, None
        item = {"file": e["file"], "kind": e["kind"],
                "datetime": e.get("datetime"), "poster": e.get("poster"),
                "duration": e.get("duration"), "gps": gps}
        c = cities.setdefault(city, {"city": city, "lat": None, "lon": None, "items": []})
        c["items"].append(item)
        if lat is not None and c["lat"] is None:
            c["lat"], c["lon"] = lat, lon

    out = sorted(cities.values(),
                 key=lambda c: (min((i.get("datetime") or "9999") for i in c["items"])))
    for c in out:
        c["items"].sort(key=lambda i: (i.get("datetime") or "9999", i["file"]))
        c["count"] = len(c["items"])
    with open(CACHE, "w") as fh:
        json.dump(cache, fh, indent=1)
    with open(OUT, "w") as fh:
        json.dump(out, fh, indent=1)
    print(f"CITIES WRITTEN: {len(out)} cities")
    for c in out:
        print(f"  {c['city']}: {c['count']} items")

if __name__ == "__main__":
    main()