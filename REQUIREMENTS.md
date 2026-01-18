# Fetch! Game Specification

Create a simple 2D fetch game called "Fetch!" with the following specifications:

## Core Gameplay
Player controls a character who throws a ball, and a dog AI retrieves it in an endless loop.

## Entities
- **Player**: Character that moves freely
- **Dog**: AI-controlled character that chases and retrieves
- **Ball**: Throwable object that can be picked up
- **Aiming Indicator**: Visual guide showing throw direction and power

## Controls
- **Movement**: Keyboard controls for player movement (directional movement)
- **Aiming**: Mouse cursor determines throw direction
- **Throwing**: Hold mouse button to charge power, release to throw toward cursor

## Mechanics
- **Throw Power**: Scales based on hold time, from minimum to maximum
- **Ball Physics**: Velocity-based movement with friction/decay, stops when sufficiently slow
- **Dog AI States**: Idle → Chasing Ball → Returning to Player → Idle
  - Dog starts chasing when ball is thrown and in motion
  - Dog grabs ball when close enough
  - Dog returns ball to player
  - Ball automatically returns to player's possession upon delivery
- **Dog Animation**: Dog becomes excited (animates) when player is charging a throw

## Visual Feedback
- Throw indicator shows where ball will land
- Throw indicator appearance changes based on power level
- Dog displays excitement animation only during charge phase

## Environment
- 2D top-down or isometric view on a ground/play area
- Window displays the game scene

## Technical Requirements
- Smooth real-time gameplay
- Frame-rate independent movement using delta time
- Collision detection using proximity/distance checks
