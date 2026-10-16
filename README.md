# Autoplay Blocker for Social Feeds

A Manifest V3 browser extension that stops videos from automatically playing
as you scroll through Instagram, Facebook, X/Twitter, TikTok, LinkedIn,
Reddit, Pinterest, and Threads. Works in **Google Chrome** and **Brave**
(and any other Chromium-based browser) without modification.

## What it does

- Patches `HTMLMediaElement.prototype.play()` and the `autoplay`
  property/attribute on every matched page, so feed videos can't start
  themselves.
- Lets through any playback you actually start yourself - clicking a video
  or its controls, or any `play()` call that happens within ~1.2 seconds of
  a click/tap/key press, is never blocked.
- Continuously watches the page (via `MutationObserver`) so videos injected
  while you scroll an infinite feed are caught too.
- Per-site toggles, a master on/off switch, and a one-click "pause
  everything on this page now" button.
- A quick popup status for the current site, plus searchable site controls and
  a live protection summary in the settings page.
- Optional "enable on all websites" mode for sites not in the default list.

No data is collected, transmitted, or stored anywhere except your own
browser's local/sync storage (your on/off preferences).

## Project structure

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

## Install in Chrome

1. Download/unzip this folder.
2. Open `chrome://extensions`.
3. Turn on **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the `autoplay-blocker` folder.
5. Pin the extension from the toolbar puzzle-piece icon for quick access.

## Install in Brave

1. Download/unzip this folder.
2. Open `brave://extensions`.
3. Turn on **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the `autoplay-blocker` folder.
5. Pin the extension from the toolbar for quick access.

> Brave's built-in "Block Autoplay" shield setting (Settings → Shields)
> stops *all* media including the video you intentionally click play on.
> This extension is more targeted: it only blocks playback the page starts
> on its own, so manually starting a video always still works.

## Using it

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

## How the blocking actually works

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
