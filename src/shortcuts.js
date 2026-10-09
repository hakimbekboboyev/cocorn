const { app, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');

const DEFAULT_SHORTCUTS = {
  startStop: 'CommandOrControl+Shift+R',
  pauseResume: 'CommandOrControl+Shift+P',
  screenshot: 'CommandOrControl+Shift+S',
  draw: 'CommandOrControl+Shift+D',
  autoZoom: 'CommandOrControl+Shift+Z'
};

const SHORTCUT_LABELS = {
  startStop: "Yozishni boshlash / To'xtatish",
  pauseResume: "Vaqtincha to'xtatish (Pauza)",
  screenshot: "Screenshot olish",
  draw: "Ekranga chizish va Strelkalar",
  autoZoom: "Smart Auto-Zoom"
};

function getSettingsPath() {
  return path.join(app.getPath('userData'), 'shortcuts.json');
}

function loadShortcuts() {
  try {
    const p = getSettingsPath();
    if (fs.existsSync(p)) {
      const data = JSON.parse(fs.readFileSync(p, 'utf8'));
      return { ...DEFAULT_SHORTCUTS, ...data };
    }
  } catch (err) {
    console.warn("Could not read shortcuts.json, using defaults:", err);
  }
  return { ...DEFAULT_SHORTCUTS };
}

function saveShortcuts(shortcuts) {
  try {
    const p = getSettingsPath();
    const dir = path.dirname(p);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(p, JSON.stringify(shortcuts, null, 2), 'utf8');
  } catch (err) {
    console.error("Could not save shortcuts.json:", err);
  }
}

let activeCallbacks = {};

function registerAll(callbacks) {
  if (callbacks) activeCallbacks = callbacks;

  globalShortcut.unregisterAll();
  const shortcuts = loadShortcuts();

  Object.entries(shortcuts).forEach(([action, accelerator]) => {
    if (!accelerator) return;
    try {
      const success = globalShortcut.register(accelerator, () => {
        if (activeCallbacks[action]) {
          activeCallbacks[action]();
        }
      });
      if (!success) {
        console.warn(`Shortcut ${accelerator} could not be registered (may be reserved).`);
      }
    } catch (e) {
      console.warn(`Error registering ${accelerator}:`, e);
    }
  });
}

function updateShortcut(action, newAccelerator) {
  const current = loadShortcuts();
  current[action] = newAccelerator;
  saveShortcuts(current);
  registerAll(activeCallbacks);
  return { success: true, shortcuts: current };
}

function resetDefaults() {
  saveShortcuts(DEFAULT_SHORTCUTS);
  registerAll(activeCallbacks);
  return { success: true, shortcuts: { ...DEFAULT_SHORTCUTS } };
}

module.exports = {
  DEFAULT_SHORTCUTS,
  SHORTCUT_LABELS,
  loadShortcuts,
  saveShortcuts,
  registerAll,
  updateShortcut,
  resetDefaults
};
