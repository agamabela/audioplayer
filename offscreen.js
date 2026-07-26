const audio = document.getElementById('offscreen-audio');

// Report real playback state back to the service worker / popup.
function report(extra = {}) {
  chrome.runtime.sendMessage({
    action: 'offscreen-state',
    paused: audio.paused,
    src: audio.src || null,
    currentTime: audio.currentTime || 0,
    duration: Number.isFinite(audio.duration) ? audio.duration : 0,
    ...extra,
  }).catch(() => {});
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg) return;

  if (msg.type === 'play') {
    if (msg.src) {
      // Only reset src when it actually changes, so resume keeps position.
      if (audio.src !== msg.src) {
        audio.src = msg.src;
      }
      audio.play().then(() => {
        report({ ok: true });
      }).catch((err) => {
        report({ ok: false, error: err && err.message ? err.message : String(err) });
      });
      sendResponse({ ok: true });
    }
  } else if (msg.type === 'pause') {
    audio.pause();
    report();
    sendResponse({ ok: true });
  } else if (msg.type === 'stop') {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    report();
    sendResponse({ ok: true });
  } else if (msg.type === 'setVolume') {
    audio.volume = Math.max(0, Math.min(1, msg.volume || 1));
    sendResponse({ ok: true });
  } else if (msg.type === 'getState') {
    sendResponse({
      paused: audio.paused,
      src: audio.src || null,
      currentTime: audio.currentTime || 0,
      duration: Number.isFinite(audio.duration) ? audio.duration : 0,
      volume: audio.volume,
    });
  }
  return true;
});

// Forward live playback progress and lifecycle events.
audio.addEventListener('timeupdate', () => report());
audio.addEventListener('playing', () => report({ ok: true }));
audio.addEventListener('pause', () => report());
audio.addEventListener('loadedmetadata', () => report());
audio.addEventListener('error', () => {
  const code = audio.error ? audio.error.code : 'unknown';
  report({ ok: false, error: `Audio load failed (code ${code})` });
});

audio.addEventListener('ended', () => {
  chrome.runtime.sendMessage({ action: 'offscreen-ended' }).catch(() => {});
});

// Announce readiness so the service worker can (re)send the pending track.
// This closes the race where a 'play' message is sent before this listener exists.
chrome.runtime.sendMessage({ action: 'offscreen-ready' }).catch(() => {});
