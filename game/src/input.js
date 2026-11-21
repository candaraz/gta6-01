// input.js — Solmar Bay v3: keyboard + mouse state.
// One job: turn browser events into a clean per-frame input snapshot.
//
// The lost-keyup fix: a keydown that arrives while the key still reads as
// down (a keyup the page missed) is queued as a fresh press, so the next
// real press is never eaten.

export function createInput(canvas) {
  const keys = new Set();
  const pressed = [];          // fresh keydown hits, consumed once per frame
  const mouse = { dx: 0, dy: 0, down: false, x: 0, y: 0, clicked: false };
  let dragging = false;

  function onKeyDown(e) {
    if (e.repeat) return;
    // Fresh non-repeat keydown: always queue the hit, even if the key
    // still reads as down (a keyup we missed must not eat the next press).
    pressed.push(e.code);
    keys.add(e.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(e.code)) e.preventDefault();
  }
  function onKeyUp(e) { keys.delete(e.code); }
  function onBlur() { keys.clear(); dragging = false; mouse.down = false; }

  function onMouseDown(e) {
    mouse.down = true; mouse.clicked = true; dragging = true;
    mouse.x = e.clientX; mouse.y = e.clientY;
  }
  function onMouseMove(e) {
    if (!dragging) return;
    mouse.dx += e.movementX || 0;
    mouse.dy += e.movementY || 0;
  }
  function onMouseUp() { mouse.down = false; dragging = false; }
  function onWheel(e) { mouse.wheel = (mouse.wheel || 0) + (e.deltaY > 0 ? 1 : -1); }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('wheel', onWheel, { passive: true });

  return {
    keys, pressed, mouse,
    // True while the key is held.
    down(code) { return keys.has(code); },
    // True once, on the frame the key went down (also for a re-press after
    // a lost keyup). Consumed by the caller reading `pressed`.
    takePressed(code) {
      const i = pressed.indexOf(code);
      if (i < 0) return false;
      pressed.splice(i, 1);
      return true;
    },
    // End-of-frame housekeeping: clear the transient mouse deltas.
    endFrame() {
      mouse.dx = 0; mouse.dy = 0; mouse.clicked = false; mouse.wheel = 0;
      pressed.length = 0;
    },
  };
}
