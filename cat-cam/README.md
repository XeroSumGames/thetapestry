# cat-cam 🐈 — who's snuggling in bed tonight?

A small program that watches a camera pointed at your bed, recognises **each
of your cats by name**, and tells you every morning who climbed in, when, and
for how long. Built for the "7 cats, who's actually sleeping with us" question.

> **Why not just reprogram the PetLibro Scout?**
> You can't — and that's not a you problem. The Scout is a sealed,
> cloud-locked camera: no developer access, no local video stream, locked
> firmware. Its built-in AI says "a pet moved," not "that's Luna." So this
> project leaves the PetLibro alone (keep using it to watch live on your
> phone) and uses a **separate, open camera** that we *can* feed to our own
> code. That open camera does the brains.

---

## What you'll need

1. **An open camera** pointed at the bed. Either:
   - a cheap **RTSP Wi-Fi camera** (~$30–60; the box/app will mention "RTSP"
     or "ONVIF" — that's the magic word that means we can read its video), **or**
   - a **USB webcam** plugged into the computer that runs this, **or**
   - a **Raspberry Pi** with a camera module.
   - Night vision / infrared is worth it — cats sleep in the dark.
2. **A computer that stays on overnight** (any old laptop, a mini-PC, or a
   Raspberry Pi 4/5). It just needs to run Python.
3. **About 15 photos of each cat.** Phone photos are fine. More on this below.

You do **not** need a graphics card. It runs on a normal CPU.

---

## One-time setup (do this once)

Everything below is typed into a **terminal** (on Windows: open "PowerShell";
on Mac: open "Terminal"). Copy-paste the commands exactly.

### Step 1 — Install Python

If `python3 --version` prints a version number, you're set. If not, install
Python 3.10+ from <https://www.python.org/downloads/> (on Windows, tick "Add
Python to PATH" during install).

### Step 2 — Get this folder onto the overnight computer

Copy the whole `cat-cam` folder to that computer. Then in the terminal, move
into it:

```
cd path/to/cat-cam
```

### Step 3 — Install the dependencies

```
pip install -r requirements.txt
```

This downloads the vision libraries. It's a few hundred MB and can take a few
minutes — that's normal. (The very first time the camera runs, it also
auto-downloads a small detection model, `yolov8n.pt`.)

### Step 4 — Make your config file

```
cp config.example.yaml config.yaml
```

(On Windows PowerShell use `copy config.example.yaml config.yaml`.)

Open `config.yaml` in any text editor (Notepad is fine) and set:

- **`camera.source`** — your camera's RTSP URL (from its app/manual), e.g.
  `"rtsp://admin:mypassword@192.168.1.50:554/stream1"`. For a USB webcam,
  just put `0` instead.
- Leave the rest as-is for now; we'll fix the bed zone in Step 5.

### Step 5 — Draw the bed zone

So we only count cats *on the bed* (not ones walking past), outline the bed
once:

```
python scripts/draw_zone.py
```

A camera snapshot pops up. **Click each corner of the bed**, then press
**Enter**. It prints a `bed_zone:` block — copy that and paste it over the
`bed_zone:` section in `config.yaml`.

*(No screen on the overnight computer? Run this step on any computer that can
reach the camera, or eyeball the corner pixel coordinates.)*

### Step 6 — Add reference photos of each cat

This is what lets the system tell **Mittens from Shadow**. There's no training
step — you just give it example photos.

Inside the `reference_photos/` folder, make **one folder per cat**, named
exactly how you want them to appear in reports:

```
reference_photos/Mittens/
reference_photos/Shadow/
reference_photos/Pumpkin/
reference_photos/Luna/
reference_photos/Oreo/
reference_photos/Tiger/
reference_photos/Smokey/
```

Drop **~15 photos of each cat** into its folder (`.jpg` or `.png`). Tips:
- Variety beats quantity: different poses, angles, lighting, day and night.
- Clear shots of just that cat work best.
- You can use normal phone photos, **or** let the camera grab some for you:
  ```
  python scripts/collect_reference.py
  ```
  That saves cat crops into `reference_photos/_unsorted/` — then drag each
  one into the right cat's folder.

---

## Nightly use

### Start the watch (in the evening, or just leave it running 24/7)

```
python scripts/run_monitor.py
```

It only does work during your `active_hours` (default 9pm–8am) and prints a
line whenever it sees a cat settle into bed. Leave the window open overnight.

### Read the morning report

```
python scripts/morning_report.py
```

You'll get something like:

```
Cat-cam report  Thu Jun 18 06:00PM -> Fri 08:00AM
====================================================
Snuggle leaderboard:
  1. Shadow         9h 00m in bed
  2. Luna           7h 30m in bed

Timeline:
  10:10PM - 05:40AM  Luna
  11:00PM - 08:00AM  Shadow  (still there)
```

The report is also saved to `data/reports/`. Snapshots of each arrival land in
`data/snapshots/` so you can double-check who was who.

---

## Tuning it (when it gets a cat wrong)

Edit these in `config.yaml`:

| Symptom | Fix |
|---|---|
| Two cats get mixed up | Raise `identify.min_confidence` (try `0.65`) and add more reference photos of both. |
| A real cat logs as "unknown" | Lower `identify.min_confidence` (try `0.45`) and add more varied photos of that cat. |
| Brief false arrivals/departures | Raise `monitor.presence_confirm_samples`. |
| Misses quick visits | Lower `monitor.sample_interval_seconds`. |

**Honest limitation:** telling apart cats that look nearly identical (say, two
solid-black cats) from pixels alone is genuinely hard. More varied reference
photos help most; a higher confidence threshold makes it say "unknown" rather
than guess wrong. If you have a pair that's truly indistinguishable on camera,
no software fixes that — but distinctly-coloured cats work well.

---

## How it works (the 30-second version)

1. **Capture** — read frames from your camera (`cat_cam/capture.py`).
2. **Detect** — a pretrained YOLO model finds cats in the frame (`detect.py`).
3. **Filter to the bed** — keep only cats inside your bed polygon (`zones.py`).
4. **Identify** — match each cat crop to your reference photos by visual
   similarity, no training needed (`identify.py`).
5. **Log** — record arrivals/departures to a local SQLite file (`db.py`).
6. **Report** — stitch events into a morning summary (`report.py`).

Your video never leaves the computer it runs on. Nothing is uploaded.

---

## Running the tests

The logic (zones, sessions, reports, scheduling) has unit tests that need no
camera or hardware:

```
pip install pytest
python -m pytest tests/ -q
```
