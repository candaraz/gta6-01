// Keyboard and mouse, read once a frame. Keys are held state; actions are
// one-frame presses the game consumes. The camera orbits while the mouse is
// dragged, and the arrow keys turn it for players without a mouse handy.

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  let mouseDown = false;
  let lastX = 0;
  let lastY = 0;
  let dragX = 0;
  let dragY = 0;
  let clicked = false;

  function keyName(event) {
    const key = event.key;
    if (key === ' ') return 'Space';
    if (key.length === 1) return key.toUpperCase();
    return key;
  }

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    const name = keyName(event);
    held.add(name);
    pressed.add(name);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(name)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    held.delete(keyName(event));
  });
  window.addEventListener('blur', () => {
    held.clear();
  });

  canvas.addEventListener('mousedown', (event) => {
    mouseDown = true;
    lastX = event.clientX;
    lastY = event.clientY;
    clicked = true;
  });
  window.addEventListener('mouseup', () => {
    mouseDown = false;
  });
  window.addEventListener('mousemove', (event) => {
    if (!mouseDown) return;
    dragX += event.clientX - lastX;
    dragY += event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
  });
  // Touch: one finger drags the camera, two quick taps act like a click.
  canvas.addEventListener('touchstart', (event) => {
    const touch = event.touches[0];
    lastX = touch.clientX;
    lastY = touch.clientY;
    mouseDown = true;
  }, { passive: true });
  canvas.addEventListener('touchmove', (event) => {
    const touch = event.touches[0];
    dragX += touch.clientX - lastX;
    dragY += touch.clientY - lastY;
    lastX = touch.clientX;
    lastY = touch.clientY;
  }, { passive: true });
  canvas.addEventListener('touchend', () => {
    mouseDown = false;
  }, { passive: true });

  return {
    // Held movement, camera-relative, as -1..1 on each axis.
    moveAxes() {
      let x = 0;
      let z = 0;
      if (held.has('A') || held.has('ArrowLeft')) x -= 1;
      if (held.has('D') || held.has('ArrowRight')) x += 1;
      if (held.has('W') || held.has('ArrowUp')) z -= 1;
      if (held.has('S') || held.has('ArrowDown')) z += 1;
      return { x, z };
    },
    sprint() {
      return held.has('Shift');
    },
    handbrake() {
      return held.has('Space');
    },
    cameraDrag() {
      const out = { x: dragX, y: dragY };
      dragX = 0;
      dragY = 0;
      return out;
    },
    wasPressed(name) {
      return pressed.has(name);
    },
    wasClicked() {
      return clicked;
    },
    mouseHeld() {
      return mouseDown;
    },
    endFrame() {
      pressed.clear();
      clicked = false;
    },
    // Scripted input for the staged screenshot scenes and self-tests.
    inject(keys, click) {
      for (const key of keys) held.add(key);
      if (click) clicked = true;
    },
    releaseAll() {
      held.clear();
    },
  };
}
