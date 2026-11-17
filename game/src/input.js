// Emberwarden — input.js
// Mouse and keyboard input, translated into canvas coordinates and into
// the small set of events the game loop consumes (clicks, keys).

import { CANVAS_WIDTH, CANVAS_HEIGHT } from './config.js';

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseInside = false;
    // Clicks queued since the last frame; the game loop drains them.
    this.clicks = [];
    // Keys pressed since the last frame, as e.key values.
    this.keys = [];
    this.heldKeys = new Set();

    canvas.addEventListener('mousemove', (event) => {
      const pos = this.toCanvas(event);
      this.mouseX = pos.x;
      this.mouseY = pos.y;
      this.mouseInside = true;
    });
    canvas.addEventListener('mouseleave', () => {
      this.mouseInside = false;
    });
    canvas.addEventListener('mousedown', (event) => {
      const pos = this.toCanvas(event);
      this.clicks.push({ x: pos.x, y: pos.y, button: event.button });
    });
    window.addEventListener('keydown', (event) => {
      if (event.repeat) return;
      this.keys.push(event.key);
      this.heldKeys.add(event.key);
      if ([' ', 'ArrowUp', 'ArrowDown'].includes(event.key)) event.preventDefault();
    });
    window.addEventListener('keyup', (event) => {
      this.heldKeys.delete(event.key);
    });
  }

  // Map a pointer event to the canvas's internal 1280x720 coordinates,
  // whatever the canvas's CSS size is.
  toCanvas(event) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * CANVAS_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * CANVAS_HEIGHT,
    };
  }

  takeClicks() {
    const clicks = this.clicks;
    this.clicks = [];
    return clicks;
  }

  takeKeys() {
    const keys = this.keys;
    this.keys = [];
    return keys;
  }
}
