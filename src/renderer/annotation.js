const canvas = document.getElementById('drawCanvas');
const ctx = canvas.getContext('2d');

let currentTool = 'pen';
let currentColor = '#ef4444';
let currentSize = 6;
let isDrawing = false;
let startX = 0;
let startY = 0;
let currentPath = [];

// History for Undo
const shapes = [];

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx.scale(dpr, dpr);
  redraw();
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Tool selection
document.querySelectorAll('.tool-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentTool = btn.dataset.tool;
  });
});

// Color selection
document.querySelectorAll('.color-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentColor = btn.dataset.color;
  });
});

// Size selection
document.querySelectorAll('.size-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentSize = parseInt(btn.dataset.size, 10);
  });
});

// Actions
document.getElementById('undoBtn').addEventListener('click', () => {
  shapes.pop();
  redraw();
});

document.getElementById('clearBtn').addEventListener('click', () => {
  shapes.length = 0;
  redraw();
});

document.getElementById('closeAnnotationBtn').addEventListener('click', () => {
  if (window.electronAPI && window.electronAPI.closeAnnotation) {
    window.electronAPI.closeAnnotation();
  }
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.getElementById('closeAnnotationBtn').click();
  } else if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
    document.getElementById('undoBtn').click();
  }
});

// Mouse drawing events
canvas.addEventListener('mousedown', (e) => {
  isDrawing = true;
  startX = e.clientX;
  startY = e.clientY;

  if (currentTool === 'pen' || currentTool === 'highlighter') {
    currentPath = [{ x: startX, y: startY }];
  }
});

canvas.addEventListener('mousemove', (e) => {
  if (!isDrawing) return;

  const currentX = e.clientX;
  const currentY = e.clientY;

  redraw();

  // Draw current live preview
  ctx.save();
  setupStyle(currentTool, currentColor, currentSize);

  if (currentTool === 'pen' || currentTool === 'highlighter') {
    currentPath.push({ x: currentX, y: currentY });
    drawFreehand(currentPath);
  } else if (currentTool === 'arrow') {
    drawArrow(startX, startY, currentX, currentY);
  } else if (currentTool === 'rect') {
    drawRect(startX, startY, currentX, currentY);
  } else if (currentTool === 'circle') {
    drawCircle(startX, startY, currentX, currentY);
  }

  ctx.restore();
});

canvas.addEventListener('mouseup', (e) => {
  if (!isDrawing) return;
  isDrawing = false;

  const endX = e.clientX;
  const endY = e.clientY;

  if (currentTool === 'pen' || currentTool === 'highlighter') {
    if (currentPath.length > 1) {
      shapes.push({
        tool: currentTool,
        path: [...currentPath],
        color: currentColor,
        size: currentSize
      });
    }
  } else if (currentTool === 'arrow') {
    shapes.push({
      tool: 'arrow',
      x1: startX,
      y1: startY,
      x2: endX,
      y2: endY,
      color: currentColor,
      size: currentSize
    });
  } else if (currentTool === 'rect') {
    shapes.push({
      tool: 'rect',
      x1: startX,
      y1: startY,
      x2: endX,
      y2: endY,
      color: currentColor,
      size: currentSize
    });
  } else if (currentTool === 'circle') {
    shapes.push({
      tool: 'circle',
      x1: startX,
      y1: startY,
      x2: endX,
      y2: endY,
      color: currentColor,
      size: currentSize
    });
  }

  currentPath = [];
  redraw();
});

function setupStyle(tool, color, size) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (tool === 'highlighter') {
    ctx.strokeStyle = color;
    ctx.lineWidth = size * 3.5;
    ctx.globalAlpha = 0.38;
  } else {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = size;
    ctx.globalAlpha = 1.0;
  }
}

function redraw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  shapes.forEach(shape => {
    ctx.save();
    setupStyle(shape.tool, shape.color, shape.size);

    if (shape.tool === 'pen' || shape.tool === 'highlighter') {
      drawFreehand(shape.path);
    } else if (shape.tool === 'arrow') {
      drawArrow(shape.x1, shape.y1, shape.x2, shape.y2);
    } else if (shape.tool === 'rect') {
      drawRect(shape.x1, shape.y1, shape.x2, shape.y2);
    } else if (shape.tool === 'circle') {
      drawCircle(shape.x1, shape.y1, shape.x2, shape.y2);
    }

    ctx.restore();
  });
}

function drawFreehand(points) {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();
}

function drawArrow(x1, y1, x2, y2) {
  const headLen = Math.max(16, ctx.lineWidth * 3.2);
  const angle = Math.atan2(y2 - y1, x2 - x1);

  // Shaft
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  // Head
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
}

function drawRect(x1, y1, x2, y2) {
  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);
  const w = Math.abs(x2 - x1);
  const h = Math.abs(y2 - y1);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 6);
  ctx.stroke();
}

function drawCircle(x1, y1, x2, y2) {
  const radiusX = Math.abs(x2 - x1) / 2;
  const radiusY = Math.abs(y2 - y1) / 2;
  const centerX = Math.min(x1, x2) + radiusX;
  const centerY = Math.min(y1, y2) + radiusY;
  ctx.beginPath();
  ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
  ctx.stroke();
}
