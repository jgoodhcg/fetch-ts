import { query } from "bitecs";
import {
  Position,
  Velocity,
  Player,
  Ball,
  BallState,
  ThrowCharge,
  DogAI,
} from "../components.ts";
import { getInput } from "./input.ts";
import type { World } from "../types.ts";

// Config
const MIN_THROW_POWER = 200;
const MAX_THROW_POWER = 800;
const CHARGE_RATE = 1.5; // Full charge in ~0.67 seconds

// Throw system - handles charging and releasing the ball
export function throwSystem(world: World, dt: number): void {
  const input = getInput();
  const players = query(world, [Position, Player, ThrowCharge]);
  const balls = query(world, [Position, Velocity, Ball]);
  const dogs = query(world, [DogAI]);

  for (const playerEid of players) {
    const playerX = Position.x[playerEid]!;
    const playerY = Position.y[playerEid]!;

    // Update target position to mouse
    ThrowCharge.targetX[playerEid] = input.mouseX;
    ThrowCharge.targetY[playerEid] = input.mouseY;

    // Find the ball
    let ballEid: number | null = null;
    for (const eid of balls) {
      ballEid = eid;
      break;
    }

    if (ballEid === null) continue;

    const ballState = Ball.state[ballEid]!;

    // Start charging when mouse pressed and ball is held by player
    if (input.mousePressed && ballState === BallState.HeldByPlayer) {
      ThrowCharge.active[playerEid] = 1;
      ThrowCharge.power[playerEid] = 0;

      // Make dog excited
      for (const dogEid of dogs) {
        DogAI.excited[dogEid] = 1;
      }
    }

    // Continue charging while mouse held
    if (ThrowCharge.active[playerEid] && input.mouseDown) {
      ThrowCharge.power[playerEid] = Math.min(1, ThrowCharge.power[playerEid]! + CHARGE_RATE * dt);
    }

    // Release throw when mouse released
    if (input.mouseReleased && ThrowCharge.active[playerEid]) {
      const power = ThrowCharge.power[playerEid]!;
      const targetX = ThrowCharge.targetX[playerEid]!;
      const targetY = ThrowCharge.targetY[playerEid]!;

      // Calculate throw direction
      const dx = targetX - playerX;
      const dy = targetY - playerY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 0) {
        const throwPower = MIN_THROW_POWER + power * (MAX_THROW_POWER - MIN_THROW_POWER);
        const dirX = dx / dist;
        const dirY = dy / dist;

        // Set ball velocity
        Velocity.x[ballEid] = dirX * throwPower;
        Velocity.y[ballEid] = dirY * throwPower;

        // Change ball state to in flight
        Ball.state[ballEid] = BallState.InFlight;
        Ball.heldBy[ballEid] = 0;
      }

      // Reset charge
      ThrowCharge.active[playerEid] = 0;
      ThrowCharge.power[playerEid] = 0;

      // Dog no longer excited (now chasing)
      for (const dogEid of dogs) {
        DogAI.excited[dogEid] = 0;
      }
    }

    // Position ball at player when held
    if (ballState === BallState.HeldByPlayer) {
      Position.x[ballEid] = playerX + 25; // Offset slightly
      Position.y[ballEid] = playerY;
    }
  }
}

// Get current charge state for rendering
export function getChargeState(world: World): { active: boolean; power: number; targetX: number; targetY: number; playerX: number; playerY: number } | null {
  const players = query(world, [Position, Player, ThrowCharge]);

  for (const eid of players) {
    if (ThrowCharge.active[eid]) {
      return {
        active: true,
        power: ThrowCharge.power[eid]!,
        targetX: ThrowCharge.targetX[eid]!,
        targetY: ThrowCharge.targetY[eid]!,
        playerX: Position.x[eid]!,
        playerY: Position.y[eid]!,
      };
    }
  }

  return null;
}
