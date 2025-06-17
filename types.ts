
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export enum FruitType {
  CHERRY = 0,
  STRAWBERRY,
  GRAPE,
  DEKOPON, // Japanese citrus
  PERSIMMON,
  APPLE,
  PEAR,
  PEACH,
  PINEAPPLE,
  MELON,
  WATERMELON,
  RAINBOW, // New Special Fruit
  BOMB,    // New Special Fruit
}

export interface FruitDefinition {
  type: FruitType;
  radius: number;
  color: number | string; // hex color
  score: number;
  nextType?: FruitType; // Type it merges into
  texture?: string; // Optional path to texture
}

export interface FruitInstance {
  id: string; 
  type: FruitType;
  mesh: THREE.Mesh;
  body: CANNON.Body;
  definition: FruitDefinition;
  hasExploded?: boolean; // For Bomb fruit
}

export interface GameConfig {
  gravity: number;
  fruitRestitution: number;
  fruitFriction: number;
  wallRestitution: number;
  wallFriction: number;
  containerWidth: number;
  containerHeight: number;
  containerDepth: number;
  dropHeight: number;
  gameOverLineY: number;
  baseFruitMass: number;
}

export interface ExposedFruitState {
  id: string;
  type: FruitType;
  x: number;
  y: number;
  radius: number;
  // velocityY: number; // For future AI: consider if fruit is falling
}

export interface GameCanvasRef {
  getFruitStates: () => ExposedFruitState[];
}