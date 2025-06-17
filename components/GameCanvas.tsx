
import React, { useRef, useEffect, useCallback, memo, forwardRef, useImperativeHandle } from 'react';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { FruitType, FruitDefinition, FruitInstance, ExposedFruitState, GameCanvasRef } from '../types';
import { 
  FRUIT_DATA, GAME_CONFIG, CAMERA_POSITION, LIGHT_POSITION, 
  MERGE_IMPULSE_STRENGTH, MAX_FRUITS, BOMB_EXPLOSION_RADIUS, 
  BOMB_AFFECTED_TYPES, BOMB_MAX_AFFECTED_FRUITS,
  MERGE_PARTICLE_COUNT, MERGE_PARTICLE_DURATION, MERGE_PARTICLE_BASE_SIZE,
  MERGE_PARTICLE_SIZE_MULTIPLIER, MERGE_PARTICLE_SPEED_SCALE,
  MERGE_PARTICLE_COLOR_BRIGHTNESS_MIN, MERGE_PARTICLE_COLOR_BRIGHTNESS_MAX
} from '../constants';

interface GameCanvasProps {
  onScoreUpdate: (newScore: number, mergedFruitType: FruitType) => void;
  onGameOver: () => void;
  onReady: () => void;
  isGameOver: boolean;
  nextFruitTypeToDrop: FruitType;
  triggerDrop: boolean;
  dropPositionX: number;
  onFruitDropped: () => void;
}

interface ParticleEffect {
  id: string;
  points: THREE.Points;
  material: THREE.PointsMaterial;
  startTime: number;
  duration: number;
  initialPositions: THREE.Vector3[]; // Store initial positions for calculations if needed
  velocities: THREE.Vector3[];
  baseColor: THREE.Color;
}

const GameCanvas = forwardRef<GameCanvasRef, GameCanvasProps>(({
  onScoreUpdate,
  onGameOver,
  onReady,
  isGameOver,
  nextFruitTypeToDrop,
  triggerDrop,
  dropPositionX,
  onFruitDropped,
}, ref) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const worldRef = useRef<CANNON.World | null>(null);
  
  const fruitsRef = useRef<FruitInstance[]>([]);
  const fruitIdCounterRef = useRef(0);
  
  const animationFrameIdRef = useRef<number | null>(null);

  const isGameOverRef = useRef(isGameOver);
  const gameReadyForLogicRef = useRef(false); 

  const bodiesToRemoveIdsRef = useRef<string[]>([]);
  const fruitsToAddFromMergeRef = useRef<{ type: FruitType; position: CANNON.Vec3; isMergeResult: boolean }[]>([]);
  const bombsToExplodeRef = useRef<string[]>([]); 

  const particleEffectsRef = useRef<ParticleEffect[]>([]);
  const particleEffectIdCounterRef = useRef(0);
  const lastStepTimeRef = useRef<number>(0);


  useEffect(() => {
    isGameOverRef.current = isGameOver;
  }, [isGameOver]);

  useImperativeHandle(ref, () => ({
    getFruitStates: () => {
      return fruitsRef.current.map(f => ({
        id: f.id,
        type: f.type,
        x: f.body.position.x,
        y: f.body.position.y,
        radius: f.definition.radius,
      }));
    }
  }));

  const spawnMergeParticles = useCallback((position: CANNON.Vec3, mergedFruitDef: FruitDefinition) => {
    if (!sceneRef.current) return;

    const particleCount = MERGE_PARTICLE_COUNT;
    const duration = MERGE_PARTICLE_DURATION;
    
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const velocities: THREE.Vector3[] = [];
    const initialPositions: THREE.Vector3[] = [];

    const baseColor = new THREE.Color(mergedFruitDef.color as number);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = position.x;
      positions[i * 3 + 1] = position.y;
      positions[i * 3 + 2] = position.z; // Start at merge point

      initialPositions.push(new THREE.Vector3(position.x, position.y, position.z));

      const HSL = { h:0, s:0, l:0 };
      baseColor.getHSL(HSL);
      const brightnessFactor = THREE.MathUtils.randFloat(MERGE_PARTICLE_COLOR_BRIGHTNESS_MIN, MERGE_PARTICLE_COLOR_BRIGHTNESS_MAX);
      const particleColor = new THREE.Color().setHSL(HSL.h, HSL.s, Math.min(1, HSL.l * brightnessFactor));
      
      colors[i * 3] = particleColor.r;
      colors[i * 3 + 1] = particleColor.g;
      colors[i * 3 + 2] = particleColor.b;

      const phi = Math.acos(-1 + (2 * i) / particleCount); // Distribute points more evenly on a sphere
      const theta = Math.sqrt(particleCount * Math.PI) * phi;
      const speed = (Math.random() * 0.5 + 0.5) * MERGE_PARTICLE_SPEED_SCALE * (mergedFruitDef.radius + 0.5); // Speed based on radius

      const velocity = new THREE.Vector3(
        Math.cos(theta) * Math.sin(phi),
        Math.sin(theta) * Math.sin(phi),
        Math.cos(phi) 
      ).normalize().multiplyScalar(speed);
      velocities.push(velocity);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: MERGE_PARTICLE_BASE_SIZE + mergedFruitDef.radius * MERGE_PARTICLE_SIZE_MULTIPLIER,
      vertexColors: true,
      transparent: true,
      opacity: 1.0,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending, // Brighter, more "explosive" look
      depthWrite: false, // Prevents particles from occluding each other weirdly with AdditiveBlending
    });

    const points = new THREE.Points(geometry, material);
    sceneRef.current.add(points);
    
    particleEffectsRef.current.push({
      id: `particle_effect_${particleEffectIdCounterRef.current++}`,
      points,
      material,
      startTime: performance.now() / 1000, // seconds
      duration,
      initialPositions,
      velocities,
      baseColor
    });

  }, []);


  const addFruit = useCallback((type: FruitType, position: CANNON.Vec3, isMergeResult: boolean = false): FruitInstance | null => {
    if (!worldRef.current || !sceneRef.current || (fruitsRef.current.length >= MAX_FRUITS && !isMergeResult)) {
        if (fruitsRef.current.length >= MAX_FRUITS && !isMergeResult) {
            console.warn("[GameCanvas] Max fruits reached, cannot add new fruit.");
        }
        return null;
    }

    const definition = FRUIT_DATA[type];
    const fruitMaterial = new CANNON.Material(`fruitMaterial_${type}`);
    fruitMaterial.friction = GAME_CONFIG.fruitFriction;
    fruitMaterial.restitution = GAME_CONFIG.fruitRestitution;

    let bodyShape: CANNON.Shape;
    let meshGeometry: THREE.BufferGeometry;
    const radius = definition.radius;

    if (type === FruitType.BOMB || type === FruitType.RAINBOW) {
      const halfExtent = radius;
      bodyShape = new CANNON.Box(new CANNON.Vec3(halfExtent, halfExtent, halfExtent));
      meshGeometry = new THREE.BoxGeometry(halfExtent * 2, halfExtent * 2, halfExtent * 2);
    } else {
      bodyShape = new CANNON.Sphere(radius);
      meshGeometry = new THREE.SphereGeometry(radius, 32, 32);
    }

    const body = new CANNON.Body({
      mass: GAME_CONFIG.baseFruitMass * Math.pow(radius / FRUIT_DATA[FruitType.CHERRY].radius, 3),
      position: new CANNON.Vec3(position.x, position.y, 0),
      shape: bodyShape,
      material: fruitMaterial,
      linearDamping: 0.1, 
      angularDamping: 0.1, 
    });
    
    const fruitId = `fruit_${fruitIdCounterRef.current++}`;
    (body as any).fruitType = type; 
    (body as any).fruitId = fruitId;

    worldRef.current.addBody(body);

    const material = new THREE.MeshStandardMaterial({ color: definition.color as number });
    const mesh = new THREE.Mesh(meshGeometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.copy(body.position as unknown as THREE.Vector3);
    sceneRef.current.add(mesh);

    const fruitInstance: FruitInstance = { id: fruitId, type, mesh, body, definition };
    if (type === FruitType.BOMB) {
      fruitInstance.hasExploded = false;
    }
    fruitsRef.current.push(fruitInstance);

    if (isMergeResult) {
      const impulseDirection = new CANNON.Vec3(
        (Math.random() - 0.5) * 2,
        (Math.random()) * 0.5, 
        (Math.random() - 0.5) * 0.2
      ).unit();
      const impulseMagnitude = MERGE_IMPULSE_STRENGTH * body.mass; 
      body.applyImpulse(impulseDirection.scale(impulseMagnitude), body.position.vadd(new CANNON.Vec3(0, radius * 0.1, 0)));
    }
    
    body.addEventListener('collide', (event: any) => {
      if (isGameOverRef.current || !gameReadyForLogicRef.current) return;
      
      const otherBody = event.body === body ? event.target : event.body;

      if (!otherBody || 
          typeof (body as any).fruitType !== 'number' || 
          typeof (otherBody as any).fruitType !== 'number' || 
          !(body as any).fruitId || 
          !(otherBody as any).fruitId) {
        return;
      }

      const thisType = (body as any).fruitType as FruitType;
      const otherType = (otherBody as any).fruitType as FruitType;
      const thisId = (body as any).fruitId as string;
      const otherId = (otherBody as any).fruitId as string;

      if (bodiesToRemoveIdsRef.current.includes(thisId) || bodiesToRemoveIdsRef.current.includes(otherId)) {
        return; 
      }
      
      const thisFruitInstance = fruitsRef.current.find(f => f.id === thisId);
      const otherFruitInstance = fruitsRef.current.find(f => f.id === otherId);

      if (thisType === FruitType.BOMB && otherType !== FruitType.BOMB) {
        if (thisFruitInstance && !thisFruitInstance.hasExploded) {
          thisFruitInstance.hasExploded = true; 
          bombsToExplodeRef.current.push(thisId); 
          return; 
        }
      } else if (otherType === FruitType.BOMB && thisType !== FruitType.BOMB) {
        if (otherFruitInstance && !otherFruitInstance.hasExploded) {
          otherFruitInstance.hasExploded = true;
          bombsToExplodeRef.current.push(otherId);
          return;
        }
      }
      
      const handleRainbowMerge = (rainbowBody: CANNON.Body, normalBody: CANNON.Body) => {
        const normalType = (normalBody as any).fruitType as FruitType;
        const normalDef = FRUIT_DATA[normalType];
        
        if (normalType === FruitType.BOMB || normalType === FruitType.RAINBOW) return false;

        if (normalDef.nextType !== undefined) { 
          const nextFruitType = normalDef.nextType;
          
          const collisionPoint = new CANNON.Vec3();
           if (event.contact && event.contact.ni) {
            const contactPointBody = event.contact.ri.vadd(rainbowBody.position); 
            const contactPointOther = event.contact.rj.vadd(normalBody.position); 
            collisionPoint.copy(contactPointBody.vadd(contactPointOther).scale(0.5));
          } else {
             rainbowBody.position.lerp(normalBody.position, 0.5, collisionPoint); 
          }
          collisionPoint.z = 0; 

          bodiesToRemoveIdsRef.current.push((rainbowBody as any).fruitId, (normalBody as any).fruitId);
          fruitsToAddFromMergeRef.current.push({ type: nextFruitType, position: collisionPoint, isMergeResult: true });
          
          onScoreUpdate(FRUIT_DATA[nextFruitType].score, nextFruitType);
          return true;
        }
        return false;
      };

      if (thisType === FruitType.RAINBOW) {
        if (handleRainbowMerge(body, otherBody)) return;
      } else if (otherType === FruitType.RAINBOW) {
        if (handleRainbowMerge(otherBody, body)) return;
      }

      if (thisType === otherType && thisType !== FruitType.RAINBOW && thisType !== FruitType.BOMB) {
        if (thisId < otherId) { 
          const currentDefinition = FRUIT_DATA[thisType];
          if (currentDefinition.nextType !== undefined) {
            const nextFruitType = currentDefinition.nextType;
            
            const collisionPoint = new CANNON.Vec3();
            if (event.contact && event.contact.ni) {
              const contactPointBody = event.contact.ri.vadd(body.position); 
              const contactPointOther = event.contact.rj.vadd(otherBody.position); 
              collisionPoint.copy(contactPointBody.vadd(contactPointOther).scale(0.5));
            } else {
               body.position.lerp(otherBody.position, 0.5, collisionPoint); 
            }
            collisionPoint.z = 0;

            bodiesToRemoveIdsRef.current.push(thisId, otherId);
            fruitsToAddFromMergeRef.current.push({ type: nextFruitType, position: collisionPoint, isMergeResult: true });
            
            onScoreUpdate(FRUIT_DATA[nextFruitType].score, nextFruitType);
          }
        }
      }
    });
    return fruitInstance;
  }, [onScoreUpdate, spawnMergeParticles]); 

  const processDeferredOperations = useCallback(() => {
    if (!worldRef.current || !sceneRef.current) return;
    let fruitsActuallyRemoved = false;

    if (bombsToExplodeRef.current.length > 0) {
        const explodingBombIds = [...new Set(bombsToExplodeRef.current)]; 
        bombsToExplodeRef.current = [];

        explodingBombIds.forEach(bombId => {
            const bombInstance = fruitsRef.current.find(f => f.id === bombId);
            if (!bombInstance || bombInstance.type !== FruitType.BOMB || bodiesToRemoveIdsRef.current.includes(bombId)) return;

            bodiesToRemoveIdsRef.current.push(bombId); 
            spawnMergeParticles(bombInstance.body.position, FRUIT_DATA[FruitType.BOMB]); // Simple grey particles for bomb

            const bombPosition = bombInstance.body.position;
            let affectedCount = 0;
            
            const victims = fruitsRef.current
                .filter(f => f.id !== bombId && !bodiesToRemoveIdsRef.current.includes(f.id) && !explodingBombIds.includes(f.id) && BOMB_AFFECTED_TYPES.includes(f.type))
                .map(f => ({
                    instance: f,
                    distanceSq: f.body.position.distanceSquared(bombPosition)
                }))
                .filter(f => f.distanceSq < BOMB_EXPLOSION_RADIUS * BOMB_EXPLOSION_RADIUS)
                .sort((a,b) => a.distanceSq - b.distanceSq); 

            for (const victim of victims) {
                if (affectedCount < BOMB_MAX_AFFECTED_FRUITS) {
                    bodiesToRemoveIdsRef.current.push(victim.instance.id);
                    affectedCount++;
                } else {
                    break;
                }
            }
        });
    }


    if (bodiesToRemoveIdsRef.current.length > 0) {
      const idsToRemoveSet = new Set(bodiesToRemoveIdsRef.current);
      const newFruitsList: FruitInstance[] = [];
      fruitsRef.current.forEach(f => {
        if (idsToRemoveSet.has(f.id)) {
          worldRef.current!.removeBody(f.body);
          sceneRef.current!.remove(f.mesh);
          f.mesh.geometry.dispose();
          if (f.mesh.material && !(f.mesh.material instanceof Array)) {
            (f.mesh.material as THREE.Material).dispose();
          }
          fruitsActuallyRemoved = true;
        } else {
          newFruitsList.push(f);
        }
      });
      fruitsRef.current = newFruitsList;
      bodiesToRemoveIdsRef.current = [];
    }

    if (fruitsToAddFromMergeRef.current.length > 0) {
      fruitsToAddFromMergeRef.current.forEach(data => {
        const newFruit = addFruit(data.type, data.position, data.isMergeResult);
        if (newFruit && data.isMergeResult) {
            spawnMergeParticles(data.position, FRUIT_DATA[data.type]);
        }
      });
      fruitsToAddFromMergeRef.current = [];
    }
    
    if (fruitsActuallyRemoved && worldRef.current) {
        worldRef.current.bodies.forEach(body => {
            if (body.sleepState === CANNON.Body.SLEEPING && body.type !== CANNON.Body.STATIC) {
                 body.wakeUp();
            }
        });
    }
  }, [addFruit, spawnMergeParticles]);


  useEffect(() => {
    if (!mountRef.current) {
      return;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xE0E5F0); 
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(75, mountRef.current.clientWidth / mountRef.current.clientHeight, 0.1, 1000);
    camera.position.set(...CAMERA_POSITION);
    camera.lookAt(0, GAME_CONFIG.containerHeight / 3, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.shadowMap.enabled = true;
    mountRef.current.innerHTML = ''; 
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.0); 
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2); 
    directionalLight.position.set(...LIGHT_POSITION);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.bias = -0.001; 
    const S = GAME_CONFIG.containerHeight; 
    directionalLight.shadow.camera.left = -S;
    directionalLight.shadow.camera.right = S;
    directionalLight.shadow.camera.top = S;
    directionalLight.shadow.camera.bottom = -S;
    scene.add(directionalLight);
    
    const world = new CANNON.World({ gravity: new CANNON.Vec3(0, GAME_CONFIG.gravity, 0), allowSleep: true });
    world.broadphase = new CANNON.SAPBroadphase(world); 
    (world.solver as CANNON.GSSolver).iterations = 10; 
    world.defaultContactMaterial.friction = GAME_CONFIG.fruitFriction;
    world.defaultContactMaterial.restitution = GAME_CONFIG.fruitRestitution;
    worldRef.current = world;
    lastStepTimeRef.current = performance.now() / 1000;
    
    const wallMaterial = new CANNON.Material('wallMaterial');
    wallMaterial.friction = GAME_CONFIG.wallFriction;
    wallMaterial.restitution = GAME_CONFIG.wallRestitution;

    const { containerWidth, containerHeight, containerDepth } = GAME_CONFIG;
    const commonWallProps = { mass: 0, material: wallMaterial };

    world.addBody(new CANNON.Body({ ...commonWallProps, shape: new CANNON.Plane(), position: new CANNON.Vec3(0, 0, 0), quaternion: new CANNON.Quaternion().setFromEuler(-Math.PI / 2, 0, 0) }));
    const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(containerWidth, containerDepth), new THREE.MeshStandardMaterial({ color: 0xB0B8C8, side: THREE.DoubleSide }));
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    const wallVisMaterial = new THREE.MeshStandardMaterial({ color: 0xA0A8B8, transparent: true, opacity: 0.1, side: THREE.DoubleSide });
    world.addBody(new CANNON.Body({ ...commonWallProps, shape: new CANNON.Plane(), position: new CANNON.Vec3(-containerWidth / 2, containerHeight / 2, 0), quaternion: new CANNON.Quaternion().setFromEuler(0, Math.PI / 2, 0) }));
    const leftWallMesh = new THREE.Mesh(new THREE.PlaneGeometry(containerDepth, containerHeight), wallVisMaterial);
    leftWallMesh.position.set(-containerWidth / 2, containerHeight / 2, 0);
    leftWallMesh.rotation.y = Math.PI / 2;
    scene.add(leftWallMesh);
    world.addBody(new CANNON.Body({ ...commonWallProps, shape: new CANNON.Plane(), position: new CANNON.Vec3(containerWidth / 2, containerHeight / 2, 0), quaternion: new CANNON.Quaternion().setFromEuler(0, -Math.PI / 2, 0) }));
    const rightWallMesh = new THREE.Mesh(new THREE.PlaneGeometry(containerDepth, containerHeight), wallVisMaterial);
    rightWallMesh.position.set(containerWidth / 2, containerHeight / 2, 0);
    rightWallMesh.rotation.y = -Math.PI / 2;
    scene.add(rightWallMesh);
    world.addBody(new CANNON.Body({ ...commonWallProps, shape: new CANNON.Plane(), position: new CANNON.Vec3(0, containerHeight / 2, -containerDepth / 2), quaternion: new CANNON.Quaternion().setFromEuler(0, 0, 0) })); 
    const backWallMesh = new THREE.Mesh(new THREE.PlaneGeometry(containerWidth, containerHeight), wallVisMaterial);
    backWallMesh.position.set(0, containerHeight / 2, -containerDepth / 2);
    scene.add(backWallMesh);
    world.addBody(new CANNON.Body({ ...commonWallProps, shape: new CANNON.Plane(), position: new CANNON.Vec3(0, containerHeight / 2, containerDepth / 2), quaternion: new CANNON.Quaternion().setFromEuler(0, Math.PI, 0) })); 
    const frontWallMesh = new THREE.Mesh(new THREE.PlaneGeometry(containerWidth, containerHeight), wallVisMaterial);
    frontWallMesh.position.set(0, containerHeight / 2, containerDepth / 2);
    frontWallMesh.rotation.y = Math.PI;
    scene.add(frontWallMesh);

    gameReadyForLogicRef.current = true;
    onReady(); 

    const gameLoop = () => {
      animationFrameIdRef.current = requestAnimationFrame(gameLoop);
      const currentTime = performance.now() / 1000;
      // const deltaTime = currentTime - lastStepTimeRef.current; // Using fixed 1/60 for Cannon.world.step
      lastStepTimeRef.current = currentTime;

      if (worldRef.current && sceneRef.current && cameraRef.current && rendererRef.current) {
        if (!isGameOverRef.current && gameReadyForLogicRef.current) {
           worldRef.current.step(1 / 60); 
        }
        
        processDeferredOperations(); 

        // Update particle effects
        for (let i = particleEffectsRef.current.length - 1; i >= 0; i--) {
          const effect = particleEffectsRef.current[i];
          const elapsed = currentTime - effect.startTime;

          if (elapsed >= effect.duration) {
            sceneRef.current.remove(effect.points);
            effect.points.geometry.dispose();
            effect.material.dispose();
            particleEffectsRef.current.splice(i, 1);
          } else {
            effect.material.opacity = 1.0 - (elapsed / effect.duration);
            
            const positions = effect.points.geometry.attributes.position as THREE.BufferAttribute;
            for (let j = 0; j < effect.velocities.length; j++) {
              const initialPos = effect.initialPositions[j];
              const velocity = effect.velocities[j];
              
              // Simple linear motion outwards: P = P0 + V * t
              const currentX = initialPos.x + velocity.x * elapsed;
              const currentY = initialPos.y + velocity.y * elapsed;
              const currentZ = initialPos.z + velocity.z * elapsed;
              
              positions.setXYZ(j, currentX, currentY, currentZ);
            }
            positions.needsUpdate = true;
          }
        }


        let highestStaticY = 0;
        let isAnyFruitMovingSignificantly = false;

        fruitsRef.current.forEach(fruit => {
          if (fruit.body && fruit.mesh) {
            fruit.mesh.position.copy(fruit.body.position as unknown as THREE.Vector3);
            fruit.mesh.quaternion.copy(fruit.body.quaternion as unknown as THREE.Quaternion);
            
            if (!isGameOverRef.current) { 
              let fruitTopY = fruit.body.position.y;
              fruitTopY += fruit.definition.radius;
              
              const isEffectivelyStatic = fruit.body.sleepState === CANNON.Body.SLEEPING || fruit.body.velocity.lengthSquared() < 0.001;

              if (isEffectivelyStatic) {
                if (fruitTopY > highestStaticY) highestStaticY = fruitTopY;
              } else {
                isAnyFruitMovingSignificantly = true;
              }
            }
          }
        });

        if (!isGameOverRef.current && fruitsRef.current.length > 0 && highestStaticY > GAME_CONFIG.gameOverLineY && !isAnyFruitMovingSignificantly) {
           onGameOver(); 
        }
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };

    animationFrameIdRef.current = requestAnimationFrame(gameLoop); 

    const handleResize = () => {
      if (cameraRef.current && rendererRef.current && mountRef.current && mountRef.current.clientWidth > 0 && mountRef.current.clientHeight > 0) {
        cameraRef.current.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize(); 

    return () => {
      gameReadyForLogicRef.current = false;
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
      window.removeEventListener('resize', handleResize);

      particleEffectsRef.current.forEach(effect => {
        if(sceneRef.current) sceneRef.current.remove(effect.points);
        effect.points.geometry.dispose();
        effect.material.dispose();
      });
      particleEffectsRef.current = [];

      fruitsRef.current.forEach(fruit => {
        if (sceneRef.current && fruit.mesh) sceneRef.current.remove(fruit.mesh);
        if (fruit.mesh) {
          if (fruit.mesh.geometry) fruit.mesh.geometry.dispose();
          if (fruit.mesh.material && !(fruit.mesh.material instanceof Array)) (fruit.mesh.material as THREE.Material).dispose();
        }
        if (worldRef.current && fruit.body) worldRef.current.removeBody(fruit.body);
      });
      fruitsRef.current = [];
      bodiesToRemoveIdsRef.current = [];
      fruitsToAddFromMergeRef.current = [];
      bombsToExplodeRef.current = [];


      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
      
      worldRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
      
      if (mountRef.current) mountRef.current.innerHTML = '';
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onReady]); 

  useEffect(() => {
    if (triggerDrop && gameReadyForLogicRef.current && !isGameOverRef.current) {
      if (fruitsRef.current.length >= MAX_FRUITS) {
        onFruitDropped(); 
        return;
      }
      const currentFruitDef = FRUIT_DATA[nextFruitTypeToDrop];
      if (!currentFruitDef) {
        onFruitDropped(); 
        return;
      }
      
      const clampedX = Math.max(
        -GAME_CONFIG.containerWidth / 2 + currentFruitDef.radius + 0.05,
        Math.min(
          GAME_CONFIG.containerWidth / 2 - currentFruitDef.radius - 0.05,
          dropPositionX
        )
      );

      const newFruitPos = new CANNON.Vec3(clampedX, GAME_CONFIG.dropHeight, 0); 
      addFruit(nextFruitTypeToDrop, newFruitPos, false);
      onFruitDropped(); 
    } else if (triggerDrop) {
      onFruitDropped();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerDrop, dropPositionX, nextFruitTypeToDrop, addFruit, onFruitDropped]); 

  return <div ref={mountRef} className="w-full h-full" />;
});

export default memo(GameCanvas);
