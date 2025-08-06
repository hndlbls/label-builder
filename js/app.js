// js/app.js
window.addEventListener('load', () => {
  // ===== Correzioni manuali =====
  // offset in px CANVAS (positivo = sposta overlay/validazione a destra/in basso)
  const OFFSET_CANVAS_X = 7;     // ← REGOLA qui (es. 8)
  const OFFSET_CANVAS_Y = 0;

  // tweak di scala (fattore relativo) — positivo = allarga
  const SCALE_EPS_X = 0.03;      // ← REGOLA qui (es. 0.02 = +2%)
  const SCALE_EPS_Y = 0.00;

  // ===== Fabric setup
  fabric.Object.prototype.objectCaching = false;

  const canvas    = new fabric.Canvas('labelCanvas', { selection: false });
  const container = document.querySelector('.canvas-container');
  const warningEl = document.getElementById('warning');

  function showWarning(show) {
    if (!warningEl) return;
    warningEl.style.display    = show ? 'block' : 'none';
    warningEl.style.visibility = show ? 'visible' : 'hidden';
    warningEl.style.opacity    = show ? '1' : '0';
  }

  // ===== Maschera off-screen
  let maskCanvas, maskCtx, maskReady = false, maskW = 0, maskH = 0;
  function loadMask(srcMask) {
    maskReady = false;
    if (!maskCanvas) {
      maskCanvas = document.createElement('canvas');
      maskCtx    = maskCanvas.getContext('2d', { willReadFrequently: true });
    }
    const img = new Image();
    img.src   = `img/${srcMask}`;
    img.onload = () => {
      maskW = maskCanvas.width  = img.naturalWidth;
      maskH = maskCanvas.height = img.naturalHeight;
      maskCtx.clearRect(0, 0, maskW, maskH);
      maskCtx.drawImage(img, 0, 0);
      ensureHitCanvas(maskW, maskH);
      ensureOccCanvas(maskW, maskH);
      maskReady = true;
    };
    img.onerror = () => console.error('[Mask] failed', img.src);
  }

  // ===== Overlay maschera (persistente)
  let maskOverlay = null;
  function loadMaskOverlay(srcMask) {
    fabric.Image.fromURL(`img/${srcMask}`, img => {
      img.set({ selectable: false, evented: false, opacity: 0.2, visible: false });
      maskOverlay = img;
      canvas.add(maskOverlay);
      maskOverlay.moveTo(0);
      scaleOverlay(maskOverlay);
      canvas.requestRenderAll();
    });
  }
  function scaleOverlay(imgObj) {
    if (!imgObj) return;
    imgObj.scaleToWidth(canvas.getWidth());
    imgObj.scaleToHeight(canvas.getHeight());
    imgObj.set({ left: 0, top: 0 });
    imgObj.setCoords();
  }

  // ===== Canvas responsive (207:52)
  function resizeCanvas() {
    const w = container.clientWidth;
    const h = w * 52 / 207;
    canvas.setWidth(w);
    canvas.setHeight(h);

    const bg = canvas.backgroundImage;
    if (bg) {
      bg.scaleToWidth(canvas.getWidth());
      bg.scaleToHeight(canvas.getHeight());
      bg.setCoords && bg.setCoords();
    }
    scaleOverlay(maskOverlay);
    scaleOverlay(debugOverlay);
    canvas.requestRenderAll();
  }

  // ===== Sfondo layout
  function loadLayout(filename) {
    canvas.setBackgroundImage(null, canvas.renderAll.bind(canvas));
    fabric.Image.fromURL(`img/${filename}`, img => {
      img.set({ selectable: false, evented: false });
      img.scaleToWidth(canvas.getWidth());
      img.scaleToHeight(canvas.getHeight());
      canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas));
    });
  }

  // ===== Hit-canvas (render per-pixel)
  let hitCanvas, hitCtx;
  function ensureHitCanvas(w, h) {
    if (!hitCanvas) {
      hitCanvas = document.createElement('canvas');
      hitCtx    = hitCanvas.getContext('2d', { willReadFrequently: true });
    }
    if (hitCanvas.width !== w || hitCanvas.height !== h) {
      hitCanvas.width  = w;
      hitCanvas.height = h;
    }
  }

  // ===== Overlay di debug (pixel occupati)
  let occCanvas, occCtx, debugOverlay = null;
  const OCC_FILL_RGBA = 'rgba(0,160,255,0.47)';
  function ensureOccCanvas(w, h) {
    if (!occCanvas) {
      occCanvas = document.createElement('canvas');
      occCtx    = occCanvas.getContext('2d', { willReadFrequently: true });
    }
    if (occCanvas.width !== w || occCanvas.height !== h) {
      occCanvas.width  = w;
      occCanvas.height = h;
    }
    if (!debugOverlay) {
      debugOverlay = new fabric.Image(occCanvas, {
        left: 0, top: 0,
        selectable: false, evented: false,
        opacity: 0.35, visible: false
      });
      canvas.add(debugOverlay);
      canvas.bringToFront(debugOverlay);
      scaleOverlay(debugOverlay);
    }
  }

  // ===== Parametri validazione
  const WHITE_LUMA_THRESHOLD = 200; // bianco=OK (inverti se maschera invertita)
  const SAMPLE_STEP          = 1;
  let isDragging = false;

  // ===== Validazione per-pixel + overlay debug (con offset + scala corretti)
  function isObjectInAllowedZone(obj) {
    if (!maskReady) return true;

    const cW = canvas.getWidth(),  cH = canvas.getHeight();

    // scala base (canvas -> maschera)
    const baseSX = maskW / cW;
    const baseSY = maskH / cH;

    // applica il tweak di scala
    const sx = baseSX * (1 + SCALE_EPS_X);
    const sy = baseSY * (1 + SCALE_EPS_Y);

    // offset convertito in px maschera
    const ox = OFFSET_CANVAS_X * baseSX;
    const oy = OFFSET_CANVAS_Y * baseSY;

    // 1) Render oggetto su hitCanvas (scalato con tweak)
    hitCtx.clearRect(0, 0, maskW, maskH);
    hitCtx.save();
    hitCtx.scale(sx, sy);
    obj.render(hitCtx);
    hitCtx.restore();

    // 2) DEBUG overlay: intero hitCanvas, con offset, nessun ritaglio
    if (isDragging) {
      occCtx.clearRect(0, 0, maskW, maskH);
      occCtx.drawImage(hitCanvas, ox, oy); // <-- offset applicato
      occCtx.globalCompositeOperation = 'source-in';
      occCtx.fillStyle = OCC_FILL_RGBA;
      occCtx.fillRect(0, 0, maskW, maskH);
      occCtx.globalCompositeOperation = 'source-over';
      debugOverlay.set('dirty', true);
      debugOverlay.set('visible', true);
      scaleOverlay(debugOverlay);
    }

    // 3) Bounding rect mappata con la stessa scala/offset
    const rect = obj.getBoundingRect(true, true);
    const rx0 = Math.max(0, Math.floor(rect.left   * sx)); // coordinate su hit (senza offset)
    const ry0 = Math.max(0, Math.floor(rect.top    * sy));
    const rw  = Math.min(maskW - rx0, Math.ceil(rect.width  * sx));
    const rh  = Math.min(maskH - ry0, Math.ceil(rect.height * sy));
    if (rw <= 0 || rh <= 0) return true;

    const rxMask = Math.max(0, Math.floor(rect.left * sx + ox)); // maschera con offset
    const ryMask = Math.max(0, Math.floor(rect.top  * sy + oy));

    const objData  = hitCtx.getImageData(rx0,   ry0,   rw, rh).data;   // oggetto (tweak no offset)
    const maskData = maskCtx.getImageData(rxMask, ryMask, rw, rh).data; // maschera (offset)

    // 4) Confronto per-pixel
    let valid = true;
    for (let y = 0; y < rh; y += SAMPLE_STEP) {
      let row = y * rw * 4;
      for (let x = 0; x < rw; x += SAMPLE_STEP) {
        const idx = row + x * 4;

        const oa = objData[idx + 3];
        if (oa <= 10) continue;

        const r = maskData[idx], g = maskData[idx+1], b = maskData[idx+2], a = maskData[idx+3];
        const luma = 0.2126*r + 0.7152*g + 0.0722*b;
        const allowedHere = (a >= 128) && (luma >= WHITE_LUMA_THRESHOLD);
        if (!allowedHere) { valid = false; break; }
      }
      if (!valid) break;
    }
    return valid;
  }

  function updateValidity(obj) {
    const ok = isObjectInAllowedZone(obj);
    obj.set({ stroke: ok ? null : 'red', strokeWidth: ok ? 0 : 2 });
    canvas.requestRenderAll();
    showWarning(!ok);
  }

  // ===== Eventi oggetto
  canvas.on('object:moving',   e => updateValidity(e.target));
  canvas.on('object:scaling',  e => updateValidity(e.target));
  canvas.on('object:rotating', e => updateValidity(e.target));
  canvas.on('object:added',    e => updateValidity(e.target));

  // ===== Drag: mostra/nascondi overlay
  canvas.on('mouse:down', () => {
    isDragging = true;
    if (maskOverlay)  { maskOverlay.set('visible', true);  maskOverlay.moveTo(0); }
    if (debugOverlay) { debugOverlay.set('visible', true); canvas.bringToFront(debugOverlay); }
    canvas.requestRenderAll();
  });
  canvas.on('mouse:up', () => {
    isDragging = false;
    if (maskOverlay)  maskOverlay.set('visible', false);
    if (debugOverlay) debugOverlay.set('visible', false);
    canvas.requestRenderAll();
  });

  // ===== Hole options
  document.querySelectorAll('input[name="holeOption"]').forEach(radio => {
    radio.addEventListener('change', () => {
      if (radio.checked) {
        const n = radio.value;
        loadLayout(`${n}.png`);
        loadMask  (`${n}-mask.png`);
        loadMaskOverlay(`${n}-mask.png`);
      }
    });
  });

  // ===== Testo & font
  const fontSelect = document.getElementById('fontSelect');
  const textInput  = document.getElementById('textInput');
  [
    "Font1","Font2","Font3","Font4","Font5",
    "Font6","Font7","Font8","Font9","Font10",
    "Font11","Font12","Font13","Font14"
  ].forEach(f => {
    const opt = document.createElement('option');
    opt.value = f; opt.textContent = f;
    fontSelect.appendChild(opt);
  });

  function addText() {
    const txt = new fabric.Text(textInput.value || "Text", {
      fontFamily: fontSelect.value,
      left: 20, top: 10,
      fill: '#333',
      fontSize: 40
    });
    canvas.add(txt).setActiveObject(txt);
  }
  fontSelect.addEventListener('change', addText);
  textInput.addEventListener('input', () => {
    const o = canvas.getActiveObject();
    if (o && o.type === 'text') {
      o.set('text', textInput.value).setCoords();
      updateValidity(o);
    }
  });

  // ===== Icone
  document.getElementById('iconSelect').addEventListener('change', e => {
    fabric.Image.fromURL(`img/${e.target.value}`, ico => {
      ico.scaleToWidth(40);
      ico.left = 100; ico.top = 10;
      canvas.add(ico).setActiveObject(ico);
    });
  });

  // ===== Resize
  let lastW = 0;
  const ro = new ResizeObserver(() => {
    const w = container.clientWidth;
    if (Math.round(w) === Math.round(lastW)) return;
    lastW = w;
    resizeCanvas();
  });
  lastW = container.clientWidth;
  ro.observe(container);

  window.addEventListener('orientationchange', () => {
    setTimeout(() => { lastW = 0; resizeCanvas(); }, 200);
  });

  // ===== Init
  resizeCanvas();
  const initial = document.querySelector('input[name="holeOption"]:checked');
  if (initial) {
    const n = initial.value;
    loadLayout(`${n}.png`);
    loadMask  (`${n}-mask.png`);
    loadMaskOverlay(`${n}-mask.png`);
  }
});
