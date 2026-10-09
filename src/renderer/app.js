// Elements
const setupView = document.getElementById('setupView');
const previewView = document.getElementById('previewView');
const statusBadge = document.getElementById('statusBadge');
const statusText = document.getElementById('statusText');
const sourcesGrid = document.getElementById('sourcesGrid');
const refreshSourcesBtn = document.getElementById('refreshSourcesBtn');
const micSelect = document.getElementById('micSelect');
const camSelect = document.getElementById('camSelect');
const camSettingItem = document.getElementById('camSettingItem');
const sourceCard = document.getElementById('sourceCard');
const qualitySelect = document.getElementById('qualitySelect');
const startRecordBtn = document.getElementById('startRecordBtn');
const vuMeterBar = document.getElementById('vuMeterBar');

// Preview View Elements
const previewPlayer = document.getElementById('previewPlayer');
const videoMetaText = document.getElementById('videoMetaText');
const saveMp4Btn = document.getElementById('saveMp4Btn');
const saveWebmBtn = document.getElementById('saveWebmBtn');
const newRecordBtn = document.getElementById('newRecordBtn');
const saveStatusMessage = document.getElementById('saveStatusMessage');

// Auto-Zoom Elements
const autoZoomToggle = document.getElementById('autoZoomToggle');
const autoZoomOptions = document.getElementById('autoZoomOptions');
const zoomLevelButtons = document.querySelectorAll('.btn-level');

// State
let selectedMode = 'screen-cam'; // 'screen-cam' | 'screen-only' | 'cam-only'
let selectedSourceId = null;
let currentRecordedBlob = null;
let recordedChunks = [];
let mediaRecorder = null;
let timerInterval = null;
let elapsedSeconds = 0;
let activeScreenStream = null;
let activeMicStream = null;
let activeCamStream = null;
let audioContext = null;
let analyserNode = null;
let vuMeterAnimationId = null;
let lastSavedFilePath = null;

// Smart Auto-Zoom State
let selectedZoomLevel = 1.6;
let autoZoomRunning = false;
let autoZoomCancelId = null;
let autoZoomTrackerTimer = null;
let autoZoomWatchdog = null;

// Initialize
async function init() {
  setupModeSelector();
  await refreshDeviceList();
  await loadSources();
  setupEventListeners();
  setupIPCListeners();
  initAudioMeter();
}

// Mode Selection
function setupModeSelector() {
  const tabs = document.querySelectorAll('.mode-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const radio = tab.querySelector('input');
      radio.checked = true;
      selectedMode = radio.value;

      if (selectedMode === 'cam-only') {
        sourceCard.style.display = 'none';
        camSettingItem.style.display = 'flex';
      } else if (selectedMode === 'screen-only') {
        sourceCard.style.display = 'flex';
        camSettingItem.style.display = 'none';
      } else {
        sourceCard.style.display = 'flex';
        camSettingItem.style.display = 'flex';
      }
    });
  });
}

// Source Selection State
let activeSourceType = 'screen'; // 'screen' | 'window'
let allFetchedSources = [];

let sourceFilterTabsInitialized = false;

// Load Screens and Windows
function setupSourceFilterTabs() {
  if (sourceFilterTabsInitialized) return;
  const tabScreensBtn = document.getElementById('tabScreensBtn');
  const tabWindowsBtn = document.getElementById('tabWindowsBtn');

  if (tabScreensBtn && tabWindowsBtn) {
    sourceFilterTabsInitialized = true;
    tabScreensBtn.addEventListener('click', () => {
      activeSourceType = 'screen';
      tabScreensBtn.classList.add('active');
      tabWindowsBtn.classList.remove('active');
      const screenOnly = allFetchedSources.filter(s => s.isScreen || (s.id && s.id.startsWith('screen:')));
      if (screenOnly.length > 0) {
        selectedSourceId = screenOnly[0].id;
      }
      renderFilteredSources();
    });

    tabWindowsBtn.addEventListener('click', () => {
      activeSourceType = 'window';
      tabWindowsBtn.classList.add('active');
      tabScreensBtn.classList.remove('active');
      const windowOnly = allFetchedSources.filter(s => !s.isScreen && !(s.id && s.id.startsWith('screen:')));
      if (windowOnly.length > 0) {
        selectedSourceId = windowOnly[0].id;
      }
      renderFilteredSources();
    });
  }
}

function renderFilteredSources() {
  sourcesGrid.innerHTML = '';

  const filtered = allFetchedSources.filter(source => {
    const isScreen = source.isScreen || (source.id && source.id.startsWith('screen:'));
    return activeSourceType === 'screen' ? isScreen : !isScreen;
  });

  if (filtered.length === 0) {
    sourcesGrid.innerHTML = `<div class="sources-loading">${
      activeSourceType === 'screen' ? 'Ekran topilmadi' : 'Ochiq dasturlar topilmadi'
    }</div>`;
    return;
  }

  // Ensure selectedSourceId belongs to current active filter if possible
  const hasActive = filtered.some(s => s.id === selectedSourceId);
  if (!hasActive && filtered.length > 0) {
    selectedSourceId = filtered[0].id;
  }

  filtered.forEach((source) => {
    const card = document.createElement('div');
    card.className = 'source-item';
    if (source.id === selectedSourceId) {
      card.classList.add('active');
    }

    const img = document.createElement('img');
    img.className = 'source-thumb';
    img.src = source.thumbnail;
    img.alt = source.name;

    const title = document.createElement('div');
    title.className = 'source-title';
    title.title = source.name;

    if (source.appIcon) {
      const icon = document.createElement('img');
      icon.className = 'source-icon';
      icon.src = source.appIcon;
      title.appendChild(icon);
    }

    const isScreen = source.isScreen || (source.id && source.id.startsWith('screen:'));
    const nameSpan = document.createElement('span');
    nameSpan.textContent = isScreen ? `🖥️ ${source.name}` : source.name;
    title.appendChild(nameSpan);

    card.appendChild(img);
    card.appendChild(title);

    card.addEventListener('click', () => {
      document.querySelectorAll('.source-item').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      selectedSourceId = source.id;
    });

    sourcesGrid.appendChild(card);
  });
}

async function loadSources() {
  if (!window.electronAPI) return;
  setupSourceFilterTabs();
  sourcesGrid.innerHTML = '<div class="sources-loading">Ekranlar qidirilmoqda...</div>';

  try {
    allFetchedSources = await window.electronAPI.getSources();

    const screenOnly = allFetchedSources.filter(s => s.isScreen || (s.id && s.id.startsWith('screen:')));
    const windowOnly = allFetchedSources.filter(s => !s.isScreen && !(s.id && s.id.startsWith('screen:')));

    if (activeSourceType === 'screen') {
      if (screenOnly.length > 0) {
        selectedSourceId = screenOnly[0].id;
      } else if (allFetchedSources.length > 0) {
        selectedSourceId = allFetchedSources[0].id;
      }
    } else {
      if (windowOnly.length > 0) {
        selectedSourceId = windowOnly[0].id;
      } else if (allFetchedSources.length > 0) {
        selectedSourceId = allFetchedSources[0].id;
      }
    }

    renderFilteredSources();
  } catch (err) {
    console.error('Error fetching sources:', err);
    sourcesGrid.innerHTML = '<div class="sources-loading">Xatolik yuz berdi</div>';
  }
}

// Enumerate Microphones and Cameras
async function refreshDeviceList() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    micSelect.innerHTML = '';
    camSelect.innerHTML = '';

    let micCount = 0;
    let camCount = 0;

    devices.forEach(device => {
      const option = document.createElement('option');
      option.value = device.deviceId;

      if (device.kind === 'audioinput') {
        micCount++;
        option.textContent = device.label || `Mikrofon ${micCount}`;
        micSelect.appendChild(option);
      } else if (device.kind === 'videoinput') {
        camCount++;
        option.textContent = device.label || `Veb-kamera ${camCount}`;
        camSelect.appendChild(option);
      }
    });

    if (micCount === 0) {
      const opt = document.createElement('option');
      opt.textContent = 'Mikrofon topilmadi';
      micSelect.appendChild(opt);
    }
    if (camCount === 0) {
      const opt = document.createElement('option');
      opt.textContent = 'Kamera topilmadi';
      camSelect.appendChild(opt);
    }
  } catch (err) {
    console.error('Device enum error:', err);
  }
}

// Live VU Meter for Microphone
async function initAudioMeter() {
  try {
    const micId = micSelect.value;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: micId ? { deviceId: { exact: micId } } : true,
      video: false
    });

    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(stream);
    analyserNode = audioContext.createAnalyser();
    analyserNode.fftSize = 64;
    source.connect(analyserNode);

    const dataArray = new Uint8Array(analyserNode.frequencyBinCount);

    function updateMeter() {
      if (!analyserNode) return;
      analyserNode.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length;
      const percentage = Math.min(100, Math.round((average / 128) * 100));
      vuMeterBar.style.width = `${percentage}%`;
      vuMeterAnimationId = requestAnimationFrame(updateMeter);
    }

    updateMeter();
  } catch (e) {
    console.warn('Audio meter init error (mic permission might be needed):', e);
  }
}

micSelect.addEventListener('change', () => {
  if (vuMeterAnimationId) cancelAnimationFrame(vuMeterAnimationId);
  if (audioContext) audioContext.close();
  initAudioMeter();
});

// Setup event listeners
function setupEventListeners() {
  refreshSourcesBtn.addEventListener('click', loadSources);

  startRecordBtn.addEventListener('click', handleStartClick);

  saveMp4Btn.addEventListener('click', () => handleSaveRecording('mp4'));
  saveWebmBtn.addEventListener('click', () => handleSaveRecording('webm'));

  newRecordBtn.addEventListener('click', () => {
    previewView.style.display = 'none';
    setupView.style.display = 'block';
    currentRecordedBlob = null;
    saveStatusMessage.style.display = 'none';
    statusText.textContent = 'Tayyor';
    document.querySelector('.status-dot').style.backgroundColor = 'var(--success)';
  });

  const quickScreenshotBtn = document.getElementById('quickScreenshotBtn');
  if (quickScreenshotBtn) {
    quickScreenshotBtn.addEventListener('click', () => {
      if (window.electronAPI && window.electronAPI.triggerScreenshot) {
        window.electronAPI.triggerScreenshot();
      }
    });
  }

  // Auto-Zoom listeners
  if (autoZoomToggle) {
    autoZoomToggle.addEventListener('change', () => {
      if (autoZoomOptions) {
        autoZoomOptions.style.opacity = autoZoomToggle.checked ? '1' : '0.4';
        autoZoomOptions.style.pointerEvents = autoZoomToggle.checked ? 'auto' : 'none';
      }
    });
  }

  zoomLevelButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      zoomLevelButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedZoomLevel = parseFloat(btn.dataset.level);
    });
  });
}

// Start Record clicked: invoke main process to show countdown & overlay
async function handleStartClick() {
  if (selectedMode !== 'cam-only' && !selectedSourceId) {
    alert("Iltimos, yozib olish uchun ekranni tanlang!");
    return;
  }

  statusText.textContent = "Tayyorlanmoqda...";
  document.querySelector('.status-dot').style.backgroundColor = '#eab308';

  const config = {
    mode: selectedMode,
    sourceId: selectedSourceId,
    micId: micSelect.value,
    camId: camSelect.value,
    quality: qualitySelect.value,
    hasCamera: selectedMode === 'screen-cam',
    autoZoom: autoZoomToggle ? autoZoomToggle.checked : true,
    zoomLevel: selectedZoomLevel
  };

  if (window.electronAPI) {
    await window.electronAPI.startRecordingSession(config);
  }
}

// IPC listeners from main process
function setupIPCListeners() {
  if (!window.electronAPI) return;

  // Actual recording starts after 3-2-1 countdown finishes
  window.electronAPI.onTriggerStartRecording(async (config) => {
    await beginRecordingStreams(config);
  });

  // Controls triggers
  window.electronAPI.onTriggerPauseRecording(() => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.pause();
    }
  });

  window.electronAPI.onTriggerResumeRecording(() => {
    if (mediaRecorder && mediaRecorder.state === 'paused') {
      mediaRecorder.resume();
    }
  });

  window.electronAPI.onTriggerStopRecording(() => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
  });

  window.electronAPI.onTriggerCancelRecording(() => {
    stopAllActiveStreams();
    clearInterval(timerInterval);
    recordedChunks = [];
    statusText.textContent = 'Tayyor';
    document.querySelector('.status-dot').style.backgroundColor = 'var(--success)';
  });

  if (window.electronAPI.onTriggerToggleAutoZoom) {
    window.electronAPI.onTriggerToggleAutoZoom(() => {
      autoZoomRunning = !autoZoomRunning;
    });
  }

  if (window.electronAPI.onSaveProgress) {
    window.electronAPI.onSaveProgress((data) => {
      if (saveStatusMessage && saveStatusMessage.style.display !== 'none') {
        saveStatusMessage.innerHTML = `<span>⏳ MP4 formatga o'tkazilmoqda: <strong>${data.time}</strong>... Iltimos kuting.</span>`;
      }
    });
  }
}

// Setup MediaStream and MediaRecorder
async function beginRecordingStreams(config) {
  try {
    statusText.textContent = "Yozilmoqda...";
    document.querySelector('.status-dot').style.backgroundColor = '#ef4444';

    const tracks = [];
    let fps = 30;
    let width = 1920;
    let height = 1080;

    if (config.quality === '1080p60') {
      fps = 60;
    } else if (config.quality === '720p30') {
      width = 1280;
      height = 720;
    }

    // 1. Video track
    if (config.mode === 'cam-only') {
      activeCamStream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: config.camId ? { exact: config.camId } : undefined,
          width: { ideal: width },
          height: { ideal: height },
          frameRate: { ideal: fps }
        },
        audio: false
      });
      tracks.push(...activeCamStream.getVideoTracks());
    } else {
      let srcId = config.sourceId;
      if (!srcId && window.electronAPI) {
        const availSources = await window.electronAPI.getSources();
        if (availSources && availSources.length > 0) {
          const scr = availSources.find(s => s.isScreen || (s.id && s.id.startsWith('screen:')));
          srcId = scr ? scr.id : availSources[0].id;
        }
      }

      activeScreenStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: srcId,
            maxWidth: 3840,
            maxHeight: 2160,
            maxFrameRate: fps
          }
        }
      });

      if (config.autoZoom) {
        // CINEMATIC SMART AUTO-ZOOM VIRTUAL CAMERA
        const rawVideo = document.createElement('video');
        rawVideo.srcObject = activeScreenStream;
        rawVideo.muted = true;
        await rawVideo.play();

        // Wait until actual video stream dimensions are available
        if (!rawVideo.videoWidth) {
          await new Promise(resolve => {
            rawVideo.onloadedmetadata = () => resolve();
            setTimeout(resolve, 300);
          });
        }

        const srcW = rawVideo.videoWidth || width;
        const srcH = rawVideo.videoHeight || height;

        const zoomCanvas = document.createElement('canvas');
        zoomCanvas.width = srcW;
        zoomCanvas.height = srcH;
        const zCtx = zoomCanvas.getContext('2d', { alpha: false });

        // Exact zoom limits: STRICTLY 1.0 at minimum, never smaller than 1.0!
        const MIN_ZOOM = 1.0;
        const MAX_ZOOM = parseFloat(config.zoomLevel || 1.6);

        let currentZoom = MIN_ZOOM;
        let targetZoom = MIN_ZOOM;

        let currentFocusX = srcW / 2;
        let currentFocusY = srcH / 2;
        let targetFocusX = srcW / 2;
        let targetFocusY = srcH / 2;

        // Position cluster detection & timing
        let clusterStartX = srcW / 2;
        let clusterStartY = srcH / 2;
        let clusterStartTime = performance.now();
        let lastZoomOutTime = 0;
        let isFocused = false;

        // Timing intervals to prevent lag & rapid oscillation
        const DWELL_TIME_MS = 600;          // Dwell time on a function before zooming in
        const ZOOM_OUT_DISTANCE = 160;      // Moving 160px away triggers smooth zoom out
        const COOLDOWN_AFTER_EXIT_MS = 900; // Stay at 1.0x for at least 900ms before next zoom
        const DEADZONE_RADIUS = 50;         // Hand tremors < 50px don't shake camera

        autoZoomRunning = true;

        // Mouse Polling with Temporal Stability
        autoZoomTrackerTimer = setInterval(async () => {
          if (!autoZoomRunning) return;
          try {
            const pos = await window.electronAPI.getCursorPosition();
            if (!pos) return;

            const screenW = window.screen.width || srcW;
            const screenH = window.screen.height || srcH;
            const mx = (pos.x / screenW) * srcW;
            const my = (pos.y / screenH) * srcH;

            const now = performance.now();

            if (!isFocused) {
              // In full overview (1.0x)
              // Cooldown: wait at least 900ms after zooming out before zooming in again
              if (now - lastZoomOutTime < COOLDOWN_AFTER_EXIT_MS) {
                clusterStartX = mx;
                clusterStartY = my;
                clusterStartTime = now;
                return;
              }

              // Check if mouse is dwelling within an element/function cluster
              const distFromCluster = Math.hypot(mx - clusterStartX, my - clusterStartY);
              if (distFromCluster > 60) {
                // Moving across screen -> reset cluster
                clusterStartX = mx;
                clusterStartY = my;
                clusterStartTime = now;
              } else {
                // Mouse is holding steady on this function!
                if (now - clusterStartTime >= DWELL_TIME_MS) {
                  // Smoothly Zoom In!
                  isFocused = true;
                  targetZoom = MAX_ZOOM;
                  targetFocusX = clusterStartX;
                  targetFocusY = clusterStartY;
                }
              }
            } else {
              // Currently ZOOMED IN (focused on an element)
              const distFromFocus = Math.hypot(mx - targetFocusX, my - targetFocusY);

              if (distFromFocus > ZOOM_OUT_DISTANCE) {
                // User moved mouse to another section: smoothly zoom out to full screen!
                isFocused = false;
                targetZoom = MIN_ZOOM;
                lastZoomOutTime = now;
                clusterStartX = mx;
                clusterStartY = my;
                clusterStartTime = now;
              } else if (distFromFocus > DEADZONE_RADIUS) {
                // Subtle deadzone drift inside focused region
                targetFocusX += (mx - targetFocusX) * 0.15;
                targetFocusY += (my - targetFocusY) * 0.15;
              }
            }
          } catch (e) {}
        }, 30);

        // High precision 60FPS render loop with Exponential Damping
        let lastFrameTime = performance.now();

        function renderVirtualCamera() {
          if (!autoZoomRunning) return;

          const now = performance.now();
          const dt = Math.min(2.5, Math.max(0.2, (now - lastFrameTime) / 16.666));
          lastFrameTime = now;

          // Smooth exponential damping (completely eliminates jitter & lag!)
          const zoomRate = 1 - Math.pow(1 - 0.038, dt);
          const panRate = 1 - Math.pow(1 - 0.048, dt);

          currentZoom += (targetZoom - currentZoom) * zoomRate;
          // STRICT FLOOR: Never allow zoom < 1.0!
          currentZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, currentZoom));

          // If virtually at 1.0, lock to exact 1.0 and draw full screen cleanly
          if (currentZoom <= 1.005 && targetZoom === 1.0) {
            currentZoom = 1.0;
            currentFocusX = srcW / 2;
            currentFocusY = srcH / 2;
            zCtx.drawImage(rawVideo, 0, 0, srcW, srcH);
          } else {
            const cropW = srcW / currentZoom;
            const cropH = srcH / currentZoom;

            const minX = cropW / 2;
            const maxX = srcW - cropW / 2;
            const minY = cropH / 2;
            const maxY = srcH - cropH / 2;

            const safeTargetX = Math.max(minX, Math.min(maxX, targetFocusX));
            const safeTargetY = Math.max(minY, Math.min(maxY, targetFocusY));

            currentFocusX += (safeTargetX - currentFocusX) * panRate;
            currentFocusY += (safeTargetY - currentFocusY) * panRate;

            const finalCropX = Math.max(0, Math.min(srcW - cropW, currentFocusX - cropW / 2));
            const finalCropY = Math.max(0, Math.min(srcH - cropH, currentFocusY - cropH / 2));

            zCtx.drawImage(rawVideo, finalCropX, finalCropY, cropW, cropH, 0, 0, srcW, srcH);
          }

          autoZoomCancelId = requestAnimationFrame(renderVirtualCamera);
        }
        autoZoomCancelId = requestAnimationFrame(renderVirtualCamera);

        // Robust watchdog timer ensuring frames keep pumping during desktop space switches
        autoZoomWatchdog = setInterval(() => {
          if (!autoZoomRunning) {
            clearInterval(autoZoomWatchdog);
            autoZoomWatchdog = null;
            return;
          }
          const now = performance.now();
          if (now - lastFrameTime > 40) {
            renderVirtualCamera();
          }
        }, 33);

        const canvasStream = zoomCanvas.captureStream(fps);
        tracks.push(...canvasStream.getVideoTracks());
      } else {
        tracks.push(...activeScreenStream.getVideoTracks());
      }
    }

    // 2. Audio track (Microphone)
    if (config.hasMic !== false) {
      try {
        activeMicStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: config.micId ? { exact: config.micId } : undefined,
            echoCancellation: true,
            noiseSuppression: true
          },
          video: false
        });
        tracks.push(...activeMicStream.getAudioTracks());
      } catch (micErr) {
        console.warn("Could not capture microphone audio:", micErr);
      }
    }

    const combinedStream = new MediaStream(tracks);

    // Pick best supported MIME type
    let mimeType = 'video/webm; codecs=vp9,opus';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm; codecs=vp8,opus';
    }
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm';
    }

    recordedChunks = [];
    mediaRecorder = new MediaRecorder(combinedStream, {
      mimeType,
      videoBitsPerSecond: fps === 60 ? 12000000 : 8000000,
      audioBitsPerSecond: 192000
    });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      stopAllActiveStreams();
      clearInterval(timerInterval);
      handleRecordingComplete();
    };

    mediaRecorder.start(1000); // chunk every second

    // Start timer
    elapsedSeconds = 0;
    sendFormattedTimer();
    timerInterval = setInterval(() => {
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        elapsedSeconds += 1;
        sendFormattedTimer();
      }
    }, 1000);

  } catch (err) {
    console.error("Recording error:", err);
    alert("Yozishni boshlashda xatolik yuz berdi: " + err.message);
    stopAllActiveStreams();
    if (window.electronAPI) window.electronAPI.recordingDone();
  }
}

function sendFormattedTimer() {
  const mins = Math.floor(elapsedSeconds / 60);
  const secs = elapsedSeconds % 60;
  const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  if (window.electronAPI) {
    window.electronAPI.sendTimerTick(timeStr);
  }
}

function stopAllActiveStreams() {
  autoZoomRunning = false;
  if (autoZoomCancelId) {
    cancelAnimationFrame(autoZoomCancelId);
    autoZoomCancelId = null;
  }
  if (autoZoomTrackerTimer) {
    clearInterval(autoZoomTrackerTimer);
    autoZoomTrackerTimer = null;
  }
  if (autoZoomWatchdog) {
    clearInterval(autoZoomWatchdog);
    autoZoomWatchdog = null;
  }
  if (activeScreenStream) {
    activeScreenStream.getTracks().forEach(t => t.stop());
    activeScreenStream = null;
  }
  if (activeMicStream) {
    activeMicStream.getTracks().forEach(t => t.stop());
    activeMicStream = null;
  }
  if (activeCamStream) {
    activeCamStream.getTracks().forEach(t => t.stop());
    activeCamStream = null;
  }
}

// When MediaRecorder stops: prepare preview
async function handleRecordingComplete() {
  if (window.electronAPI) {
    await window.electronAPI.recordingDone();
  }

  currentRecordedBlob = new Blob(recordedChunks, { type: 'video/webm' });
  const videoUrl = URL.createObjectURL(currentRecordedBlob);

  previewPlayer.src = videoUrl;

  const sizeMb = (currentRecordedBlob.size / (1024 * 1024)).toFixed(1);
  const mins = Math.floor(elapsedSeconds / 60);
  const secs = elapsedSeconds % 60;
  const durationStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  videoMetaText.textContent = `Davomiyligi: ${durationStr} • Hajmi: ${sizeMb} MB`;

  setupView.style.display = 'none';
  previewView.style.display = 'flex';
  statusText.textContent = 'Tugatildi';
  document.querySelector('.status-dot').style.backgroundColor = 'var(--success)';
}

// Save recording file (MP4 or WebM)
async function handleSaveRecording(format) {
  if (!currentRecordedBlob) return;

  saveStatusMessage.style.display = 'flex';
  saveStatusMessage.className = 'save-status-msg';

  if (format === 'mp4') {
    saveStatusMessage.innerHTML = '<span>⏳ MP4 formatga o\'tkazilmoqda (FFmpeg)... Iltimos kuting.</span>';
    saveMp4Btn.disabled = true;
  } else {
    saveStatusMessage.innerHTML = '<span>⏳ Saqlanmoqda...</span>';
    saveWebmBtn.disabled = true;
  }

  try {
    const arrayBuffer = await currentRecordedBlob.arrayBuffer();
    const result = await window.electronAPI.saveVideoFile(arrayBuffer, format);

    if (result && result.success) {
      lastSavedFilePath = result.filePath;
      const fileName = result.filePath.split(/[\\/]/).pop();
      saveStatusMessage.innerHTML = `
        <span>✓ <strong>${fileName}</strong> saqlandi!</span>
        <button id="showFolderBtn" style="background:#10b981;color:#fff;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:12px;">Jildda ko'rish</button>
      `;

      document.getElementById('showFolderBtn')?.addEventListener('click', () => {
        if (lastSavedFilePath && window.electronAPI) {
          window.electronAPI.showInFolder(lastSavedFilePath);
        }
      });
    } else if (result && result.canceled) {
      saveStatusMessage.style.display = 'none';
    } else {
      saveStatusMessage.className = 'save-status-msg error';
      saveStatusMessage.textContent = 'Saqlashda xatolik yuz berdi: ' + (result?.error || 'Noma\'lum xatolik');
    }
  } catch (err) {
    saveStatusMessage.className = 'save-status-msg error';
    saveStatusMessage.textContent = 'Xatolik: ' + err.message;
  } finally {
    saveMp4Btn.disabled = false;
    saveWebmBtn.disabled = false;
  }
}

// Settings Modal Elements
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const doneSettingsBtn = document.getElementById('doneSettingsBtn');
const resetShortcutsBtn = document.getElementById('resetShortcutsBtn');
const shortcutsList = document.getElementById('shortcutsList');

function openSettingsModal() {
  if (!settingsModal) return;
  settingsModal.style.display = 'flex';
  renderShortcutsTable();
}

function closeSettingsModal() {
  if (!settingsModal) return;
  settingsModal.style.display = 'none';
}

if (settingsBtn) settingsBtn.addEventListener('click', openSettingsModal);
if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', closeSettingsModal);
if (doneSettingsBtn) doneSettingsBtn.addEventListener('click', closeSettingsModal);

if (resetShortcutsBtn) {
  resetShortcutsBtn.addEventListener('click', async () => {
    if (confirm("Barcha shortcutlarni standart holatga qaytarmoqchimisiz?")) {
      if (window.electronAPI && window.electronAPI.resetShortcuts) {
        await window.electronAPI.resetShortcuts();
        renderShortcutsTable();
      }
    }
  });
}

// Format Electron accelerator for user display
function formatAcceleratorBadge(acc) {
  if (!acc) return '<span style="color:#64748b;font-size:12px;">O\'rnatilmagan</span>';
  const parts = acc.split('+');
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  return parts.map(part => {
    let display = part;
    if (part === 'CommandOrControl') display = isMac ? '⌘ Cmd' : 'Ctrl';
    else if (part === 'Command') display = '⌘ Cmd';
    else if (part === 'Control') display = 'Ctrl';
    else if (part === 'Alt') display = isMac ? '⌥ Option' : 'Alt';
    else if (part === 'Shift') display = '⇧ Shift';
    return `<kbd>${display}</kbd>`;
  }).join(' <span style="color:#64748b">+</span> ');
}

async function renderShortcutsTable() {
  if (!window.electronAPI || !window.electronAPI.getShortcuts || !shortcutsList) return;
  const data = await window.electronAPI.getShortcuts();
  if (!data || !data.shortcuts) return;

  const { shortcuts, labels } = data;
  shortcutsList.innerHTML = '';

  Object.entries(shortcuts).forEach(([action, accelerator]) => {
    const row = document.createElement('div');
    row.className = 'shortcut-row';

    const labelDiv = document.createElement('div');
    labelDiv.className = 'shortcut-label';
    labelDiv.textContent = labels[action] || action;

    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'shortcut-controls';

    const badge = document.createElement('div');
    badge.className = 'key-badge';
    badge.innerHTML = formatAcceleratorBadge(accelerator);

    const editBtn = document.createElement('button');
    editBtn.className = 'btn-edit-key';
    editBtn.textContent = "O'zgartirish";

    editBtn.addEventListener('click', () => {
      recordNewShortcut(action, editBtn, badge);
    });

    controlsDiv.appendChild(badge);
    controlsDiv.appendChild(editBtn);

    row.appendChild(labelDiv);
    row.appendChild(controlsDiv);

    shortcutsList.appendChild(row);
  });
}

function recordNewShortcut(action, editBtn, badge) {
  editBtn.classList.add('recording');
  editBtn.textContent = 'Klavishlarni bosing...';

  function onKeyDown(e) {
    e.preventDefault();
    e.stopPropagation();

    if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

    const modifiers = [];
    if (e.metaKey || e.ctrlKey) modifiers.push('CommandOrControl');
    if (e.altKey) modifiers.push('Alt');
    if (e.shiftKey) modifiers.push('Shift');

    let key = e.key.toUpperCase();
    if (key === ' ') key = 'Space';
    if (key === 'ESCAPE') {
      window.removeEventListener('keydown', onKeyDown, true);
      editBtn.classList.remove('recording');
      editBtn.textContent = "O'zgartirish";
      return;
    }

    const newAccelerator = modifiers.length > 0 ? `${modifiers.join('+')}+${key}` : key;

    window.removeEventListener('keydown', onKeyDown, true);
    editBtn.classList.remove('recording');
    editBtn.textContent = "O'zgartirish";

    window.electronAPI.updateShortcut(action, newAccelerator).then(res => {
      if (res && res.shortcuts) {
        badge.innerHTML = formatAcceleratorBadge(res.shortcuts[action]);
      }
    });
  }

  window.addEventListener('keydown', onKeyDown, { capture: true, once: false });
}

// Listen for external trigger from Tray to open settings
if (window.electronAPI && window.electronAPI.onOpenSettings) {
  window.electronAPI.onOpenSettings(() => {
    openSettingsModal();
  });
}

// Run
init();
