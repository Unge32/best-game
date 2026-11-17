// Emberwarden — main.js
// The game loop and state machine. It wires input to the world, drains the
// world's sound events into the sound engine, and draws every frame with a
// fixed-timestep simulation. ?shot=start|play|end|win&seed=N stages a
// deterministic screenshot scene instead of starting the title screen.

import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  CELL,
  FIELD_X,
  FIELD_Y,
  GRID_COLS,
  GRID_ROWS,
  TOWER_ORDER,
} from './config.js';
import { World } from './world.js';
import { Renderer, getButtons } from './render.js';
import { Input } from './input.js';
import { SoundEngine } from './audio.js';
import { stageShot } from './shots.js';

const BEST_KEY = 'emberwarden.bestScore';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.world = new World();
    this.renderer = new Renderer(canvas);
    this.input = new Input(canvas);
    this.sound = new SoundEngine();
    this.state = 'title'; // title | playing | paused | gameover | victory
    this.time = 0;
    this.bestScore = 0;
    try {
      this.bestScore = Number(window.localStorage.getItem(BEST_KEY)) || 0;
    } catch {
      this.bestScore = 0;
    }
    this.accumulator = 0;
    this.lastNow = 0;
    this.shotMode = false;
    // Debug hooks for the automated play-test (harmless in normal play).
    window.__game = this;
  }

  saveBest() {
    if (this.world.score > this.bestScore) {
      this.bestScore = this.world.score;
      try {
        window.localStorage.setItem(BEST_KEY, String(this.bestScore));
      } catch {
        // Best score is a nicety, never a failure.
      }
    }
  }

  // --- State changes ----------------------------------------------------

  startRun() {
    this.world.reset();
    this.state = 'playing';
    this.sound.unlock();
  }

  endRun(won) {
    this.saveBest();
    this.state = won ? 'victory' : 'gameover';
  }

  togglePause() {
    if (this.state === 'playing') this.state = 'paused';
    else if (this.state === 'paused') this.state = 'playing';
  }

  // --- Input ------------------------------------------------------------

  pointIn(rect, x, y) {
    return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
  }

  handleClick(click) {
    this.sound.unlock();
    const buttons = getButtons(this.state, this.world);
    for (const button of buttons) {
      if (!button.enabled) continue;
      if (this.pointIn(button, click.x, click.y)) {
        this.pressButton(button.id);
        return;
      }
    }
    // A click on the field while playing: build or select a tower.
    if (this.state === 'playing') this.handleFieldClick(click);
  }

  pressButton(id) {
    if (id === 'wave') {
      this.world.startWave();
    } else if (id === 'pause') {
      this.togglePause();
    } else if (id === 'mute') {
      this.sound.setMuted(!this.sound.muted);
    } else if (id.startsWith('shop:')) {
      const kind = id.slice(5);
      this.world.selectedKind = this.world.selectedKind === kind ? null : kind;
      this.world.selectedTower = null;
      this.sound.unlock();
    } else if (id === 'upgrade') {
      if (this.world.selectedTower) this.world.upgradeTower(this.world.selectedTower);
    } else if (id === 'sell') {
      if (this.world.selectedTower) this.world.sellTower(this.world.selectedTower);
    } else if (id === 'title') {
      this.startRun();
    } else if (id === 'resume') {
      this.state = 'playing';
    } else if (id === 'retry') {
      this.startRun();
    }
  }

  handleFieldClick(click) {
    const col = Math.floor((click.x - FIELD_X) / CELL);
    const row = Math.floor((click.y - FIELD_Y) / CELL);
    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) {
      this.world.selectedTower = null;
      return;
    }
    if (this.world.selectedKind) {
      const placed = this.world.placeTower(col, row);
      if (placed) this.world.selectedKind = null;
      return;
    }
    const tower = this.world.grid[row][col];
    this.world.selectedTower = tower || null;
  }

  handleKey(key) {
    this.sound.unlock();
    if (key === 'Enter' || key === ' ') {
      if (this.state === 'title' || this.state === 'gameover' || this.state === 'victory') {
        this.startRun();
        return;
      }
      if (this.state === 'playing' && key === ' ') {
        this.world.startWave();
        return;
      }
    }
    if (key === 'Escape') {
      this.world.selectedKind = null;
      this.world.selectedTower = null;
      return;
    }
    if (key === 'p' || key === 'P') {
      this.togglePause();
      return;
    }
    if (key === 'm' || key === 'M') {
      this.sound.setMuted(!this.sound.muted);
      return;
    }
    if (this.state !== 'playing') return;
    const index = ['1', '2', '3'].indexOf(key);
    if (index >= 0) {
      const kind = TOWER_ORDER[index];
      this.world.selectedKind = this.world.selectedKind === kind ? null : kind;
      this.world.selectedTower = null;
    }
  }

  // --- Sound events -----------------------------------------------------

  drainEvents() {
    for (const event of this.world.events) {
      if (event.startsWith('shoot:')) this.sound.shoot(event.slice(6));
      else if (event === 'hit') this.sound.hit();
      else if (event === 'explode') this.sound.explode();
      else if (event === 'coin') this.sound.coin();
      else if (event === 'place') this.sound.place();
      else if (event === 'upgrade') this.sound.upgrade();
      else if (event === 'denied') this.sound.denied();
      else if (event === 'lanternHit') this.sound.lanternHit();
      else if (event === 'waveHorn') this.sound.waveHorn();
      else if (event === 'victory') this.sound.victory();
      else if (event === 'defeat') this.sound.defeat();
    }
    this.world.events = [];
  }

  // --- Loop -------------------------------------------------------------

  step(now) {
    const dt = Math.min(0.1, (now - this.lastNow) / 1000 || 0);
    this.lastNow = now;
    this.time += dt;

    for (const click of this.input.takeClicks()) this.handleClick(click);
    for (const key of this.input.takeKeys()) this.handleKey(key);

    if (this.state === 'playing') {
      this.accumulator += dt;
      const fixed = 1 / 60;
      let guard = 0;
      while (this.accumulator >= fixed && guard < 8) {
        this.world.update(fixed);
        this.accumulator -= fixed;
        guard += 1;
      }
      this.drainEvents();
      if (this.world.won) this.endRun(true);
      else if (this.world.lost) this.endRun(false);
    } else if (this.state === 'title') {
      // Embers drift behind the title screen.
      if (Math.random() < dt * 6) {
        this.world.particles.push({
          x: 40 + Math.random() * 1200,
          y: 700,
          vx: (Math.random() - 0.5) * 16,
          vy: -30 - Math.random() * 30,
          life: 2.5,
          maxLife: 2.5,
          size: 1.5 + Math.random() * 2.5,
          color: ['#ff8c42', '#ffc857', '#ff7a3c'][Math.floor(Math.random() * 3)],
        });
      }
      for (const p of this.world.particles) {
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
      this.world.particles = this.world.particles.filter((p) => p.life > 0);
    }

    this.renderer.draw(this);
  }

  run() {
    // A single bad frame must never freeze the game: log it and keep going.
    const loop = (now) => {
      try {
        this.step(now);
      } catch (err) {
        console.error(err);
      }
      window.requestAnimationFrame(loop);
    };
    window.requestAnimationFrame((now) => {
      this.lastNow = now;
      loop(now);
    });
  }

  // --- Boot ---------------------------------------------------------------

  static boot() {
    const canvas = document.getElementById('game');
    const game = new Game(canvas);
    const params = new URLSearchParams(window.location.search);
    const shot = params.get('shot');
    if (shot) {
      game.shotMode = true;
      const seed = Number(params.get('seed')) || 1;
      stageShot(game, shot, seed);
      game.renderer.draw(game);
      return game;
    }
    game.run();
    return game;
  }
}

Game.boot();
