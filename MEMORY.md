# 🧠 Project Memory Bank

*Last updated: 2026-10-17*

This file serves as the persistent cross-session and cross-device memory for all projects in this workspace.

---

## 💻 Cross-Laptop Sync Instructions
To make sure you never lose anything between your laptops:
1. **On your current laptop after working:**
   ```bash
   git add AGENTS.md GEMINI.md MEMORY.md
   git commit -m "Update project memory and agent state"
   git push
   ```
2. **On your other laptop before starting:**
   ```bash
   git pull
   ```
The AI agent will immediately read this file and know everything you worked on.

---

## 📱 App Inventory & Architecture

### 1. Lofi Music Player
- **Type**: Chrome MV3 Extension + Native Messaging Host
- **Location**: Root directory (`manifest.json`, `background.js`, `popup.*`, `offscreen.*`, `player.*`, `host/`)
- **Git Repo**: `https://github.com/agamabela/audioplayer.git`
- **Key Concepts**:
  - Offscreen audio playback: Audio keeps playing even after the extension popup closes.
  - Native Host (`host/lofi_downloader.py`): Wraps `yt-dlp` and `ffmpeg` to download audio from YouTube URLs and convert them to MP3.
  - Storage: Files stored in `music/` with a `tracks.json` index.
- **Setup Command**:
  ```bash
  python3 host/install.py <CHROME_EXTENSION_ID>
  ```

### 2. Kavling SaaS
- **Type**: Property / Kavling Management Web App
- **Location**: `kavling-saas/`
- **Git Repo**: `https://github.com/agamabela/kavling-saas.git`
- **Stack**: Next.js (App Router), TypeScript, Tailwind CSS, Prisma ORM
- **Key Files**:
  - `kavling-saas/app/`: Next.js pages and API routes
  - `kavling-saas/components/`: UI components
  - `kavling-saas/prisma/`: Database schema and migrations
  - `kavling-saas/DESIGN.md`: Product architecture and design doc

### 3. Rubik's Cube Solver
- **Type**: 3D Interactive Rubik's Cube Game & Algorithm Solver
- **Location**: `rubik/`
- **Stack**: Three.js, Vanilla JavaScript (`cube.js`, `solve.js`), HTML5 Canvas
- **Entry Point**: `rubik/index.html`

### 4. WordPress Malware Scanners
- **Type**: Python security analysis tools
- **Location**: Root (`wp_batch_scan.py`, `wp_detailed_scan.py`, `wp_malware_scan.py`, `wp_batch_injection_scan.py`, `malware_db_check.php`)
- **Purpose**: Detect malware, suspicious backdoors, and database injections in WordPress sites.

### 5. Android TV Home Micro-Server (Termux Environment)
- **Target Device**: Android TV on local network (`192.168.1.25`)
- **Connection Details**:
  - SSH: `ssh -p 8022 u0_a57@192.168.1.25`
  - ADB: `adb connect 192.168.1.25:5555`
- **Main Deployment & Control Scripts**: `kavling-saas/scripts/`
  - `tv_start.sh`: Master startup script run on Android TV boot.
  - `deploy-to-tv.sh`: Local automated deploy script (pings TV, establishes ADB/SSH, pulls repo, builds, restarts server).
  - `run_tv.sh` / `stop_tv.sh`: PID-managed process lifecycle scripts.
  - `watchdog_tv.sh`: Auto-recovery watchdog ensuring 24/7 uptime.
  - `nginx_tv.conf`: Reverse proxy configuration.
- **Port Mapping & Ecosystem on the TV**:
  - **Port 80 (Nginx)**:
    - `/` & `/api/` & `/rubik` ➡️ `http://127.0.0.1:8080` (TV Remote & Rubik solver)
    - `/tracker/` ➡️ `http://127.0.0.1:3000` (`multiapss` web app)
    - `/kavling/` ➡️ `http://127.0.0.1:3001` (Kavling SaaS portal)
  - **Port 8080**: TV Remote Server (`/data/local/tv_remote/server.py` with Python + hardware mouse input emulation).
  - **Port 8022**: OpenSSH Server (`sshd`).
  - **Port 5900**: DroidVNC-NG screen mirroring server.
  - **Port 3001**: Kavling SaaS production build (`node server.js`) + Cloudflare Tunnel for public access.
  - **Background Bot**: Family Finance Bot (`/data/data/com.termux/files/home/family-finance-bot`) with quiet recovery watchdog.
  - **Background Streams**: 24/7 YouTube live streams (`Pax Dei` & `Lofi`) via `start1.sh` and `start2.sh`.

---

## 👤 User Preferences & Habits
- **Cross-device workflow**: Works across multiple laptops — memory and context must always be recorded in this repository.
- **Workflow style**: Builds distinct applications and tools in focused subdirectories.
- **Rule for Agent**: Never wipe `MEMORY.md`. Always review `MEMORY.md` first and append new milestones, decisions, or issues.

---

## 📝 Recent Progress & Notes
- **2026-10-16**: Initialized persistent memory system (`AGENTS.md`, `GEMINI.md`, `MEMORY.md`). Documented all 4 active apps (Lofi Music Player, Kavling SaaS, Rubik Solver, WordPress Scanners) to prevent context loss across sessions and between laptops.
- **2026-10-16**: Fixed YouTube Live 24/7 stream stoppage. When YouTube ended the previous 10-hour broadcast, the new room defaulted "Dual stream" to ON (causing encoder stalls waiting for dual ingestion). Toggled off Dual Stream in YouTube Studio, restarted Mac launchd service (`com.tavernsound.livestream`), and verified live playback on video ID `uv_NNO_YQ1A`.
- **2026-10-16**: Connected and configured Redmi device (`25040RP0AG`, `192.168.1.4`) via wireless debugging pairing code (`564341`). Discovered ADB port `33395`, switched device to persistent TCP/IP mode on standard port `5555` (`adb tcpip 5555`), and established persistent ADB connection at `192.168.1.4:5555` for gamepad/joystick gameplay.
- **2026-10-16**: Reverse engineered `https://www.allsonicgames.net/sonic-the-hedgehog-2.php` to extract original Sega Genesis ROM (`sonic-the-hedgehog-2.gen`). Pushed ROM to Redmi storage (`/sdcard/Download/Sonic The Hedgehog 2.gen`), built clean full-screen ad-free EmulatorJS player with HTML5 Gamepad API in `sonic2_web/index.html`, hosted on `http://192.168.1.7:8088`, and launched directly in Chrome on Redmi with full USB Xbox 360 controller support.
- **2026-10-16**: Created custom standalone native Android APK (`SonicTheHedgehog2.apk`, 6.6MB) using Apktool, Android build-tools, and REA. Bundled `sonic-the-hedgehog-2.gen` directly into the APK assets, patched `intentDataPath` in smali to auto-unpack and boot straight into Sonic 2 without user prompts, branded app title as "Sonic The Hedgehog 2", aligned, signed with debug keystore, and deployed to `/sdcard/Download/SonicTheHedgehog2.apk` on the Redmi for instant Xbox 360 gamepad play.
- **2026-10-16**: Inspected MD.emu in-game gamepad mapping configurations (`Key/Gamepad Input Setup` -> `SHANWAN PS3/PC Gamepad`). Confirmed ShanWan controller is detected as Player 1 with axis and button bindings. Disconnected all wireless ADB connections per user instruction.
- **2026-10-16**: Resolved RetroArch ShanWan USB gamepad issue on Redmi (`192.168.1.4:5555`). Fixed autoconfig profile name mismatch (`SHANWAN PS3/PC Gamepad` with VID `9571`, PID `1397`), moved profile into app-accessible storage (`/sdcard/Android/data/com.retroarch.aarch64/files/autoconfig/android/`), mapped hardware Start (`105`) and Select (`104`), and created game-specific Genesis Plus GX remap (`Sonic 2.rmp`) binding all face/shoulder buttons to Genesis Jump and Start buttons.
- **2026-10-17**: Configured standalone PS1 game **Kaettekita Cyborg Kuro-chan** (SLPM-87174) for RetroArch with ShanWan USB joystick support on Redmi (`192.168.1.4:5555`). Extracted ROM (`kaette kita.cue`/`.bin`), deployed official Libretro arm64-v8a `pcsx_rearmed_libretro_android.so` core and ROM to `/sdcard/Download/KuroChan/`, generated custom PCSX ReARMed remaps with `analog_dpad_mode = 1` for full joystick analog + D-pad support, and built standalone one-tap Android launcher APK `Cyborg-Kuro-Chan.apk` (package `local.kurochan.launcher`) with authentic high-res Kuro-chan box art icon deployed to `/sdcard/Download/Cyborg-Kuro-Chan.apk`.
- **2026-10-17**: Synced cross-device project repository to second laptop (`depanlaptop`, Linux environment) into `/home/depanlaptop/.gemini/antigravity/scratch/audioplayer`. Loaded and verified persistent memory bank (`MEMORY.md`, `AGENTS.md`, `GEMINI.md`). Established local working environment for seamless multi-laptop development.

---

## 📜 Detailed History of Conversations & Projects (Past 30 Days)

### 1. YouTube Channel Downloader Desktop App (2026-10-14 — 2026-10-15)
- **Session ID**: `7097d0b7-9d5e-4a64-a4b9-dd91d2fff489`
- **Location**: `/home/depanlaptop/.gemini/antigravity/scratch/youtube-channel-downloader`
- **What Was Built**:
  - Full native Desktop GUI application (Python / Tkinter) wrapping `yt-dlp`.
  - Scans entire YouTube channels, lists videos with metadata (titles, durations, views), and allows selective or batch downloading of video (MP4) or audio (MP3).
  - Multi-threaded download manager with live visual progress bars, cancel/resume support, and directory selection.
  - Launcher: `./run.sh`.

### 2. Stardew Valley GOG Linux Mint Installation (2026-10-09)
- **Session ID**: `d2c93d32-46d1-4679-8261-69d526345d8e`
- **User Request**: Install Stardew Valley on Linux Mint using an Arch AUR package link.
- **Resolution**:
  - Clarified why Arch AUR PKGBUILDs cannot be directly installed on Debian/Ubuntu-based Linux Mint.
  - Extracted game assets using GOG Linux native installer (`gog_stardew_valley_*.sh` / `innoextract`), configured Mono/FNA runtime dependencies, and created desktop shortcut.

### 3. Fullscreen Overlay & Modal Ad Blocker Extension (2026-10-05)
- **Session ID**: `300aa08c-c79c-40d3-84c1-32abd61b6e24`
- **Location**: `/home/depanlaptop/.gemini/antigravity/scratch/fullscreen-ad-blocker`
- **What Was Built**:
  - Firefox WebExtension specifically designed to destroy full-screen invisible click-hijack divs, anti-adblock modals, and JavaScript popup redirect loops.
  - MutationObserver script that scans DOM for `position: fixed; z-index: >9999` overlays blocking `pointer-events` or scrolling, restores `overflow: auto` on `<body>`/`<html>`, and neuters `window.open` traps.
  - Resolved browser tab freezing by throttling DOM mutation checks.

### 4. Family Finance Telegram Bot with AI Understanding (2026-10-01 — 2026-10-02)
- **Session ID**: `e5865763-727d-4d5b-8fd3-c54a64ffdeb6`
- **Location**: `/home/depanlaptop/.gemini/antigravity/scratch/family-finance-bot`
- **What Was Built**:
  - Python Telegram Bot for collaborative family finance and daily expense tracking.
  - Integrated Google Gemini AI to parse free-form natural language messages in Indonesian (e.g. *"beli beras 50rb di warung"*, *"bayar listrik 250k"*).
  - SQLite database storing transactions, income, expense categories, and monthly budgets.
  - Automatic voice note transcription & receipt breakdown parsing.
  - Interactive commands: `/rekap`, `/saldo`, `/kategori`, `/bantuan`.

### 5. Telegram Mobile Context & Journal Companion (2026-09-30 — 2026-10-01)
- **Session ID**: `477f08a8-c1e0-4ef4-a09c-95621fe4fa54`
- **Location**: `/home/depanlaptop/.gemini/antigravity/scratch/telegram-journal-bot`
- **What Was Built**:
  - Mobile-to-workstation context bridge: Telegram bot allowing user to send links, notes, images, and code snippets from mobile (iOS/Android) directly into their workstation context.
  - Built local web dashboard to view, tag, and search captured notes.

### 6. ShanWan USB Gamepad D-pad Axis Remapping (2026-09-27)
- **Session ID**: `6c792a01-65b2-4135-9f87-7cebcd0585b2`
- **Problem**: ShanWan USB controller (Xbox 360 clone) had inverted D-pad directions on Linux (pressing Up triggered Down, inverted horizontal axis).
- **Resolution**:
  - Identified driver/kernel axis inversion in `xpad` / generic USB HID driver.
  - Mapped physical axes using `evtest` / `jstest`.
  - Created custom SDL game controller mapping string and system udev rule to normalize analog hat and D-pad input across emulators.

### 7. Soundcore Q20i Bluetooth & Linux Mint Audio Fixes (2026-09-18, 2026-09-23, 2026-09-26)
- **Session IDs**: `45cc620a`, `a511c446`, `3cdfee1f`
- **Problems**: "No input device" error on laptop, missing audio, Discord error 3002, Soundcore Q20i headphones disconnecting or stuck in low-quality mono HSP/HFP profile.
- **Resolution**:
  - Restarted PipeWire / WirePlumber audio daemon subsystem:
    `systemctl --user restart wireplumber pipewire pipewire-pulse`
  - Fixed ALSA card indexing and default sink routing to Intel HDA / Bluetooth.
  - Configured Bluetooth audio profile switching so Soundcore Q20i locks to A2DP high-fidelity stereo sink for playback.

### 8. Android TV YouTube 24/7 Live Stream Recovery (2026-09-25)
- **Session ID**: `cb189466-8f61-4153-ac27-ae2be16005ca`
- **Target**: Android TV Micro-Server (`192.168.1.25`)
- **Action**:
  - Inspected background live stream service on the Android TV (`start1.sh` / `start2.sh`).
  - Fixed audio conversion for `YTDown.com` MP3 files, generated continuous looping video feed, and restored uninterrupted stream transmission.

### 9. Linux Mint APT Download Speed Optimization (2026-09-24)
- **Session ID**: `b33ea2a2-02f0-4967-801b-3c2c060e2156`
- **Problem**: Linux Mint Update Manager took excessively long to download packages like Firefox.
- **Resolution**:
  - Identified IPv6 DNS lookup stalls and slow Indonesian mirror latency.
  - Forced IPv4 in APT: `echo 'Acquire::ForceIPv4 "true";' | sudo tee /etc/apt/apt.conf.d/99force-ipv4`
  - Switched to fastest synchronized regional mirrors.

### 10. Kindle 11th Gen Jailbreak Analysis & Native Manga Sync Pipeline (2026-09-23)
- **Session ID**: `ac21c5a9-bcef-47e7-b71d-01f8cb07c2f0`
- **Location**: `/home/depanlaptop/kindle_diy` & `/home/depanlaptop/Downloads`
- **Actions**:
  - Analyzed Kindle 11th Gen running firmware `5.19.2.0.1` (firmware >= 5.16.x has patched software jailbreaks like LanguageBreak).
  - Developed alternative zero-jailbreak workflow: built automated batch manga converter (`kindle_tools.py`, `sync_manga_to_kindle.py`, `sync_mobi_to_kindle.py`).
  - Converted complete 16 volumes of *The Law of Ueki* into high-resolution native Kindle mobi/azw3 with proper metadata, reading direction, and cover art, synced over USB.

### 11. Redmi Watch 5 Active Modification Assessment (2026-09-23 — 2026-09-24)
- **Session ID**: `5b600775-4f06-449c-9087-623f8ee5d099`
- **Assessment**: Analyzed Redmi Watch 5 Active hardware & firmware. Because it runs lightweight proprietary RTOS (not full Android Wear OS), traditional Android ADB/rooting/jailbreaking is physically impossible; documented customization options via official watch face APIs.

### 12. MintubeLite Repair & Antigravity Desktop Launcher (2026-09-15 — 2026-09-16)
- **Session IDs**: `934e62e9`, `9bc88a54`
- **Location**: `/home/depanlaptop/mintube-lite`
- **Actions**:
  - Diagnosed startup error in `mintube-lite` (lightweight YouTube audio/video player). Corrected dependencies and launcher script.
  - Created standard FreeDesktop `.desktop` entry and icon integration for Antigravity in Linux Mint XFCE dock/panel.

### 13. Mobile Personalization & Android Game Emulation Experiments (2026-09-16)
- **Session IDs**: `833aa16d`, `1936011d`, `4233b024`
- **Actions**:
  - Diagnosed Xiaomi phone setting accessibility issue at `192.168.1.16`.
  - Explored running Angry Birds 2 on Linux Mint via lightweight Android runtimes (Waydroid / Anbox) without heavy virtualization.
  - Brainstormed development roadmaps for personal utilities.

### 14. Cross-Laptop Sync & Memory Integration (2026-10-16 — 2026-10-17)
- **Session IDs**: `128bc05a`, `01da096a`
- **Location**: `/home/depanlaptop/.gemini/antigravity/scratch/audioplayer`
- **Actions**:
  - Cloned GitHub repo `https://github.com/agamabela/audioplayer.git` onto `depanlaptop`.
  - Ingested persistent memory bank (`MEMORY.md`, `AGENTS.md`, `GEMINI.md`).
  - Configured git author `agamabela <agamabela@gmail.com>`.
  - Archived full 30-day conversational history into `MEMORY.md` to ensure zero context degradation across devices.







