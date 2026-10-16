/**
 * popup.js
 *
 * Shows the master on/off switch, a per-site override for the active tab,
 * and a "pause everything now" action. All state lives in chrome.storage.sync
 * so it stays in sync with the options page and across devices.
 */

const DEFAULT_SETTINGS = {
  globalEnabled: true,
  siteOverrides: {}
};

function normalizeHostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch (err) {
    return '';
  }
}

async function init() {
  const globalToggle = document.getElementById('globalToggle');
  const siteToggle = document.getElementById('siteToggle');
  const siteNameEl = document.getElementById('siteName');
  const statusEl = document.getElementById('statusText');
  const pauseBtn = document.getElementById('pauseBtn');
  const optionsLink = document.getElementById('optionsLink');

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const hostname = tab?.url ? normalizeHostname(tab.url) : '';
  siteNameEl.textContent = hostname || 'this page';

  const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  const siteOverrides = stored.siteOverrides || {};

  globalToggle.checked = stored.globalEnabled !== false;

  const siteValue = siteOverrides[hostname];
  siteToggle.checked = siteValue === undefined ? true : Boolean(siteValue);
  siteToggle.disabled = !globalToggle.checked || !hostname;

  function refreshStatus() {
    if (!hostname) {
      statusEl.textContent = 'Open a website to see its status.';
    } else if (!globalToggle.checked) {
      statusEl.textContent = 'Blocking is off everywhere.';
    } else if (!siteToggle.checked) {
      statusEl.textContent = `Autoplay is allowed on ${hostname}.`;
    } else {
      statusEl.textContent = `Blocking autoplay on ${hostname}.`;
    }
  }
  refreshStatus();

  globalToggle.addEventListener('change', async () => {
    await chrome.storage.sync.set({ globalEnabled: globalToggle.checked });
    siteToggle.disabled = !globalToggle.checked || !hostname;
    refreshStatus();
  });

  siteToggle.addEventListener('change', async () => {
    if (!hostname) return;
    const current = await chrome.storage.sync.get({ siteOverrides: {} });
    const overrides = { ...current.siteOverrides, [hostname]: siteToggle.checked };
    await chrome.storage.sync.set({ siteOverrides: overrides });
    refreshStatus();
  });

  pauseBtn.addEventListener('click', () => {
    if (!tab?.id) return;
    chrome.tabs.sendMessage(tab.id, { type: 'APB_PAUSE_ALL' }).catch(() => {
      // No content script on this page (e.g. a browser settings page) - ignore.
    });
    statusEl.textContent = 'Paused all playing videos on this page.';
    setTimeout(refreshStatus, 1800);
  });

  optionsLink.addEventListener('click', (event) => {
    event.preventDefault();
    chrome.runtime.openOptionsPage();
  });
}

document.addEventListener('DOMContentLoaded', init);
