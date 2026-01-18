import { query } from "bitecs";
import { Position, Velocity } from "../components.ts";
import type { World } from "../types.ts";

// Pure simulation system - no rendering concerns
export function movementSystem(world: World): void {
  const entities = query(world, [Position, Velocity]);

  for (const eid of entities) {
    Position.x[eid] = Position.x[eid]! + Velocity.x[eid]!;
    Position.y[eid] = Position.y[eid]! + Velocity.y[eid]!;
  }
}

// Boundary system - keeps entities within bounds
export function boundsSystem(world: World, width: number, height: number): void {
  const entities = query(world, [Position, Velocity, Sprite]);

  for (const eid of entities) {
    const radius = Sprite.radius[eid]!;

    if (Position.x[eid]! <= radius || Position.x[eid]! >= width - radius) {
      Velocity.x[eid] = Velocity.x[eid]! * -1;
      Position.x[eid] = Math.max(radius, Math.min(width - radius, Position.x[eid]!));
    }

    if (Position.y[eid]! <= radius || Position.y[eid]! >= height - radius) {
      Velocity.y[eid] = Velocity.y[eid]! * -1;
      Position.y[eid] = Math.max(radius, Math.min(height - radius, Position.y[eid]!));
    }
  }
}

// Import Sprite for bounds checking
import { Sprite } from "../components.ts";
