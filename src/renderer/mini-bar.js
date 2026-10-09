// CoCorn Mini Toolbar Controller
const recordBtn = document.getElementById('recordBtn');
const screenshotBtn = document.getElementById('screenshotBtn');
const micToggle = document.getElementById('micToggle');
const camToggle = document.getElementById('camToggle');
const zoomToggle = document.getElementById('zoomToggle');
const dashboardBtn = document.getElementById('dashboardBtn');
const closeBtn = document.getElementById('closeBtn');

let micEnabled = true;
let camEnabled = false;
let autoZoomEnabled = true;

// Toggle Feature Handlers
micToggle.addEventListener('click', () => {
  micEnabled = !micEnabled;
  micToggle.classList.toggle('active', micEnabled);
  micToggle.title = `Mikrofon: ${micEnabled ? "Yoqilgan" : "O'chirilgan"}`;
});

camToggle.addEventListener('click', () => {
  camEnabled = !camEnabled;
  camToggle.classList.toggle('active', camEnabled);
  camToggle.title = `Veb-kamera doirasi: ${camEnabled ? "Yoqilgan" : "O'chirilgan"}`;
});

zoomToggle.addEventListener('click', () => {
  autoZoomEnabled = !autoZoomEnabled;
  zoomToggle.classList.toggle('active', autoZoomEnabled);
  zoomToggle.title = `Auto-Zoom: ${autoZoomEnabled ? "Yoqilgan" : "O'chirilgan"}`;
});

// Start Record
recordBtn.addEventListener('click', startRecording);

async function startRecording() {
  if (window.electronAPI && window.electronAPI.startFromMiniBar) {
    await window.electronAPI.startFromMiniBar({
      hasMic: micEnabled,
      hasCamera: camEnabled,
      autoZoom: autoZoomEnabled
    });
  }
}

// Screenshot Trigger
screenshotBtn.addEventListener('click', () => {
  if (window.electronAPI && window.electronAPI.triggerScreenshot) {
    window.electronAPI.triggerScreenshot();
    if (window.electronAPI.closeMiniBar) {
      window.electronAPI.closeMiniBar();
    }
  }
});

// Open Full Dashboard
dashboardBtn.addEventListener('click', () => {
  if (window.electronAPI && window.electronAPI.openMainWindow) {
    window.electronAPI.openMainWindow();
  }
});

// Close Mini Bar
closeBtn.addEventListener('click', () => {
  if (window.electronAPI && window.electronAPI.closeMiniBar) {
    window.electronAPI.closeMiniBar();
  }
});

// Keyboard Shortcuts
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeBtn.click();
  } else if (e.key === 'Enter') {
    startRecording();
  } else if (e.key.toLowerCase() === 'm' && !e.metaKey && !e.ctrlKey) {
    micToggle.click();
  } else if (e.key.toLowerCase() === 'c' && !e.metaKey && !e.ctrlKey) {
    camToggle.click();
  } else if (e.key.toLowerCase() === 'z' && !e.metaKey && !e.ctrlKey) {
    zoomToggle.click();
  } else if (e.key.toLowerCase() === 's' && !e.metaKey && !e.ctrlKey) {
    screenshotBtn.click();
  }
});
