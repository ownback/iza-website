#!/usr/bin/env python3
"""Media pipeline for Iza's site: collect /new into app/assets/travel with clean names,
chronological order, posters for videos, and a manifest of raw metadata."""
import json, os, re, shutil, subprocess, sys
from datetime import datetime
from PIL import Image

SRC = "/home/ownback/Work/iza/media/new"
DST = "/home/ownback/Work/iza/app/assets/travel"
POSTERS = os.path.join(DST, "posters")


def log(msg):
    print(msg, flush=True)


def exif_dt(path):
    try:
        exif = Image.open(path).getexif()
        raw = exif.get(36867) or exif.get(306)
        if raw:
            return datetime.strptime(raw[:19], "%Y:%m:%d %H:%M:%S")
    except Exception:
        pass
    return None


def exif_gps(path):
    try:
        gps = Image.open(path).getexif().get_ifd(34853)
        if gps and 2 in gps and 4 in gps:
            def dms(v):
                d, m, s = v
                return float(d) + float(m) / 60.0 + float(s) / 3600.0
            lat = dms(gps[2]) * (1 if gps.get(1, "N") == "N" else -1)
            lon = dms(gps[4]) * (1 if gps.get(3, "E") == "E" else -1)
            return [round(lat, 5), round(lon, 5)]
    except Exception:
        pass
    return None


def parse_iso6709(s):
    if not s:
        return None
    nums = re.findall(r"[+-]\d+\.\d+", s)
    if len(nums) >= 2:
        return [round(float(nums[0]), 5), round(float(nums[1]), 5)]
    return None


def main():
    os.makedirs(DST, exist_ok=True)
    os.makedirs(POSTERS, exist_ok=True)
    entries = []

    photos = [f for f in os.listdir(SRC) if f.lower().endswith((".jpg", ".jpeg"))]
    dngs = [f for f in os.listdir(SRC) if f.upper().endswith(".DNG")]
    vids = [f for f in os.listdir(SRC) if f.lower().endswith((".mp4", ".mov"))]

    log(f"reading EXIF dates for {len(photos)} photos...")
    photos_dated = sorted(photos, key=lambda f: (exif_dt(os.path.join(SRC, f)) or datetime(2100, 1, 1), f))

    log("copying photos...")
    for i, f in enumerate(photos_dated, 1):
        src = os.path.join(SRC, f)
        dst_name = f"trip-photo-{i:03d}.jpg"
        shutil.copy2(src, os.path.join(DST, dst_name))
        entries.append({"file": f"assets/travel/{dst_name}", "kind": "photo",
                        "datetime": (exif_dt(src).isoformat() if exif_dt(src) else None),
                        "gps": exif_gps(src)})
    log(f"  {len(photos_dated)} photos copied")

    log(f"converting {len(dngs)} DNG RAWs...")
    dng_dated = sorted(dngs, key=lambda f: (exif_dt(os.path.join(SRC, f)) or datetime(2100, 1, 1), f))
    for j, f in enumerate(dng_dated, 1):
        src = os.path.join(SRC, f)
        dst_name = f"trip-photo-{len(photos_dated) + j:03d}.jpg"
        out = os.path.join(DST, dst_name)
        r = subprocess.run(["convert", src, "-auto-orient", "-resize", "1600x1600>",
                            "-quality", "86", out], capture_output=True)
        if r.returncode != 0:
            log(f"  FAILED {f}: {r.stderr.decode()[:120]}")
            continue
        dt = exif_dt(out) or exif_dt(src)
        gps = exif_gps(out) or exif_gps(src)
        entries.append({"file": f"assets/travel/{dst_name}", "kind": "photo",
                        "datetime": dt.isoformat() if dt else None, "gps": gps})
        if j % 10 == 0:
            log(f"  DNG {j}/{len(dng_dated)}")

    log("processing videos...")
    vids_sorted = sorted(vids, key=lambda f: (exif_dt(os.path.join(SRC, f)) or datetime(2100, 1, 1), f))
    for i, f in enumerate(vids_sorted, 1):
        src = os.path.join(SRC, f)
        dst_name = f"trip-clip-{i:02d}.mp4"
        if f.lower().endswith(".mov"):
            r = subprocess.run(["ffmpeg", "-y", "-i", src,
                                "-vf", "if(gt(iw,ih),min(1920,iw),min(1080,iw)):-2",
                                "-c:v", "libx264", "-crf", "26", "-preset", "fast",
                                "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k",
                                "-movflags", "+faststart", os.path.join(DST, dst_name)],
                               capture_output=True)
            if r.returncode != 0:
                log(f"  FAILED video {f}: {r.stderr.decode()[-200:]}")
                continue
        else:
            shutil.copy2(src, os.path.join(DST, dst_name))
        post = f"trip-clip-{i:02d}.jpg"
        subprocess.run(["ffmpeg", "-y", "-ss", "0.6", "-i", os.path.join(DST, dst_name),
                        "-frames:v", "1", "-vf", "scale=720:-2", "-q:v", "3",
                        os.path.join(POSTERS, post)], capture_output=True)
        probe = subprocess.run(["ffprobe", "-v", "quiet", "-show_entries",
                                "format=duration:format_tags=creation_time,com.apple.quicktime.location.ISO6709",
                                "-of", "json", src], capture_output=True, text=True)
        try:
            info = json.loads(probe.stdout)["format"]
            tags = info.get("tags", {})
            entries.append({"file": f"assets/travel/{dst_name}", "kind": "video",
                            "poster": f"assets/travel/posters/{post}",
                            "datetime": tags.get("creation_time"),
                            "gps": parse_iso6709(tags.get("com.apple.quicktime.location.ISO6709")),
                            "duration": float(info.get("duration", 0))})
        except Exception:
            entries.append({"file": f"assets/travel/{dst_name}", "kind": "video",
                            "poster": f"assets/travel/posters/{post}",
                            "datetime": None, "gps": None, "duration": None})
        log(f"  video {i}/{len(vids_sorted)} done")

    with open(os.path.join(DST, "manifest.json"), "w") as fh:
        json.dump(entries, fh, indent=1)
    log(f"MANIFEST WRITTEN: {len(entries)} entries")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        log(f"FATAL: {e}")
        sys.exit(1)