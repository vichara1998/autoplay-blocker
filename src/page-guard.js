/**
 * page-guard.js
 *
 * Runs in the *page's* MAIN world (Manifest V3 "world": "MAIN"), so it can
 * patch the exact `HTMLMediaElement.prototype` that the host page's own
 * scripts use to start playback. This is what actually stops Instagram,
 * TikTok, etc. from calling `video.play()` as soon as a post scrolls into
 * view.
 *
 * Communication with the isolated-world content script (content.js) is a
 * single read-only data attribute on <html>:
 *
 *   document.documentElement.dataset.apbEnabled === "false"  -> allow autoplay
 *   anything else (including "true" or not yet set)          -> block autoplay
 *
 * Reading happens at the moment play() is called, which is always *after*
 * content.js has had a chance to set the attribute, so there is no race
 * condition between the two content scripts.
 */
(() => {
  'use strict';

  // A play() call within this window of a real user interaction (click,
  // tap, key press) is treated as something the user asked for, not autoplay.
  const GESTURE_WINDOW_MS = 1200;
  let lastGestureAt = 0;

  const markGesture = () => {
    lastGestureAt = Date.now();
  };

  ['pointerdown', 'keydown', 'touchstart'].forEach((eventName) => {
    document.addEventListener(eventName, markGesture, { capture: true, passive: true });
  });

  const isBlockingEnabled = () =>
    document.documentElement?.dataset.apbEnabled !== 'false';

  // --- Patch HTMLMediaElement.prototype.play -------------------------------
  const originalPlay = HTMLMediaElement.prototype.play;

  HTMLMediaElement.prototype.play = function patchedPlay(...args) {
    if (!isBlockingEnabled()) {
      return originalPlay.apply(this, args);
    }

    const recentGesture = Date.now() - lastGestureAt < GESTURE_WINDOW_MS;
    const userRequested = this.dataset?.apbUserPlay === 'true';

    if (recentGesture || userRequested) {
      if (userRequested) delete this.dataset.apbUserPlay;
      return originalPlay.apply(this, args);
    }

    // Not a user-initiated play: cancel it and report it the way browsers
    // already report blocked autoplay, so site code handles it gracefully.
    try {
      this.pause();
    } catch (err) {
      /* element may not be fully initialised yet - safe to ignore */
    }
    try {
      this.removeAttribute('autoplay');
    } catch (err) {
      /* ignore */
    }
    return Promise.reject(new DOMException('Blocked by Autoplay Blocker', 'NotAllowedError'));
  };

  // --- Patch the `autoplay` property/attribute setter -----------------------
  // Some players set `video.autoplay = true` repeatedly instead of (or in
  // addition to) calling play() directly. Force it back to false while
  // blocking is enabled.
  const autoplayDescriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'autoplay');
  if (autoplayDescriptor && typeof autoplayDescriptor.set === 'function') {
    Object.defineProperty(HTMLMediaElement.prototype, 'autoplay', {
      configurable: true,
      enumerable: autoplayDescriptor.enumerable,
      get: autoplayDescriptor.get,
      set(value) {
        autoplayDescriptor.set.call(this, isBlockingEnabled() ? false : value);
      }
    });
  }

  // --- Mark direct clicks on a <video> as user-initiated ---------------------
  // If someone taps the video itself (the site's built-in play/pause control
  // is usually the <video> element or an overlay directly on top of it), the
  // very next play() call on that element is allowed through even outside the
  // gesture window, so legitimate manual playback is never blocked.
  document.addEventListener('click', (event) => {
    const target = event.target;
    const video = target instanceof Element
      ? (target.tagName === 'VIDEO' ? target : target.closest('video'))
      : null;
    if (video) {
      video.dataset.apbUserPlay = 'true';
    }
  }, { capture: true, passive: true });
})();
