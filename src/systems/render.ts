import { query } from "bitecs";
import { Graphics, Container, Sprite as PixiSprite, Texture } from "pixi.js";
import {
  Position,
  Sprite,
  Player,
  DogAI,
  DogState,
  Ball,
  BallState,
} from "../components.ts";
import { getChargeState } from "./throw.ts";
import type { World } from "../types.ts";

type DogDirection = "front" | "left" | "right" | "back";

interface DogAnimationFrames {
  front: Texture[];
  left: Texture[];
  right: Texture[];
  back: Texture[];
}

interface Offset2D {
  x: number;
  y: number;
}

interface DogBallOffsetConfig {
  front: Offset2D;
  left: Offset2D;
  right: Offset2D;
  back: Offset2D;
}

interface DogRunConfig {
  in: DogAnimationFrames;
  out: DogAnimationFrames;
  fps: number;
}

export interface DogSpriteConfig {
  idle: DogAnimationFrames;
  wag: DogAnimationFrames;
  run: DogRunConfig;
  ballOffset?: DogBallOffsetConfig;
  scale: number;
  idleFps: number;
  wagFps: number;
  idleHoldFrameIndex: number;
  idleHoldMultiplier: number;
  anchorX: number;
  anchorY: number;
}

// Render context - holds Pixi objects
interface RenderContext {
  container: Container;
  playerGraphics: Graphics;
  ballGraphics: Graphics;
  aimIndicator: Graphics;
  dogGraphics?: Graphics;
  dogContainer?: Container;
  dogSprites: Map<number, PixiSprite>;
  dogConfig?: DogSpriteConfig;
}

let ctx: RenderContext | null = null;

export function initRenderSystem(container: Container, options?: { dog?: DogSpriteConfig }): void {
  const playerGraphics = new Graphics();
  const ballGraphics = new Graphics();
  const aimIndicator = new Graphics();
  const dogGraphics = new Graphics();
  const dogContainer = new Container();

  container.addChild(aimIndicator); // Behind everything
  container.addChild(playerGraphics);
  if (options?.dog) {
    container.addChild(dogContainer);
  } else {
    container.addChild(dogGraphics);
  }
  container.addChild(ballGraphics);

  ctx = {
    container,
    playerGraphics,
    ballGraphics,
    aimIndicator,
    dogGraphics,
    dogContainer,
    dogSprites: new Map(),
    dogConfig: options?.dog,
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
    g.fill({ color: 0xffffff, alpha: 0.3 });
  }
}

function getDogDirection(playerX: number, playerY: number, dogX: number, dogY: number): DogDirection {
  const dx = playerX - dogX;
  const dy = playerY - dogY;

  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? "right" : "left";
  }

  return dy > 0 ? "front" : "back";
}

function getHeldFrameIndex(
  now: number,
  fps: number,
  frameCount: number,
  holdIndex: number,
  holdMultiplier: number
): number {
  const safeMultiplier = Math.max(1, holdMultiplier);
  const baseDuration = 1 / fps;
  let totalDuration = baseDuration * frameCount;

  if (holdIndex >= 0 && holdIndex < frameCount && safeMultiplier > 1) {
    totalDuration += baseDuration * (safeMultiplier - 1);
  }

  const localTime = now % totalDuration;
  let accumulated = 0;

  for (let i = 0; i < frameCount; i += 1) {
    const duration = baseDuration * (i === holdIndex ? safeMultiplier : 1);
    accumulated += duration;
    if (localTime < accumulated) {
      return i;
    }
  }

  return frameCount - 1;
}

function renderDog(world: World): void {
  if (!ctx) return;

  const dogs = query(world, [Position, DogAI, Sprite]);

  if (ctx.dogConfig) {
    const config = ctx.dogConfig;
    const dogContainer = ctx.dogContainer!;
    const dogSprites = ctx.dogSprites;
    const active = new Set<number>();
    const now = performance.now() / 1000;

    let playerX = 0;
    let playerY = 0;
    let hasPlayer = false;
    const players = query(world, [Position, Player]);
    for (const eid of players) {
      playerX = Position.x[eid]!;
      playerY = Position.y[eid]!;
      hasPlayer = true;
      break;
    }
    let ballX = 0;
    let ballY = 0;
    let hasBall = false;
    const balls = query(world, [Position, Ball]);
    for (const eid of balls) {
      ballX = Position.x[eid]!;
      ballY = Position.y[eid]!;
      hasBall = true;
      break;
    }

    for (const eid of dogs) {
      active.add(eid);
      let sprite = dogSprites.get(eid);
      if (!sprite) {
        sprite = new PixiSprite(config.idle.front[0] ?? Texture.EMPTY);
        sprite.anchor.set(config.anchorX, config.anchorY);
        sprite.scale.set(config.scale);
        dogContainer.addChild(sprite);
        dogSprites.set(eid, sprite);
      }

      const dogX = Position.x[eid]!;
      const dogY = Position.y[eid]!;
      const excited = DogAI.excited[eid]!;
      const state = DogAI.state[eid]!;
      let direction: DogDirection = "front";
      if (state === DogState.Idle || state === DogState.ReturningToPlayer) {
        if (hasPlayer) {
          direction = getDogDirection(playerX, playerY, dogX, dogY);
        }
      } else if (hasBall) {
        direction = getDogDirection(ballX, ballY, dogX, dogY);
      } else if (hasPlayer) {
        direction = getDogDirection(playerX, playerY, dogX, dogY);
      }
      let frames: Texture[] = [];
      let fps = config.idleFps;
      let frameIndex = 0;

      if (state !== DogState.Idle) {
        const runFrames = state === DogState.ChasingBall ? config.run.out : config.run.in;
        frames = runFrames[direction];
        fps = config.run.fps;
        frameIndex = frames.length > 1 ? Math.floor(now * fps) % frames.length : 0;
      } else {
        frames = excited ? config.wag[direction] : config.idle[direction];
        fps = excited ? config.wagFps : config.idleFps;
        if (frames.length > 1) {
          frameIndex = excited
            ? Math.floor(now * fps) % frames.length
            : getHeldFrameIndex(now, fps, frames.length, config.idleHoldFrameIndex, config.idleHoldMultiplier);
        }
      }

      sprite.texture = frames[frameIndex] ?? sprite.texture;
      sprite.x = dogX;
      sprite.y = dogY;
      sprite.visible = true;
    }

    for (const [eid, sprite] of dogSprites) {
      if (!active.has(eid)) {
        sprite.destroy();
        dogSprites.delete(eid);
      }
    }

    return;
  }

  const g = ctx.dogGraphics;
  if (!g) return;

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

  let playerX = 0;
  let playerY = 0;
  let hasPlayer = false;
  const players = query(world, [Position, Player]);
  for (const eid of players) {
    playerX = Position.x[eid]!;
    playerY = Position.y[eid]!;
    hasPlayer = true;
    break;
  }

  for (const eid of balls) {
    let x = Position.x[eid]!;
    let y = Position.y[eid]!;
    const color = Sprite.color[eid]!;
    const radius = Sprite.radius[eid]!;
    const state = Ball.state[eid]!;
    const holder = Ball.heldBy[eid]!;

    if (state === BallState.HeldByDog && ctx?.dogConfig?.ballOffset && holder) {
      const dogX = Position.x[holder]!;
      const dogY = Position.y[holder]!;
      const direction = hasPlayer ? getDogDirection(playerX, playerY, dogX, dogY) : "front";
      const offset = ctx.dogConfig.ballOffset[direction];
      x = dogX + offset.x;
      y = dogY + offset.y;
    }

    // Ball shadow (when in flight)
    if (state === BallState.InFlight) {
      g.circle(x + 3, y + 3, radius);
      g.fill({ color: 0x000000, alpha: 0.2 });
    }

    // Ball
    g.circle(x, y, radius);
    g.fill(color);

    // Highlight
    g.circle(x - radius * 0.3, y - radius * 0.3, radius * 0.25);
    g.fill({ color: 0xffffff, alpha: 0.4 });
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
  g.fill({ color: 0x333333, alpha: 0.7 });

  // Fill
  g.rect(barX, barY, barWidth * power, barHeight);
  g.fill({ color, alpha: 0.9 });

  // Border
  g.rect(barX, barY, barWidth, barHeight);
  g.stroke({ width: 1, color: 0xffffff, alpha: 0.5 });
}

export function getRenderStats(): { poolSize: number; active: number } {
  return { poolSize: 4, active: 4 }; // Fixed entities for now
}
