import { query } from "bitecs";
import {
  Position,
  DogAI,
  DogState,
  Ball,
  BallState,
  Player,
} from "../components.ts";
import type { World } from "../types.ts";

// Config
const PICKUP_DISTANCE = 30;
const DELIVERY_DISTANCE = 40;

// Helper to move entity toward target
function moveToward(
  eid: number,
  targetX: number,
  targetY: number,
  speed: number,
  dt: number
): void {
  const x = Position.x[eid]!;
  const y = Position.y[eid]!;

  const dx = targetX - x;
  const dy = targetY - y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist > 1) {
    const moveX = (dx / dist) * speed * dt;
    const moveY = (dy / dist) * speed * dt;

    // Don't overshoot
    if (Math.abs(moveX) > Math.abs(dx)) {
      Position.x[eid] = targetX;
    } else {
      Position.x[eid] = x + moveX;
    }

    if (Math.abs(moveY) > Math.abs(dy)) {
      Position.y[eid] = targetY;
    } else {
      Position.y[eid] = y + moveY;
    }
  }
}

// Dog AI system - state machine for chasing and returning ball
export function dogAISystem(world: World, dt: number): void {
  const dogs = query(world, [Position, DogAI]);
  const balls = query(world, [Position, Ball]);
  const players = query(world, [Position, Player]);

  // Find player and ball
  let playerEid: number | null = null;
  let ballEid: number | null = null;

  for (const eid of players) {
    playerEid = eid;
    break;
  }

  for (const eid of balls) {
    ballEid = eid;
    break;
  }

  if (playerEid === null || ballEid === null) return;

  const playerX = Position.x[playerEid]!;
  const playerY = Position.y[playerEid]!;
  const ballX = Position.x[ballEid]!;
  const ballY = Position.y[ballEid]!;
  const ballState = Ball.state[ballEid]!;

  for (const dogEid of dogs) {
    const state = DogAI.state[dogEid]!;
    const speed = DogAI.speed[dogEid]!;
    const dogX = Position.x[dogEid]!;
    const dogY = Position.y[dogEid]!;

    switch (state) {
      case DogState.Idle: {
        // Start chasing if ball is thrown or on ground
        if (ballState === BallState.InFlight || ballState === BallState.OnGround) {
          DogAI.state[dogEid] = DogState.ChasingBall;
        }
        break;
      }

      case DogState.ChasingBall: {
        // Move toward ball
        moveToward(dogEid, ballX, ballY, speed, dt);

        // Check if close enough to pick up
        const distToBall = Math.sqrt((dogX - ballX) ** 2 + (dogY - ballY) ** 2);

        if (distToBall < PICKUP_DISTANCE && (ballState === BallState.InFlight || ballState === BallState.OnGround)) {
          // Pick up ball
          Ball.state[ballEid] = BallState.HeldByDog;
          Ball.heldBy[ballEid] = dogEid;
          DogAI.state[dogEid] = DogState.ReturningToPlayer;
        }

        // If ball is back with player somehow, go idle
        if (ballState === BallState.HeldByPlayer) {
          DogAI.state[dogEid] = DogState.Idle;
        }
        break;
      }

      case DogState.ReturningToPlayer: {
        // Move toward player
        moveToward(dogEid, playerX, playerY, speed, dt);

        // Ball follows dog
        if (ballState === BallState.HeldByDog) {
          Position.x[ballEid] = Position.x[dogEid]! + 15;
          Position.y[ballEid] = Position.y[dogEid]!;
        }

        // Check if close enough to deliver
        const distToPlayer = Math.sqrt((dogX - playerX) ** 2 + (dogY - playerY) ** 2);

        if (distToPlayer < DELIVERY_DISTANCE) {
          // Deliver ball to player
          Ball.state[ballEid] = BallState.HeldByPlayer;
          Ball.heldBy[ballEid] = playerEid;
          DogAI.state[dogEid] = DogState.Idle;
        }
        break;
      }
    }
  }
}
