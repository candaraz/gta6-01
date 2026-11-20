// input.js — keyboard + mouse state for one frame.
// `down` is held, `hit` fires once on the frame the key goes down,
// `released` fires once on the frame it comes up. Hold-to-use stages
// (m8 vault) read `down`; single presses (E, T) read `hit`.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.down = Object.create(null);
    this.hit = Object.create(null);
    this.released = Object.create(null);
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.mouseDown = false;
    this.mouseHit = false;
    this.locked = false;
    this._queue = [];
    this._wire();
  }

  _wire() {
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      // Queue the hit on every fresh (non-repeat) keydown, even if the
      // key still reads as down: a keyup lost while the tab was busy
      // must not eat the next press of that key.
      this._queue.push(['hit', k]);
      this.down[k] = true;
      if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) e.preventDefault();
    });
    addEventListener('keyup', (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      this.down[k] = false;
      this._queue.push(['released', k]);
    });
    addEventListener('blur', () => {
      this.down = Object.create(null);
    });
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.mouseDown = true; this.mouseHit = true; }
    });
    addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseDown = false;
    });
    document.addEventListener('mousemove', (e) => {
      if (this.locked) { this.mouseDX += e.movementX; this.mouseDY += e.movementY; }
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
    });
    this.canvas.addEventListener('click', () => {
      if (!this.locked && !document.pointerLockElement) {
        try { this.canvas.requestPointerLock(); } catch (_) { /* pointer lock is a nicety */ }
      }
    });
  }

  // Call once per frame, after the game has read the state.
  endFrame() {
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.mouseHit = false;
  }

  // Call at the START of the frame, before systems read it: flush the
  // events queued since last frame into this frame's hit/released sets.
  beginFrame() {
    this.hit = Object.create(null);
    this.released = Object.create(null);
    for (const [kind, k] of this._queue) {
      if (kind === 'hit') this.hit[k] = true;
      else this.released[k] = true;
    }
    this._queue.length = 0;
  }

  isDown(...keys) {
    return keys.some((k) => !!this.down[k]);
  }

  wasHit(...keys) {
    return keys.some((k) => !!this.hit[k]);
  }

  // -1..1 movement axis from a pair of keys (WASD or arrows).
  axis(neg, pos) {
    return (this.isDown(pos) ? 1 : 0) - (this.isDown(neg) ? 1 : 0);
  }

  moveAxis() {
    return {
      fwd: this.axis('s', 'w') + this.axis('ArrowDown', 'ArrowUp'),
      strafe: this.axis('a', 'd') + this.axis('ArrowLeft', 'ArrowRight'),
    };
  }
}
