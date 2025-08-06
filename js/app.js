// js/app.js
window.addEventListener('load', async () => {
  // ===== 1) Attendi i webfont (se supportato) =====
  if (document.fonts && document.fonts.ready) {
    try { await document.fonts.ready; } catch(_) {}
  }

  // ===== 2) Canvas Fabric senza retina scaling (coerenza su tutti i device) =====
  fabric.Object.prototype.objectCaching = false;
  const canvas = new fabric.Canvas('labelCanvas', {
    selection: false,
    enableRetinaScaling: false   // <— chiave per eliminare differenze tra dispositivi
  });

  const container = document.querySelector('.canvas-container');
  const warningEl = document.getElementById('warning');

  function showWarning(show) {
    if (!warningEl) return;
    warningEl.classList.toggle('show', !!show);
  }

  // ===== Maschera off-screen (per validazione) =====
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

  // ===== Overlay grafico della maschera (solo visibility) =====
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

  // ===== Canvas responsive (rapporto 207:52) =====
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

  // ===== Sfondo layout =====
  function loadLayout(filename) {
    canvas.setBackgroundImage(null, canvas.renderAll.bind(canvas));
    fabric.Image.fromURL(`img/${filename}`, img => {
      img.set({ selectable: false, evented: false });
      img.scaleToWidth(canvas.getWidth());
      img.scaleToHeight(canvas.getHeight());
      canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas));
    });
  }

  // ===== Hit-canvas (render per-pixel dell'oggetto alla risoluzione maschera) =====
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

  // ===== Overlay di debug (pixel occupati) =====
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

  // ===== Parametri validazione =====
  const WHITE_LUMA_THRESHOLD = 200; // bianco=OK (invertire se maschera invertita)
  const SAMPLE_STEP          = 1;
  let isDragging = false;

  // ===== Validazione per-pixel + overlay debug =====
  function isObjectInAllowedZone(obj) {
    if (!maskReady) return true;

    // Mappa coordinate canvas → maschera (nessun retina, niente offset manuali)
    const sx = maskW / canvas.getWidth();
    const sy = maskH / canvas.getHeight();

    // 1) Render solo dell'oggetto su hitCanvas (stessa posa, stessa metrica)
    hitCtx.clearRect(0, 0, maskW, maskH);
    hitCtx.save();
    hitCtx.scale(sx, sy);        // scala uniforme dalla dimensione canvas a quella maschera
    obj.render(hitCtx);          // usa l'oggetto reale (font già pronto)
    hitCtx.restore();

    // 2) Overlay di debug: copia intero hitCanvas e tingilo (nessun ritaglio = niente shift)
    if (isDragging) {
      occCtx.clearRect(0, 0, maskW, maskH);
      occCtx.drawImage(hitCanvas, 0, 0);
      occCtx.globalCompositeOperation = 'source-in';
      occCtx.fillStyle = OCC_FILL_RGBA;
      occCtx.fillRect(0, 0, maskW, maskH);
      occCtx.globalCompositeOperation = 'source-over';
      debugOverlay.set('dirty', true);
      debugOverlay.set('visible', true);
      scaleOverlay(debugOverlay);
    }

    // 3) Confronto per-pixel limitato alla bbox in coordinate MASCHERA
    const rect = obj.getBoundingRect(true, true);
    const rx = Math.max(0, Math.floor(rect.left   * sx));
    const ry = Math.max(0, Math.floor(rect.top    * sy));
    const rw = Math.min(maskW - rx, Math.ceil(rect.width  * sx));
    const rh = Math.min(maskH - ry, Math.ceil(rect.height * sy));
    if (rw <= 0 || rh <= 0) return true;

    const objData  = hitCtx.getImageData(rx, ry, rw, rh).data;
    const maskData = maskCtx.getImageData(rx, ry, rw, rh).data;

    for (let y = 0; y < rh; y += SAMPLE_STEP) {
      let row = y * rw * 4;
      for (let x = 0; x < rw; x += SAMPLE_STEP) {
        const idx = row + x * 4;
        const oa = objData[idx + 3];        // alpha oggetto
        if (oa <= 10) continue;             // ignora pixel trasparenti
        const r = maskData[idx], g = maskData[idx+1], b = maskData[idx+2], a = maskData[idx+3];
        const luma = 0.2126*r + 0.7152*g + 0.0722*b;
        const allowed = (a >= 128) && (luma >= WHITE_LUMA_THRESHOLD);
        if (!allowed) return false;
      }
    }
    return true;
  }

  function updateValidity(obj) {
    // throttling su frame per evitare lavoro eccessivo durante drag
    if (updateValidity._raf) cancelAnimationFrame(updateValidity._raf);
    updateValidity._raf = requestAnimationFrame(() => {
      const ok = isObjectInAllowedZone(obj);
      obj.set({ stroke: ok ? null : 'red', strokeWidth: ok ? 0 : 2 });
      canvas.requestRenderAll();
      showWarning(!ok);
    });
  }

  // ===== Eventi oggetto =====
  canvas.on('object:moving',   e => updateValidity(e.target));
  canvas.on('object:scaling',  e => updateValidity(e.target));
  canvas.on('object:rotating', e => updateValidity(e.target));
  canvas.on('object:added',    e => updateValidity(e.target));

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

  // ===== Hole options =====
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

  // ===== Testo & font =====
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
      fontSize: 40,
      objectCaching: false
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

  // ===== Icone =====
  document.getElementById('iconSelect').addEventListener('change', e => {
    fabric.Image.fromURL(`img/${e.target.value}`, ico => {
      ico.set({ objectCaching: false });
      ico.scaleToWidth(40);
      ico.left = 100; ico.top = 10;
      canvas.add(ico).setActiveObject(ico);
    });
  });

  // ===== Resize =====
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

  // ===== Init =====
  resizeCanvas();
  const initial = document.querySelector('input[name="holeOption"]:checked');
  if (initial) {
    const n = initial.value;
    loadLayout(`${n}.png`);
    loadMask  (`${n}-mask.png`);
    loadMaskOverlay(`${n}-mask.png`);
  }
});
