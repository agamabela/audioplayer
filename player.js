const STORAGE_KEY = 'lofi-links';

const tabs = document.querySelectorAll('.tab');
const panelYoutube = document.getElementById('panel-youtube');
const panelLocal = document.getElementById('panel-local');
const ytStage = document.getElementById('yt-stage');
const audioStage = document.getElementById('audio-stage');

const ytList = document.getElementById('yt-list');
const localList = document.getElementById('local-list');
const player = document.getElementById('player');
const audio = document.getElementById('audio');
const nowPlaying = document.getElementById('now-playing');

const fileInput = document.getElementById('file-input');
const drop = document.querySelector('.drop');

// Keeps object URLs so we can revoke them when the list is replaced.
const objectUrls = [];

function getLinks() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ [STORAGE_KEY]: [] }, (result) => resolve(result[STORAGE_KEY]));
  });
}

function getVideoId(url) {
  try {
    const parsed = new URL(url);

    if (parsed.hostname === 'youtu.be') {
      return parsed.pathname.slice(1);
    }

    if (parsed.searchParams.get('v')) {
      return parsed.searchParams.get('v');
    }

    const parts = parsed.pathname.split('/').filter(Boolean);
    const supportedPath = ['embed', 'shorts', 'live'].find((name) => parts.includes(name));
    const supportedIndex = supportedPath ? parts.indexOf(supportedPath) : -1;
    if (supportedIndex >= 0 && parts[supportedIndex + 1]) {
      return parts[supportedIndex + 1];
    }
  } catch {
    return null;
  }

  return null;
}

function embedUrl(url) {
  const videoId = getVideoId(url);
  return videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0` : url;
}

function clearActive(container) {
  container.querySelectorAll('.track').forEach((btn) => btn.classList.remove('active'));
}

function makeTrack(label, icon, onClick) {
  const item = document.createElement('li');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'track';

  const iconEl = document.createElement('span');
  iconEl.className = 't-icon';
  iconEl.textContent = icon;

  const labelEl = document.createElement('span');
  labelEl.className = 't-label';
  labelEl.textContent = label;

  button.append(iconEl, labelEl);
  button.addEventListener('click', () => onClick(button));
  item.appendChild(button);
  return { item, button };
}

function emptyRow(list, message) {
  const empty = document.createElement('li');
  empty.className = 'empty';
  empty.textContent = message;
  list.appendChild(empty);
}

/* ---- Tabs ---- */
tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    tabs.forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');

    const isYoutube = tab.dataset.tab === 'youtube';
    panelYoutube.classList.toggle('hidden', !isYoutube);
    panelLocal.classList.toggle('hidden', isYoutube);
    ytStage.classList.toggle('hidden', !isYoutube);
    audioStage.classList.toggle('hidden', isYoutube);
  });
});

/* ---- YouTube (embedded iframe, auto-plays) ---- */
let currentLinks = [];

function playYoutube(url, button) {
  player.src = embedUrl(url);
  clearActive(ytList);
  button.classList.add('active');
}

function switchToYoutubeTab() {
  const ytTab = document.querySelector('.tab[data-tab="youtube"]');
  if (ytTab && !ytTab.classList.contains('active')) ytTab.click();
}

function renderYoutube(links, autoplayIndex = 0) {
  currentLinks = links;
  ytList.innerHTML = '';

  if (!links.length) {
    emptyRow(ytList, 'Add YouTube links from the popup.');
    player.src = 'about:blank';
    return;
  }

  const buttons = [];
  links.forEach((link) => {
    const { item, button } = makeTrack(link.url, '\u25B6', (btn) => playYoutube(link.url, btn));
    ytList.appendChild(item);
    buttons.push(button);
  });

  const target = buttons[autoplayIndex];
  if (target) playYoutube(links[autoplayIndex].url, target);
}

// Auto-play the newest link the moment it is added from the popup.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes[STORAGE_KEY]) return;

  const links = changes[STORAGE_KEY].newValue || [];
  const grew = links.length > currentLinks.length;
  renderYoutube(links, grew ? links.length - 1 : 0);
  if (grew) switchToYoutubeTab();
});

/* ---- Local MP3 ---- */
function playLocal(src, name, button) {
  audio.src = src;
  audio.play().catch(() => {});
  nowPlaying.textContent = name;
  clearActive(localList);
  button.classList.add('active');
}

function addLocalTracks(entries) {
  const placeholder = localList.querySelector('.empty');
  if (placeholder) placeholder.remove();

  entries.forEach((entry) => {
    const { item, button } = makeTrack(entry.name, '♪', (btn) =>
      playLocal(entry.src, entry.name, btn),
    );
    localList.appendChild(item);
  });
}

async function loadBundledTracks() {
  try {
    const res = await fetch(chrome.runtime.getURL('music/tracks.json'));
    if (!res.ok) return [];
    const names = await res.json();
    return names.map((name) => ({
      name,
      src: chrome.runtime.getURL(`music/${name}`),
    }));
  } catch {
    return [];
  }
}

async function initLocal() {
  const bundled = await loadBundledTracks();
  if (bundled.length) {
    addLocalTracks(bundled);
  } else {
    emptyRow(localList, 'No files yet. Add some above.');
  }
}

function handleFiles(fileList) {
  const files = Array.from(fileList).filter((file) => file.type.startsWith('audio/'));
  if (!files.length) return;

  const entries = files.map((file) => {
    const src = URL.createObjectURL(file);
    objectUrls.push(src);
    return { name: file.name, src };
  });

  addLocalTracks(entries);
  const firstButton = localList.querySelectorAll('.track');
  // Auto-play the newest added file.
  const lastButton = firstButton[firstButton.length - 1];
  if (lastButton) lastButton.click();
}

fileInput.addEventListener('change', (event) => {
  handleFiles(event.target.files);
  fileInput.value = '';
});

['dragenter', 'dragover'].forEach((type) => {
  drop.addEventListener(type, (event) => {
    event.preventDefault();
    drop.classList.add('dragover');
  });
});

['dragleave', 'drop'].forEach((type) => {
  drop.addEventListener(type, (event) => {
    event.preventDefault();
    drop.classList.remove('dragover');
  });
});

drop.addEventListener('drop', (event) => {
  if (event.dataTransfer?.files?.length) {
    handleFiles(event.dataTransfer.files);
  }
});

window.addEventListener('beforeunload', () => {
  objectUrls.forEach((url) => URL.revokeObjectURL(url));
});

getLinks().then(renderYoutube);
initLocal();
