// js/app.js

window.addEventListener('load', () => {
  // 1) Inizializza Fabric.js canvas
  const canvas = new fabric.Canvas('labelCanvas', { selection: false });
  const container = document.querySelector('.canvas-container');

  // 2) Funzione per ridimensionare il canvas in base alla larghezza del container e rapporto 207:52
  function resizeCanvas() {
    const w = container.clientWidth;
    const h = w * 52 / 207;  // rapporto 207:52
    canvas.setWidth(w);
    canvas.setHeight(h);
  }

  // 3) Funzione per caricare il layout di base come sfondo Fabric.js
  function loadLayout(filename) {
    canvas.setBackgroundImage(null, canvas.renderAll.bind(canvas));
    fabric.Image.fromURL(`img/${filename}`, img => {
      img.set({ selectable: false, evented: false });
      img.scaleToWidth(canvas.getWidth());
      img.scaleToHeight(canvas.getHeight());
      canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas));
    });
  }

  // 4) Hole Options: radio buttons per cambiare layout
  document.querySelectorAll('input[name="holeOption"]').forEach(radio => {
    radio.addEventListener('change', () => {
      if (radio.checked) {
        loadLayout(`${radio.value}.png`);
      }
    });
  });

  // 5) Font & Text: popola select e gestisci drag & drop testo
  const fontSelect = document.getElementById('fontSelect');
  const textInput  = document.getElementById('textInput');
  const fonts      = [
    "Font1","Font2","Font3","Font4","Font5",
    "Font6","Font7","Font8","Font9","Font10",
    "Font11","Font12","Font13","Font14"
  ];
  fonts.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f;
    opt.textContent = f;
    fontSelect.appendChild(opt);
  });

  function addText() {
    const txtVal = textInput.value || "Text";
    const txt = new fabric.Text(txtVal, {
      fontFamily: fontSelect.value,
      left: 20,
      top: 10,
      fill: '#333',
      fontSize: 40
    });
    canvas.add(txt).setActiveObject(txt);
  }

  fontSelect.addEventListener('change', addText);
  textInput.addEventListener('input', () => {
    const obj = canvas.getActiveObject();
    if (obj && obj.type === 'text') {
      obj.set('text', textInput.value).setCoords();
      canvas.renderAll();
    }
  });

  // 6) Icone draggable
  const iconSelect = document.getElementById('iconSelect');
  iconSelect.addEventListener('change', e => {
    fabric.Image.fromURL(`img/${e.target.value}`, ico => {
      ico.scaleToWidth(40);
      ico.left = 100;
      ico.top = 10;
      canvas.add(ico).setActiveObject(ico);
    });
  });

  // 7) Inizializza canvas: ridimensiona e carica layout di default
  resizeCanvas();
  const initial = document.querySelector('input[name="holeOption"]:checked');
  if (initial) {
    loadLayout(`${initial.value}.png`);
  }

  // 8) Usa ResizeObserver per ridimensionare dinamicamente su mobile/desktop
  const ro = new ResizeObserver(() => {
    resizeCanvas();
    const curr = document.querySelector('input[name="holeOption"]:checked');
    if (curr) {
      loadLayout(`${curr.value}.png`);
    }
  });
  ro.observe(container);
});
