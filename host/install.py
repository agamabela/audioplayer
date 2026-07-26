import os
import re
import sys
import json
import stat
import shutil
import subprocess

HOST_NAME = "com.lofi.downloader"
HOST_SCRIPT = "lofi_downloader.py"
WRAPPER_SCRIPT = "lofi_downloader.sh"


def find_python_3_10_plus():
    """Return a Python 3.10+ executable path, if available."""
    if sys.version_info >= (3, 10):
        return sys.executable

    candidates = [
        "python3.12",
        "python3.11",
        "python3.10",
        "/opt/homebrew/bin/python3.12",
        "/opt/homebrew/bin/python3.11",
        "/opt/homebrew/bin/python3.10",
        "/usr/local/bin/python3.12",
        "/usr/local/bin/python3.11",
        "/usr/local/bin/python3.10",
    ]
    for candidate in candidates:
        try:
            result = subprocess.run([candidate, "--version"], capture_output=True, text=True, check=True)
            version = result.stdout.strip() or result.stderr.strip()
            match = re.search(r"Python\s+(\d+)\.(\d+)", version)
            if match:
                major = int(match.group(1))
                minor = int(match.group(2))
                if major > 3 or (major == 3 and minor >= 10):
                    return candidate
        except (subprocess.CalledProcessError, FileNotFoundError):
            continue
    return None


def find_python_3_9_plus():
    """Return a Python 3.9+ executable path, if available."""
    if sys.version_info >= (3, 9):
        return sys.executable

    candidates = [
        "python3",
        "/usr/bin/python3",
        "/Library/Developer/CommandLineTools/usr/bin/python3",
    ]
    for candidate in candidates:
        try:
            result = subprocess.run([candidate, "--version"], capture_output=True, text=True, check=True)
            version = result.stdout.strip() or result.stderr.strip()
            match = re.search(r"Python\s+(\d+)\.(\d+)", version)
            if match:
                major = int(match.group(1))
                minor = int(match.group(2))
                if major > 3 or (major == 3 and minor >= 9):
                    return candidate
        except (subprocess.CalledProcessError, FileNotFoundError):
            continue
    return None

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 install.py <your_chrome_extension_id>")
        sys.exit(1)

    extension_id = sys.argv[1]
    
    source_dir = os.path.dirname(os.path.abspath(__file__))
    source_host_path = os.path.join(source_dir, HOST_SCRIPT)
    
    # Target directory for Chrome native hosts
    target_dir = os.path.expanduser("~/Library/Application Support/Google/Chrome/NativeMessagingHosts")
    os.makedirs(target_dir, exist_ok=True)
    
    # We will copy the host files into a subfolder to avoid macOS TCC protected folder issues (like ~/Documents)
    app_dir = os.path.join(target_dir, "lofi_host_app")
    os.makedirs(app_dir, exist_ok=True)
    
    target_host_path = os.path.join(app_dir, HOST_SCRIPT)
    wrapper_path = os.path.join(app_dir, WRAPPER_SCRIPT)
    
    # Copy host script
    shutil.copy2(source_host_path, target_host_path)

    # Copy bundled yt-dlp if present so the installed host can use the tested native binary.
    local_yt_dlp = os.path.join(source_dir, 'yt-dlp')
    target_yt_dlp = os.path.join(app_dir, 'yt-dlp')
    if os.path.isfile(local_yt_dlp) and os.access(local_yt_dlp, os.X_OK):
        shutil.copy2(local_yt_dlp, target_yt_dlp)
        os.chmod(target_yt_dlp, 0o755)

    # Ensure the python script is executable
    os.chmod(target_host_path, 0o755)

    print("Setting up Python virtual environment and installing yt-dlp...")
    python_executable = find_python_3_10_plus()
    if python_executable is None:
        python_executable = find_python_3_9_plus()
        if python_executable is not None:
            print("Warning: Python 3.9 is deprecated for yt-dlp, but will be used for this install.")
        else:
            print("Error: Python 3.9 or above is required. Install it and rerun install.py.")
            sys.exit(1)

    venv_dir = os.path.join(app_dir, "venv")
    if os.path.isdir(venv_dir):
        print("Removing existing virtual environment to recreate with the selected Python executable...")
        shutil.rmtree(venv_dir)
    subprocess.run([python_executable, "-m", "venv", venv_dir], check=True)
    python_bin = os.path.join(venv_dir, "bin", "python")
    subprocess.run([python_bin, "-m", "pip", "install", "-U", "pip", "yt-dlp"], check=True)

    music_dir = os.path.join(os.path.dirname(source_dir), 'music')
    os.makedirs(music_dir, exist_ok=True)

    # Create a shell wrapper to avoid any PATH issues in Chrome
    wrapper_content = f'''#!/bin/sh
exec 2> "{app_dir}/sh_stderr.log"
export PATH="{venv_dir}/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:$PATH"
export LOFI_MUSIC_DIR="{music_dir}"
exec "{python_bin}" "{target_host_path}" "$@"
'''
    with open(wrapper_path, 'w') as f:
        f.write(wrapper_content)
    os.chmod(wrapper_path, 0o755)

    manifest = {
        "name": HOST_NAME,
        "description": "Lofi Music Player yt-dlp downloader",
        "path": wrapper_path,
        "type": "stdio",
        "allowed_origins": [
            f"chrome-extension://{extension_id}/"
        ]
    }

    target_file = os.path.join(target_dir, f"{HOST_NAME}.json")
    
    with open(target_file, "w") as f:
        json.dump(manifest, f, indent=2)
        
    print(f"Native messaging host installed to {target_file}")
    print(f"Host app files copied to {app_dir}")
    print(f"Allowed extension ID: {extension_id}")

if __name__ == "__main__":
    main()
