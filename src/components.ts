import { soa } from "bitecs";

// Max entities - sized for future scaling
export const MAX_ENTITIES = 100_000;

// Position in world space
export const Position = soa({
  x: new Float32Array(MAX_ENTITIES),
  y: new Float32Array(MAX_ENTITIES),
});

// Velocity for movement
export const Velocity = soa({
  x: new Float32Array(MAX_ENTITIES),
  y: new Float32Array(MAX_ENTITIES),
});

// Sprite component - declares rendering intent
export const Sprite = soa({
  color: new Uint32Array(MAX_ENTITIES),
  radius: new Float32Array(MAX_ENTITIES),
});

// Player tag - marks entity as player-controlled
export const Player = soa({
  speed: new Float32Array(MAX_ENTITIES),
});

// Dog AI component
export const DogAI = soa({
  // 0 = Idle, 1 = Chasing Ball, 2 = Returning to Player
  state: new Uint8Array(MAX_ENTITIES),
  speed: new Float32Array(MAX_ENTITIES),
  // Is the dog excited (player charging throw)?
  excited: new Uint8Array(MAX_ENTITIES),
});

export const DogState = {
  Idle: 0,
  ChasingBall: 1,
  ReturningToPlayer: 2,
} as const;

// Ball component
export const Ball = soa({
  // 0 = Held by player, 1 = In flight, 2 = On ground, 3 = Held by dog
  state: new Uint8Array(MAX_ENTITIES),
  // Friction applied per frame
  friction: new Float32Array(MAX_ENTITIES),
  // Owner entity ID (player or dog holding it)
  heldBy: new Uint32Array(MAX_ENTITIES),
});

export const BallState = {
  HeldByPlayer: 0,
  InFlight: 1,
  OnGround: 2,
  HeldByDog: 3,
} as const;

// Throw charge component - added to player when charging
export const ThrowCharge = soa({
  // Current charge level (0 to 1)
  power: new Float32Array(MAX_ENTITIES),
  // Target position (mouse cursor)
  targetX: new Float32Array(MAX_ENTITIES),
  targetY: new Float32Array(MAX_ENTITIES),
  // Is currently charging?
  active: new Uint8Array(MAX_ENTITIES),
});

// Aim indicator component - for the visual throw guide
export const AimIndicator = soa({
  // Source entity (player)
  sourceEntity: new Uint32Array(MAX_ENTITIES),
  visible: new Uint8Array(MAX_ENTITIES),
});
