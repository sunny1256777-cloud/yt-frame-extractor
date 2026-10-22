// YouTube Frame Extractor - Popup Logic
document.addEventListener('DOMContentLoaded', async () => {
  const statusDot = document.getElementById('status-dot');
  const statusLabel = document.getElementById('status-label');
  const videoDetails = document.getElementById('video-details');
  const videoTitleEl = document.getElementById('video-title');
  const badgeDuration = document.getElementById('badge-duration');
  const badgeResolution = document.getElementById('badge-resolution');
  const badgeEstFrames = document.getElementById('badge-est-frames');

  const settingsCard = document.getElementById('settings-card');
  const intervalSelect = document.getElementById('interval-select');
  const customIntervalGroup = document.getElementById('custom-interval-group');
  const customIntervalInput = document.getElementById('custom-interval');

  const rangeAllRadio = document.getElementById('range-all');
  const rangeCustomRadio = document.getElementById('range-custom');
  const customRangeGroup = document.getElementById('custom-range-group');
  const rangeStartInput = document.getElementById('range-start');
  const rangeEndInput = document.getElementById('range-end');

  const formatSelect = document.getElementById('format-select');
  const qualitySelect = document.getElementById('quality-select');

  const progressCard = document.getElementById('progress-card');
  const progressStatusText = document.getElementById('progress-status-text');
  const progressPct = document.getElementById('progress-pct');
  const progressFill = document.getElementById('progress-fill');
  const progressCount = document.getElementById('progress-count');
  const progressStateBadge = document.getElementById('progress-state-badge');

  const btnStart = document.getElementById('btn-start');
  const btnPause = document.getElementById('btn-pause');
  const btnStopSave = document.getElementById('btn-stop-save');
  const btnCancel = document.getElementById('btn-cancel');

  let currentTabId = null;
  let videoDuration = 0;
  let isPolling = false;
  let pollInterval = null;

  // Format seconds to mm:ss
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

  // Get current active interval
  function getSelectedInterval() {
    if (intervalSelect.value === 'custom') {
      return Math.max(0.1, parseFloat(customIntervalInput.value) || 1.0);
    }
    return parseFloat(intervalSelect.value) || 1.0;
  }

  // Update Estimated frames badge
  function updateEstimate() {
    if (!videoDuration) return;
    const interval = getSelectedInterval();
    let start = 0;
    let end = videoDuration;

    if (rangeCustomRadio.checked) {
      start = Math.max(0, parseFloat(rangeStartInput.value) || 0);
      end = Math.min(videoDuration, parseFloat(rangeEndInput.value) || videoDuration);
    }

    const rangeDiff = Math.max(0, end - start);
    const estCount = Math.floor(rangeDiff / interval) + 1;
    badgeEstFrames.innerText = `🎞 ~${estCount} frames`;
  }

  // Event Listeners for controls
  intervalSelect.addEventListener('change', () => {
    if (intervalSelect.value === 'custom') {
      customIntervalGroup.classList.remove('hidden');
    } else {
      customIntervalGroup.classList.add('hidden');
    }
    updateEstimate();
  });

  customIntervalInput.addEventListener('input', updateEstimate);

  rangeAllRadio.addEventListener('change', () => {
    customRangeGroup.classList.add('hidden');
    updateEstimate();
  });

  rangeCustomRadio.addEventListener('change', () => {
    customRangeGroup.classList.remove('hidden');
    updateEstimate();
  });

  rangeStartInput.addEventListener('input', updateEstimate);
  rangeEndInput.addEventListener('input', updateEstimate);

  // Send message safely to current active tab
  async function sendMessageToTab(msg) {
    if (!currentTabId) return null;
    try {
      return await chrome.tabs.sendMessage(currentTabId, msg);
    } catch (e) {
      return null;
    }
  }

  // Poll state from content script
  async function pollStatus() {
    const res = await sendMessageToTab({ type: 'GET_STATUS' });
    if (!res) return;

    const state = res.state;
    if (!state) return;

    if (state.status === 'extracting' || state.status === 'paused' || state.status === 'zipping') {
      progressCard.classList.remove('hidden');
      settingsCard.classList.add('hidden');
      btnStart.classList.add('hidden');

      progressFill.style.width = `${state.progressPct}%`;
      progressPct.innerText = `${state.progressPct}%`;
      progressCount.innerText = `${state.currentFrame} / ${state.totalFrames} frames`;
      progressStatusText.innerText = state.statusText;
      progressStateBadge.innerText = state.status.toUpperCase();

      if (state.status === 'paused') {
        btnPause.innerText = '▶ Resume';
      } else {
        btnPause.innerText = '⏸ Pause';
      }
    } else if (state.status === 'done') {
      progressFill.style.width = '100%';
      progressPct.innerText = '100%';
      progressCount.innerText = `${state.capturedCount} frames ready!`;
      progressStatusText.innerText = 'ZIP downloaded successfully!';
      progressStateBadge.innerText = 'DONE';
      btnPause.classList.add('hidden');
      btnStopSave.classList.add('hidden');
      btnCancel.innerText = '✓ Close';

      btnStart.classList.remove('hidden');
      btnStart.disabled = false;
      btnStart.querySelector('span').innerText = 'Extract Again';
      clearInterval(pollInterval);
      isPolling = false;
    } else if (state.status === 'cancelled') {
      progressCard.classList.add('hidden');
      settingsCard.classList.remove('hidden');
      btnStart.classList.remove('hidden');
      btnStart.disabled = false;
      btnStart.querySelector('span').innerText = 'Extract Frames & Download ZIP';
      clearInterval(pollInterval);
      isPolling = false;
    }
  }

  function startPolling() {
    if (isPolling) return;
    isPolling = true;
    pollStatus();
    pollInterval = setInterval(pollStatus, 180);
  }

  // Button actions
  btnStart.addEventListener('click', async () => {
    btnStart.disabled = true;
    const intervalSec = getSelectedInterval();
    let startTime = 0;
    let endTime = videoDuration;

    if (rangeCustomRadio.checked) {
      startTime = Math.max(0, parseFloat(rangeStartInput.value) || 0);
      endTime = Math.min(videoDuration, parseFloat(rangeEndInput.value) || videoDuration);
    }

    const options = {
      intervalSec,
      startTime,
      endTime,
      format: formatSelect.value,
      quality: parseFloat(qualitySelect.value)
    };

    const res = await sendMessageToTab({
      type: 'START_EXTRACTION',
      options
    });

    if (res && res.success) {
      startPolling();
    } else {
      alert('Extraction start nahi ho paaya. Tab refresh karke try karein.');
      btnStart.disabled = false;
    }
  });

  btnPause.addEventListener('click', async () => {
    if (btnPause.innerText.includes('Pause')) {
      await sendMessageToTab({ type: 'PAUSE_EXTRACTION' });
      btnPause.innerText = '▶ Resume';
    } else {
      await sendMessageToTab({ type: 'RESUME_EXTRACTION' });
      btnPause.innerText = '⏸ Pause';
    }
  });

  btnStopSave.addEventListener('click', async () => {
    await sendMessageToTab({ type: 'STOP_AND_SAVE' });
  });

  btnCancel.addEventListener('click', async () => {
    await sendMessageToTab({ type: 'CANCEL_EXTRACTION' });
    progressCard.classList.add('hidden');
    settingsCard.classList.remove('hidden');
    btnStart.classList.remove('hidden');
    btnStart.disabled = false;
    clearInterval(pollInterval);
    isPolling = false;
  });

  // Main Initializer
  async function init() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) {
      statusLabel.innerText = 'Koi tab detect nahi hui.';
      statusDot.className = 'status-dot error';
      return;
    }

    currentTabId = tab.id;

    if (!tab.url.includes('youtube.com')) {
      statusLabel.innerText = 'Please YouTube video page open karein.';
      statusDot.className = 'status-dot error';
      btnStart.disabled = true;
      return;
    }

    statusLabel.innerText = 'Connecting to YouTube video...';
    let res = await sendMessageToTab({ type: 'GET_STATUS' });

    // In case content script wasn't ready yet, inject and retry
    if (!res) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['lib/jszip.min.js', 'content/content.js']
        });
        await chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ['content/content.css']
        });
        await new Promise(r => setTimeout(r, 300));
        res = await sendMessageToTab({ type: 'GET_STATUS' });
      } catch (err) {
        console.warn('Script injection notice:', err);
      }
    }

    if (res && res.foundVideo) {
      videoDuration = Math.floor(res.duration || 0);
      statusDot.className = 'status-dot active';
      statusLabel.innerText = 'YouTube Video Detected ✓';

      videoTitleEl.innerText = res.videoTitle || 'YouTube Video';
      badgeDuration.innerText = `⏱ ${formatTime(videoDuration)}`;
      badgeResolution.innerText = `📐 ${res.videoWidth || 1280}x${res.videoHeight || 720}`;
      rangeEndInput.value = videoDuration;

      videoDetails.classList.remove('hidden');
      btnStart.disabled = false;

      updateEstimate();

      // Check if already extracting
      if (res.state && (res.state.status === 'extracting' || res.state.status === 'zipping' || res.state.status === 'paused')) {
        startPolling();
      }
    } else {
      statusDot.className = 'status-dot error';
      statusLabel.innerText = 'No active video player found on this page.';
      btnStart.disabled = true;
    }
  }

  init();
});
