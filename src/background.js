/**
 * background.js (service worker)
 *
 * - Sets sensible default settings the first time the extension is installed.
 * - Manages the optional "enable on all websites" mode: once the user grants
 *   the <all_urls> host permission from the options page, this registers the
 *   same two content scripts dynamically for every site.
 */

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

const ALL_SITES_SCRIPT_IDS = ['apb-page-guard-all', 'apb-content-all'];

async function registerAllSitesScripts() {
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: ALL_SITES_SCRIPT_IDS });
  if (existing.length === ALL_SITES_SCRIPT_IDS.length) return;

  // Avoid duplicate-id errors if one of the two is already registered.
  if (existing.length > 0) {
    await chrome.scripting.unregisterContentScripts({ ids: ALL_SITES_SCRIPT_IDS }).catch(() => {});
  }

  await chrome.scripting.registerContentScripts([
    {
      id: 'apb-page-guard-all',
      matches: ['<all_urls>'],
      js: ['src/page-guard.js'],
      runAt: 'document_start',
      allFrames: true,
      world: 'MAIN'
    },
    {
      id: 'apb-content-all',
      matches: ['<all_urls>'],
      js: ['src/content.js'],
      runAt: 'document_start',
      allFrames: true
    }
  ]);
}

async function unregisterAllSitesScripts() {
  try {
    await chrome.scripting.unregisterContentScripts({ ids: ALL_SITES_SCRIPT_IDS });
  } catch (err) {
    // Already unregistered (e.g. permission was revoked outside the extension) - ignore.
  }
}

async function syncAllSitesScripts() {
  const { allSitesEnabled } = await chrome.storage.sync.get({ allSitesEnabled: false });
  if (!allSitesEnabled) return;

  const granted = await chrome.permissions.contains({ origins: ['<all_urls>'] });
  if (granted) {
    await registerAllSitesScripts();
  } else {
    // Permission was revoked since this was enabled - keep settings consistent.
    await chrome.storage.sync.set({ allSitesEnabled: false });
  }
}

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await chrome.storage.sync.set(DEFAULT_SETTINGS);
  }
  await syncAllSitesScripts();
});

chrome.runtime.onStartup.addListener(syncAllSitesScripts);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'APB_SET_ALL_SITES') {
    const action = message.enabled ? registerAllSitesScripts() : unregisterAllSitesScripts();
    action
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true; // keep the message channel open for the async response
  }
  return undefined;
});
