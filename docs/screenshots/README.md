# Screenshots & GIFs

This folder holds the screenshots and GIFs used on the [landing page](../index.html) and in the [project README](../../README.md).

## How to capture

You need to run the app yourself and capture the screen — there's no way to automate a real, honest demo. Here are the options, from easiest to most polished.

### Option 1 — iOS Simulator (recommended, macOS)

1. Start the app: `npm install && npx expo start`, then press `i` to open the iOS Simulator.
2. **Screenshot:** `Cmd + S` in the Simulator (saves to your Desktop), or `xcrun simctl io booted screenshot shot.png`.
3. **GIF / video:** Simulator has no built-in GIF export, so record the screen with macOS's built-in **QuickTime Player**:
   - Open QuickTime → *File → New Screen Recording* → select the Simulator window → record.
   - Trim the clip, then convert to GIF with `ffmpeg` (see below).

### Option 2 — Android emulator

1. Start the app and open the Android emulator.
2. **Screenshot:** `adb exec-out screencap -p > shot.png`.
3. **GIF / video:** `adb shell screenrecord /sdcard/demo.mp4`, then pull it with `adb pull /sdcard/demo.mp4`. Convert to GIF with `ffmpeg`.

### Option 3 — Physical device

Use your phone's built-in screen recorder (iOS: Control Center → Screen Recording; Android: quick settings → Screen record), then transfer the file to your Mac.

## Converting video → GIF

Install `ffmpeg` (`brew install ffmpeg`) and run:

```bash
# Resize to a phone-ish width, cap the frame rate, and loop forever.
ffmpeg -i demo.mp4 -vf "fps=15,scale=360:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" -loop 0 demo.gif
```

Keep GIFs small (a few MB max) — they're served from the static site and embedded in the README.

## Current screenshots

| File | What it shows |
|------|---------------|
| `search.jpg` | Search & subscribe to a podcast |
| `episode_about.jpg` | Episode details / about |
| `queue.jpg` | The playback queue |
| `downloads.jpg` | Offline downloads |

## Adding more

Use descriptive, lowercase, hyphenated names so the README and landing page stay readable:

| File | What it shows |
|------|---------------|
| `stats.jpg` | Listening stats |
| `demo.gif` | A short looping demo of the main flow |



## After adding files

- **Landing page:** add an `<img>` to the gallery in [`docs/index.html`](../index.html) (reference it as `screenshots/<name>.png`).
- **README:** add a line to the Screenshots section in [`README.md`](../../README.md) (reference it as `docs/screenshots/<name>.png`).

Both are deployed automatically on push to `main` (see `deploy.sh`), so no extra steps are needed.
