const timerDisplay = document.getElementById('timerDisplay');
const pauseBtn = document.getElementById('pauseBtn');
const pauseIcon = document.getElementById('pauseIcon');
const resumeIcon = document.getElementById('resumeIcon');
const zoomBtn = document.getElementById('zoomBtn');
const drawBtn = document.getElementById('drawBtn');
const screenshotBtn = document.getElementById('screenshotBtn');
const stopBtn = document.getElementById('stopBtn');
const cancelBtn = document.getElementById('cancelBtn');
const recDot = document.querySelector('.rec-dot');

let isPaused = false;

if (window.electronAPI) {
  // Timer updates
  window.electronAPI.onUpdateTimer((timeStr) => {
    timerDisplay.textContent = timeStr;
  });

  // State sync from main process
  if (window.electronAPI.onZoomState) {
    window.electronAPI.onZoomState((active) => {
      zoomBtn.classList.toggle('active', !!active);
    });
  }

  if (window.electronAPI.onDrawState) {
    window.electronAPI.onDrawState((active) => {
      drawBtn.classList.toggle('active', !!active);
    });
  }
}

// Pause / Resume
pauseBtn.addEventListener('click', () => {
  if (!isPaused) {
    isPaused = true;
    pauseIcon.style.display = 'none';
    resumeIcon.style.display = 'block';
    recDot.classList.add('paused');
    if (window.electronAPI) window.electronAPI.controlAction('pause');
  } else {
    isPaused = false;
    pauseIcon.style.display = 'block';
    resumeIcon.style.display = 'none';
    recDot.classList.remove('paused');
    if (window.electronAPI) window.electronAPI.controlAction('resume');
  }
});

// Smart Auto-Zoom Toggle
let isAutoZoomActive = true;
zoomBtn.addEventListener('click', () => {
  isAutoZoomActive = !isAutoZoomActive;
  zoomBtn.classList.toggle('active', isAutoZoomActive);
  if (window.electronAPI) {
    window.electronAPI.controlAction('toggle-auto-zoom');
  }
});

// Draw / Annotate
drawBtn.addEventListener('click', () => {
  if (window.electronAPI && window.electronAPI.toggleDrawMode) {
    window.electronAPI.toggleDrawMode();
  }
});

// Screenshot
screenshotBtn.addEventListener('click', () => {
  if (window.electronAPI && window.electronAPI.triggerScreenshot) {
    window.electronAPI.triggerScreenshot();
  }
});

// Stop
stopBtn.addEventListener('click', () => {
  if (window.electronAPI) window.electronAPI.controlAction('stop');
});

// Cancel / Discard
cancelBtn.addEventListener('click', () => {
  if (confirm("Yozishni bekor qilmoqchimisiz? Ushbu video saqlanmaydi.")) {
    if (window.electronAPI) window.electronAPI.controlAction('cancel');
  }
});

// Keyboard shortcuts for convenience
window.addEventListener('keydown', (e) => {
  if (e.key === 'z' || e.key === 'Z') {
    zoomBtn.click();
  } else if (e.key === 'd' || e.key === 'D') {
    drawBtn.click();
  } else if (e.key === 's' || e.key === 'S') {
    screenshotBtn.click();
  } else if (e.key === ' ') {
    pauseBtn.click();
  }
});
