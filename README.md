# 🎬 YouTube Frame Extractor

> **Extract frame-accurate video sequences from any YouTube video and bundle them into downloadable ZIP archives at 30× real-time speed.**

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-red.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Browser Support](https://img.shields.io/badge/Chrome%20%7C%20Edge%20%7C%20Brave-Supported-success.svg)](#)
[![Speed](https://img.shields.io/badge/Capture%20Speed-30%C3%97%20Realtime-brightgreen.svg)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## ⚡ Overview

Computer vision researchers, video editors, dataset curators, and AI creators frequently need clean image sequences from YouTube videos. Traditional workflows require bulky third-party software, screen recorders, or command-line scripts with `yt-dlp` and `ffmpeg`.

**YouTube Frame Extractor** is a lightweight, zero-dependency Manifest V3 browser extension that captures frames directly from the active YouTube HTML5 player tab and packages them into an organized `.zip` file with a single click.

---

## ✨ Features

* **⚡ Ultra-Fast 30× Extraction:**
  * Uses hardware-accelerated HTML5 Canvas rendering and deterministic seek listeners to capture up to 40 frames per second on buffered media.
* **🎯 Customizable Frame Rates:**
  * **1 FPS (Default):** Captures exactly one frame for every second of video (e.g., a 60-second clip yields ~60 images).
  * **2 FPS (High Density):** Captures a frame every 0.5 seconds.
  * **0.5 FPS (Overview):** Captures a frame every 2 seconds.
  * **Custom Intervals:** Configure custom second or millisecond intervals to match your exact project needs.
* **✂️ Custom Time Range Slicing:**
  * Extract frames from the entire video or specify precise Start and End timestamps (e.g., from `01:15` to `03:45`).
* **🔇 Smart Auto-Mute:**
  * Automatically mutes the video during the rapid scrubbing phase to prevent stuttering audio bursts, restoring your original volume upon completion.
* **🖼️ Format Flexibility:**
  * **JPEG (Default):** Optimized compression for rapid downloading and small archive sizes.
  * **PNG:** Lossless pixel-perfect frames ideal for machine learning datasets and high-end video editing.
* **🔒 100% Private & Local:**
  * All frame capture and ZIP packaging are performed entirely in-browser using bundled client-side JSZip. Zero external servers, zero API tokens, and zero rate limits.
* **🎛️ Dual Trigger Interfaces:**
  * Trigger extractions using the convenient in-page floating pill on YouTube or via the dedicated extension popup window.

---

## 🚀 Installation Guide (For Any User)

You can install YouTube Frame Extractor on any Chromium browser (**Google Chrome**, **Brave**, **Microsoft Edge**, **Opera**, or **Vivaldi**) in under a minute:

### Step 1: Download the Source Code

#### Option A (Using Git):
Open your terminal and clone the repository:
```bash
git clone https://github.com/sunny1256777-cloud/yt-frame-extractor.git
```

#### Option B (Download as ZIP):
1. Click the green **`<> Code`** button at the top of this GitHub repository.
2. Select **`Download ZIP`**.
3. Extract the downloaded `.zip` file into a folder on your computer.

---

### Step 2: Load into Your Browser

1. Open your browser and navigate to the Extensions management page:
   * **Google Chrome / Brave:** Visit `chrome://extensions/`
   * **Microsoft Edge:** Visit `edge://extensions/`
2. In the top-right corner, toggle **Developer mode** to **ON**.
3. In the top-left corner, click **"Load unpacked"**.
4. In the file picker, select the cloned or extracted `yt-frame-extractor` folder (the folder containing `manifest.json`).
5. **Done!** The extension is now active. Pin it to your browser toolbar for easy access.

---

## 📺 How to Use

1. Open any YouTube video (e.g., `https://www.youtube.com/watch?v=...`).
2. Click the extension icon in your browser toolbar or click the floating **"Extract Frames"** button on the bottom-right of the video page.
3. Configure your preferences:
   * **Frame Rate:** Choose 1 FPS, 2 FPS, or 0.5 FPS.
   * **Range:** Full Video or specific Start/End timestamps.
   * **Format:** JPEG or PNG.
4. Click **`Extract Frames & Download ZIP`**.
5. The extension will rapidly scrub the video, capture the frames, and automatically trigger a `.zip` download in your browser!

---

## 🛠️ Architecture & Technical Details

* **Platform:** Manifest V3 Chrome Extension
* **Frame Pipeline:** HTML5 `<video>` seek synchronization paired with 2D Offscreen Canvas extraction.
* **Archiving:** Pure client-side JSZip stream compression (`STORE` / `DEFLATE` mode).
* **State Management:** `chrome.storage.local` for persistent user preferences.

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
