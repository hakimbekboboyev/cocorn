const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Sources
  getSources: () => ipcRenderer.invoke('get-sources'),
  
  // Recording flow
  startRecordingSession: (config) => ipcRenderer.invoke('start-recording-session', config),
  stopRecordingSession: () => ipcRenderer.invoke('stop-recording-session'),
  pauseRecordingSession: () => ipcRenderer.invoke('pause-recording-session'),
  resumeRecordingSession: () => ipcRenderer.invoke('resume-recording-session'),
  cancelRecordingSession: () => ipcRenderer.invoke('cancel-recording-session'),
  
  // Listeners from main to renderer
  onTriggerStartRecording: (callback) => {
    ipcRenderer.on('trigger-start-recording', (_event, value) => callback(value));
  },
  onTriggerStopRecording: (callback) => {
    ipcRenderer.on('trigger-stop-recording', (_event) => callback());
  },
  onTriggerPauseRecording: (callback) => {
    ipcRenderer.on('trigger-pause-recording', (_event) => callback());
  },
  onTriggerResumeRecording: (callback) => {
    ipcRenderer.on('trigger-resume-recording', (_event) => callback());
  },
  onTriggerCancelRecording: (callback) => {
    ipcRenderer.on('trigger-cancel-recording', (_event) => callback());
  },
  onTriggerToggleAutoZoom: (callback) => {
    ipcRenderer.on('trigger-toggle-auto-zoom', (_event) => callback());
  },
  onUpdateTimer: (callback) => {
    ipcRenderer.on('update-timer', (_event, timeStr) => callback(timeStr));
  },
  onSaveProgress: (callback) => {
    ipcRenderer.on('save-progress', (_event, data) => callback(data));
  },

  // Notify main of recorder events
  sendTimerTick: (timeStr) => ipcRenderer.send('timer-tick', timeStr),
  recordingDone: (data) => ipcRenderer.invoke('recording-done', data),
  saveVideoFile: (arrayBuffer, extension) => ipcRenderer.invoke('save-video-file', arrayBuffer, extension),
  showInFolder: (filePath) => ipcRenderer.invoke('show-in-folder', filePath),

  // Camera bubble controls
  updateCameraSize: (size) => ipcRenderer.send('update-camera-size', size),
  closeCameraBubble: () => ipcRenderer.send('close-camera-bubble'),
  
  // Controls window triggers
  controlAction: (action) => ipcRenderer.send('control-action', action),
  
  // Mini Bar Launcher
  startFromMiniBar: (options) => ipcRenderer.invoke('start-from-mini-bar', options),
  openMainWindow: () => ipcRenderer.send('open-main-window'),
  closeMiniBar: () => ipcRenderer.send('close-mini-bar'),
  
  // Countdown
  onCountdownNumber: (callback) => {
    ipcRenderer.on('countdown-number', (_event, num) => callback(num));
  },

  // Drawing & Annotation
  toggleDrawMode: () => ipcRenderer.send('toggle-draw-mode'),
  closeAnnotation: () => ipcRenderer.send('close-annotation'),
  onDrawState: (callback) => {
    ipcRenderer.on('draw-state', (_event, active) => callback(active));
  },

  // Cursor Zoom & Focus
  toggleZoomMode: () => ipcRenderer.send('toggle-zoom-mode'),
  onZoomState: (callback) => {
    ipcRenderer.on('zoom-state', (_event, active) => callback(active));
  },
  getCursorPosition: () => ipcRenderer.invoke('get-cursor-position'),

  // Screenshot (Mac / Windows Clean Snip Mode)
  triggerScreenshot: () => ipcRenderer.send('trigger-screenshot'),
  captureSnip: (data) => ipcRenderer.invoke('capture-snip', data),
  onMergeAndFinish: (callback) => ipcRenderer.on('merge-and-finish', (_event, data) => callback(data)),
  finishWithCompositedImage: (data) => ipcRenderer.invoke('finish-with-composited-image', data),
  copyScreenshot: (dataUrl) => ipcRenderer.invoke('copy-screenshot', dataUrl),
  saveScreenshot: (dataUrl) => ipcRenderer.invoke('save-screenshot', dataUrl),
  closeScreenshot: () => ipcRenderer.send('close-screenshot'),
  onScreenshotData: (callback) => {
    ipcRenderer.on('screenshot-data', (_event, data) => callback(data));
  },

  // Shortcuts Configuration
  getShortcuts: () => ipcRenderer.invoke('get-shortcuts'),
  updateShortcut: (action, accelerator) => ipcRenderer.invoke('update-shortcut', action, accelerator),
  resetShortcuts: () => ipcRenderer.invoke('reset-shortcuts'),
  onOpenSettings: (callback) => ipcRenderer.on('open-settings', () => callback())
});

