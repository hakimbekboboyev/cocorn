const screenVideo = document.getElementById('screenVideo');
const spotlightCanvas = document.getElementById('spotlightCanvas');
const sCtx = spotlightCanvas.getContext('2d');
const focusLens = document.getElementById('focusLens');
const lensCanvas = document.getElementById('lensCanvas');
const lCtx = lensCanvas.getContext('2d');

let targetX = window.innerWidth / 2;
let targetY = window.innerHeight / 2;
let currentX = targetX;
let currentY = targetY;
let isZoomActive = false;
let animationFrameId = null;

function resizeSpotlight() {
  spotlightCanvas.width = window.innerWidth;
  spotlightCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeSpotlight);
resizeSpotlight();

async function initScreenFeed() {
  try {
    if (!window.electronAPI) return;
    const sources = await window.electronAPI.getSources();
    const primarySource = sources.find(s => s.id.startsWith('screen')) || sources[0];

    if (!primarySource) return;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: primarySource.id,
          minWidth: 1280,
          maxWidth: window.screen.width * (window.devicePixelRatio || 1),
          minHeight: 720,
          maxHeight: window.screen.height * (window.devicePixelRatio || 1)
        }
      }
    });

    screenVideo.srcObject = stream;
    await screenVideo.play();
  } catch (err) {
    console.warn("Screen feed for zoom lens warning:", err);
  }
}

// Track cursor screen position smoothly
async function pollCursor() {
  if (window.electronAPI && window.electronAPI.getCursorPosition) {
    try {
      const pos = await window.electronAPI.getCursorPosition();
      if (pos) {
        targetX = pos.x;
        targetY = pos.y;
      }
    } catch (e) {}
  }
}

function renderFrame() {
  // Smooth lerp movement towards cursor
  currentX += (targetX - currentX) * 0.24;
  currentY += (targetY - currentY) * 0.24;

  focusLens.style.left = `${currentX}px`;
  focusLens.style.top = `${currentY}px`;

  // 1. Draw Spotlight (ambient dark vignette with hole for focus)
  sCtx.clearRect(0, 0, spotlightCanvas.width, spotlightCanvas.height);
  
  sCtx.fillStyle = 'rgba(0, 0, 0, 0.22)';
  sCtx.fillRect(0, 0, spotlightCanvas.width, spotlightCanvas.height);

  sCtx.save();
  sCtx.globalCompositeOperation = 'destination-out';
  const radGrad = sCtx.createRadialGradient(currentX, currentY, 80, currentX, currentY, 260);
  radGrad.addColorStop(0, 'rgba(0, 0, 0, 1)');
  radGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  sCtx.fillStyle = radGrad;
  sCtx.beginPath();
  sCtx.arc(currentX, currentY, 260, 0, Math.PI * 2);
  sCtx.fill();
  sCtx.restore();

  // 2. Draw 2x Magnified Content into Lens Canvas
  if (screenVideo.videoWidth > 0) {
    const scale = 2.0; // 2x Zoom
    const lensRadius = lensCanvas.width / 2;

    const vWidth = screenVideo.videoWidth;
    const vHeight = screenVideo.videoHeight;
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    // Convert screen coordinates to video source coordinates
    const sxCenter = (currentX / screenWidth) * vWidth;
    const syCenter = (currentY / screenHeight) * vHeight;

    const sw = (lensCanvas.width / scale) * (vWidth / screenWidth);
    const sh = (lensCanvas.height / scale) * (vHeight / screenHeight);
    const sx = sxCenter - sw / 2;
    const sy = syCenter - sh / 2;

    lCtx.clearRect(0, 0, lensCanvas.width, lensCanvas.height);

    lCtx.save();
    // Circular clip
    lCtx.beginPath();
    lCtx.arc(lensRadius, lensRadius, lensRadius, 0, Math.PI * 2);
    lCtx.clip();

    // Draw magnified frame
    lCtx.drawImage(
      screenVideo,
      Math.max(0, sx), Math.max(0, sy), sw, sh,
      0, 0, lensCanvas.width, lensCanvas.height
    );

    // Subtle crosshair in the center of lens
    lCtx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
    lCtx.lineWidth = 1.5;
    lCtx.beginPath();
    lCtx.moveTo(lensRadius - 12, lensRadius);
    lCtx.lineTo(lensRadius + 12, lensRadius);
    lCtx.moveTo(lensRadius, lensRadius - 12);
    lCtx.lineTo(lensRadius, lensRadius + 12);
    lCtx.stroke();

    lCtx.restore();
  }

  animationFrameId = requestAnimationFrame(renderFrame);
}

// Polling interval for cursor
let cursorInterval = null;

function startZoom() {
  if (isZoomActive) return;
  isZoomActive = true;
  focusLens.style.display = 'block';
  spotlightCanvas.style.display = 'block';

  cursorInterval = setInterval(pollCursor, 30);
  renderFrame();
}

function stopZoom() {
  isZoomActive = false;
  focusLens.style.display = 'none';
  spotlightCanvas.style.display = 'none';

  if (cursorInterval) clearInterval(cursorInterval);
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
}

if (window.electronAPI && window.electronAPI.onZoomState) {
  window.electronAPI.onZoomState((active) => {
    if (active) startZoom();
    else stopZoom();
  });
}

initScreenFeed();
startZoom();
