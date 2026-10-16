/**
 * content.js
 *
 * Runs in the isolated world on every matched page. Responsibilities:
 *
 *  1. Load the user's settings from chrome.storage and react live to changes.
 *  2. Tell page-guard.js (running in the page's MAIN world) whether blocking
 *     is currently enabled for this site, via document.documentElement's
 *     `data-apb-enabled` attribute.
 *  3. Sweep the DOM for <video> elements and clean up anything that slipped
 *     past page-guard.js (e.g. videos that were already playing when this
 *     script loaded, or elements created before the patch was in place).
 *  4. Respond to "pause everything now" requests from the popup.
 */
(() => {
  'use strict';

  const DEFAULT_SETTINGS = {
    globalEnabled: true,
    allSitesEnabled: false,
    siteOverrides: {
      'instagram.com': true,
      'facebook.com': true,
      'fb.com': true,
      'twitter.com': true,
      'x.com': true,
      'tiktok.com': true,
      'linkedin.com': true,
      'reddit.com': true,
      'pinterest.com': true,
      'threads.net': true,
      'youtube.com': false
    }
  };

  /** @type {{globalEnabled: boolean, allSitesEnabled: boolean, siteOverrides: Record<string, boolean>}} */
  let settings = {
    globalEnabled: DEFAULT_SETTINGS.globalEnabled,
    allSitesEnabled: DEFAULT_SETTINGS.allSitesEnabled,
    siteOverrides: { ...DEFAULT_SETTINGS.siteOverrides }
  };

  const getHostnameKey = () => location.hostname.replace(/^www\./, '');

  const isBlockingEnabled = () => {
    if (!settings.globalEnabled) return false;
    const override = settings.siteOverrides[getHostnameKey()];
    return override === undefined ? true : Boolean(override);
  };

  /** Mirror the current state onto <html> so page-guard.js can read it. */
  const syncFlag = () => {
    document.documentElement.dataset.apbEnabled = isBlockingEnabled() ? 'true' : 'false';
  };

  const cleanupVideo = (video) => {
    if (!(video instanceof HTMLMediaElement)) return;
    if (video.dataset.apbUserPlay === 'true') return;
    if (video.hasAttribute('autoplay')) video.removeAttribute('autoplay');
    if (!video.paused) video.pause();
  };

  const sweepVideos = (root) => {
    if (!isBlockingEnabled()) return;
    const scope = root || document;
    scope.querySelectorAll?.('video').forEach(cleanupVideo);
  };

  const observeNewVideos = () => {
    const observer = new MutationObserver((mutationList) => {
      if (!isBlockingEnabled()) return;
      for (const mutation of mutationList) {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          if (node.tagName === 'VIDEO') {
            cleanupVideo(node);
          } else {
            sweepVideos(node);
          }
        });
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    return observer;
  };

  /**
   * Final safety net: listen for the native `play` event. This catches
   * playback started in ways page-guard.js could not intercept (for
   * example, in older Chromium builds without MAIN-world content script
   * support).
   */
  const observePlayEvents = () => {
    document.addEventListener('play', (event) => {
      const video = event.target;
      if (!(video instanceof HTMLMediaElement)) return;
      if (!isBlockingEnabled()) return;
      if (video.dataset.apbUserPlay === 'true') {
        delete video.dataset.apbUserPlay;
        return;
      }
      video.pause();
    }, true);
  };

  const handleStorageChange = (changes, area) => {
    if (area !== 'sync') return;
    if (changes.globalEnabled) settings.globalEnabled = changes.globalEnabled.newValue;
    if (changes.allSitesEnabled) settings.allSitesEnabled = changes.allSitesEnabled.newValue;
    if (changes.siteOverrides) {
      settings.siteOverrides = { ...DEFAULT_SETTINGS.siteOverrides, ...changes.siteOverrides.newValue };
    }
    syncFlag();
    sweepVideos();
  };

  const handleRuntimeMessage = (message) => {
    if (message?.type === 'APB_PAUSE_ALL') {
      document.querySelectorAll('video').forEach((video) => {
        delete video.dataset.apbUserPlay;
        video.pause();
      });
    }
  };

  const init = () => {
    // Fail-safe default while settings are loading: block playback.
    document.documentElement.dataset.apbEnabled = 'true';

    chrome.storage.sync.get(DEFAULT_SETTINGS, (stored) => {
      settings = {
        globalEnabled: stored.globalEnabled ?? DEFAULT_SETTINGS.globalEnabled,
        allSitesEnabled: stored.allSitesEnabled ?? DEFAULT_SETTINGS.allSitesEnabled,
        siteOverrides: { ...DEFAULT_SETTINGS.siteOverrides, ...(stored.siteOverrides || {}) }
      };
      syncFlag();
      sweepVideos();
    });

    observeNewVideos();
    observePlayEvents();
    chrome.storage.onChanged.addListener(handleStorageChange);
    chrome.runtime.onMessage.addListener(handleRuntimeMessage);

    // Belt-and-suspenders periodic sweep for players that resist everything else.
    setInterval(() => sweepVideos(), 1500);
  };

  init();
})();
