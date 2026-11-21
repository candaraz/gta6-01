// Keyboard + mouse input, with a queue for fresh key presses.
export function createInput() {
  const I = {
    keys: {}, pressed: {}, // pressed: fresh non-repeat keydowns this frame
    mouseDX: 0, mouseDY: 0, mouseDown: false, mouseClicked: false,
    dragging: false, lastX: 0, lastY: 0,
  };
  const KEYMAP = {
    KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
    KeyE: 'enter', KeyF: 'punch', KeyQ: 'cycle', KeyR: 'reload',
    KeyT: 'activity', Space: 'handbrake', ShiftLeft: 'sprint', ShiftRight: 'sprint',
    KeyH: 'horn', KeyP: 'pause', Escape: 'pause',
    Digit1: 'w1', Digit2: 'w2', Digit3: 'w3', Digit4: 'w4', Digit5: 'w5',
  };
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    I.keys[e.code] = true;
    const m = KEYMAP[e.code];
    if (m) I.pressed[m] = true;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { I.keys[e.code] = false; });
  window.addEventListener('mousedown', (e) => {
    I.mouseDown = true; I.mouseClicked = true; I.dragging = true; I.lastX = e.clientX; I.lastY = e.clientY;
  });
  window.addEventListener('mouseup', () => { I.mouseDown = false; I.dragging = false; });
  window.addEventListener('mousemove', (e) => {
    if (!I.dragging) return;
    I.mouseDX += e.clientX - I.lastX; I.mouseDY += e.clientY - I.lastY;
    I.lastX = e.clientX; I.lastY = e.clientY;
  });
  window.addEventListener('blur', () => { I.keys = {}; I.dragging = false; I.mouseDown = false; });
  I.isDown = (name) => {
    for (const code in I.keys) if (I.keys[code] && KEYMAP[code] === name) return true;
    return false;
  };
  I.consume = (name) => { const v = !!I.pressed[name]; if (v) I.pressed[name] = false; return v; };
  I.endFrame = () => {
    I.pressed = {}; I.mouseDX = 0; I.mouseDY = 0; I.mouseClicked = false;
  };
  return I;
}
