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

let currentSiteOverrides = { ...DEFAULT_SETTINGS.siteOverrides };

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
const siteSearch = document.getElementById('siteSearch');
const emptySearch = document.getElementById('emptySearch');
const enabledCountEl = document.getElementById('enabledCount');
const siteSummaryEl = document.getElementById('siteSummary');
const overviewTitleEl = document.getElementById('overviewTitle');

function buildSiteRow(domain, enabled) {
  const row = document.createElement('div');
  row.className = 'row';

  const identity = document.createElement('div');
  identity.className = 'site-row__identity';

  const monogram = document.createElement('span');
  monogram.className = 'site-row__monogram';
  monogram.setAttribute('aria-hidden', 'true');
  monogram.textContent = (SITE_LABELS[domain] || domain).replace(/[^a-z0-9]/gi, '').slice(0, 2).toUpperCase();
  identity.appendChild(monogram);

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
  input.setAttribute('aria-label', `Enable autoplay blocking on ${SITE_LABELS[domain] || domain}`);

  const track = document.createElement('span');
  track.className = 'switch__track';

  const thumb = document.createElement('span');
  thumb.className = 'switch__thumb';

  track.appendChild(thumb);
  label.appendChild(input);
  label.appendChild(track);

  identity.appendChild(labelWrap);
  row.appendChild(identity);
  row.appendChild(label);

  input.addEventListener('change', async () => {
    const stored = await chrome.storage.sync.get({ siteOverrides: DEFAULT_SETTINGS.siteOverrides });
    currentSiteOverrides = {
      ...DEFAULT_SETTINGS.siteOverrides,
      ...stored.siteOverrides,
      [domain]: input.checked
    };
    await chrome.storage.sync.set({ siteOverrides: currentSiteOverrides });
    await renderOverview();
  });

  return row;
}

function renderSiteList(query = '') {
  const normalizedQuery = query.trim().toLowerCase();
  const matchingSites = Object.keys(DEFAULT_SETTINGS.siteOverrides).filter((domain) => {
    const label = SITE_LABELS[domain] || domain;
    return !normalizedQuery || `${label} ${domain}`.toLowerCase().includes(normalizedQuery);
  });

  siteListEl.innerHTML = '';
  matchingSites.forEach((domain) => {
    const enabled = currentSiteOverrides[domain] ?? DEFAULT_SETTINGS.siteOverrides[domain];
    siteListEl.appendChild(buildSiteRow(domain, enabled));
  });
  emptySearch.hidden = matchingSites.length > 0;
}

async function renderOverview() {
  const stored = await chrome.storage.sync.get({
    globalEnabled: DEFAULT_SETTINGS.globalEnabled,
    allSitesEnabled: DEFAULT_SETTINGS.allSitesEnabled,
    siteOverrides: DEFAULT_SETTINGS.siteOverrides
  });
  const globalEnabled = stored.globalEnabled !== false;
  const siteOverrides = stored.siteOverrides || {};
  const protectedCount = globalEnabled
    ? Object.keys(DEFAULT_SETTINGS.siteOverrides).filter((domain) => (
      siteOverrides[domain] ?? DEFAULT_SETTINGS.siteOverrides[domain]
    )).length
    : 0;
  const allSitesGranted = stored.allSitesEnabled
    && await chrome.permissions.contains({ origins: ['<all_urls>'] });

  enabledCountEl.textContent = String(protectedCount);
  overviewTitleEl.textContent = globalEnabled ? 'Your feeds, under control' : 'Protection is paused';
  siteSummaryEl.textContent = !globalEnabled
    ? 'Autoplay blocking is turned off everywhere.'
    : allSitesGranted
      ? 'Autoplay blocking is enabled on every website.'
      : `Blocking is enabled on ${protectedCount} of ${Object.keys(DEFAULT_SETTINGS.siteOverrides).length} supported sites.`;
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
  await renderOverview();
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
  await renderOverview();
});

siteSearch.addEventListener('input', () => {
  renderSiteList(siteSearch.value);
});

(async function init() {
  const stored = await chrome.storage.sync.get({ siteOverrides: DEFAULT_SETTINGS.siteOverrides });
  currentSiteOverrides = { ...DEFAULT_SETTINGS.siteOverrides, ...(stored.siteOverrides || {}) };
  await Promise.all([renderGlobalToggle(), renderSiteList(), renderAllSitesToggle(), renderOverview()]);
})();
