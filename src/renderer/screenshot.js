// CoCorn Clean Snip Engine (Instant Live Transparent Snip)
const drawCanvas = document.getElementById('drawCanvas');
const drawCtx = drawCanvas.getContext('2d');

const overlayCanvas = document.getElementById('overlayCanvas');
const overlayCtx = overlayCanvas.getContext('2d');

const topSnipBar = document.getElementById('topSnipBar');
const modeAreaBtn = document.getElementById('modeAreaBtn');
const modeFullBtn = document.getElementById('modeFullBtn');
const modeCancelBtn = document.getElementById('modeCancelBtn');

const textInputContainer = document.getElementById('textInputContainer');
const textInput = document.getElementById('textInput');
const sizeBadge = document.getElementById('sizeBadge');
const screenshotToolbar = document.getElementById('screenshotToolbar');

const copyBtn = document.getElementById('copyBtn');
const saveBtn = document.getElementById('saveBtn');
const cancelBtn = document.getElementById('cancelBtn');
const undoBtn = document.getElementById('undoBtn');

// Display / Resolution
const dpr = window.devicePixelRatio || 1;

// Crop State
let cropRect = null; // { x, y, w, h }
let isCreatingCrop = false;
let isMovingCrop = false;
let activeResizeHandle = null;
let dragStartX = 0;
let dragStartY = 0;
let origCropRect = null;
let lastClickTime = 0;

// Annotation State
let currentTool = 'select'; // 'select' | 'arrow' | 'rect' | 'circle' | 'pen' | 'text' | 'blur'
let currentColor = '#ef4444';
let currentLineWidth = 4;
let annotations = []; // Committed annotations
let currentDrawing = null; // In-progress annotation
let textPos = null;

const HANDLE_SIZE = 8;
const HANDLE_HIT_RADIUS = 10;

// Initialize Canvases
function initCanvases() {
  const w = window.innerWidth;
  const h = window.innerHeight;

  drawCanvas.width = w * dpr;
  drawCanvas.height = h * dpr;
  drawCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

  overlayCanvas.width = w * dpr;
  overlayCanvas.height = h * dpr;
  overlayCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

  renderOverlay();
}
initCanvases();
window.addEventListener('resize', initCanvases);

// Render translucent veil and selection cutout over live desktop
function renderOverlay() {
  overlayCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);

  if (!cropRect) {
    // Soft transparent veil over live desktop
    overlayCtx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    overlayCtx.fillRect(0, 0, window.innerWidth, window.innerHeight);
    sizeBadge.style.display = 'none';
    screenshotToolbar.style.display = 'none';
    return;
  }

  const { x, y, w, h } = cropRect;

  // Dimming mask with transparent cutout so live desktop shines through
  overlayCtx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  overlayCtx.fillRect(0, 0, window.innerWidth, y);
  overlayCtx.fillRect(0, y, x, h);
  overlayCtx.fillRect(x + w, y, window.innerWidth - (x + w), h);
  overlayCtx.fillRect(0, y + h, window.innerWidth, window.innerHeight - (y + h));

  // Selection Border (Mac style)
  overlayCtx.strokeStyle = '#38bdf8';
  overlayCtx.lineWidth = 1.5;
  overlayCtx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

  // Subtle interior guide
  overlayCtx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  overlayCtx.lineWidth = 1;
  overlayCtx.strokeRect(x - 0.5, y - 0.5, w + 1, h + 1);

  // 8 Resize Handles
  const handles = getHandles(cropRect);
  for (const hKey in handles) {
    const pt = handles[hKey];
    overlayCtx.fillStyle = '#ffffff';
    overlayCtx.strokeStyle = '#0284c7';
    overlayCtx.lineWidth = 1.5;
    overlayCtx.beginPath();
    overlayCtx.arc(pt.x, pt.y, HANDLE_SIZE / 2, 0, Math.PI * 2);
    overlayCtx.fill();
    overlayCtx.stroke();
  }

  // Dimension Badge
  sizeBadge.style.display = 'block';
  sizeBadge.textContent = `${Math.round(w)} × ${Math.round(h)} px`;
  let badgeY = y - 26;
  if (badgeY < 8) badgeY = y + 8;
  let badgeX = x;
  if (badgeX + 110 > window.innerWidth) badgeX = window.innerWidth - 110;
  sizeBadge.style.left = `${Math.max(8, badgeX)}px`;
  sizeBadge.style.top = `${badgeY}px`;

  updateToolbarPosition();
}

function getHandles(rect) {
  const { x, y, w, h } = rect;
  return {
    nw: { x: x, y: y },
    n:  { x: x + w / 2, y: y },
    ne: { x: x + w, y: y },
    e:  { x: x + w, y: y + h / 2 },
    se: { x: x + w, y: y + h },
    s:  { x: x + w / 2, y: y + h },
    sw: { x: x, y: y + h },
    w:  { x: x, y: y + h / 2 }
  };
}

function getHandleUnderCursor(px, py) {
  if (!cropRect) return null;
  const handles = getHandles(cropRect);
  for (const key in handles) {
    const pt = handles[key];
    const dx = px - pt.x;
    const dy = py - pt.y;
    if (Math.hypot(dx, dy) <= HANDLE_HIT_RADIUS) {
      return key;
    }
  }
  return null;
}

function getCursorForHandle(handle) {
  switch (handle) {
    case 'nw': case 'se': return 'nwse-resize';
    case 'ne': case 'sw': return 'nesw-resize';
    case 'n':  case 's':  return 'ns-resize';
    case 'e':  case 'w':  return 'ew-resize';
    default: return 'crosshair';
  }
}

function isPointInsideCrop(px, py) {
  if (!cropRect) return false;
  return (
    px >= cropRect.x &&
    px <= cropRect.x + cropRect.w &&
    py >= cropRect.y &&
    py <= cropRect.y + cropRect.h
  );
}

function updateToolbarPosition() {
  if (!cropRect) {
    screenshotToolbar.style.display = 'none';
    return;
  }

  screenshotToolbar.style.display = 'flex';
  const { x, y, w, h } = cropRect;
  const tbWidth = screenshotToolbar.offsetWidth || 480;
  const tbHeight = screenshotToolbar.offsetHeight || 42;

  let tbX = x + (w / 2) - (tbWidth / 2);
  let tbY = y + h + 10;

  // If overflows bottom, flip to above
  if (tbY + tbHeight + 10 > window.innerHeight) {
    tbY = y - tbHeight - 10;
  }
  if (tbY < 10) tbY = y + 10;

  // Clamp horizontally
  tbX = Math.max(10, Math.min(window.innerWidth - tbWidth - 10, tbX));

  screenshotToolbar.style.left = `${Math.round(tbX)}px`;
  screenshotToolbar.style.top = `${Math.round(tbY)}px`;
}

// Mouse Event Listeners
window.addEventListener('mousedown', (e) => {
  if (e.target.closest('#topSnipBar') || e.target.closest('#screenshotToolbar') || e.target.closest('#textInputContainer')) {
    return;
  }

  commitTextInput();

  const px = e.clientX;
  const py = e.clientY;

  // Double click inside box = Instant Copy to clipboard!
  const now = Date.now();
  if (cropRect && isPointInsideCrop(px, py) && (now - lastClickTime < 300)) {
    lastClickTime = 0;
    executeSnip(false);
    return;
  }
  lastClickTime = now;

  // Check resize handles first
  const handle = getHandleUnderCursor(px, py);
  if (handle) {
    activeResizeHandle = handle;
    dragStartX = px;
    dragStartY = py;
    origCropRect = { ...cropRect };
    return;
  }

  // If Select mode (default)
  if (currentTool === 'select') {
    if (cropRect && isPointInsideCrop(px, py)) {
      // Reposition crop box
      isMovingCrop = true;
      dragStartX = px;
      dragStartY = py;
      origCropRect = { ...cropRect };
    } else {
      // Create new crop box
      isCreatingCrop = true;
      dragStartX = px;
      dragStartY = py;
      cropRect = { x: px, y: py, w: 0, h: 0 };
      renderOverlay();
    }
    return;
  }

  // Annotation tools (arrow, rect, circle, pen, blur, text)
  if (currentTool === 'text') {
    openTextInput(px, py);
    return;
  }

  startAnnotation(px, py);
});

window.addEventListener('mousemove', (e) => {
  const px = e.clientX;
  const py = e.clientY;

  // Cursor updates
  if (!activeResizeHandle && !isCreatingCrop && !isMovingCrop && !currentDrawing) {
    const handle = getHandleUnderCursor(px, py);
    if (handle) {
      document.body.style.cursor = getCursorForHandle(handle);
    } else if (currentTool === 'select') {
      if (cropRect && isPointInsideCrop(px, py)) {
        document.body.style.cursor = 'move';
      } else {
        document.body.style.cursor = 'crosshair';
      }
    } else if (currentTool === 'text') {
      document.body.style.cursor = 'text';
    } else {
      document.body.style.cursor = 'crosshair';
    }
  }

  // Dragging resize handle
  if (activeResizeHandle && origCropRect) {
    const dx = px - dragStartX;
    const dy = py - dragStartY;
    cropRect = calculateResizedRect(origCropRect, activeResizeHandle, dx, dy);
    renderOverlay();
    return;
  }

  // Moving crop box
  if (isMovingCrop && origCropRect) {
    const dx = px - dragStartX;
    const dy = py - dragStartY;
    let newX = origCropRect.x + dx;
    let newY = origCropRect.y + dy;

    newX = Math.max(0, Math.min(window.innerWidth - origCropRect.w, newX));
    newY = Math.max(0, Math.min(window.innerHeight - origCropRect.h, newY));

    cropRect = {
      x: newX,
      y: newY,
      w: origCropRect.w,
      h: origCropRect.h
    };
    renderOverlay();
    return;
  }

  // Creating crop box
  if (isCreatingCrop) {
    const x = Math.min(dragStartX, px);
    const y = Math.min(dragStartY, py);
    const w = Math.abs(px - dragStartX);
    const h = Math.abs(py - dragStartY);
    cropRect = { x, y, w, h };
    renderOverlay();
    return;
  }

  // In-progress annotation drawing
  if (currentDrawing) {
    updateAnnotation(px, py);
  }
});

window.addEventListener('mouseup', () => {
  if (activeResizeHandle) {
    activeResizeHandle = null;
    origCropRect = null;
    normalizeCropRect();
    renderOverlay();
  }

  if (isMovingCrop) {
    isMovingCrop = false;
    origCropRect = null;
    renderOverlay();
  }

  if (isCreatingCrop) {
    isCreatingCrop = false;
    if (cropRect && (cropRect.w < 10 || cropRect.h < 10)) {
      cropRect = null;
    } else {
      normalizeCropRect();
    }
    renderOverlay();
  }

  if (currentDrawing) {
    finishAnnotation();
  }
});

function calculateResizedRect(orig, handle, dx, dy) {
  let { x, y, w, h } = orig;

  if (handle.includes('e')) w += dx;
  if (handle.includes('s')) h += dy;
  if (handle.includes('w')) {
    x += dx;
    w -= dx;
  }
  if (handle.includes('n')) {
    y += dy;
    h -= dy;
  }

  return { x, y, w, h };
}

function normalizeCropRect() {
  if (!cropRect) return;
  let { x, y, w, h } = cropRect;
  if (w < 0) {
    x += w;
    w = Math.abs(w);
  }
  if (h < 0) {
    y += h;
    h = Math.abs(h);
  }
  w = Math.max(20, w);
  h = Math.max(20, h);

  x = Math.max(0, Math.min(window.innerWidth - w, x));
  y = Math.max(0, Math.min(window.innerHeight - h, y));

  cropRect = { x, y, w, h };
}

// Annotation Engine
function startAnnotation(px, py) {
  switch (currentTool) {
    case 'pen':
      currentDrawing = {
        type: 'pen',
        points: [{ x: px, y: py }],
        color: currentColor,
        size: currentLineWidth
      };
      break;
    case 'arrow':
      currentDrawing = {
        type: 'arrow',
        x1: px,
        y1: py,
        x2: px,
        y2: py,
        color: currentColor,
        size: currentLineWidth
      };
      break;
    case 'rect':
      currentDrawing = {
        type: 'rect',
        x1: px,
        y1: py,
        x2: px,
        y2: py,
        color: currentColor,
        size: currentLineWidth
      };
      break;
    case 'circle':
      currentDrawing = {
        type: 'circle',
        x1: px,
        y1: py,
        x2: px,
        y2: py,
        color: currentColor,
        size: currentLineWidth
      };
      break;
    case 'blur':
      currentDrawing = {
        type: 'blur',
        x1: px,
        y1: py,
        x2: px,
        y2: py
      };
      break;
  }
}

function updateAnnotation(px, py) {
  if (!currentDrawing) return;

  if (currentDrawing.type === 'pen') {
    currentDrawing.points.push({ x: px, y: py });
  } else {
    currentDrawing.x2 = px;
    currentDrawing.y2 = py;
  }

  renderAnnotations();
}

function finishAnnotation() {
  if (!currentDrawing) return;

  let keep = true;
  if (currentDrawing.type === 'pen' && currentDrawing.points.length < 2) keep = false;
  if (currentDrawing.type !== 'pen') {
    const dist = Math.hypot(currentDrawing.x2 - currentDrawing.x1, currentDrawing.y2 - currentDrawing.y1);
    if (dist < 4) keep = false;
  }

  if (keep) {
    annotations.push(currentDrawing);
  }
  currentDrawing = null;
  renderAnnotations();
}

function renderAnnotations() {
  drawCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);

  for (const ann of annotations) {
    drawSingleAnnotation(drawCtx, ann);
  }

  if (currentDrawing) {
    drawSingleAnnotation(drawCtx, currentDrawing);
  }
}

function drawSingleAnnotation(ctx, ann) {
  ctx.save();

  if (ann.type === 'pen') {
    if (ann.points.length < 2) return;
    ctx.strokeStyle = ann.color;
    ctx.lineWidth = ann.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(ann.points[0].x, ann.points[0].y);
    for (let i = 1; i < ann.points.length; i++) {
      ctx.lineTo(ann.points[i].x, ann.points[i].y);
    }
    ctx.stroke();
  } else if (ann.type === 'arrow') {
    drawCrispArrow(ctx, ann.x1, ann.y1, ann.x2, ann.y2, ann.color, ann.size);
  } else if (ann.type === 'rect') {
    const rx = Math.min(ann.x1, ann.x2);
    const ry = Math.min(ann.y1, ann.y2);
    const rw = Math.abs(ann.x2 - ann.x1);
    const rh = Math.abs(ann.y2 - ann.y1);

    ctx.strokeStyle = ann.color;
    ctx.lineWidth = ann.size;
    ctx.beginPath();
    ctx.roundRect(rx, ry, rw, rh, 6);
    ctx.stroke();
  } else if (ann.type === 'circle') {
    const rx = Math.min(ann.x1, ann.x2);
    const ry = Math.min(ann.y1, ann.y2);
    const rw = Math.abs(ann.x2 - ann.x1);
    const rh = Math.abs(ann.y2 - ann.y1);
    const cx = rx + rw / 2;
    const cy = ry + rh / 2;

    ctx.strokeStyle = ann.color;
    ctx.lineWidth = ann.size;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rw / 2, rh / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (ann.type === 'blur') {
    const bx = Math.min(ann.x1, ann.x2);
    const by = Math.min(ann.y1, ann.y2);
    const bw = Math.abs(ann.x2 - ann.x1);
    const bh = Math.abs(ann.y2 - ann.y1);

    // Mosaic overlay styling
    ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, bw, bh);
  } else if (ann.type === 'text') {
    drawCrispText(ctx, ann.x, ann.y, ann.text, ann.color, ann.fontSize);
  }

  ctx.restore();
}

function drawCrispArrow(ctx, x1, y1, x2, y2, color, size) {
  const headLen = Math.max(14, size * 3.5);
  const angle = Math.atan2(y2 - y1, x2 - x1);

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = size;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(
    x2 - headLen * Math.cos(angle - Math.PI / 6),
    y2 - headLen * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    x2 - headLen * Math.cos(angle + Math.PI / 6),
    y2 - headLen * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fill();
}

function drawCrispText(ctx, x, y, text, color, fontSize = 16) {
  ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif`;
  ctx.textBaseline = 'top';

  const metrics = ctx.measureText(text);
  const paddingX = 8;
  const paddingY = 4;
  const th = fontSize + 6;
  const tw = metrics.width + paddingX * 2;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.beginPath();
  ctx.roundRect(x - paddingX, y - paddingY, tw, th, 6);
  ctx.fill();

  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

// In-place Text Input
function openTextInput(px, py) {
  commitTextInput();
  textPos = { x: px, y: py };
  textInputContainer.style.left = `${px}px`;
  textInputContainer.style.top = `${py}px`;
  textInputContainer.style.display = 'block';
  textInput.value = '';
  textInput.style.color = currentColor;
  setTimeout(() => textInput.focus(), 20);
}

function commitTextInput() {
  if (textInputContainer.style.display === 'block' && textPos) {
    const val = textInput.value.trim();
    if (val) {
      annotations.push({
        type: 'text',
        x: textPos.x,
        y: textPos.y,
        text: val,
        color: currentColor,
        fontSize: 16
      });
      renderAnnotations();
    }
    textInputContainer.style.display = 'none';
    textPos = null;
  }
}

textInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    commitTextInput();
  } else if (e.key === 'Escape') {
    textInput.value = '';
    commitTextInput();
  }
});

// Toolbar Tool Toggles
document.querySelectorAll('.tb-tool-btn[data-tool]').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (btn.classList.contains('active')) {
      // Toggle off to default selection
      btn.classList.remove('active');
      currentTool = 'select';
    } else {
      document.querySelectorAll('.tb-tool-btn[data-tool]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentTool = btn.dataset.tool;
    }
  });
});

// Color Selection
document.querySelectorAll('.color-dot').forEach((dot) => {
  dot.addEventListener('click', () => {
    document.querySelectorAll('.color-dot').forEach((d) => d.classList.remove('active'));
    dot.classList.add('active');
    currentColor = dot.dataset.color;
    if (textInputContainer.style.display === 'block') {
      textInput.style.color = currentColor;
    }
  });
});

// Undo
undoBtn.addEventListener('click', () => {
  if (annotations.length > 0) {
    annotations.pop();
    renderAnnotations();
  }
});

// Top Snip Bar Modes
modeAreaBtn.addEventListener('click', () => {
  modeAreaBtn.classList.add('active');
  modeFullBtn.classList.remove('active');
});

modeFullBtn.addEventListener('click', () => {
  // Capture Full Screen directly
  executeSnip(false, true);
});

modeCancelBtn.addEventListener('click', () => {
  if (window.electronAPI && window.electronAPI.closeScreenshot) {
    window.electronAPI.closeScreenshot();
  }
});

// Execute Snip on confirmation (Enter / Button / Double-click)
async function executeSnip(isSave = false, isFullScreen = false) {
  commitTextInput();

  // If no selection on screen, default to full screen
  if (!cropRect && !isFullScreen) {
    isFullScreen = true;
  }

  const hasAnnotations = annotations.length > 0;
  let annotationsDataUrl = null;

  if (hasAnnotations) {
    // Export transparent annotations canvas
    annotationsDataUrl = drawCanvas.toDataURL('image/png');
  }

  if (window.electronAPI && window.electronAPI.captureSnip) {
    await window.electronAPI.captureSnip({
      cropRect: cropRect || { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight },
      hasAnnotations,
      annotationsDataUrl,
      isSave,
      isFullScreen
    });
  }
}

// Receive merge request from main if annotations need compositing
if (window.electronAPI && window.electronAPI.onMergeAndFinish) {
  window.electronAPI.onMergeAndFinish(async ({ screenDataUrl }) => {
    const img = new Image();
    img.onload = () => {
      const mergeCanvas = document.createElement('canvas');
      mergeCanvas.width = img.width;
      mergeCanvas.height = img.height;
      const mCtx = mergeCanvas.getContext('2d');

      // Draw cropped screen
      mCtx.drawImage(img, 0, 0);

      // Draw annotations scaled and translated
      if (cropRect) {
        mCtx.save();
        mCtx.scale(dpr, dpr);
        mCtx.translate(-cropRect.x, -cropRect.y);
        for (const ann of annotations) {
          drawSingleAnnotation(mCtx, ann);
        }
        mCtx.restore();
      }

      const finalDataUrl = mergeCanvas.toDataURL('image/png');
      if (window.electronAPI.finishWithCompositedImage) {
        window.electronAPI.finishWithCompositedImage(finalDataUrl);
      }
    };
    img.src = screenDataUrl;
  });
}

// Buttons
copyBtn.addEventListener('click', () => executeSnip(false));
saveBtn.addEventListener('click', () => executeSnip(true));
cancelBtn.addEventListener('click', () => {
  if (window.electronAPI && window.electronAPI.closeScreenshot) {
    window.electronAPI.closeScreenshot();
  }
});

// Keyboard Shortcuts
window.addEventListener('keydown', (e) => {
  if (textInputContainer.style.display === 'block') return;

  if (e.key === 'Escape') {
    cancelBtn.click();
  } else if (e.key === 'Enter') {
    copyBtn.click();
  } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c') {
    copyBtn.click();
  } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    saveBtn.click();
  } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    undoBtn.click();
  } else if (!e.metaKey && !e.ctrlKey) {
    const key = e.key.toLowerCase();
    const map = { a: 'arrow', r: 'rect', o: 'circle', p: 'pen', t: 'text', b: 'blur' };
    if (map[key]) {
      const btn = document.querySelector(`.tb-tool-btn[data-tool="${map[key]}"]`);
      if (btn) btn.click();
    }
  }
});
