# Dashpod

A minimalist, open-source podcast client built with [Expo](https://expo.dev) and React Native. No accounts, no tracking, no ads — just RSS feeds, local playback, and your own listening history stored on-device.

## Features

- **Search & subscribe** to any podcast via the iTunes Search API and its RSS feed
- **Playback** with background audio, speed control, and a persistent mini-player
- **Downloads** for offline listening
- **Queue** for lining up episodes to play next
- **History** — an endless, day-grouped log of everything you've listened to
- **Stats** — Day/Week/Month/Year/All-time breakdowns with a calendar day-picker, a per-podcast pie chart, and expandable per-episode listening times

All listening data is stored locally in SQLite — nothing leaves your device.

## Screenshots

> Screenshots live in [`docs/screenshots/`](docs/screenshots/README.md). Drop your captures there and they'll show up here and on the [landing page](https://dashpod.yankvasya.dev).

<p align="center">
  <img src="docs/screenshots/search.jpg" alt="Search" width="200" />
  <img src="docs/screenshots/episode_about.jpg" alt="Episode details" width="200" />
  <img src="docs/screenshots/queue.jpg" alt="Playback queue" width="200" />
  <img src="docs/screenshots/downloads.jpg" alt="Downloads" width="200" />
</p>

## Status

This is an early-stage personal project, developed iteratively and tested on iOS Simulator. There is no published build yet (App Store or Play Store) — for now, run it from source via Expo.

## Getting started

Requires Expo SDK 57 / React Native's New Architecture (mandatory, not optional in this project).

```bash
npm install
npx expo start
```

Then open in an [iOS Simulator](https://docs.expo.dev/workflow/ios-simulator/), [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/), or a [development build](https://docs.expo.dev/develop/development-builds/introduction/) on a physical device. This project uses native modules (SQLite, background audio, native tabs), so it will not run in Expo Go.

## Contributing

Want to contribute? Check out [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[GPL-3.0](LICENSE) — you're free to use, modify, and redistribute this code, but any distributed derivative work must also be open source under the same license.
