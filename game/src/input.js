// Solmar Bay — keyboard and mouse input.
// One job: turn DOM events into a clean per-frame input state the game reads.
// Keys are tracked by code (layout independent). Mouse drag orbits the camera;
// the game never needs pointer lock, so it works the same in a real browser and
// in headless play-tests.

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set(); // keys pressed since last frame (edge-triggered)
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.dragging = false; // right-drag orbits the camera
    this.leftDown = false; // left button held = shoot
    this.wheel = 0;
    this.anyKey = false;
    this._canvas = canvas;
    this._onKeyDown = (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
      this.anyKey = true;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
    };
    this._onKeyUp = (e) => { this.keys.delete(e.code); };
    this._onMouseDown = (e) => {
      if (e.button === 2) { this.dragging = true; this._lastX = e.clientX; this._lastY = e.clientY; }
      if (e.button === 0) this.leftDown = true;
    };
    this._onMouseUp = (e) => {
      if (e.button === 2) this.dragging = false;
      if (e.button === 0) this.leftDown = false;
    };
    this._onMouseMove = (e) => {
      if (!this.dragging) return;
      this.mouseDX += e.clientX - this._lastX;
      this.mouseDY += e.clientY - this._lastY;
      this._lastX = e.clientX; this._lastY = e.clientY;
    };
    this._onWheel = (e) => { this.wheel += e.deltaY; e.preventDefault(); };
    this._onBlur = () => { this.keys.clear(); this.dragging = false; this.leftDown = false; };
    this._onContext = (e) => e.preventDefault();
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    canvas.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('mousemove', this._onMouseMove);
    canvas.addEventListener('wheel', this._onWheel, { passive: false });
    canvas.addEventListener('contextmenu', this._onContext);
    window.addEventListener('blur', this._onBlur);
  }

  down(code) { return this.keys.has(code); }
  // true only on the frame the key went down
  hit(code) { return this.pressed.has(code); }
  axis(neg, pos) { return (this.keys.has(pos) ? 1 : 0) - (this.keys.has(neg) ? 1 : 0); }

  // call at the end of each frame
  endFrame() {
    this.pressed.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
    this.anyKey = false;
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    this._canvas.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);
    window.removeEventListener('mousemove', this._onMouseMove);
    this._canvas.removeEventListener('wheel', this._onWheel);
    this._canvas.removeEventListener('contextmenu', this._onContext);
    window.removeEventListener('blur', this._onBlur);
  }
}

// Default key bindings (shown on the start screen and in settings).
export const BINDINGS = [
  ['W A S D', 'Move / drive'],
  ['Shift', 'Sprint / nitro'],
  ['Space', 'Jump / handbrake'],
  ['E', 'Enter / exit vehicle, steal car'],
  ['F', 'Interact / pick up / talk'],
  ['T', 'Street race (in a car) / taxi fare (on foot)'],
  ['Q', 'Weapon wheel (hold)'],
  ['1 – 4', 'Select weapon'],
  ['R', 'Change radio station'],
  ['C', 'Change camera'],
  ['M', 'Mute audio'],
  ['Esc / P', 'Pause'],
  ['Mouse (hold)', 'Shoot'],
  ['Right-drag', 'Orbit camera'],
  ['Mouse wheel', 'Zoom camera'],
];
