import { query } from "bitecs";
import { Position, Velocity, Ball, BallState } from "../components.ts";
import type { World } from "../types.ts";

// Config
const STOP_THRESHOLD = 10; // Velocity below this = stopped

// Ball physics system - handles friction and state transitions
export function ballPhysicsSystem(world: World, dt: number, width: number, height: number): void {
  const balls = query(world, [Position, Velocity, Ball]);

  for (const eid of balls) {
    const state = Ball.state[eid]!;

    // Only apply physics to balls in flight
    if (state !== BallState.InFlight) continue;

    const friction = Ball.friction[eid]!;

    // Apply friction
    Velocity.x[eid] = Velocity.x[eid]! * Math.pow(friction, dt * 60);
    Velocity.y[eid] = Velocity.y[eid]! * Math.pow(friction, dt * 60);

    // Move ball
    Position.x[eid] = Position.x[eid]! + Velocity.x[eid]! * dt;
    Position.y[eid] = Position.y[eid]! + Velocity.y[eid]! * dt;

    // Bounce off walls
    const margin = 15;
    if (Position.x[eid]! < margin) {
      Position.x[eid] = margin;
      Velocity.x[eid] = Math.abs(Velocity.x[eid]!) * 0.7;
    } else if (Position.x[eid]! > width - margin) {
      Position.x[eid] = width - margin;
      Velocity.x[eid] = -Math.abs(Velocity.x[eid]!) * 0.7;
    }

    if (Position.y[eid]! < margin) {
      Position.y[eid] = margin;
      Velocity.y[eid] = Math.abs(Velocity.y[eid]!) * 0.7;
    } else if (Position.y[eid]! > height - margin) {
      Position.y[eid] = height - margin;
      Velocity.y[eid] = -Math.abs(Velocity.y[eid]!) * 0.7;
    }

    // Check if ball has stopped
    const speed = Math.sqrt(Velocity.x[eid]! ** 2 + Velocity.y[eid]! ** 2);
    if (speed < STOP_THRESHOLD) {
      Velocity.x[eid] = 0;
      Velocity.y[eid] = 0;
      Ball.state[eid] = BallState.OnGround;
    }
  }
}
