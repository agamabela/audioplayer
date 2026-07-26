#!/usr/bin/env python3
"""
Native messaging host for Lofi Music Player.
Receives YouTube URLs from the Chrome extension, downloads audio
via yt-dlp, saves MP3 to the extension's music/ folder, and
responds with the filename so the extension can play it.
"""

import json
import struct
import sys
import os
import subprocess
import shutil
import hashlib
import re

import logging

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
EXTENSION_DIR = os.path.dirname(SCRIPT_DIR)  # host/ lives inside extension dir
MUSIC_DIR = os.environ.get('LOFI_MUSIC_DIR', os.path.join(EXTENSION_DIR, 'music'))

logging.basicConfig(filename=os.path.join(SCRIPT_DIR, 'host.log'), level=logging.DEBUG)

# ---- native-messaging I/O ----
def read_message():
    try:
        raw = sys.stdin.buffer.read(4)
        if not raw or len(raw) < 4:
            logging.debug("No more input or incomplete length prefix.")
            return None
        length = struct.unpack('<I', raw)[0]
        data = sys.stdin.buffer.read(length)
        logging.debug(f"Received message length: {length}")
        return json.loads(data.decode('utf-8'))
    except Exception as e:
        logging.error(f"Error reading message: {e}")
        return None

def send_message(obj):
    try:
        encoded = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        sys.stdout.buffer.write(struct.pack('<I', len(encoded)))
        sys.stdout.buffer.write(encoded)
        sys.stdout.buffer.flush()
        logging.debug(f"Sent message: {obj}")
    except Exception as e:
        logging.error(f"Error sending message: {e}")


# ---- helpers ----
def safe_filename(title, video_id):
    """Create a filesystem-safe filename from the video title + id."""
    clean = re.sub(r'[^\w\s\-]', '', title).strip()
    clean = re.sub(r'\s+', '_', clean)[:80]
    short_hash = hashlib.md5(video_id.encode()).hexdigest()[:6]
    return f'{clean}_{short_hash}'


def read_tracks():
    path = os.path.join(MUSIC_DIR, 'tracks.json')
    try:
        with open(path, 'r') as f:
            return json.load(f)
    except Exception:
        return []


def write_tracks(tracks):
    path = os.path.join(MUSIC_DIR, 'tracks.json')
    with open(path, 'w') as f:
        json.dump(tracks, f, indent=2, ensure_ascii=False)


def find_yt_dlp():
    """Find yt-dlp in the local bundle, venv, PATH, or installed binary."""
    # Prefer the venv-installed yt-dlp, then PATH, then the bundled executable.
    candidates = [
        os.path.join(SCRIPT_DIR, 'venv', 'bin', 'yt-dlp'),
        shutil.which('yt-dlp'),
        os.path.join(SCRIPT_DIR, 'yt-dlp'),
    ]
    for candidate in candidates:
        if candidate and os.path.isfile(candidate) and os.access(candidate, os.X_OK):
            return candidate
    return None


def find_ffmpeg():
    """Find ffmpeg/ffprobe in PATH or common macOS locations."""
    paths = [
        shutil.which('ffmpeg'),
        shutil.which('ffprobe'),
        '/opt/homebrew/bin/ffmpeg',
        '/opt/homebrew/bin/ffprobe',
        '/usr/local/bin/ffmpeg',
        '/usr/local/bin/ffprobe',
    ]
    return next((p for p in paths if p and os.path.isfile(p) and os.access(p, os.X_OK)), None)


def download_audio(url, video_id, cookies_text=None, music_dir=None):
    target_dir = music_dir or MUSIC_DIR
    os.makedirs(target_dir, exist_ok=True)
    
    cookie_file = None
    if cookies_text:
        import tempfile
        fd, cookie_file = tempfile.mkstemp(suffix='.txt', text=True)
        with os.fdopen(fd, 'w') as f:
            f.write(cookies_text)

    yt_dlp = find_yt_dlp()
    if not yt_dlp:
        return None, None, 'yt-dlp not found. Install with: brew install yt-dlp'

    ffmpeg_path = find_ffmpeg()

    # First, get the video title
    title_cmd = [
        yt_dlp,
        '--no-playlist',
        '--print', 'title',
        '--add-header', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        '--add-header', 'Referer: https://www.youtube.com/',
        url,
    ]
    try:
        title_result = subprocess.run(title_cmd, capture_output=True, text=True, timeout=30)
        title = title_result.stdout.strip() or video_id
        if title_result.returncode != 0:
            logging.debug(f"yt-dlp title command stderr: {title_result.stderr.strip()}")
        else:
            if title_result.stderr:
                logging.debug(f"yt-dlp title command extra output: {title_result.stderr.strip()}")
    except Exception:
        title = video_id

    base_name = safe_filename(title, video_id)

    # Check if already downloaded
    for ext in ['mp3', 'opus', 'webm', 'm4a', 'ogg']:
        candidate = os.path.join(target_dir, f'{base_name}.{ext}')
        if os.path.exists(candidate):
            fname = f'{base_name}.{ext}'
            # Ensure it's in tracks.json (tracks.json lives next to target_dir)
            tracks = read_tracks()
            if fname not in tracks:
                tracks.append(fname)
                write_tracks(tracks)
            if cookie_file: os.remove(cookie_file)
            return fname, title, None

    # Try mp3 (requires ffmpeg)
    output_tpl = os.path.join(target_dir, f'{base_name}.%(ext)s')
    headers = [
        '--add-header', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        '--add-header', 'Referer: https://www.youtube.com/',
    ]

    cmd = [
        yt_dlp,
        '-f', 'bestaudio[ext=m4a]/bestaudio/best',
        '-x', '--audio-format', 'mp3', '--audio-quality', '0',
        '--no-playlist',
        '--no-overwrites',
        '-o', output_tpl,
        *headers,
        url,
    ]
    
    cmd2 = [
        yt_dlp,
        '-f', 'bestaudio[ext=m4a]/bestaudio/best',
        '--no-playlist',
        '--no-overwrites',
        '-o', output_tpl,
        *headers,
        url,
    ]
    
    if ffmpeg_path:
        cmd.extend(['--ffmpeg-location', ffmpeg_path])
        cmd2.extend(['--ffmpeg-location', ffmpeg_path])
    else:
        send_message({'type': 'progress', 'text': 'ffmpeg not found: MP3 conversion may fail. Install ffmpeg if you want automatic MP3 output.'})
    
    if cookie_file:
        cmd.extend(['--cookies', cookie_file])
        cmd2.extend(['--cookies', cookie_file])

    def run_cmd_with_progress(cmd_list):
        process = subprocess.Popen(
            cmd_list,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1
        )

        output_lines = []
        # Stream and forward progress lines to the extension, while keeping a full log
        while True:
            line = process.stdout.readline()
            if not line and process.poll() is not None:
                break
            if line:
                line_str = line.rstrip('\n')
                output_lines.append(line_str)
                # Forward download progress lines
                if "[download]" in line_str and "%" in line_str:
                    try:
                        send_message({'type': 'progress', 'text': line_str})
                    except Exception:
                        logging.exception('Failed to send progress message')

        full_output = "\n".join(output_lines)
        # Log the full output for debugging
        logging.debug(f"yt-dlp output for command {cmd_list[:3]}...:\n{full_output}")
        return process.returncode, full_output

    returncode, err_out = run_cmd_with_progress(cmd)

    if returncode != 0:
        # Retry without mp3 conversion (no ffmpeg)
        send_message({'type': 'progress', 'text': 'Retrying without conversion...'})
        returncode, err_out = run_cmd_with_progress(cmd2)

    if cookie_file:
        os.remove(cookie_file)

    if returncode != 0:
        return None, title, err_out

    # Find the downloaded file
    for f in os.listdir(target_dir):
        if f.startswith(base_name) and not f.endswith('.json'):
            tracks = read_tracks()
            if f not in tracks:
                tracks.append(f)
                write_tracks(tracks)
            return f, title, None

    return None, title, 'Download finished but file not found'


# ---- main loop ----
def main():
    global MUSIC_DIR
    logging.info("Native host started.")
    while True:
        try:
            msg = read_message()
            if msg is None:
                break

            action = msg.get('action', '')
            logging.info(f"Processing action: {action}")


            if action == 'download':
                url = msg.get('url', '')
                video_id = msg.get('videoId', 'unknown')
                cookies_text = msg.get('cookies', None)
                # Allow caller to request a specific music directory. Only honor an
                # ABSOLUTE path; anything else falls back to MUSIC_DIR (which respects
                # the LOFI_MUSIC_DIR env set by the install wrapper). This avoids
                # resolving a bare "music" against the installed host's own folder.
                requested_dir = msg.get('musicDir')
                if requested_dir and os.path.isabs(requested_dir):
                    music_dir = requested_dir
                else:
                    music_dir = MUSIC_DIR

                send_message({'type': 'progress', 'text': 'Starting download…'})

                filename, title, error = download_audio(url, video_id, cookies_text, music_dir)

                if error:
                    logging.error(f"Download error: {error}")
                    send_message({'type': 'error', 'error': error})
                else:
                    logging.info(f"Download complete: {filename}")
                    # Include absolute filepath so the extension/background can verify or copy if needed
                    filepath = os.path.join(music_dir or MUSIC_DIR, filename)
                    send_message({'type': 'done', 'filename': filename, 'title': title or '', 'filepath': filepath})

            elif action == 'probe':
                # Lightweight check: determine whether a file already exists for this
                # URL/video. Check the disk FIRST (instant) and return immediately so
                # the extension's short probe timeout is never exceeded. Only fall back
                # to a (slow) network title fetch when nothing is on disk.
                url = msg.get('url', '')
                video_id = msg.get('videoId', 'unknown')
                requested_dir = msg.get('musicDir')
                if requested_dir and os.path.isabs(requested_dir):
                    probe_dir = requested_dir
                else:
                    probe_dir = MUSIC_DIR

                # Prefer detection by video-id hash (stable even if title changed)
                short_hash = hashlib.md5(video_id.encode()).hexdigest()[:6]
                found_fname = None
                try:
                    for f in os.listdir(probe_dir):
                        if short_hash in f and not f.endswith('.json'):
                            found_fname = f
                            break
                except Exception:
                    found_fname = None

                if found_fname:
                    # Derive a display title from the filename — no network call needed.
                    display_title = re.sub(r'_[0-9a-f]{6}\.[^.]+$', '', found_fname).replace('_', ' ')
                    send_message({'type': 'probe_result', 'found': True, 'filename': found_fname, 'filepath': os.path.join(probe_dir, found_fname), 'title': display_title or video_id})
                else:
                    # Not on disk — try to get a title without downloading (may be slow).
                    try:
                        title_cmd = [
                            find_yt_dlp(),
                            '--no-playlist',
                            '--print', 'title',
                            url,
                        ]
                        title_result = subprocess.run(title_cmd, capture_output=True, text=True, timeout=20)
                        title = title_result.stdout.strip() or video_id
                    except Exception:
                        title = video_id
                    send_message({'type': 'probe_result', 'found': False, 'title': title})

            elif action == 'list':
                tracks = read_tracks()
                send_message({'type': 'tracks', 'tracks': tracks})

            elif action == 'list_tracks':
                # Return the MP3/audio files actually present on disk, each with a
                # display title derived from the filename. Lets the extension show
                # previously downloaded songs even if its stored list was cleared.
                requested_dir = msg.get('musicDir')
                if requested_dir and os.path.isabs(requested_dir):
                    scan_dir = requested_dir
                else:
                    scan_dir = MUSIC_DIR
                audio_exts = ('.mp3', '.m4a', '.opus', '.webm', '.ogg')
                items = []
                try:
                    for f in sorted(os.listdir(scan_dir)):
                        if f.endswith('.json') or f.startswith('.'):
                            continue
                        if not f.lower().endswith(audio_exts):
                            continue
                        title = re.sub(r'_[0-9a-f]{6}\.[^.]+$', '', f).replace('_', ' ').strip()
                        items.append({'filename': f, 'title': title or f})
                except Exception:
                    items = []
                send_message({'type': 'track_list', 'tracks': items})

            elif action == 'clear_music':
                # Delete every audio file in the music dir and reset tracks.json.
                requested_dir = msg.get('musicDir')
                if requested_dir and os.path.isabs(requested_dir):
                    clear_dir = requested_dir
                else:
                    clear_dir = MUSIC_DIR
                audio_exts = ('.mp3', '.m4a', '.opus', '.webm', '.ogg')
                removed = []
                try:
                    for f in os.listdir(clear_dir):
                        if f.lower().endswith(audio_exts):
                            try:
                                os.remove(os.path.join(clear_dir, f))
                                removed.append(f)
                            except Exception as e:
                                logging.error(f"Failed to remove {f}: {e}")
                    # Reset the track index.
                    with open(os.path.join(clear_dir, 'tracks.json'), 'w') as tf:
                        json.dump([], tf)
                except Exception as e:
                    logging.exception('clear_music failed')
                    send_message({'type': 'error', 'error': str(e)})
                else:
                    send_message({'type': 'cleared', 'removed': removed})

            elif action == 'copy_to_extension':
                # Copy an absolute file path into the extension's music folder
                src = msg.get('src')
                dest_rel = msg.get('destRel', 'music')
                if not src or not os.path.isfile(src):
                    send_message({'type': 'error', 'error': f'src not found: {src}'})
                else:
                    try:
                        dest_dir = os.path.join(os.path.dirname(SCRIPT_DIR), dest_rel)
                        os.makedirs(dest_dir, exist_ok=True)
                        dest_name = os.path.basename(src)
                        dest_path = os.path.join(dest_dir, dest_name)
                        shutil.copy2(src, dest_path)
                        tracks = read_tracks()
                        if dest_name not in tracks:
                            tracks.append(dest_name)
                            write_tracks(tracks)
                        send_message({'type': 'copy_done', 'filename': dest_name, 'filepath': dest_path})
                    except Exception as e:
                        logging.exception('copy_to_extension failed')
                        send_message({'type': 'error', 'error': str(e)})

            elif action == 'set_music_dir':
                # Persist a requested music dir for future requests
                dirval = msg.get('dir')
                if dirval:
                    if os.path.isabs(dirval):
                        newdir = dirval
                    else:
                        newdir = os.path.join(os.path.dirname(SCRIPT_DIR), dirval)
                    try:
                        os.makedirs(newdir, exist_ok=True)
                        # update global MUSIC_DIR for the lifetime of this process
                        MUSIC_DIR = newdir
                        send_message({'type': 'progress', 'text': f'Set music dir to {newdir}'})
                    except Exception as e:
                        send_message({'type': 'error', 'error': str(e)})
                else:
                    send_message({'type': 'error', 'error': 'No dir provided'})

            elif action == 'ping':
                yt_dlp = find_yt_dlp()
                send_message({
                    'type': 'pong',
                    'ytdlp': yt_dlp is not None,
                    'musicDir': MUSIC_DIR,
                })

            else:
                logging.warning(f"Unknown action: {action}")
                send_message({'type': 'error', 'error': f'Unknown action: {action}'})
        except Exception as e:
            logging.exception(f"Unhandled exception in main loop: {e}")
            break
            
    logging.info("Native host exiting normally.")

if __name__ == '__main__':
    main()
