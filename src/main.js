const { app, BrowserWindow, desktopCapturer, ipcMain, dialog, shell, screen, systemPreferences, clipboard, nativeImage, Menu, Tray } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');
const ffmpegStaticPath = require('ffmpeg-static');
const ffmpegPath = ffmpegStaticPath ? ffmpegStaticPath.replace('app.asar', 'app.asar.unpacked') : null;
const shortcutsManager = require('./shortcuts');

let mainWindow = null;
let cameraWindow = null;
let controlsWindow = null;
let countdownWindow = null;
let annotationWindow = null;
let zoomWindow = null;
let screenshotWindow = null;
let miniBarWindow = null;
let tray = null;
let isQuitting = false;

let isDrawingActive = false;
let isZoomActive = false;

// Track active recording configuration
let currentConfig = null;

async function checkMediaPermissions() {
  if (process.platform === 'darwin') {
    try {
      const cameraStatus = systemPreferences.getMediaAccessStatus('camera');
      if (cameraStatus !== 'granted') {
        await systemPreferences.askForMediaAccess('camera');
      }
      const micStatus = systemPreferences.getMediaAccessStatus('microphone');
      if (micStatus !== 'granted') {
        await systemPreferences.askForMediaAccess('microphone');
      }
    } catch (err) {
      console.warn('Could not request media access permissions:', err);
    }
  }
}

const appIcon = path.join(__dirname, '..', 'build', 'icon.png');

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    title: 'CoCorn',
    icon: appIcon,
    backgroundColor: '#0f172a',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // On macOS: Closing window hides it to keep CoCorn accessible from the Menu Bar!
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    cleanupOverlayWindows();
  });
}

function createTray() {
  if (tray) return;

  const trayIconPath = path.join(__dirname, '..', 'build', 'trayIcon.png');
  let icon = nativeImage.createFromPath(trayIconPath);
  if (icon.isEmpty()) {
    icon = nativeImage.createFromPath(path.join(__dirname, '..', 'build', 'trayIconTemplate.png'));
  }
  tray = new Tray(icon);
  tray.setToolTip('CoCorn Screen Recorder');

  function updateTrayMenu() {
    const isRecording = !!controlsWindow;
    const currentShortcuts = shortcutsManager.loadShortcuts();

    const contextMenu = Menu.buildFromTemplate([
      {
        label: '🌽 CoCorn oynasini ochish',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        }
      },
      { type: 'separator' },
      {
        label: isRecording ? '⏹️ Yozishni tugatish' : '🎬 Tezkor panelni ochish (Mini Bar)',
        accelerator: currentShortcuts.startStop,
        click: () => {
          if (isRecording) {
            if (mainWindow) mainWindow.webContents.send('trigger-stop-recording');
          } else {
            showMiniBar();
          }
        }
      },
      {
        label: '📸 Screenshot olish',
        accelerator: currentShortcuts.screenshot,
        click: () => triggerScreenshot()
      },
      {
        label: '✏️ Ekranga chizish va Strelkalar',
        accelerator: currentShortcuts.draw,
        click: () => toggleDrawMode()
      },
      {
        label: '⚡ Auto-Zoomni almashtirish',
        accelerator: currentShortcuts.autoZoom,
        click: () => {
          if (mainWindow) mainWindow.webContents.send('trigger-toggle-auto-zoom');
        }
      },
      { type: 'separator' },
      {
        label: '⚙️ Shortcut sozlamalari...',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
            mainWindow.webContents.send('open-settings');
          }
        }
      },
      { type: 'separator' },
      {
        label: '✕ CoCorn\'dan chiqish',
        click: () => {
          isQuitting = true;
          app.quit();
        }
      }
    ]);

    tray.setContextMenu(contextMenu);
  }

  updateTrayMenu();

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

function createMiniBarWindow() {
  if (miniBarWindow && !miniBarWindow.isDestroyed()) {
    return miniBarWindow;
  }

  const cursorPoint = screen.getCursorScreenPoint();
  const activeDisplay = screen.getDisplayNearestPoint(cursorPoint);
  const { x, y, width, height } = activeDisplay.workArea;

  const barWidth = 490;
  const barHeight = 56;
  const barX = x + Math.round((width - barWidth) / 2);
  const barY = y + height - barHeight - 28;

  miniBarWindow = new BrowserWindow({
    width: barWidth,
    height: barHeight,
    x: barX,
    y: barY,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  miniBarWindow.setContentProtection(true);
  miniBarWindow.setAlwaysOnTop(true, 'screen-saver');
  miniBarWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  miniBarWindow.loadFile(path.join(__dirname, 'renderer', 'mini-bar.html'));

  miniBarWindow.on('closed', () => {
    miniBarWindow = null;
  });

  return miniBarWindow;
}

function showMiniBar() {
  const win = createMiniBarWindow();
  const cursorPoint = screen.getCursorScreenPoint();
  const activeDisplay = screen.getDisplayNearestPoint(cursorPoint);
  const { x, y, width, height } = activeDisplay.workArea;
  const barWidth = 490;
  const barHeight = 56;
  const barX = x + Math.round((width - barWidth) / 2);
  const barY = y + height - barHeight - 28;

  win.setPosition(barX, barY);
  win.show();
  win.focus();
}

function hideMiniBar() {
  if (miniBarWindow && !miniBarWindow.isDestroyed()) {
    miniBarWindow.hide();
  }
}

function setupGlobalShortcuts() {
  shortcutsManager.registerAll({
    startStop: () => {
      if (controlsWindow) {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('trigger-stop-recording');
        }
      } else {
        if (miniBarWindow && !miniBarWindow.isDestroyed() && miniBarWindow.isVisible()) {
          hideMiniBar();
        } else {
          showMiniBar();
        }
      }
    },
    pauseResume: () => {
      if (mainWindow && !mainWindow.isDestroyed() && controlsWindow) {
        mainWindow.webContents.send('trigger-toggle-pause');
      }
    },
    screenshot: () => {
      triggerScreenshot();
    },
    draw: () => {
      toggleDrawMode();
    },
    autoZoom: () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('trigger-toggle-auto-zoom');
      }
    }
  });
}

function createCameraWindow() {
  if (cameraWindow) {
    cameraWindow.show();
    return cameraWindow;
  }

  const cursorPoint = screen.getCursorScreenPoint();
  const activeDisplay = screen.getDisplayNearestPoint(cursorPoint);
  const { x, y, height } = activeDisplay.workArea;
  const bubbleSize = 200;

  cameraWindow = new BrowserWindow({
    width: bubbleSize,
    height: bubbleSize,
    x: x + 40,
    y: y + height - bubbleSize - 50,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  cameraWindow.setAlwaysOnTop(true, 'screen-saver');
  cameraWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  cameraWindow.loadFile(path.join(__dirname, 'renderer', 'camera.html'));

  cameraWindow.on('closed', () => {
    cameraWindow = null;
  });

  return cameraWindow;
}

function createControlsWindow() {
  if (controlsWindow) {
    controlsWindow.show();
    return controlsWindow;
  }

  const cursorPoint = screen.getCursorScreenPoint();
  const activeDisplay = screen.getDisplayNearestPoint(cursorPoint);
  const { x, y, width, height } = activeDisplay.workArea;
  const barWidth = 460;
  const barHeight = 64;

  controlsWindow = new BrowserWindow({
    width: barWidth,
    height: barHeight,
    x: x + Math.round((width - barWidth) / 2),
    y: y + height - barHeight - 30,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  controlsWindow.setContentProtection(true);
  controlsWindow.setAlwaysOnTop(true, 'screen-saver');
  controlsWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  controlsWindow.loadFile(path.join(__dirname, 'renderer', 'controls.html'));

  controlsWindow.on('closed', () => {
    controlsWindow = null;
  });

  return controlsWindow;
}

function createAnnotationWindow() {
  if (annotationWindow) {
    annotationWindow.show();
    return annotationWindow;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.bounds;

  annotationWindow = new BrowserWindow({
    x: 0,
    y: 0,
    width,
    height,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    hasShadow: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  annotationWindow.setContentProtection(false);
  annotationWindow.setAlwaysOnTop(true, 'screen-saver');
  annotationWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  annotationWindow.loadFile(path.join(__dirname, 'renderer', 'annotation.html'));

  annotationWindow.on('closed', () => {
    annotationWindow = null;
    isDrawingActive = false;
    notifyDrawState(false);
  });

  return annotationWindow;
}

function toggleDrawMode() {
  isDrawingActive = !isDrawingActive;
  if (isDrawingActive) {
    createAnnotationWindow();
  } else {
    if (annotationWindow && !annotationWindow.isDestroyed()) {
      annotationWindow.close();
      annotationWindow = null;
    }
  }
  notifyDrawState(isDrawingActive);
}

function notifyDrawState(active) {
  if (controlsWindow && !controlsWindow.isDestroyed()) {
    controlsWindow.webContents.send('draw-state', active);
  }
}

function createZoomWindow() {
  if (zoomWindow) {
    zoomWindow.show();
    return zoomWindow;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.bounds;

  zoomWindow = new BrowserWindow({
    x: 0,
    y: 0,
    width,
    height,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    hasShadow: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  zoomWindow.setIgnoreMouseEvents(true, { forward: true });
  zoomWindow.setContentProtection(false);
  zoomWindow.setAlwaysOnTop(true, 'screen-saver');
  zoomWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  zoomWindow.loadFile(path.join(__dirname, 'renderer', 'zoom.html'));

  zoomWindow.on('closed', () => {
    zoomWindow = null;
    isZoomActive = false;
    notifyZoomState(false);
  });

  return zoomWindow;
}

function toggleZoomMode() {
  isZoomActive = !isZoomActive;
  if (isZoomActive) {
    createZoomWindow();
    if (zoomWindow && !zoomWindow.isDestroyed()) {
      zoomWindow.webContents.send('zoom-state', true);
    }
  } else {
    if (zoomWindow && !zoomWindow.isDestroyed()) {
      zoomWindow.close();
      zoomWindow = null;
    }
  }
  notifyZoomState(isZoomActive);
}

function notifyZoomState(active) {
  if (controlsWindow && !controlsWindow.isDestroyed()) {
    controlsWindow.webContents.send('zoom-state', active);
  }
}

function triggerScreenshot() {
  try {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { x, y, width, height } = primaryDisplay.bounds;

    if (screenshotWindow && !screenshotWindow.isDestroyed()) {
      screenshotWindow.close();
      screenshotWindow = null;
    }

    screenshotWindow = new BrowserWindow({
      x,
      y,
      width,
      height,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      alwaysOnTop: true,
      hasShadow: false,
      skipTaskbar: true,
      enableLargerThanScreen: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    screenshotWindow.setAlwaysOnTop(true, 'screen-saver');
    screenshotWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    screenshotWindow.setContentProtection(true);
    screenshotWindow.loadFile(path.join(__dirname, 'renderer', 'screenshot.html'));

    screenshotWindow.webContents.on('did-finish-load', () => {
      screenshotWindow.focus();
    });

    screenshotWindow.on('closed', () => {
      screenshotWindow = null;
    });
  } catch (err) {
    console.error("Screenshot window error:", err);
  }
}

function runCountdown(onFinish) {
  const cursorPoint = screen.getCursorScreenPoint();
  const activeDisplay = screen.getDisplayNearestPoint(cursorPoint);
  const { x, y, width, height } = activeDisplay.workArea;

  countdownWindow = new BrowserWindow({
    width: 300,
    height: 300,
    x: x + Math.round((width - 300) / 2),
    y: y + Math.round((height - 300) / 2),
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  countdownWindow.setContentProtection(true);
  countdownWindow.setAlwaysOnTop(true, 'screen-saver');
  countdownWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  countdownWindow.loadFile(path.join(__dirname, 'renderer', 'countdown.html'));

  let count = 3;
  countdownWindow.webContents.on('did-finish-load', () => {
    countdownWindow.webContents.send('countdown-number', count);
    
    const interval = setInterval(() => {
      count -= 1;
      if (count > 0) {
        if (countdownWindow && !countdownWindow.isDestroyed()) {
          countdownWindow.webContents.send('countdown-number', count);
        }
      } else {
        clearInterval(interval);
        if (countdownWindow && !countdownWindow.isDestroyed()) {
          countdownWindow.close();
        }
        countdownWindow = null;
        if (onFinish) onFinish();
      }
    }, 1000);
  });
}

// App lifecycle
app.whenReady().then(async () => {
  await checkMediaPermissions();
  createMainWindow();
  createTray();
  setupGlobalShortcuts();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    } else if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC: Get Screen and Window sources
ipcMain.handle('get-sources', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 480, height: 270 },
    fetchWindowIcons: true
  });

  return sources.map(source => ({
    id: source.id,
    name: source.name,
    thumbnail: source.thumbnail.toDataURL(),
    appIcon: source.appIcon ? source.appIcon.toDataURL() : null,
    display_id: source.display_id,
    isScreen: source.id.startsWith('screen:')
  }));
});

// IPC: Start Recording Flow
ipcMain.handle('start-recording-session', async (_event, config) => {
  currentConfig = config;

  if (mainWindow) {
    mainWindow.minimize();
  }

  runCountdown(() => {
    if (config.hasCamera) {
      createCameraWindow();
    }

    createControlsWindow();

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('trigger-start-recording', config);
    }
  });

  return { success: true };
});

// Timer tick relay from mainWindow to controlsWindow
ipcMain.on('timer-tick', (_event, timeStr) => {
  if (controlsWindow && !controlsWindow.isDestroyed()) {
    controlsWindow.webContents.send('update-timer', timeStr);
  }
});

// Control bar actions relay
ipcMain.on('control-action', (_event, action) => {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  switch (action) {
    case 'stop':
      mainWindow.webContents.send('trigger-stop-recording');
      break;
    case 'pause':
      mainWindow.webContents.send('trigger-pause-recording');
      break;
    case 'resume':
      mainWindow.webContents.send('trigger-resume-recording');
      break;
    case 'toggle-auto-zoom':
      mainWindow.webContents.send('trigger-toggle-auto-zoom');
      break;
    case 'cancel':
      mainWindow.webContents.send('trigger-cancel-recording');
      cleanupOverlayWindows();
      if (mainWindow) {
        mainWindow.restore();
        mainWindow.focus();
      }
      break;
  }
});

// IPC: Start Recording from Mini Bar Launcher
ipcMain.handle('start-from-mini-bar', async (_event, options) => {
  hideMiniBar();

  const cursorPoint = screen.getCursorScreenPoint();
  const activeDisplay = screen.getDisplayNearestPoint(cursorPoint);

  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: 320, height: 180 }
  });

  let targetSource = sources.find(s => String(s.display_id) === String(activeDisplay.id))
    || sources.find(s => s.id && s.id.startsWith('screen:'))
    || sources[0];

  const recordingConfig = {
    mode: options.hasCamera ? 'screen-cam' : 'screen-only',
    sourceId: targetSource ? targetSource.id : null,
    hasCamera: options.hasCamera,
    autoZoom: options.autoZoom,
    quality: '1080p',
    hasMic: options.hasMic
  };

  currentConfig = recordingConfig;

  runCountdown(() => {
    if (recordingConfig.hasCamera) {
      createCameraWindow();
    }

    createControlsWindow();

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('trigger-start-recording', recordingConfig);
    }
  });

  return { success: true };
});

ipcMain.on('open-main-window', () => {
  hideMiniBar();
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  }
});

ipcMain.on('close-mini-bar', () => {
  hideMiniBar();
});

function cleanupOverlayWindows() {
  hideMiniBar();
  if (cameraWindow && !cameraWindow.isDestroyed()) {
    cameraWindow.close();
    cameraWindow = null;
  }
  if (controlsWindow && !controlsWindow.isDestroyed()) {
    controlsWindow.close();
    controlsWindow = null;
  }
  if (annotationWindow && !annotationWindow.isDestroyed()) {
    annotationWindow.close();
    annotationWindow = null;
  }
  if (zoomWindow && !zoomWindow.isDestroyed()) {
    zoomWindow.close();
    zoomWindow = null;
  }
  if (screenshotWindow && !screenshotWindow.isDestroyed()) {
    screenshotWindow.close();
    screenshotWindow = null;
  }
  isDrawingActive = false;
  isZoomActive = false;
}

// Recording Finished from renderer
ipcMain.handle('recording-done', async () => {
  cleanupOverlayWindows();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
  return { success: true };
});

// Camera window resize
ipcMain.on('update-camera-size', (_event, size) => {
  if (cameraWindow && !cameraWindow.isDestroyed()) {
    let dimension = 200;
    if (size === 'small') dimension = 140;
    else if (size === 'large') dimension = 280;

    cameraWindow.setSize(dimension, dimension);
  }
});

ipcMain.on('close-camera-bubble', () => {
  if (cameraWindow && !cameraWindow.isDestroyed()) {
    cameraWindow.close();
    cameraWindow = null;
  }
});

// Drawing IPC
ipcMain.on('toggle-draw-mode', () => {
  toggleDrawMode();
});

ipcMain.on('close-annotation', () => {
  if (annotationWindow && !annotationWindow.isDestroyed()) {
    annotationWindow.close();
    annotationWindow = null;
  }
  isDrawingActive = false;
  notifyDrawState(false);
});

// Zoom IPC
ipcMain.on('toggle-zoom-mode', () => {
  toggleZoomMode();
});

ipcMain.handle('get-cursor-position', () => {
  return screen.getCursorScreenPoint();
});

// Screenshot IPC (Instant Live Clean Snip Mode)
ipcMain.on('trigger-screenshot', () => {
  triggerScreenshot();
});

ipcMain.on('close-screenshot', () => {
  if (screenshotWindow && !screenshotWindow.isDestroyed()) {
    screenshotWindow.close();
    screenshotWindow = null;
  }
});

let pendingMergeResolver = null;
ipcMain.handle('finish-with-composited-image', (_event, finalDataUrl) => {
  if (pendingMergeResolver) {
    pendingMergeResolver(finalDataUrl);
    pendingMergeResolver = null;
  }
  return { success: true };
});

ipcMain.handle('capture-snip', async (_event, payload) => {
  const { cropRect, hasAnnotations, isSave, isFullScreen } = payload;
  try {
    // 1. Hide the window immediately so nothing of the overlay appears in the capture
    if (screenshotWindow && !screenshotWindow.isDestroyed()) {
      screenshotWindow.hide();
    }

    // 2. Play Apple shutter click sound
    try {
      execFile('/usr/bin/afplay', ['/System/Library/Sounds/Tink.aiff'], () => {});
    } catch (_) {}

    // 3. Capture the screen via desktopCapturer
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.bounds;
    const dpr = primaryDisplay.scaleFactor || 2;

    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: Math.round(width * dpr),
        height: Math.round(height * dpr)
      }
    });

    const primarySource = sources[0];
    if (!primarySource) {
      if (screenshotWindow && !screenshotWindow.isDestroyed()) screenshotWindow.close();
      return { success: false, error: 'Screen source not found' };
    }

    let nativeImg = primarySource.thumbnail;

    if (!isFullScreen && cropRect && cropRect.w > 0 && cropRect.h > 0) {
      const fullSize = nativeImg.getSize();
      const rx = Math.max(0, Math.min(fullSize.width - 2, Math.round(cropRect.x * dpr)));
      const ry = Math.max(0, Math.min(fullSize.height - 2, Math.round(cropRect.y * dpr)));
      const rw = Math.max(1, Math.min(fullSize.width - rx, Math.round(cropRect.w * dpr)));
      const rh = Math.max(1, Math.min(fullSize.height - ry, Math.round(cropRect.h * dpr)));

      nativeImg = nativeImg.crop({ x: rx, y: ry, width: rw, height: rh });
    }

    // 4. If user drew annotations, merge them
    if (hasAnnotations && screenshotWindow && !screenshotWindow.isDestroyed()) {
      const mergedPromise = new Promise((resolve) => {
        pendingMergeResolver = resolve;
        screenshotWindow.webContents.send('merge-and-finish', {
          screenDataUrl: nativeImg.toDataURL()
        });
        setTimeout(() => {
          if (pendingMergeResolver) {
            pendingMergeResolver(null);
            pendingMergeResolver = null;
          }
        }, 1500);
      });

      const mergedDataUrl = await mergedPromise;
      if (mergedDataUrl) {
        nativeImg = nativeImage.createFromDataURL(mergedDataUrl);
      }
    }

    // 5. Put into Clipboard
    clipboard.writeImage(nativeImg);

    // 6. If Save requested, write to Desktop
    let filePath = null;
    if (isSave) {
      const defaultDir = path.join(os.homedir(), 'Desktop');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `CoCorn-Screenshot-${timestamp}.png`;
      filePath = path.join(defaultDir, filename);
      fs.writeFileSync(filePath, nativeImg.toPNG());
    }

    // 7. Close overlay window
    if (screenshotWindow && !screenshotWindow.isDestroyed()) {
      screenshotWindow.close();
      screenshotWindow = null;
    }

    return { success: true, filePath };
  } catch (err) {
    console.error("Capture snip error:", err);
    if (screenshotWindow && !screenshotWindow.isDestroyed()) {
      screenshotWindow.close();
      screenshotWindow = null;
    }
    return { success: false, error: err.message };
  }
});

// IPC: Shortcuts Management
ipcMain.handle('get-shortcuts', () => {
  return {
    shortcuts: shortcutsManager.loadShortcuts(),
    labels: shortcutsManager.SHORTCUT_LABELS
  };
});

ipcMain.handle('update-shortcut', (_event, action, accelerator) => {
  const res = shortcutsManager.updateShortcut(action, accelerator);
  if (tray) {
    // Refresh tray accelerator display
    const currentShortcuts = shortcutsManager.loadShortcuts();
    tray.setToolTip(`CoCorn (${currentShortcuts.startStop})`);
  }
  return res;
});

ipcMain.handle('reset-shortcuts', () => {
  return shortcutsManager.resetDefaults();
});

// IPC: Save recorded video file (WebM / MP4)
ipcMain.handle('save-video-file', async (_event, arrayBuffer, format = 'mp4') => {
  try {
    const defaultDir = path.join(os.homedir(), 'Desktop');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const defaultFilename = `CoCorn-Recording-${timestamp}.${format}`;

    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Yozib olingan videoni saqlash',
      defaultPath: path.join(defaultDir, defaultFilename),
      filters: [
        { name: format.toUpperCase() + ' Video', extensions: [format] },
        { name: 'WebM Video', extensions: ['webm'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (canceled || !filePath) {
      return { success: false, canceled: true };
    }

    const tempWebmPath = path.join(os.tmpdir(), `temp_rec_${Date.now()}_${Math.random().toString(36).substring(7)}.webm`);
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(tempWebmPath, buffer);

    if (process.platform !== 'win32' && ffmpegPath && fs.existsSync(ffmpegPath)) {
      try { fs.chmodSync(ffmpegPath, 0o755); } catch (_) {}
    }

    const isMp4 = filePath.toLowerCase().endsWith('.mp4');

    if (isMp4 && ffmpegPath && fs.existsSync(ffmpegPath)) {
      await new Promise((resolve, reject) => {
        const child = execFile(ffmpegPath, [
          '-fflags', '+genpts',
          '-i', tempWebmPath,
          '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
          '-c:v', 'libx264',
          '-preset', 'fast',
          '-crf', '19',
          '-pix_fmt', 'yuv420p',
          '-c:a', 'aac',
          '-b:a', '192k',
          '-af', 'aresample=async=1000',
          '-movflags', '+faststart',
          '-y',
          filePath
        ], (error, _stdout, stderr) => {
          if (error) {
            console.error('FFmpeg MP4 conversion error:', error, stderr);
            reject(new Error(`Konvertatsiyada xatolik yuz berdi: ${error.message}`));
          } else {
            resolve();
          }
        });

        // Track real-time progress from FFmpeg stderr
        if (child.stderr) {
          child.stderr.on('data', (data) => {
            const str = data.toString();
            const timeMatch = str.match(/time=(\d{2}:\d{2}:\d{2}\.\d+)/);
            if (timeMatch && mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('save-progress', { time: timeMatch[1].slice(0, 8) });
            }
          });
        }
      });
      try { fs.unlinkSync(tempWebmPath); } catch (e) {}
    } else {
      // For WebM format: remux with FFmpeg to generate missing Matroska cues and duration metadata
      if (ffmpegPath && fs.existsSync(ffmpegPath)) {
        await new Promise((resolve) => {
          execFile(ffmpegPath, [
            '-i', tempWebmPath,
            '-c', 'copy',
            '-y',
            filePath
          ], (error) => {
            if (error) {
              fs.copyFileSync(tempWebmPath, filePath);
            }
            resolve();
          });
        });
      } else {
        fs.copyFileSync(tempWebmPath, filePath);
      }
      try { fs.unlinkSync(tempWebmPath); } catch (e) {}
    }

    return { success: true, filePath };
  } catch (err) {
    console.error('Save file error:', err);
    return { success: false, error: err.message };
  }
});

// IPC: Show item in folder
ipcMain.handle('show-in-folder', (_event, targetPath) => {
  if (fs.existsSync(targetPath)) {
    shell.showItemInFolder(targetPath);
    return true;
  }
  return false;
});
