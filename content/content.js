// YouTube Frame Extractor - Content Script
(function () {
  'use strict';

  let extractorState = {
    status: 'idle', // 'idle' | 'extracting' | 'paused' | 'zipping' | 'done' | 'cancelled' | 'error'
    currentFrame: 0,
    totalFrames: 0,
    progressPct: 0,
    statusText: '',
    errorMsg: '',
    videoTitle: '',
    duration: 0,
    cancelRequested: false,
    stopRequested: false,
    pauseRequested: false,
    resumePromiseResolve: null,
    zipInstance: null,
    capturedCount: 0
  };

  // Helper to find the active video element (supports normal video & YouTube Shorts)
  function getVideoElement() {
    const shortsVideo = document.querySelector('ytd-reel-video-renderer[is-active] video');
    if (shortsVideo) return shortsVideo;
    return document.querySelector('video.html5-main-video') || document.querySelector('video');
  }

  // Helper to get video title
  function getVideoTitle() {
    // Check Shorts title
    const shortsTitle = document.querySelector('ytd-reel-video-renderer[is-active] h2.title');
    if (shortsTitle && shortsTitle.innerText.trim()) {
      return shortsTitle.innerText.trim();
    }
    // Check normal video title
    const el = document.querySelector('h1.ytd-watch-metadata yt-formatted-string') ||
               document.querySelector('h1.title yt-formatted-string') ||
               document.querySelector('h1.ytd-video-primary-info-renderer');
    if (el && el.innerText.trim()) {
      return el.innerText.trim();
    }
    const docTitle = document.title.replace(/\s*-\s*YouTube$/, '').trim();
    return docTitle || 'youtube_video';
  }

  // Format seconds to mm:ss or hh:mm:ss
  function formatTime(seconds) {
    const s = Math.floor(seconds || 0);
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    if (hrs > 0) {
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  // Blazing-fast seek that works flawlessly whether video is PAUSED or PLAYING!
  // No requestVideoFrameCallback hang when paused!
  function seekVideo(video, targetTime) {
    return new Promise((resolve) => {
      // If video is already within 30ms of target, capture immediately
      if (Math.abs(video.currentTime - targetTime) < 0.035) {
        return resolve();
      }

      let settled = false;
      let timer = null;

      const finish = () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          video.removeEventListener('seeked', onSeeked);
          resolve();
        }
      };

      // 700ms fallback in case an unbuffered network chunk is loading
      timer = setTimeout(finish, 750);

      const onSeeked = () => {
        // 12ms micro-delay gives the GPU compositor time to commit the decoded frame
        setTimeout(finish, 12);
      };

      video.addEventListener('seeked', onSeeked, { once: true });
      video.currentTime = Math.min(targetTime, (video.duration || targetTime));
    });
  }

  // In-page UI creation & updates
  let floatingBtn = null;
  let overlayCard = null;

  function injectInPageUI() {
    if (document.getElementById('yt-fe-floating-btn')) return;

    floatingBtn = document.createElement('div');
    floatingBtn.id = 'yt-fe-floating-btn';
    floatingBtn.className = 'yt-fe-floating-btn';
    floatingBtn.innerHTML = `
      <svg viewBox="0 0 24 24"><path d="M4 4h3l2-2h6l2 2h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm8 3a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6z"/></svg>
      <span>Extract Frames</span>
    `;

    floatingBtn.addEventListener('click', () => {
      if (extractorState.status === 'idle' || extractorState.status === 'done' || extractorState.status === 'cancelled') {
        startExtraction({ intervalSec: 1, format: 'image/jpeg', quality: 0.85 });
      } else {
        showOverlayCard();
      }
    });

    document.body.appendChild(floatingBtn);
  }

  function showOverlayCard() {
    if (!overlayCard) {
      overlayCard = document.createElement('div');
      overlayCard.id = 'yt-fe-overlay-card';
      overlayCard.className = 'yt-fe-overlay-card';
      overlayCard.innerHTML = `
        <div class="yt-fe-card-header">
          <div class="yt-fe-card-title">
            <svg style="width:16px;height:16px;fill:#ff0033" viewBox="0 0 24 24"><path d="M4 4h3l2-2h6l2 2h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm8 3a5 5 0 1 0 0 10 5 5 0 0 0 0-10z"/></svg>
            <span>Frame Extractor</span>
            <span class="badge" id="yt-fe-badge">FAST 1 FPS</span>
          </div>
          <button class="yt-fe-close-btn" id="yt-fe-close" title="Minimize">×</button>
        </div>
        <div class="yt-fe-progress-info">
          <span id="yt-fe-count">0 / 0 frames</span>
          <span class="yt-fe-progress-pct" id="yt-fe-pct">0%</span>
        </div>
        <div class="yt-fe-progress-track">
          <div class="yt-fe-progress-bar" id="yt-fe-bar"></div>
        </div>
        <div class="yt-fe-status-text" id="yt-fe-status">Extracting...</div>
        <div class="yt-fe-actions-row">
          <button class="yt-fe-btn yt-fe-btn-stop" id="yt-fe-action-stop">⏹ Save Now</button>
          <button class="yt-fe-btn yt-fe-btn-cancel" id="yt-fe-action-cancel">✕ Cancel</button>
        </div>
      `;

      document.body.appendChild(overlayCard);

      document.getElementById('yt-fe-close').addEventListener('click', () => {
        overlayCard.style.display = 'none';
        if (floatingBtn) floatingBtn.style.display = 'flex';
      });

      document.getElementById('yt-fe-action-stop').addEventListener('click', () => {
        extractorState.stopRequested = true;
      });

      document.getElementById('yt-fe-action-cancel').addEventListener('click', () => {
        extractorState.cancelRequested = true;
      });
    }

    overlayCard.style.display = 'block';
  }

  function updateInPageUI() {
    if (!overlayCard) return;

    const bar = document.getElementById('yt-fe-bar');
    const pct = document.getElementById('yt-fe-pct');
    const count = document.getElementById('yt-fe-count');
    const status = document.getElementById('yt-fe-status');
    const badge = document.getElementById('yt-fe-badge');

    if (bar) bar.style.width = `${extractorState.progressPct}%`;
    if (pct) pct.innerText = `${extractorState.progressPct}%`;
    if (count) count.innerText = `${extractorState.currentFrame} / ${extractorState.totalFrames} frames`;
    if (status) status.innerText = extractorState.statusText;
    if (badge) badge.innerText = extractorState.status.toUpperCase();
  }

  // Main Extraction Workflow
  async function startExtraction(options = {}) {
    const video = getVideoElement();
    if (!video) {
      alert('YouTube video nahi mila! Please video load hone dein ya refresh karein.');
      return;
    }

    if (!window.JSZip) {
      alert('JSZip library load nahi hui. Please refresh the page.');
      return;
    }

    const intervalSec = parseFloat(options.intervalSec) || 1.0;
    const startTime = Math.max(0, parseFloat(options.startTime) || 0);
    const duration = video.duration || 60;
    const endTime = Math.min(duration, parseFloat(options.endTime) || duration);
    const mimeType = options.format === 'image/png' ? 'image/png' : 'image/jpeg';
    const quality = parseFloat(options.quality) || 0.85;
    const ext = mimeType === 'image/png' ? 'png' : 'jpg';

    // Calculate time slots (e.g. 0s, 1s, 2s, 3s...)
    const timeSlots = [];
    for (let t = startTime; t <= endTime; t += intervalSec) {
      timeSlots.push(t);
    }
    if (timeSlots.length === 0) {
      timeSlots.push(startTime);
    }

    // Initialize state
    extractorState.status = 'extracting';
    extractorState.totalFrames = timeSlots.length;
    extractorState.currentFrame = 0;
    extractorState.capturedCount = 0;
    extractorState.progressPct = 0;
    extractorState.cancelRequested = false;
    extractorState.stopRequested = false;
    extractorState.pauseRequested = false;
    extractorState.statusText = 'Starting fast extraction...';
    extractorState.videoTitle = getVideoTitle();
    extractorState.duration = duration;

    showOverlayCard();
    updateInPageUI();

    // Preserve original user playback state
    const origTime = video.currentTime;
    const origPaused = video.paused;
    const origMuted = video.muted;

    // Keep video paused during scrubbing so it doesn't wander or fight with seeking
    video.pause();
    video.muted = true;

    // Prevent YouTube player from auto-resuming while we are extracting
    const preventAutoPlay = (e) => {
      if (extractorState.status === 'extracting') {
        video.pause();
      }
    };
    video.addEventListener('play', preventAutoPlay);

    // Wait if video hasn't loaded data yet
    if (video.readyState < 2) {
      extractorState.statusText = 'Buffering video initial frames...';
      updateInPageUI();
      await new Promise((res) => {
        const onReady = () => {
          video.removeEventListener('loadeddata', onReady);
          video.removeEventListener('canplay', onReady);
          res();
        };
        video.addEventListener('loadeddata', onReady, { once: true });
        video.addEventListener('canplay', onReady, { once: true });
        setTimeout(res, 1500);
      });
    }

    // Create Canvas for frame grabbing
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');

    const zip = new window.JSZip();
    extractorState.zipInstance = zip;
    const folder = zip.folder("frames");

    try {
      for (let i = 0; i < timeSlots.length; i++) {
        // Handle cancel
        if (extractorState.cancelRequested) {
          extractorState.status = 'cancelled';
          extractorState.statusText = 'Extraction cancelled.';
          updateInPageUI();
          break;
        }

        // Handle early stop & save
        if (extractorState.stopRequested) {
          extractorState.statusText = 'Stopping early, packaging ZIP...';
          updateInPageUI();
          break;
        }

        // Handle pause
        if (extractorState.pauseRequested) {
          extractorState.status = 'paused';
          extractorState.statusText = 'Paused. Click Resume to continue.';
          updateInPageUI();
          await new Promise((resolve) => {
            extractorState.resumePromiseResolve = resolve;
          });
          extractorState.status = 'extracting';
        }

        const t = timeSlots[i];
        extractorState.currentFrame = i + 1;
        extractorState.statusText = `Capturing frame ${i + 1}/${timeSlots.length} (${formatTime(t)})`;
        extractorState.progressPct = Math.round(((i + 1) / timeSlots.length) * 100);
        updateInPageUI();

        // 1. Fast Seek (works 100% while paused)
        await seekVideo(video, t);

        // 2. Draw current frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // 3. Convert to blob
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, mimeType, quality));

        if (blob) {
          const frameNum = String(i + 1).padStart(5, '0');
          const timeLabel = String(Math.floor(t)).padStart(5, '0');
          const fileName = `frame_${frameNum}_sec_${timeLabel}.${ext}`;
          folder.file(fileName, blob);
          extractorState.capturedCount++;
        }
      }

      // Restore user's previous video playback position & settings
      video.removeEventListener('play', preventAutoPlay);
      video.currentTime = origTime;
      video.muted = origMuted;
      if (!origPaused && !extractorState.cancelRequested) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }

      // Generate ZIP if frames were captured
      if (!extractorState.cancelRequested && extractorState.capturedCount > 0) {
        extractorState.status = 'zipping';
        extractorState.statusText = `Packaging ${extractorState.capturedCount} frames into ZIP...`;
        updateInPageUI();

        // Use STORE for JPEGs (instant packaging without wasting CPU re-compressing JPEGs!)
        const isJpg = (ext === 'jpg');
        const zipBlob = await zip.generateAsync({
          type: 'blob',
          compression: isJpg ? 'STORE' : 'DEFLATE',
          compressionOptions: { level: isJpg ? 1 : 4 }
        }, (metadata) => {
          extractorState.statusText = `Compressing ZIP: ${Math.round(metadata.percent)}%`;
          extractorState.progressPct = Math.round(metadata.percent);
          updateInPageUI();
        });

        // Trigger Instant Download
        extractorState.status = 'done';
        extractorState.statusText = `Success! ${extractorState.capturedCount} frames downloaded.`;
        extractorState.progressPct = 100;
        updateInPageUI();

        const cleanTitle = extractorState.videoTitle.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim().replace(/\s+/g, '_') || 'youtube_frames';
        const downloadUrl = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `${cleanTitle}_frames_${extractorState.capturedCount}.zip`;
        document.body.appendChild(a);
        a.click();

        setTimeout(() => {
          URL.revokeObjectURL(downloadUrl);
          a.remove();
        }, 15000);

      } else if (extractorState.cancelRequested) {
        extractorState.status = 'cancelled';
        extractorState.statusText = 'Extraction cancelled.';
        updateInPageUI();
      }

    } catch (err) {
      console.error('Frame extraction error:', err);
      extractorState.status = 'error';
      extractorState.errorMsg = err.message;
      extractorState.statusText = `Error: ${err.message}`;
      updateInPageUI();
    } finally {
      video.removeEventListener('play', preventAutoPlay);
      video.currentTime = origTime;
      video.muted = origMuted;
      if (origPaused) {
        video.pause();
      }
    }
  }

  // Handle Chrome Extension Messages
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const video = getVideoElement();

    if (message.type === 'GET_STATUS') {
      sendResponse({
        foundVideo: !!video,
        videoTitle: video ? getVideoTitle() : '',
        duration: video ? (video.duration || 0) : 0,
        videoWidth: video ? video.videoWidth : 0,
        videoHeight: video ? video.videoHeight : 0,
        currentTime: video ? video.currentTime : 0,
        state: extractorState
      });
      return true;
    }

    if (message.type === 'START_EXTRACTION') {
      startExtraction(message.options || {});
      sendResponse({ success: true });
      return true;
    }

    if (message.type === 'PAUSE_EXTRACTION') {
      extractorState.pauseRequested = true;
      sendResponse({ success: true });
      return true;
    }

    if (message.type === 'RESUME_EXTRACTION') {
      extractorState.pauseRequested = false;
      if (extractorState.resumePromiseResolve) {
        extractorState.resumePromiseResolve();
        extractorState.resumePromiseResolve = null;
      }
      sendResponse({ success: true });
      return true;
    }

    if (message.type === 'STOP_AND_SAVE') {
      extractorState.stopRequested = true;
      if (extractorState.resumePromiseResolve) {
        extractorState.resumePromiseResolve();
        extractorState.resumePromiseResolve = null;
      }
      sendResponse({ success: true });
      return true;
    }

    if (message.type === 'CANCEL_EXTRACTION') {
      extractorState.cancelRequested = true;
      if (extractorState.resumePromiseResolve) {
        extractorState.resumePromiseResolve();
        extractorState.resumePromiseResolve = null;
      }
      sendResponse({ success: true });
      return true;
    }
  });

  // Watch for YouTube URL and page changes (SPA navigation)
  function setupPageWatcher() {
    setInterval(() => {
      const isWatchPage = window.location.pathname.startsWith('/watch') || window.location.pathname.startsWith('/shorts');
      const video = getVideoElement();

      if (isWatchPage && video) {
        injectInPageUI();
        if (floatingBtn && (extractorState.status === 'idle' || extractorState.status === 'done' || extractorState.status === 'cancelled')) {
          floatingBtn.style.display = 'flex';
        }
      } else {
        if (floatingBtn) floatingBtn.style.display = 'none';
      }
    }, 1200);
  }

  // Initialize
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setupPageWatcher();
  } else {
    document.addEventListener('DOMContentLoaded', setupPageWatcher);
  }

})();
