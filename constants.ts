
import { FruitType, FruitDefinition, GameConfig } from './types';

export const FRUIT_DATA: Record<FruitType, FruitDefinition> = {
  [FruitType.CHERRY]: { type: FruitType.CHERRY, radius: 0.2, color: 0xff0000, score: 1, nextType: FruitType.STRAWBERRY },
  [FruitType.STRAWBERRY]: { type: FruitType.STRAWBERRY, radius: 0.25, color: 0xff4580, score: 3, nextType: FruitType.GRAPE },
  [FruitType.GRAPE]: { type: FruitType.GRAPE, radius: 0.35, color: 0x800080, score: 6, nextType: FruitType.DEKOPON },
  [FruitType.DEKOPON]: { type: FruitType.DEKOPON, radius: 0.45, color: 0xffa500, score: 10, nextType: FruitType.PERSIMMON },
  [FruitType.PERSIMMON]: { type: FruitType.PERSIMMON, radius: 0.55, color: 0xff8c69, score: 15, nextType: FruitType.APPLE },
  [FruitType.APPLE]: { type: FruitType.APPLE, radius: 0.65, color: 0x00ff00, score: 21, nextType: FruitType.PEAR },
  [FruitType.PEAR]: { type: FruitType.PEAR, radius: 0.75, color: 0xadff2f, score: 28, nextType: FruitType.PEACH },
  [FruitType.PEACH]: { type: FruitType.PEACH, radius: 0.85, color: 0xffdab9, score: 36, nextType: FruitType.PINEAPPLE },
  [FruitType.PINEAPPLE]: { type: FruitType.PINEAPPLE, radius: 0.95, color: 0xffff00, score: 45, nextType: FruitType.MELON },
  [FruitType.MELON]: { type: FruitType.MELON, radius: 1.1, color: 0x90ee90, score: 55, nextType: FruitType.WATERMELON },
  [FruitType.WATERMELON]: { type: FruitType.WATERMELON, radius: 1.3, color: 0x228b22, score: 66, nextType: undefined }, // Largest fruit
  [FruitType.RAINBOW]: { type: FruitType.RAINBOW, radius: 0.3, color: 0xffa500, score: 3, nextType: undefined }, // 특수: 주황색 큐브 - 아무 과일과 합쳐져 업그레이드
  [FruitType.BOMB]: { type: FruitType.BOMB, radius: 0.3, color: 0x1A1A1A, score: 0, nextType: undefined },       // 특수: 검은색 큐브 - 폭발
};

export const INITIAL_FRUIT_TYPES: FruitType[] = [ // Regular fruits for normal spawning
  FruitType.CHERRY,
  FruitType.STRAWBERRY,
  FruitType.GRAPE,
  FruitType.DEKOPON,
];

export const GAME_CONFIG: GameConfig = {
  gravity: -9.82,
  fruitRestitution: 0.2,
  fruitFriction: 0.9,
  wallRestitution: 0.1,
  wallFriction: 0.5,
  containerWidth: 6,
  containerHeight: 8, 
  containerDepth: 1, 
  dropHeight: 7.5,     
  gameOverLineY: 7.0,  
  baseFruitMass: 0.1, 
};

export const CAMERA_POSITION: [number, number, number] = [0, GAME_CONFIG.containerHeight / 2, 12]; 
export const LIGHT_POSITION: [number, number, number] = [5, 15, 5];

export const MERGE_IMPULSE_STRENGTH = 0.5;
export const MAX_FRUITS = 1000; 
export const AUTOPLAY_DROP_DELAY = 750; // Milliseconds for AI to "think" before dropping
export const DROP_COOLDOWN_MS = 1000; // Milliseconds for cooldown between fruit drops

// Combo System Constants
export const COMBO_WINDOW_MS = 2500; // 2.5 seconds to continue combo
export const COMBO_BASE_BONUS_POINTS = 5; // Points for each merge in a combo (after the first merge)

// Special Fruit Constants
export const SPECIAL_FRUIT_SPAWN_CHANCE = 0.10; // 10% chance to spawn a special fruit
export const BOMB_EXPLOSION_RADIUS = 1.8;
export const BOMB_AFFECTED_TYPES: FruitType[] = [FruitType.CHERRY, FruitType.STRAWBERRY, FruitType.GRAPE, FruitType.DEKOPON];
export const BOMB_MAX_AFFECTED_FRUITS = 5; // Max fruits destroyed by one bomb (excluding the bomb itself)

// Merge Particle Effect Constants
export const MERGE_PARTICLE_COUNT = 45; // Number of particles per merge
export const MERGE_PARTICLE_DURATION = 0.75; // Seconds the particles last
export const MERGE_PARTICLE_BASE_SIZE = 0.06; // Base size of particles
export const MERGE_PARTICLE_SIZE_MULTIPLIER = 0.2; // Multiplied by merged fruit radius
export const MERGE_PARTICLE_SPEED_SCALE = 2.0; // Multiplier for particle speed based on fruit radius
export const MERGE_PARTICLE_COLOR_BRIGHTNESS_MIN = 1.1; // Min brightness factor for particle color
export const MERGE_PARTICLE_COLOR_BRIGHTNESS_MAX = 1.8; // Max brightness factor for particle color
