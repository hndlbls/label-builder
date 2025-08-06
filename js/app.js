const canvas = new fabric.Canvas('labelCanvas', { selection: false });

const layoutSelect = document.getElementById('layoutSelect');
function loadLayout(src) {
  fabric.Image.fromURL(`img/${src}`, img => {
    img.selectable = false;
    img.scaleToWidth(600);
    canvas.clear();
    canvas.add(img);
    canvas.sendToBack(img);
  });
}
layoutSelect.onchange = e => loadLayout(e.target.value);
loadLayout(layoutSelect.value);

const fontSelect = document.getElementById('fontSelect');
const textInput = document.getElementById('textInput');
const fonts = ["Font1","Font2","Font3","Font4","Font5","Font6","Font7","Font8","Font9","Font10","Font11","Font12","Font13","Font14"];
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
    left: 100, top: 100,
    fill: '#333',
    fontSize: 40
  });
  canvas.add(txt).setActiveObject(txt);
}
fontSelect.onchange = addText;
textInput.onkeyup = () => {
  const obj = canvas.getActiveObject();
  if (obj && obj.type === 'text') {
    obj.set('text', textInput.value).setCoords();
    canvas.renderAll();
  }
};

const iconSelect = document.getElementById('iconSelect');
iconSelect.onchange = e => {
  fabric.Image.fromURL(`img/${e.target.value}`, ico => {
    ico.scaleToWidth(40);
    ico.left = 200; ico.top = 100;
    canvas.add(ico).setActiveObject(ico);
  });
};
