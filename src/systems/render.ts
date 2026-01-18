import { query } from "bitecs";
import { Graphics, Container } from "pixi.js";
import {
  Position,
  Sprite,
  Player,
  DogAI,
  Ball,
  BallState,
} from "../components.ts";
import { getChargeState } from "./throw.ts";
import type { World } from "../types.ts";

// Render context - holds Pixi objects
interface RenderContext {
  container: Container;
  playerGraphics: Graphics;
  dogGraphics: Graphics;
  ballGraphics: Graphics;
  aimIndicator: Graphics;
}

let ctx: RenderContext | null = null;

export function initRenderSystem(container: Container): void {
  const playerGraphics = new Graphics();
  const dogGraphics = new Graphics();
  const ballGraphics = new Graphics();
  const aimIndicator = new Graphics();

  container.addChild(aimIndicator); // Behind everything
  container.addChild(playerGraphics);
  container.addChild(dogGraphics);
  container.addChild(ballGraphics);

  ctx = {
    container,
    playerGraphics,
    dogGraphics,
    ballGraphics,
    aimIndicator,
  };
}

// Main render system
export function renderSystem(world: World): void {
  if (!ctx) {
    throw new Error("Render system not initialized");
  }

  renderPlayer(world);
  renderDog(world);
  renderBall(world);
  renderAimIndicator(world);
}

function renderPlayer(world: World): void {
  const players = query(world, [Position, Player, Sprite]);
  const g = ctx!.playerGraphics;

  g.clear();

  for (const eid of players) {
    const x = Position.x[eid]!;
    const y = Position.y[eid]!;
    const color = Sprite.color[eid]!;
    const radius = Sprite.radius[eid]!;

    // Draw player as a circle with a direction indicator
    g.circle(x, y, radius);
    g.fill(color);

    // Inner highlight
    g.circle(x - radius * 0.2, y - radius * 0.2, radius * 0.3);
    g.fill(0xffffff, 0.3);
  }
}

function renderDog(world: World): void {
  const dogs = query(world, [Position, DogAI, Sprite]);
  const g = ctx!.dogGraphics;

  g.clear();

  for (const eid of dogs) {
    const x = Position.x[eid]!;
    const y = Position.y[eid]!;
    const color = Sprite.color[eid]!;
    const radius = Sprite.radius[eid]!;
    const excited = DogAI.excited[eid]!;

    // Base dog shape
    g.circle(x, y, radius);
    g.fill(color);

    // Ears
    g.circle(x - radius * 0.7, y - radius * 0.7, radius * 0.4);
    g.fill(color);
    g.circle(x + radius * 0.7, y - radius * 0.7, radius * 0.4);
    g.fill(color);

    // Snout
    g.ellipse(x, y + radius * 0.3, radius * 0.4, radius * 0.3);
    g.fill(0xd4a574);

    // Nose
    g.circle(x, y + radius * 0.4, radius * 0.15);
    g.fill(0x333333);

    // Eyes
    g.circle(x - radius * 0.3, y - radius * 0.1, radius * 0.15);
    g.fill(0x333333);
    g.circle(x + radius * 0.3, y - radius * 0.1, radius * 0.15);
    g.fill(0x333333);

    // Excitement indicator (wagging effect via scale)
    if (excited) {
      const wobble = Math.sin(Date.now() * 0.02) * 3;
      // Draw excitement lines
      g.moveTo(x - radius - 8, y + wobble);
      g.lineTo(x - radius - 15, y + wobble - 5);
      g.stroke({ width: 2, color: 0xffcc00 });
      g.moveTo(x + radius + 8, y - wobble);
      g.lineTo(x + radius + 15, y - wobble - 5);
      g.stroke({ width: 2, color: 0xffcc00 });
    }
  }
}

function renderBall(world: World): void {
  const balls = query(world, [Position, Ball, Sprite]);
  const g = ctx!.ballGraphics;

  g.clear();

  for (const eid of balls) {
    const x = Position.x[eid]!;
    const y = Position.y[eid]!;
    const color = Sprite.color[eid]!;
    const radius = Sprite.radius[eid]!;
    const state = Ball.state[eid]!;

    // Ball shadow (when in flight)
    if (state === BallState.InFlight) {
      g.circle(x + 3, y + 3, radius);
      g.fill(0x000000, 0.2);
    }

    // Ball
    g.circle(x, y, radius);
    g.fill(color);

    // Highlight
    g.circle(x - radius * 0.3, y - radius * 0.3, radius * 0.25);
    g.fill(0xffffff, 0.4);
  }
}

function renderAimIndicator(world: World): void {
  const g = ctx!.aimIndicator;
  g.clear();

  const charge = getChargeState(world);
  if (!charge || !charge.active) return;

  const { power, playerX, playerY, targetX, targetY } = charge;

  // Calculate direction
  const dx = targetX - playerX;
  const dy = targetY - playerY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < 1) return;

  const dirX = dx / dist;
  const dirY = dy / dist;

  // Line length based on power
  const minLength = 50;
  const maxLength = 200;
  const lineLength = minLength + power * (maxLength - minLength);

  const endX = playerX + dirX * lineLength;
  const endY = playerY + dirY * lineLength;

  // Color based on power (green -> yellow -> red)
  let color: number;
  if (power < 0.5) {
    color = 0x44ff44; // Green
  } else if (power < 0.8) {
    color = 0xffff44; // Yellow
  } else {
    color = 0xff4444; // Red
  }

  // Draw dashed line
  const dashLength = 10;
  const gapLength = 5;
  let currentDist = 0;
  let drawing = true;

  g.moveTo(playerX + dirX * 30, playerY + dirY * 30); // Start slightly away from player

  while (currentDist < lineLength - 30) {
    const segmentLength = drawing ? dashLength : gapLength;
    currentDist += segmentLength;

    const x = playerX + dirX * Math.min(currentDist + 30, lineLength);
    const y = playerY + dirY * Math.min(currentDist + 30, lineLength);

    if (drawing) {
      g.lineTo(x, y);
      g.stroke({ width: 3, color, alpha: 0.7 });
    }
    g.moveTo(x, y);

    drawing = !drawing;
  }

  // Draw target circle
  g.circle(endX, endY, 8 + power * 8);
  g.stroke({ width: 2, color, alpha: 0.7 });

  // Power bar
  const barWidth = 40;
  const barHeight = 6;
  const barX = playerX - barWidth / 2;
  const barY = playerY - 40;

  // Background
  g.rect(barX, barY, barWidth, barHeight);
  g.fill(0x333333, 0.7);

  // Fill
  g.rect(barX, barY, barWidth * power, barHeight);
  g.fill(color, 0.9);

  // Border
  g.rect(barX, barY, barWidth, barHeight);
  g.stroke({ width: 1, color: 0xffffff, alpha: 0.5 });
}

export function getRenderStats(): { poolSize: number; active: number } {
  return { poolSize: 4, active: 4 }; // Fixed entities for now
}
