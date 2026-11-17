// Emberwarden — shots.js
// Deterministic screenshot staging: ?shot=start|play|end|win&seed=N builds
// a fixed scene from a seeded generator, steps the simulation with a fixed
// timestep (no wall clock), renders it twice and sets window.__shotReady.
// The screenshots the entry hands in are real renders of the game's code.

import { makeRandom } from './random.js';
import { TOTAL_WAVES } from './config.js';

// A fixed mid-game layout for the play shot: towers the seeded generator
// picks, spread over the open ground.
function stagePlayLayout(world, rng) {
  const plots = [
    [3, 0], [3, 3], [4, 6], [6, 2], [7, 6], [8, 1], [9, 6], [11, 3], [12, 5], [13, 2],
  ];
  const kinds = ['spark', 'frost', 'ember'];
  let placed = 0;
  for (const [col, row] of plots) {
    if (placed >= 7) break;
    if (!world.canBuildAt(col, row)) continue;
    world.selectedKind = kinds[placed % kinds.length];
    world.gold = 10000;
    if (world.placeTower(col, row)) {
      placed += 1;
      const tower = world.grid[row][col];
      if (tower && placed % 3 === 0 && rng.next() < 0.7) {
        world.gold = 10000;
        world.upgradeTower(tower);
      }
    }
  }
  world.selectedKind = null;
  world.selectedTower = null;
  world.gold = 260;
}

// Step the world for `seconds` of game time at a fixed 1/60 s step.
function fastForward(world, seconds) {
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps; i++) world.update(1 / 60);
}

export function stageShot(game, scene, seed) {
  const rng = makeRandom(seed);
  const world = game.world;
  const renderer = game.renderer;

  if (scene === 'start') {
    game.state = 'title';
    game.time = 2.0;
    // A few drifting embers behind the title, from the seeded generator.
    for (let i = 0; i < 26; i++) {
      world.particles.push({
        x: rng.range(40, 1240),
        y: rng.range(80, 660),
        vx: rng.range(-8, 8),
        vy: rng.range(-26, -8),
        life: 2,
        maxLife: 2,
        size: rng.range(1.5, 4),
        color: rng.pick(['#ff8c42', '#ffc857', '#ff7a3c']),
      });
    }
  } else if (scene === 'play') {
    game.state = 'playing';
    game.time = 0;
    // Wave 4 for a full field: towers up, a mixed horde mid-road.
    stagePlayLayout(world, rng);
    world.wave = 3;
    world.startWave(); // starts wave 4
    fastForward(world, 9.5);
    // Keep the banner off the play shot so the action reads cleanly.
    world.banner = null;
  } else if (scene === 'end') {
    game.state = 'gameover';
    game.time = 0;
    stagePlayLayout(world, rng);
    world.popups = [];
    world.wave = 7;
    world.kills = 148;
    world.score = 3240;
    world.goldEarned = 512;
    world.towersBuilt = 9;
    world.lanternHp = 0;
    world.lost = true;
    // A last cinder at the lantern and a burst of embers for the scene.
    world.spawnQueue = [];
    world.spawnEnemy('brute');
    const last = world.enemies[0];
    last.dist = world.pathLength - 40;
    const pos = world.positionOnPath(last.dist);
    last.x = pos.x;
    last.y = pos.y;
    world.burst(pos.x, pos.y, '#ff6b5e', 24, 160);
    world.shake = 0;
  } else if (scene === 'win') {
    game.state = 'victory';
    game.time = 0;
    stagePlayLayout(world, rng);
    world.popups = [];
    world.wave = TOTAL_WAVES;
    world.kills = 312;
    world.score = 9840;
    world.goldEarned = 1240;
    world.towersBuilt = 14;
    world.lanternHp = 6;
    world.won = true;
    world.gold = 540;
    // Celebration particles over the field.
    for (let i = 0; i < 40; i++) {
      world.particles.push({
        x: rng.range(40, 1000),
        y: rng.range(100, 600),
        vx: rng.range(-20, 20),
        vy: rng.range(-40, -10),
        life: 2,
        maxLife: 2,
        size: rng.range(2, 4.5),
        color: rng.pick(['#ffc857', '#7dff9a', '#7de3ff', '#ff8c42']),
      });
    }
  } else {
    game.state = 'title';
    game.time = 0;
  }

  // Render twice so canvas state settles, then signal the screenshot.
  renderer.draw(game);
  renderer.draw(game);
  window.__shotReady = true;
}
