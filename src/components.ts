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
// The render system reads this to know how to draw the entity
export const Sprite = soa({
  color: new Uint32Array(MAX_ENTITIES),  // hex color
  radius: new Float32Array(MAX_ENTITIES),
});
