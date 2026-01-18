import { query } from "bitecs";
import { Position, Velocity, Player } from "../components.ts";
import { isMovingUp, isMovingDown, isMovingLeft, isMovingRight } from "./input.ts";
import type { World } from "../types.ts";

// Player movement system - reads input and moves player
export function playerMovementSystem(world: World, dt: number): void {
  const entities = query(world, [Position, Player]);

  for (const eid of entities) {
    const speed = Player.speed[eid]!;

    let dx = 0;
    let dy = 0;

    if (isMovingUp()) dy -= 1;
    if (isMovingDown()) dy += 1;
    if (isMovingLeft()) dx -= 1;
    if (isMovingRight()) dx += 1;

    // Normalize diagonal movement
    if (dx !== 0 && dy !== 0) {
      const len = Math.sqrt(dx * dx + dy * dy);
      dx /= len;
      dy /= len;
    }

    Position.x[eid] = Position.x[eid]! + dx * speed * dt;
    Position.y[eid] = Position.y[eid]! + dy * speed * dt;
  }
}

// Generic velocity movement system
export function velocitySystem(world: World, dt: number): void {
  const entities = query(world, [Position, Velocity]);

  for (const eid of entities) {
    Position.x[eid] = Position.x[eid]! + Velocity.x[eid]! * dt;
    Position.y[eid] = Position.y[eid]! + Velocity.y[eid]! * dt;
  }
}

// Clamp entities to bounds
export function boundsSystem(world: World, width: number, height: number, margin: number = 20): void {
  const entities = query(world, [Position]);

  for (const eid of entities) {
    Position.x[eid] = Math.max(margin, Math.min(width - margin, Position.x[eid]!));
    Position.y[eid] = Math.max(margin, Math.min(height - margin, Position.y[eid]!));
  }
}
