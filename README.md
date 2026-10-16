<div align="center">
  <img src="icons/icon128.png" alt="Autoplay Blocker logo" width="112" height="112">
  <h1>Autoplay Blocker</h1>
  <p><strong>Scroll in peace. Play what you choose.</strong></p>
  <p>Stop surprise videos on social feeds — while keeping the videos you choose to play.</p>
  <p>
    <img src="https://img.shields.io/badge/Chrome-supported-4285F4?logo=googlechrome&logoColor=white" alt="Chrome supported">
    <img src="https://img.shields.io/badge/Brave-supported-FB542B?logo=brave&logoColor=white" alt="Brave supported">
    <img src="https://img.shields.io/badge/Manifest-V3-6C5CE7" alt="Manifest V3">
    <img src="https://img.shields.io/badge/privacy-no%20tracking-168A65" alt="No tracking">
  </p>
</div>

<p align="center">
  <a href="#-features">Features</a> &nbsp;·&nbsp;
  <a href="#-install">Install</a> &nbsp;·&nbsp;
  <a href="#-using-it">Using it</a> &nbsp;·&nbsp;
  <a href="#-how-it-works">How it works</a>
</p>

---

## 🌿 Features

| | |
|:--|:--|
| 🛡️ **Quiet by default** | Blocks autoplay across Instagram, Facebook, X, TikTok, LinkedIn, Reddit, Pinterest, and Threads. |
| 🙌 **Your clicks still work** | Videos you choose to play are allowed through. |
| 🎛️ **Quick controls** | Check the current site, toggle protection, or pause videos from the toolbar popup. |
| 🔎 **Find your sites** | Search the supported-site list and customize protection for each platform. |
| 🌍 **Go beyond the list** | Optionally enable protection on all websites with your permission. |
| 🔒 **Private by design** | No tracking or data collection. Preferences stay in your browser storage. |

Works in **Google Chrome**, **Brave**, and other Chromium-based browsers.

## 📦 Project structure

```
autoplay-blocker/
├── manifest.json          Manifest V3 configuration
├── icons/                  Toolbar and store icons (16/48/128px)
├── src/
│   ├── background.js       Service worker: defaults + "all sites" mode
│   ├── page-guard.js        Runs in the page's MAIN world, blocks play()
│   └── content.js           Runs in the isolated world, settings + cleanup
├── popup/                   Toolbar popup (quick toggles)
└── options/                 Full settings page (per-site list, all-sites mode)
```

## 🚀 Install

### Google Chrome

1. Download/unzip this folder.
2. Open `chrome://extensions`.
3. Turn on **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the `autoplay-blocker` folder.
5. Pin the extension from the toolbar puzzle-piece icon for quick access.

### Brave

1. Download/unzip this folder.
2. Open `brave://extensions`.
3. Turn on **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the `autoplay-blocker` folder.
5. Pin the extension from the toolbar for quick access.

> Brave's built-in "Block Autoplay" shield setting (Settings → Shields)
> stops *all* media including the video you intentionally click play on.
> This extension is more targeted: it only blocks playback the page starts
> on its own, so manually starting a video always still works.

## 🎛️ Using it

- Click the toolbar icon to:
  - See whether autoplay is blocked on the current site.
  - Toggle blocking on/off everywhere.
  - Toggle blocking on/off for the site you're currently on.
  - Pause every currently-playing video on the page.
- Click **Manage sites & advanced settings** (or right-click the icon →
  **Options**) to:
  - Search the supported sites and enable/disable blocking per platform.
  - See how many supported sites currently have protection enabled.
  - Turn on "Enable on all websites" to cover sites beyond the default
    list (this asks your browser to confirm the broader permission).

## ⚙️ How it works

Social feeds typically call `videoElement.play()` (or set
`video.autoplay = true`) from JavaScript once a post scrolls into the
viewport, often via an `IntersectionObserver`. `page-guard.js` is injected
into the page's own JavaScript context (`"world": "MAIN"`) at
`document_start`, before the page's own scripts run, and replaces
`HTMLMediaElement.prototype.play` with a version that:

1. Allows the call through if it happens within ~1.2 seconds of a real
   click, tap, or key press, **or** if the user just clicked the `<video>`
   element directly.
2. Otherwise pauses the element, strips the `autoplay` attribute, and
   rejects the returned promise with `NotAllowedError` - the same shape
   browsers already use for blocked autoplay, so well-written sites handle
   it gracefully (showing their own paused/play-button state).

`content.js` (isolated world) reads your settings from `chrome.storage.sync`,
mirrors the current on/off state onto `<html data-apb-enabled>` for
`page-guard.js` to read, and does ongoing DOM cleanup (removing stray
`autoplay` attributes, pausing anything that slipped through, reacting
instantly to settings changes from the popup/options page).

## Customizing the site list

The default list lives in `DEFAULT_SETTINGS.siteOverrides` in
`src/background.js`, `src/content.js`, and `options/options.js` (and the
`matches`/`host_permissions` arrays in `manifest.json`). To permanently add
another platform, add its domain to all of those, or simply turn on
**Enable on all websites** from the options page to cover any site without
editing code.

## Notes & limitations

- YouTube is included but blocking is **off by default** there, since its
  "autoplay next video" feature is something many people want to keep.
  Turn it on from the options page if you'd like it blocked too.
- `"world": "MAIN"` content scripts require Chrome/Brave 111 or newer
  (released ~March 2023). On older versions the `content.js` fallback
  (listening for the native `play` event and pausing videos) still blocks
  most autoplay, just slightly later.
- Some sites occasionally change their player internals; if a specific site
  starts autoplaying again, use the "Pause all videos on this page" button
  and please report which site so the heuristics can be tuned.
