const HOST_NAME = 'com.lofi.downloader';

// Absolute music dir reported by native host (set via ping)
let HOST_MUSIC_DIR = null;

// Ping native host on startup to learn its configured music directory
function pingNativeHost() {
  try {
    const port = chrome.runtime.connectNative(HOST_NAME);
    const onMsg = (msg) => {
      if (msg && msg.type === 'pong') {
        HOST_MUSIC_DIR = msg.musicDir || null;
      }
      try { port.disconnect(); } catch (e) {}
    };
    port.onMessage.addListener(onMsg);
    port.postMessage({ action: 'ping' });
    setTimeout(() => { try { port.disconnect(); } catch (e) {} }, 500);
  } catch (e) {
    // ignore
  }
}

pingNativeHost();

// Keep track of active downloads so we don't duplicate them
const activeDownloads = new Map(); // videoId -> status string

// Track what the offscreen document should be playing so we can (re)send it
// once the offscreen listener is actually ready (avoids a startup race).
let pendingPlaySrc = null;
let offscreenReady = false;

async function ensureOffscreen() {
  if (!chrome.offscreen) return false;
  const has = await chrome.offscreen.hasDocument();
  if (!has) {
    offscreenReady = false;
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['AUDIO_PLAYBACK'],
      justification: 'Play audio while popup is closed',
    });
  }
  return true;
}

function sendPlayToOffscreen(src) {
  chrome.runtime.sendMessage({ type: 'play', src }).catch(() => {});
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Handle play/pause commands from popup and forward to offscreen document
  if (request.action === 'play_offscreen') {
    const src = request.src;
    pendingPlaySrc = src;
    ensureOffscreen().then((ok) => {
      if (!ok) {
        // No offscreen API — nothing can play in background
        chrome.runtime.sendMessage({ action: 'player-state', ok: false, error: 'Offscreen playback unavailable', src }).catch(() => {});
        sendResponse({ ok: false, error: 'Offscreen playback unavailable' });
        return;
      }
      sendPlayToOffscreen(src);
      setTimeout(() => {
        if (pendingPlaySrc === src) sendPlayToOffscreen(src);
      }, 250);
      sendResponse({ ok: true });
    }).catch((err) => {
      sendResponse({ ok: false, error: err.message });
    });
    return true;
  }

  // Offscreen document finished loading and registered its listener.
  if (request.action === 'offscreen-ready') {
    offscreenReady = true;
    if (pendingPlaySrc) sendPlayToOffscreen(pendingPlaySrc);
    return;
  }

  // Live state (progress, play/pause, load errors) from the offscreen audio.
  // Relay to the popup so it can move the progress bar / show errors.
  if (request.action === 'offscreen-state') {
    chrome.runtime.sendMessage({ ...request, action: 'player-state' }).catch(() => {});
    return;
  }

  if (request.action === 'pause_offscreen') {
    chrome.runtime.sendMessage({ type: 'pause' }).catch(() => {});
    sendResponse({ ok: true });
    return true;
  }

  if (request.action === 'stop_offscreen') {
    pendingPlaySrc = null;
    chrome.runtime.sendMessage({ type: 'stop' }).catch(() => {});
    sendResponse({ ok: true });
    return true;
  }

  if (request.action === 'get_offscreen_state') {
    // Ask offscreen for state and return via callback
    chrome.runtime.sendMessage({ type: 'getState' }, (resp) => {
      sendResponse(resp || { paused: true });
    });
    return true;
  }

  // Offscreen document reported ended — forward to any listeners (popup)
  if (request.action === 'offscreen-ended') {
    chrome.runtime.sendMessage({ action: 'ended' }).catch(() => {});
    return;
  }

  if (request.action === 'download') {
    const { url, videoId } = request;

    // If already downloading, just return current status
    if (activeDownloads.has(videoId)) {
      sendResponse({ status: 'started', message: 'Already downloading' });
      return true;
    }

    activeDownloads.set(videoId, 'starting');

    // Get configured music dir (if any) and include in native host message
    chrome.storage.local.get({ lofi_music_dir: 'music' }, (res) => {
      const musicDir = res.lofi_music_dir || 'music';

      try {
        const port = chrome.runtime.connectNative(HOST_NAME);

        let completed = false;
        let disconnectTimeout = null;

        const finish = (status, payload) => {
          completed = true;
          activeDownloads.delete(videoId);
          if (disconnectTimeout) {
            clearTimeout(disconnectTimeout);
            disconnectTimeout = null;
          }
          try { port.disconnect(); } catch (e) {}
          chrome.runtime.sendMessage({ action: status, videoId, ...payload }).catch(() => {});
        };

        port.onMessage.addListener((msg) => {
          if (msg.type === 'progress') {
            activeDownloads.set(videoId, msg.text);
            chrome.runtime.sendMessage({ action: 'progress', videoId, text: msg.text }).catch(() => {});
          } else if (msg.type === 'done') {
            // The extension serves files from its `music/` resource path. Build a runtime URL
            // that points to the filename inside the extension, regardless of host's absolute path.
            const extUrl = chrome.runtime.getURL(`music/${msg.filename}`);
            // Verify the extension can serve this file; if not, ask native host to copy it into place.
            fetch(extUrl, { method: 'HEAD' }).then(resp => {
              if (resp && resp.ok) {
                finish('done', { url: extUrl, title: msg.title });
              } else if (msg.filepath) {
                // Request copy via a NEW native connection to avoid reusing a port that may soon close
                try {
                  const copyPort = chrome.runtime.connectNative(HOST_NAME);
                  const onCopyMsg = (m2) => {
                    if (m2.type === 'copy_done' && m2.filename === msg.filename) {
                      try { copyPort.disconnect(); } catch (e) {}
                      // Reload extension so Chrome will serve newly copied files from the extension package.
                      try {
                        chrome.runtime.reload();
                        // Give reload a short moment, then notify completion (background will restart).
                        setTimeout(() => {
                          chrome.runtime.sendMessage({ action: 'done', videoId, url: extUrl, title: msg.title }).catch(() => {});
                        }, 500);
                      } catch (e) {
                        chrome.runtime.sendMessage({ action: 'done', videoId, url: extUrl, title: msg.title }).catch(() => {});
                      }
                    } else if (m2.type === 'error') {
                      try { copyPort.disconnect(); } catch (e) {}
                      finish('error', { error: m2.error });
                    }
                  };
                  copyPort.onMessage.addListener(onCopyMsg);
                  copyPort.postMessage({ action: 'copy_to_extension', src: msg.filepath, destRel: 'music' });
                  // timeout for copy
                  setTimeout(() => {
                    try { copyPort.onMessage.removeListener(onCopyMsg); } catch (e) {}
                    try { copyPort.disconnect(); } catch (e) {}
                  }, 10000);
                } catch (e) {
                  finish('error', { error: 'Failed to request host copy: ' + e.message });
                }
              } else {
                finish('error', { error: 'Downloaded file not available to extension' });
              }
            }).catch(() => {
              if (msg.filepath) {
                try {
                  const copyPort = chrome.runtime.connectNative(HOST_NAME);
                  copyPort.postMessage({ action: 'copy_to_extension', src: msg.filepath, destRel: 'music' });
                  setTimeout(() => { try { copyPort.disconnect(); } catch (e) {} }, 10000);
                } catch (e) {
                  finish('error', { error: 'Could not verify file availability' });
                }
              } else {
                finish('error', { error: 'Could not verify file availability' });
              }
            });
          } else if (msg.type === 'error') {
            finish('error', { error: msg.error });
          }
        });

        port.onDisconnect.addListener(() => {
          if (completed) return;
          disconnectTimeout = setTimeout(() => {
            if (completed) return;
            activeDownloads.delete(videoId);
            const err = chrome.runtime.lastError ? chrome.runtime.lastError.message : 'Native host disconnected';
            chrome.runtime.sendMessage({ action: 'error', videoId, error: err }).catch(() => {});
          }, 1000);
        });

        // Prefer the absolute path reported by the native host (so files land where Chrome can serve them).
        const sendMusicDir = HOST_MUSIC_DIR || musicDir;
        port.postMessage({ action: 'download', url, videoId, musicDir: sendMusicDir });

        sendResponse({ status: 'started' });
      } catch (err) {
        activeDownloads.delete(videoId);
        sendResponse({ status: 'error', error: err.message });
      }
    });

    return true;
  }

  if (request.action === 'probe') {
    const { url, videoId } = request;
    try {
      const port = chrome.runtime.connectNative(HOST_NAME);
      let handled = false;
      const onMsg = (msg) => {
        if (!msg) return;
        if (msg.type === 'probe_result') {
          handled = true;
          try { port.disconnect(); } catch (e) {}
          if (msg.found) {
            // Build extension URL for the file
            const extUrl = chrome.runtime.getURL(`music/${msg.filename}`);
            sendResponse({ found: true, filename: msg.filename, url: extUrl, title: msg.title });
          } else {
            sendResponse({ found: false, title: msg.title });
          }
        }
      };
      port.onMessage.addListener(onMsg);
      // Ask host to probe; include HOST_MUSIC_DIR so host probes the expected location
      const sendMusicDir = HOST_MUSIC_DIR || 'music';
      port.postMessage({ action: 'probe', url, videoId, musicDir: sendMusicDir });
      // Timeout fallback
      setTimeout(() => {
        if (!handled) {
          try { port.disconnect(); } catch (e) {}
          sendResponse({ found: false });
        }
      }, 3000);
    } catch (e) {
      sendResponse({ found: false, error: e.message });
    }
    return true;
  }

  // List audio files present on disk (each with a display title).
  if (request.action === 'list_tracks') {
    try {
      const port = chrome.runtime.connectNative(HOST_NAME);
      let handled = false;
      port.onMessage.addListener((msg) => {
        if (msg && msg.type === 'track_list') {
          handled = true;
          try { port.disconnect(); } catch (e) {}
          const tracks = (msg.tracks || []).map((t) => ({
            filename: t.filename,
            title: t.title,
            url: chrome.runtime.getURL(`music/${t.filename}`),
          }));
          sendResponse({ ok: true, tracks });
        }
      });
      port.postMessage({ action: 'list_tracks', musicDir: HOST_MUSIC_DIR || 'music' });
      setTimeout(() => {
        if (!handled) { try { port.disconnect(); } catch (e) {} sendResponse({ ok: false, tracks: [] }); }
      }, 3000);
    } catch (e) {
      sendResponse({ ok: false, tracks: [], error: e.message });
    }
    return true;
  }

  // Delete all downloaded audio files from disk.
  if (request.action === 'clear_music') {
    try {
      const port = chrome.runtime.connectNative(HOST_NAME);
      let handled = false;
      port.onMessage.addListener((msg) => {
        if (msg && (msg.type === 'cleared' || msg.type === 'error')) {
          handled = true;
          try { port.disconnect(); } catch (e) {}
          if (msg.type === 'cleared') sendResponse({ ok: true, removed: msg.removed || [] });
          else sendResponse({ ok: false, error: msg.error });
        }
      });
      port.postMessage({ action: 'clear_music', musicDir: HOST_MUSIC_DIR || 'music' });
      setTimeout(() => {
        if (!handled) { try { port.disconnect(); } catch (e) {} sendResponse({ ok: false, error: 'timeout' }); }
      }, 5000);
    } catch (e) {
      sendResponse({ ok: false, error: e.message });
    }
    return true;
  }

  if (request.action === 'set_music_dir') {
    const { dir } = request;
    chrome.storage.local.set({ lofi_music_dir: dir }, () => {});
    // Optionally notify native host about directory change
    try {
      const port = chrome.runtime.connectNative(HOST_NAME);
      port.postMessage({ action: 'set_music_dir', dir });
      setTimeout(() => { try { port.disconnect(); } catch (e) {} }, 200);
    } catch (e) {
      // ignore native host errors
    }
    // Re-ping the native host to pick up its new absolute music dir
    setTimeout(pingNativeHost, 300);
    return true;
  }

  if (request.action === 'check_status') {
    const { videoId } = request;
    if (activeDownloads.has(videoId)) {
      sendResponse({ status: 'downloading', text: activeDownloads.get(videoId) });
    } else {
      sendResponse({ status: 'idle' });
    }
    return true;
  }
});
