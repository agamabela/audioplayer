Chrome Audio Music Player
=================

A Chrome MV3 extension + native host that downloads YouTube audio, converts
it to MP3 (via yt-dlp + ffmpeg), stores files in an extension-accessible
`music/` folder and provides persistent playback (offscreen) and progress
updates in the popup UI.

This README explains how the pieces fit together, how to install the native
host, and how to test and troubleshoot the download/playback flow on macOS.

**Features**
- Paste YouTube links into the popup and play without opening a tab.
- Probe whether a track is already downloaded (fast). If not, host will
  download and convert to MP3 and report streaming progress.
- Offscreen audio playback so music continues after the popup closes.
- Option to change the target download directory used by the native host.

**Repository layout (important files)**
- `manifest.json` — Chrome MV3 manifest and permissions.
- `background.js` — service worker: talks to native host, handles progress/done, coordinates copy flow and offscreen playback.
- `popup.html`, `popup.js`, `popup.css` — UI for adding URLs, showing progress, and controlling playback.
- `offscreen.html`, `offscreen.js` — offscreen audio player that keeps playing when popup is closed.
- `player.html`, `player.js`, `player.css` — a standalone player page used as a bundled UI (optional).
- `host/lofi_downloader.py` — native messaging host (yt-dlp wrapper): actions: `download`, `probe`, `copy_to_extension`, `list_tracks`, `clear_music`, `set_music_dir`, `ping`.
- `host/install.py` — helper to install the host for Chrome (creates venv, installs `yt-dlp`, writes Chrome native host manifest pointing to a wrapper).
- `host/lofi_downloader.sh` — wrapper used by the installed native host to run the venv python and set `LOFI_MUSIC_DIR`.
- `music/` — extension-bundled music files and `tracks.json` index.

Requirements
------------
- macOS (instructions below are macOS-oriented)
- Chrome/Chromium supporting Manifest V3 and `offscreen` API
- Python 3.10+ (recommended) — Homebrew Python is preferred on macOS to
  avoid system Python quirks
- `ffmpeg` installed (for MP3 conversion)
- `yt-dlp` (installed into the host venv; `host/install.py` installs it)
- Optional: `deno` or `node` when yt-dlp requires a JS runtime for certain extractors (SABR)

Quick install (recommended)
---------------------------
1. Build and install native host (automated): find your extension ID and run:

```bash
# from the project root
python3 host/install.py <your_chrome_extension_id>
```

`install.py` will:
- copy `host/lofi_downloader.py` to Chrome's NativeMessagingHosts folder
  (~"~/Library/Application Support/Google/Chrome/NativeMessagingHosts/lofi_host_app")
- create a `venv` there using a Python 3.10+ executable when available
- `pip install -U pip yt-dlp` inside the venv
- write the native host manifest that allows your extension ID

2. Ensure system dependencies are present (Homebrew recommended):

```bash
brew install ffmpeg
brew install deno   # optional — helps yt-dlp JS extractors like SABR
```

3. In Chrome, load the unpacked extension (Developer → Extensions → Load unpacked)
   and point to this project folder.

4. Open the extension popup, paste a YouTube URL, and play. The popup will
   probe the host and either immediately play a local file or start a
   download and show progress.

Manual host setup (if you prefer):
---------------------------------
If you want to control venv creation yourself or choose a specific Python:

```bash
# in host/ directory
/opt/homebrew/bin/python3 -m venv venv
./venv/bin/python -m pip install -U pip yt-dlp
# ensure wrapper sets LOFI_MUSIC_DIR; copy host files to Chrome native host dir
python3 host/install.py <your_chrome_extension_id>   # this automates copying and manifest writing
```

How it works (high-level)
-------------------------
- Popup -> background: user clicks play → `background.js` sends an extension message to initiate a `probe` to the native host.
- Host `probe` quickly checks the configured `music` directory for a filename matching the URL's id-hash; if found, background uses `chrome.runtime.getURL('music/<file>')` and plays it via the offscreen player.
- If not found, background sends `download` to the host. The host runs `yt-dlp` and streams its stdout lines back to the extension as `{'type':'progress', 'text': ...}` messages.
- When host finishes, it sends `{'type':'done','filename':..., 'filepath': <abs>}`, and `background.js` verifies extension can serve `music/<filename>`; if not, it requests the host to `copy_to_extension` to place the file under the extension's `music/` folder and reloads the extension.
- The offscreen document receives `play` messages from the background service worker and produces `offscreen-state` updates that the popup mirrors.

Testing and debugging
---------------------
- Host log (installed location):
  `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/lofi_host_app/host.log`
- If Chrome reports `Specified native messaging host not found`:
  - Ensure the JSON manifest was written to `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.lofi.downloader.json` and `path` points to `lofi_downloader.sh`.
  - Ensure `lofi_downloader.sh` is executable and the venv exists below the installed host directory.
- If you see macOS "Python.framework is damaged" dialogs, avoid using PyInstaller-packaged Python binaries; instead recreate the venv with a Homebrew Python 3.10+ and ensure `host/install.py` points to it.
- If downloads fail with extractor errors (403s, "page needs reload", or SABR warnings), try:
  - Installing `deno` (via Homebrew) or a recent `node` so yt-dlp can use a JS runtime.
  - Passing cookies via the popup (host is already designed to accept cookies exported from Chrome).

Developer notes
---------------
- To inspect the native messaging I/O while developing, `host/lofi_downloader.py` logs its activity to `host.log` inside the installed app folder.
- The extension tolerates benign MV3 service worker lifecycle errors (e.g. `message port closed before a response was received`) and relies on streaming progress messages instead of synchronous RPC.
- If you modify `host/lofi_downloader.py`, re-run `host/install.py <extension_id>` to copy the updated script and recreate the venv if needed.

Contributing
------------
- Fork, make improvements to `host/lofi_downloader.py` or the extension UI, and open a PR.
- Add tests or examples for `yt-dlp` extractor edge cases when you encounter them.

License
-------
MIT — feel free to reuse and adapt.


---
