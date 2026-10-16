/**
 * options.js
 *
 * Renders the master switch, the per-site toggle list, and the optional
 * "enable on all websites" control. Every change is written straight to
 * chrome.storage.sync so content.js picks it up immediately via
 * chrome.storage.onChanged.
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

const SITE_LABELS = {
  'instagram.com': 'Instagram',
  'facebook.com': 'Facebook',
  'fb.com': 'Facebook (fb.com)',
  'twitter.com': 'Twitter / X (twitter.com)',
  'x.com': 'X (x.com)',
  'tiktok.com': 'TikTok',
  'linkedin.com': 'LinkedIn',
  'reddit.com': 'Reddit',
  'pinterest.com': 'Pinterest',
  'threads.net': 'Threads',
  'youtube.com': 'YouTube'
};

const globalToggle = document.getElementById('globalToggle');
const siteListEl = document.getElementById('siteList');
const allSitesToggle = document.getElementById('allSitesToggle');
const allSitesStatus = document.getElementById('allSitesStatus');

function buildSiteRow(domain, enabled) {
  const row = document.createElement('div');
  row.className = 'row';

  const labelWrap = document.createElement('div');

  const title = document.createElement('p');
  title.className = 'row__label';
  title.textContent = SITE_LABELS[domain] || domain;
  labelWrap.appendChild(title);

  const hint = document.createElement('p');
  hint.className = 'row__hint';
  hint.textContent = domain;
  labelWrap.appendChild(hint);

  const label = document.createElement('label');
  label.className = 'switch';

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = enabled;
  input.dataset.domain = domain;

  const track = document.createElement('span');
  track.className = 'switch__track';

  const thumb = document.createElement('span');
  thumb.className = 'switch__thumb';

  track.appendChild(thumb);
  label.appendChild(input);
  label.appendChild(track);

  row.appendChild(labelWrap);
  row.appendChild(label);

  input.addEventListener('change', async () => {
    const stored = await chrome.storage.sync.get({ siteOverrides: DEFAULT_SETTINGS.siteOverrides });
    const siteOverrides = { ...stored.siteOverrides, [domain]: input.checked };
    await chrome.storage.sync.set({ siteOverrides });
  });

  return row;
}

async function renderSiteList() {
  const stored = await chrome.storage.sync.get({ siteOverrides: DEFAULT_SETTINGS.siteOverrides });
  const siteOverrides = stored.siteOverrides || {};

  siteListEl.innerHTML = '';
  Object.keys(DEFAULT_SETTINGS.siteOverrides).forEach((domain) => {
    const enabled = siteOverrides[domain] ?? DEFAULT_SETTINGS.siteOverrides[domain];
    siteListEl.appendChild(buildSiteRow(domain, enabled));
  });
}

async function renderGlobalToggle() {
  const stored = await chrome.storage.sync.get({ globalEnabled: DEFAULT_SETTINGS.globalEnabled });
  globalToggle.checked = stored.globalEnabled !== false;
}

async function renderAllSitesToggle() {
  const stored = await chrome.storage.sync.get({ allSitesEnabled: DEFAULT_SETTINGS.allSitesEnabled });
  const granted = await chrome.permissions.contains({ origins: ['<all_urls>'] });
  const enabled = Boolean(stored.allSitesEnabled) && granted;
  allSitesToggle.checked = enabled;
  allSitesStatus.textContent = enabled
    ? 'Enabled — running on every site you visit.'
    : 'Disabled — only the platforms listed above are covered.';
}

globalToggle.addEventListener('change', async () => {
  await chrome.storage.sync.set({ globalEnabled: globalToggle.checked });
});

allSitesToggle.addEventListener('change', async () => {
  if (allSitesToggle.checked) {
    let granted = false;
    try {
      granted = await chrome.permissions.request({ origins: ['<all_urls>'] });
    } catch (err) {
      granted = false;
    }

    if (!granted) {
      allSitesToggle.checked = false;
      allSitesStatus.textContent = 'Permission was not granted, so this stays disabled.';
      return;
    }

    await chrome.storage.sync.set({ allSitesEnabled: true });
    chrome.runtime.sendMessage({ type: 'APB_SET_ALL_SITES', enabled: true });
    allSitesStatus.textContent = 'Enabled — running on every site you visit.';
  } else {
    await chrome.storage.sync.set({ allSitesEnabled: false });
    chrome.runtime.sendMessage({ type: 'APB_SET_ALL_SITES', enabled: false });
    try {
      await chrome.permissions.remove({ origins: ['<all_urls>'] });
    } catch (err) {
      // Removal is best-effort; the background script still unregisters scripts.
    }
    allSitesStatus.textContent = 'Disabled — only the platforms listed above are covered.';
  }
});

(async function init() {
  await Promise.all([renderGlobalToggle(), renderSiteList(), renderAllSitesToggle()]);
})();
