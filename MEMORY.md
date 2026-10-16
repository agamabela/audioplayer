# 🧠 Project Memory Bank

*Last updated: 2026-10-16*

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

---

## 📜 Full Conversation History & Technical Changelog

### 1. Genesis / Sonic The Hedgehog 2 Standalone & Joystick Resolution
- **Goal**: Create a 1-tap dedicated Android launcher for Sonic 2 with full physical joystick control.
- **Hardware & Environment**:
  - Tablet: Redmi Pad SE / 25040RP0AG (`192.168.1.4:5555`) running Android 16 (API 36).
  - Controller: SHANWAN USB PS3/PC Gamepad (Vendor ID: `9571` / `0x2563`, Product ID: `1397` / `0x0575`).
- **Initial Roadblocks & Solutions**:
  - *Play Protect / Install Restrictions*: Android 16 rejected silent ADB installs (`INSTALL_FAILED_USER_RESTRICTED`). Transferred `RetroArch-Sonic-Setup.apk` (175 MB) to `/sdcard/Download/` for manual user installation.
  - *First Launcher Route*: Initial launcher launched basic RetroArch UI rather than the ROM directly. Patched launcher to target `com.retroarch.browser.debug.CoreSideloadActivity` passing explicit extras:
    - `ROM`: `/sdcard/Download/Sonic2/Sonic 2.gen`
    - `LIBRETRO`: `/sdcard/Download/Sonic2/genesis_plus_gx_libretro_android.so`
    - Flags: `0x24000000` (`FLAG_ACTIVITY_NEW_TASK | FLAG_ACTIVITY_CLEAR_TOP`).
    - Released: `Sonic-The-Hedgehog-2-Fixed.apk`.
  - *Gamepad Mismatch & "Shanwan Fallback"*:
    - Touchpad worked, but physical joystick buttons/axes were unmapped or showed fallback warnings.
    - Diagnosed RetroArch autoconfig lookup: RetroArch required autoconfig profiles placed in scoped storage `/sdcard/Android/data/com.retroarch.aarch64/files/autoconfig/android/`.
    - Authored and deployed `SHANWAN_PS3_PC_Gamepad.cfg`:
      - Device Name: `"SHANWAN PS3/PC Gamepad"` (VID `9571`, PID `1397`).
      - Face Buttons: B=`96` (A), A=`97` (B), Y=`98` (X), X=`100` (Y).
      - Menu/Options: Start=`105` (scanCode 313), Select=`104` (scanCode 314).
      - Shoulders: L1=`102`, R1=`103`, L2=`104`, R2=`105`.
      - Hat/D-pad: `h0up`, `h0down`, `h0left`, `h0right`.
      - Left Analog Stick: Axis `0` (X) and Axis `1` (Y).
    - Game Remap (`Sonic 2.rmp`): Set `analog_dpad_mode = 1` so left analog stick translates to D-pad, and bound action buttons to jump. User confirmed Sonic 2 fully working with the joystick.

### 2. Kaettekita Cyborg Kuro-chan (PS1) Standalone Setup
- **Goal**: Replicate the standalone launcher and joystick support for the PS1 classic *Kaettekita Cyborg Kuro-chan* (帰ってきた サイボーグクロちゃん - SLPM-87174).
- **Asset Acquisition & Processing**:
  - Extracted game archive from user link (`https://www.retrogames.cc/psx-games/kaettekita-cyborg-kuro-chan.html`) into `kaette kita.cue` (77 bytes) and `kaette kita.bin` (25.9 MB).
  - Fetched official 64-bit ARM core: `pcsx_rearmed_libretro_android.so` (arm64-v8a) from libretro buildbot.
  - Deployed game files and core to `/sdcard/Download/KuroChan/`.
- **Core & Controller Configuration**:
  - Verified PCSX ReARMed HLE BIOS boots `SLPM_871.74;1` directly.
  - Deployed custom remaps (`PCSX-ReARMed.rmp` and `kaette kita.rmp`) enabling `input_player1_analog_dpad_mode = "1"`.
  - Buttons mapped 1:1 with PS1 Retropad: Cross/A = Jump, Circle/B = Shoot, Square/X = Attack, Triangle/Y = Switch Weapon, Start = Pause/Start.
  - Captured test gameplay screenshots confirming full 60 FPS rendering and HUD active.
- **Dedicated Android Launcher APK**:
  - Package: `local.kurochan.launcher`
  - Activity: `local.kurochan.launcher.KurochanLauncherActivity`
  - App Name: `Cyborg Kuro-chan`
  - Custom Icon: Extracted official Japanese cover art from PSX Data Center, processed via macOS `sips` into multi-dpi mipmap drawables (`mdpi`, `xhdpi`, `xxhdpi`, `xxxhdpi`).
  - Smali Architecture: Launches `CoreSideloadActivity` targeting `/sdcard/Download/KuroChan/kaette kita.cue` and core `/sdcard/Download/KuroChan/pcsx_rearmed_libretro_android.so`, then finishes.
  - Built with `apktool 2.10.0`, aligned with `zipalign`, and signed with debug keystore (`apksigner`).
  - Deployed to `/sdcard/Download/Cyborg-Kuro-Chan.apk`.

### 3. Repository Synchronization
- **Git Repository**: `https://github.com/agamabela/audioplayer.git`
- **Tracked Memory File**: `MEMORY.md`
- **Sync Command**: `git add AGENTS.md GEMINI.md MEMORY.md && git commit -m "..." && git push origin main`
- **Other Devices**: Pull updates via `git pull origin main`.




