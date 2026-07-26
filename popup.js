const STORAGE_KEY = 'lofi-links';

const HOST_NAME = 'com.lofi.downloader';

/* ---- DOM refs ---- */
const form        = document.getElementById('add-form');
const urlInput    = document.getElementById('url-input');
const addBtn      = document.getElementById('add-btn');
const list        = document.getElementById('list');
const clearBtn    = document.getElementById('clear-list');
const audio       = document.getElementById('audio');
const thumb       = document.getElementById('thumb');
const thumbNote   = document.getElementById('thumb-note');
const trackTitle  = document.getElementById('track-title');
const playerStatus= document.getElementById('player-status');
const playPauseBtn = document.getElementById('play-pause');
const musicDirInput = document.getElementById('music-dir');
const saveMusicDirBtn = document.getElementById('save-music-dir');

/* ---- Helpers ---- */
let currentObjectUrl = null;
let currentLocalSrc = null; // last local URL returned by host
let offscreenState = { paused: true, src: null };

function getVideoId(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'youtu.be') return parsed.pathname.slice(1);
    if (parsed.searchParams.get('v')) return parsed.searchParams.get('v');
    const parts = parsed.pathname.split('/').filter(Boolean);
    const hit = ['shorts', 'live', 'embed'].find(p => parts.includes(p));
    if (hit) return parts[parts.indexOf(hit) + 1] || null;
  } catch { /* noop */ }
  return null;
}

function thumbUrl(videoId) {
  return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
}

function setStatus(state, msg) {
  playerStatus.className = `player-status ${state}`;
  
  const progressContainer = document.getElementById('progress-container');
  const progressBar = document.getElementById('progress-bar');
  
  if (state === 'loading' && msg) {
    const match = msg.match(/\[download\]\s+([\d\.]+)%/);
    if (match && progressContainer) {
      const percent = parseFloat(match[1]);
      progressContainer.classList.remove('hidden');
      progressBar.style.width = percent + '%';
      
      // Also extract ETA if possible
      const etaMatch = msg.match(/ETA\s+([\d:]+)/);
      const eta = etaMatch ? ` (ETA: ${etaMatch[1]})` : '';
      playerStatus.textContent = `Downloading: ${percent}%${eta}`;
    } else {
      if (progressContainer && !msg.includes('Downloading')) {
        progressContainer.classList.add('hidden');
      }
      playerStatus.textContent = msg;
    }
  } else {
    if (progressContainer) progressContainer.classList.add('hidden');
    playerStatus.textContent = msg;
  }
}

function showThumb(videoId) {
  if (!videoId) {
    thumb.classList.add('hidden');
    thumbNote.classList.remove('hidden');
    return;
  }
  thumb.src = thumbUrl(videoId);
  thumb.onload = () => {
    thumb.classList.remove('hidden');
    thumbNote.classList.add('hidden');
  };
  thumb.onerror = () => {
    thumb.classList.add('hidden');
    thumbNote.classList.remove('hidden');
  };
}

/* ---- Storage ---- */
function getLinks() {
  return new Promise(resolve =>
    chrome.storage.local.get({ [STORAGE_KEY]: [] }, r => resolve(r[STORAGE_KEY]))
  );
}
function setLinks(links) {
  return new Promise(resolve =>
    chrome.storage.local.set({ [STORAGE_KEY]: links }, resolve)
  );
}

/* ---- Background Service Worker — audio download ---- */
function downloadAudioViaHost(url, videoId, onProgress) {
  return new Promise((resolve, reject) => {
    // 0. Get cookies for youtube.com
    chrome.cookies.getAll({ url: "https://www.youtube.com" }, (cookies) => {
      let cookiesText = "";
      if (cookies && cookies.length > 0) {
        for (let c of cookies) {
          let domain = c.domain;
          let flag = domain.startsWith('.') ? 'TRUE' : 'FALSE';
          let path = c.path;
          let secure = c.secure ? 'TRUE' : 'FALSE';
          let expiration = c.expirationDate ? Math.floor(c.expirationDate) : 0;
          cookiesText += `${domain}\t${flag}\t${path}\t${secure}\t${expiration}\t${c.name}\t${c.value}\n`;
        }
      }

      // 1. Send the download request. If the message port closed warning appears,
      //    ignore it and rely on progress/done messages from the background service.
      chrome.runtime.sendMessage({ action: 'download', url, videoId, cookies: cookiesText }, (response) => {
        if (chrome.runtime.lastError) {
          const msg = chrome.runtime.lastError.message || '';
          if (msg.includes('message port closed before a response was received')) {
            // benign in some service worker lifecycle cases — continue and listen for progress
          } else {
            return reject(new Error(msg));
          }
        }
        if (response && response.status === 'error') {
          return reject(new Error(response.error));
        }
      });
    });

    // 2. Listen for background updates
    const listener = (msg) => {
      if (msg.videoId !== videoId) return;

      if (msg.action === 'progress') {
        if (onProgress) onProgress(msg.text);
      } else if (msg.action === 'done') {
        chrome.runtime.onMessage.removeListener(listener);
        resolve({
          url: msg.url,
          title: msg.title
        });
      } else if (msg.action === 'error') {
        chrome.runtime.onMessage.removeListener(listener);
        reject(new Error(msg.error));
      }
    };

    chrome.runtime.onMessage.addListener(listener);

    // 3. Check if it was already downloading before we opened the popup
    chrome.runtime.sendMessage({ action: 'check_status', videoId }, (res) => {
      if (res && res.status === 'downloading') {
        if (onProgress) onProgress(res.text);
      }
    });
  });
}

/* ---- Play ---- */
async function playVideo(url, rowEl) {
  // Clear active
  list.querySelectorAll('.row').forEach(r => r.classList.remove('active'));
  if (rowEl) rowEl.classList.add('active');

  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = null;
  }

  const videoId = getVideoId(url);
  showThumb(videoId);
  trackTitle.textContent = url;
  setStatus('loading', '⏳ Checking local file…');

  try {
    // First probe whether the native host already has a downloaded file for this video
    const probe = await new Promise(resolve =>
      chrome.runtime.sendMessage({ action: 'probe', url, videoId }, (res) => resolve(res))
    );

    if (probe && probe.found) {
      trackTitle.textContent = probe.title || url;
      persistTitle(url, probe.title);
      playLocalFile(probe.url, probe.filepath);
      return;
    }

    setStatus('loading', '⏳ Downloading (not yet saved locally)…');
    const dl = await downloadAudioViaHost(url, videoId, (msg) => {
      setStatus('loading', msg);
    });

    trackTitle.textContent = dl.title || url;
    persistTitle(url, dl.title);
    // The download response gives us the extension URL to play.
    playLocalFile(dl.url, dl.filepath);
  } catch (err) {
    console.error('[lofi]', err);
    let errMsg = err.message;
    if (errMsg.includes('Specified native messaging host not found')) {
       errMsg = 'Native host not installed. Run python3 host/install.py <extension_id>';
    }
    setStatus('error', `⚠ ${errMsg}`);
  }
}

/* ---- Playback via offscreen document (keeps playing after popup closes) ---- */
// The audio element lives in the offscreen document, which Chrome keeps alive
// for AUDIO_PLAYBACK. The popup only sends commands and mirrors reported state.
function playLocalFile(extUrl, filepath) {
  if (!extUrl) {
    setStatus('error', '⚠ No playable URL for this track');
    return;
  }

  currentLocalSrc = extUrl;
  setStatus('loading', '⏳ Loading audio…');

  chrome.runtime.sendMessage({ action: 'play_offscreen', src: extUrl }, (resp) => {
    void chrome.runtime.lastError; // swallow benign port warnings
    if (resp && resp.ok === false) {
      setStatus('error', `⚠ ${resp.error || 'Playback failed'}`);
    }
  });
}

function fmtTime(sec) {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Reflect live offscreen playback state (progress, play/pause, load errors).
chrome.runtime.onMessage.addListener((msg) => {
  if (!msg) return;

  if (msg.action === 'player-state') {
    const bar = document.getElementById('progress-bar');
    const box = document.getElementById('progress-container');

    if (msg.ok === false && msg.error) {
      const map = { 1: 'aborted', 2: 'network', 3: 'decode', 4: 'file not found / not readable' };
      setStatus('error', `⚠ ${msg.error}`);
      offscreenState = { paused: true, src: msg.src || currentLocalSrc };
      updatePlayButton();
      return;
    }

    offscreenState = { paused: !!msg.paused, src: msg.src || currentLocalSrc };
    currentLocalSrc = msg.src || currentLocalSrc;
    updatePlayButton();

    const dur = msg.duration || 0;
    const cur = msg.currentTime || 0;
    if (dur > 0 && bar && box) {
      box.classList.remove('hidden');
      bar.style.width = `${Math.min(100, (cur / dur) * 100)}%`;
      playerStatus.className = 'player-status ready';
      playerStatus.textContent = `${msg.paused ? '⏸' : '▶'} ${fmtTime(cur)} / ${fmtTime(dur)}`;
    } else if (!msg.paused) {
      playerStatus.className = 'player-status ready';
      playerStatus.textContent = '▶ Playing';
    }
    return;
  }

  // Offscreen track finished — auto-advance to the next row.
  if (msg.action === 'ended') {
    const active = list.querySelector('.row.active');
    const next = active?.nextElementSibling;
    if (next && next.classList.contains('row')) {
      const nextId = next.dataset.id;
      getLinks().then(links => {
        const found = links.find(l => l.id === nextId);
        if (found) playVideo(found.url, next);
      });
    } else {
      offscreenState = { paused: true, src: currentLocalSrc };
      updatePlayButton();
    }
    return;
  }
});

/* ---- Persist a fetched title onto the stored link + refresh its row ---- */
async function persistTitle(url, title) {
  if (!title) return;
  const links = await getLinks();
  let changed = false;
  const next = links.map((l) => {
    if (l.url === url && l.title !== title) {
      changed = true;
      return { ...l, title };
    }
    return l;
  });
  if (changed) {
    await setLinks(next);
    // Update the visible row label without a full re-render.
    for (const l of next) {
      if (l.url === url) {
        const row = list.querySelector(`li.row[data-id="${l.id}"] .row-label`);
        if (row) {
          row.textContent = title;
          row.title = `${title}\n${url}`;
        }
      }
    }
  }
}

/* ---- Render list ---- */
function renderList(links) {
  list.innerHTML = '';

  if (!links.length) {
    const empty = document.createElement('li');
    empty.className = 'empty';
    empty.textContent = 'No songs yet. Paste a YouTube URL above.';
    list.appendChild(empty);
    return;
  }

  for (const link of links) {
    const item = document.createElement('li');
    item.className = 'row';
    item.dataset.id = link.id;

    // Disk-backed entries play directly; YouTube entries go through probe/download.
    const startPlay = () => {
      list.querySelectorAll('.row').forEach(r => r.classList.remove('active'));
      item.classList.add('active');
      if (link.local) {
        trackTitle.textContent = link.title || link.filename;
        showThumb(null);
        playLocalFile(link.url, null);
      } else {
        playVideo(link.url, item);
      }
    };

    const playBtn = document.createElement('button');
    playBtn.className = 'play-btn';
    playBtn.type = 'button';
    playBtn.textContent = '▶';
    playBtn.setAttribute('aria-label', 'Play');
    playBtn.addEventListener('click', startPlay);

    const label = document.createElement('span');
    label.className = 'row-label';
    // Show the song title when we have it; fall back to the URL.
    label.textContent = link.title || link.url;
    label.title = link.title ? `${link.title}\n${link.url}` : link.url;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove';
    removeBtn.type = 'button';
    removeBtn.textContent = '×';
    removeBtn.setAttribute('aria-label', 'Remove');
    removeBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const next = (await getLinks()).filter(e => e.id !== link.id);
      await setLinks(next);
      renderList(next);
    });

    item.append(playBtn, label, removeBtn);
    // Click the row to play
    item.addEventListener('click', (e) => {
      if (e.target === removeBtn || e.target === playBtn) return;
      startPlay();
    });
    list.appendChild(item);
  }
}

/* ---- Form submit ---- */
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const url = urlInput.value.trim();
  let parsed;
  try { parsed = new URL(url); } catch { return; }

  const isYt = parsed.hostname.includes('youtube.com') || parsed.hostname === 'youtu.be';
  if (!isYt) {
    setStatus('error', '⚠ Only YouTube URLs are supported');
    return;
  }
  if (!getVideoId(url)) {
    setStatus('error', '⚠ Could not extract video ID from URL');
    return;
  }

  const links = await getLinks();

  // Avoid duplicates
  if (links.some(l => l.url === url)) {
    setStatus('error', '⚠ Already in the list');
    return;
  }

  const next = [...links, { id: crypto.randomUUID(), url }];
  await setLinks(next);
  renderList(next);
  form.reset();
  setStatus('idle', '');

  // Auto-play the newly added track
  const lastRow = list.querySelector('li.row:last-child');
  if (lastRow) playVideo(url, lastRow);
});

/* ---- Clear ---- */
clearBtn.addEventListener('click', async () => {
  // Stop playback first so no file is in use while we delete it.
  chrome.runtime.sendMessage({ action: 'stop_offscreen' }, () => { void chrome.runtime.lastError; });

  await setLinks([]);
  renderList([]);

  // Delete the downloaded MP3 files from disk via the native host.
  setStatus('loading', '⏳ Deleting downloaded files…');
  chrome.runtime.sendMessage({ action: 'clear_music' }, (resp) => {
    void chrome.runtime.lastError;
    if (resp && resp.ok) {
      setStatus('idle', `Removed ${resp.removed ? resp.removed.length : 0} file(s)`);
    } else {
      setStatus('idle', '');
    }
  });

  currentLocalSrc = null;
  offscreenState = { paused: true, src: null };
  updatePlayButton();
  trackTitle.textContent = 'Nothing playing';
  showThumb(null);
  setStatus('idle', '');
});

/* ---- Init ---- */
async function initList() {
  const links = await getLinks();

  // Merge in audio files that exist on disk but aren't in the stored list yet,
  // so previously downloaded songs still show up and are playable.
  const disk = await new Promise((resolve) =>
    chrome.runtime.sendMessage({ action: 'list_tracks' }, (resp) => {
      void chrome.runtime.lastError;
      resolve(resp && resp.ok ? resp.tracks : []);
    })
  );

  const knownFiles = new Set(links.map((l) => l.filename).filter(Boolean));
  let merged = [...links];
  let added = false;

  for (const t of disk) {
    if (knownFiles.has(t.filename)) continue;
    merged.push({
      id: crypto.randomUUID(),
      url: t.url,          // extension URL of the file
      title: t.title,
      filename: t.filename,
      local: true,         // disk-backed entry: play directly, no probe/download
    });
    added = true;
  }

  if (added) await setLinks(merged);
  renderList(merged);
}

initList();

// When the popup (re)opens, ask the offscreen document what it's playing so the
// UI reflects audio that's still going after a previous close.
chrome.runtime.sendMessage({ action: 'get_offscreen_state' }, (state) => {
  void chrome.runtime.lastError;
  if (state && state.src) {
    currentLocalSrc = state.src;
    offscreenState = { paused: !!state.paused, src: state.src };
    updatePlayButton();
    if (!state.paused) {
      playerStatus.className = 'player-status ready';
      playerStatus.textContent = '▶ Playing';
    }
  }
});

function updatePlayButton() {
  if (!playPauseBtn) return;
  if (offscreenState && !offscreenState.paused) {
    playPauseBtn.textContent = '⏸';
    playPauseBtn.setAttribute('aria-pressed', 'true');
  } else {
    playPauseBtn.textContent = '▶';
    playPauseBtn.setAttribute('aria-pressed', 'false');
  }
}

// Play/pause button drives the offscreen player via the background service worker.
if (playPauseBtn) {
  playPauseBtn.addEventListener('click', (e) => {
    e.stopPropagation();

    // Nothing loaded yet — start the active (or first) row.
    if (!currentLocalSrc) {
      const active = list.querySelector('.row.active') || list.querySelector('.row');
      if (active) {
        const id = active.dataset.id;
        getLinks().then(links => {
          const found = links.find(l => l.id === id);
          if (found) playVideo(found.url, active);
        });
      }
      return;
    }

    if (offscreenState && !offscreenState.paused) {
      chrome.runtime.sendMessage({ action: 'pause_offscreen' }, () => {
        void chrome.runtime.lastError;
        offscreenState = { paused: true, src: currentLocalSrc };
        updatePlayButton();
      });
    } else {
      chrome.runtime.sendMessage({ action: 'play_offscreen', src: currentLocalSrc }, () => {
        void chrome.runtime.lastError;
        offscreenState = { paused: false, src: currentLocalSrc };
        updatePlayButton();
      });
    }
  });
}

// Settings: load/save music dir
if (musicDirInput) {
  chrome.storage.local.get({ lofi_music_dir: 'music' }, (res) => {
    musicDirInput.value = res.lofi_music_dir || 'music';
  });
}
if (saveMusicDirBtn) {
  saveMusicDirBtn.addEventListener('click', () => {
    const dir = musicDirInput.value.trim() || 'music';
    chrome.storage.local.set({ lofi_music_dir: dir }, () => {
      // Notify background (optional) and native host
      chrome.runtime.sendMessage({ action: 'set_music_dir', dir }, () => {
        setStatus('idle', 'Saved download directory');
      });
    });
  });
}
