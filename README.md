# Trainingsplan

**English** | [Deutsch](README.de.md)

A personal home-workout plan as a small web app – with built-in timers, exercise illustrations and full offline support on the iPhone.

**Live:** https://davekrn.github.io/trainingsplan/

> The content is in German and tailored to my own goals and equipment (fat loss while keeping/building muscle, plus a mobility routine for people who sit a lot). Feel free to look around or adapt it for yourself – it is not medical advice.

## What it does

- **Weekly plan:** 6 training days + 1 rest day, about 30 minutes per session, with a 10–12 minute mobility routine on four days
- **Timers for every exercise:** sets with rest, holds (with side switch), intervals and fixed durations – including lead-in time, beeps and automatic transition to the next exercise
- **Adjustable times:** −/+ buttons per exercise; the setting is remembered on the device
- **Screen stays on** during a workout
- **Illustrations:** simple stick figures for each exercise
- **Print view:** a clean printable version via the browser's print function

## Technology

Plain HTML, CSS and JavaScript – no framework, no build step, no server-side code.

| File | Purpose |
|---|---|
| `index.html` | Page frame |
| `app.js` | Rendering, timers, sounds (Web Audio API), screen wake lock |
| `style.css` | Layout incl. `@media print` for the print view |
| `plan.json` | **All content and timer settings** – the only file to edit for plan changes |
| `sw.js` | Service worker for offline use |
| `manifest.json`, `icon.png` | Web app manifest (name, icon, full-screen start) |
| `nosleep.mp4` | Fallback to keep the screen on in older iOS versions |
| `README.md`, `README.de.md` | This text (English/German), also shown in the “About” tab |
| `Bilder/` | Exercise illustrations |

Hosted for free on **GitHub Pages** directly from this repository.

## Offline feature

The site is a **Progressive Web App (PWA)**. Once opened with an internet connection, it works completely without network – e.g. in a basement or garden room without Wi-Fi.

**How it works**

- On the first visit, the browser installs the **service worker** (`sw.js`).
- It stores all app files *and* every image referenced in `plan.json` in the browser's **Cache Storage**.
- From then on, every request is answered from this local cache first ("cache first"); the network is only used for files not yet stored.
- Personal timer adjustments are kept in the browser's `localStorage`.

**Use it on the iPhone**

1. Open https://davekrn.github.io/trainingsplan/ in **Safari**.
2. Tap **Share → Add to Home Screen**.
3. Start the app from the new home-screen icon. It opens full-screen like a native app and works offline.

On Android, Chrome offers *Install app* / *Add to Home screen* in the menu; on a desktop, Chrome and Edge show an install icon in the address bar.

## Publishing updates

The cache only refreshes when the service worker changes. So for every update:

1. Edit the files (usually just `plan.json`).
2. Increase `VERSION` in `sw.js` (e.g. `tp-7` → `tp-8`).
3. Upload the changed files to this repository (*Add file → Upload files → Commit changes*).
4. Wait 1–2 minutes for GitHub Pages, then open the app once **with** a connection, close it and open it again.

## Adapting it for yourself

Fork the repository, enable GitHub Pages (*Settings → Pages → Deploy from branch: main*) and edit `plan.json`. Exercises, texts, images and timer types (`sets`, `hold`, `interval`, `duration`) are all defined there.
