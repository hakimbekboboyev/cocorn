const videoElement = document.getElementById('cameraVideo');
const sizeSmallBtn = document.getElementById('sizeSmallBtn');
const sizeMedBtn = document.getElementById('sizeMedBtn');
const sizeLargeBtn = document.getElementById('sizeLargeBtn');
const flipBtn = document.getElementById('flipBtn');
const closeBtn = document.getElementById('closeBtn');

let isMirrored = true;

async function initCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 720 },
        height: { ideal: 720 },
        facingMode: 'user'
      },
      audio: false
    });
    videoElement.srcObject = stream;
  } catch (err) {
    console.error('Camera init error:', err);
  }
}

function setActiveSize(btn, size) {
  [sizeSmallBtn, sizeMedBtn, sizeLargeBtn].forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (window.electronAPI && window.electronAPI.updateCameraSize) {
    window.electronAPI.updateCameraSize(size);
  }
}

sizeSmallBtn.addEventListener('click', () => setActiveSize(sizeSmallBtn, 'small'));
sizeMedBtn.addEventListener('click', () => setActiveSize(sizeMedBtn, 'medium'));
sizeLargeBtn.addEventListener('click', () => setActiveSize(sizeLargeBtn, 'large'));

flipBtn.addEventListener('click', () => {
  isMirrored = !isMirrored;
  if (isMirrored) {
    videoElement.classList.remove('unmirrored');
  } else {
    videoElement.classList.add('unmirrored');
  }
});

closeBtn.addEventListener('click', () => {
  if (window.electronAPI && window.electronAPI.closeCameraBubble) {
    window.electronAPI.closeCameraBubble();
  }
});

initCamera();
