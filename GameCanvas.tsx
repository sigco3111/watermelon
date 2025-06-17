
import React, { useRef, useEffect, useCallback, memo } from 'react';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { FruitType, FruitDefinition, FruitInstance } from '../types';
import { FRUIT_DATA, GAME_CONFIG, CAMERA_POSITION, LIGHT_POSITION, MERGE_IMPULSE_STRENGTH, MAX_FRUITS } from '../constants';

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

const GameCanvas: React.FC<GameCanvasProps> = ({
  onScoreUpdate,
  onGameOver,
  onReady,
  isGameOver,
  nextFruitTypeToDrop,
  triggerDrop,
  dropPositionX,
  onFruitDropped,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const worldRef = useRef<CANNON.World | null>(null);
  
  const fruitsRef = useRef<FruitInstance[]>([]);
  const fruitIdCounterRef = useRef(0);
  
  const animationFrameIdRef = useRef<number | null>(null);
  // const gameOverTimeoutRef = useRef<number | null>(null); // Removed

  const isGameOverRef = useRef(isGameOver);
  const gameReadyForLogicRef = useRef(false); 

  const bodiesToRemoveIdsRef = useRef<string[]>([]);
  const fruitsToAddFromMergeRef = useRef<{ type: FruitType; position: CANNON.Vec3; isMergeResult: boolean }[]>([]);

  useEffect(() => {
    isGameOverRef.current = isGameOver;
  }, [isGameOver]);

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

    const body = new CANNON.Body({
      mass: GAME_CONFIG.baseFruitMass * Math.pow(definition.radius / FRUIT_DATA[FruitType.CHERRY].radius, 3),
      position,
      shape: new CANNON.Sphere(definition.radius),
      material: fruitMaterial,
      linearDamping: 0.1, 
      angularDamping: 0.1, 
    });
    
    const fruitId = `fruit_${fruitIdCounterRef.current++}`;
    (body as any).fruitType = type; 
    (body as any).fruitId = fruitId;

    worldRef.current.addBody(body);

    const geometry = new THREE.SphereGeometry(definition.radius, 32, 32);
    const material = new THREE.MeshStandardMaterial({ color: definition.color as number });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.copy(body.position as unknown as THREE.Vector3);
    sceneRef.current.add(mesh);

    const fruitInstance: FruitInstance = { id: fruitId, type, mesh, body, definition };
    fruitsRef.current.push(fruitInstance);

    if (isMergeResult) {
      const impulseDirection = new CANNON.Vec3(
        (Math.random() - 0.5) * 2,
        (Math.random()) * 0.5, 
        (Math.random() - 0.5) * 2
      ).unit();
      const impulseMagnitude = MERGE_IMPULSE_STRENGTH * body.mass; 
      body.applyImpulse(impulseDirection.scale(impulseMagnitude), body.position.vadd(new CANNON.Vec3(0, definition.radius * 0.1, 0)));
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

      if (thisType === otherType && thisId < otherId) { 
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

          bodiesToRemoveIdsRef.current.push(thisId, otherId);
          fruitsToAddFromMergeRef.current.push({ type: nextFruitType, position: collisionPoint, isMergeResult: true });
          
          onScoreUpdate(FRUIT_DATA[nextFruitType].score, nextFruitType);
        }
      }
    });
    return fruitInstance;
  }, [onScoreUpdate]); 

  const processDeferredOperations = useCallback(() => {
    if (!worldRef.current || !sceneRef.current) return;
    let fruitsActuallyRemoved = false;

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
        addFruit(data.type, data.position, data.isMergeResult);
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
  }, [addFruit]);


  useEffect(() => {
    console.log('[GameCanvas] Initializing...');
    if (!mountRef.current) {
      console.error('[GameCanvas] Mount ref not available.');
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
    console.log('[GameCanvas] Cannon world created. Gravity Y:', worldRef.current.gravity.y);

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
    console.log('[GameCanvas] Initialization complete. Game loop starting.');

    const gameLoop = () => {
      animationFrameIdRef.current = requestAnimationFrame(gameLoop);

      if (worldRef.current && sceneRef.current && cameraRef.current && rendererRef.current) {
        if (!isGameOverRef.current && gameReadyForLogicRef.current) {
           worldRef.current.step(1 / 60); 
        }
        
        processDeferredOperations(); 

        let highestStaticY = 0;
        let isAnyFruitMovingSignificantly = false;

        fruitsRef.current.forEach(fruit => {
          if (fruit.body && fruit.mesh) {
            fruit.mesh.position.copy(fruit.body.position as unknown as THREE.Vector3);
            fruit.mesh.quaternion.copy(fruit.body.quaternion as unknown as THREE.Quaternion);
            
            if (!isGameOverRef.current) { 
              const fruitTopY = fruit.body.position.y + fruit.definition.radius;
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
           console.log('[GameCanvas] Game over condition met and confirmed.');
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
      console.log('[GameCanvas] Cleanup initiated.');
      gameReadyForLogicRef.current = false;
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
      // if (gameOverTimeoutRef.current) clearTimeout(gameOverTimeoutRef.current); // Removed
      window.removeEventListener('resize', handleResize);

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

      if (rendererRef.current) {
        rendererRef.current.dispose();
        console.log('[GameCanvas] Renderer disposed.');
      }
      if (sceneRef.current) {
        console.log('[GameCanvas] Scene cleared (meshes removed).');
      }
      
      worldRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
      
      if (mountRef.current) mountRef.current.innerHTML = '';
      console.log('[GameCanvas] Cleanup complete.');
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onReady]); 

  useEffect(() => {
    if (triggerDrop && gameReadyForLogicRef.current && !isGameOverRef.current) {
      console.log(`[GameCanvas] Attempting to drop fruit: ${FruitType[nextFruitTypeToDrop]}`);
      if (fruitsRef.current.length >= MAX_FRUITS) {
        console.warn("[GameCanvas] Max fruit limit reached. Cannot drop fruit.");
        onFruitDropped(); 
        return;
      }
      const currentFruitDef = FRUIT_DATA[nextFruitTypeToDrop];
      if (!currentFruitDef) {
        console.error(`[GameCanvas] Invalid nextFruitTypeToDrop: ${nextFruitTypeToDrop}`);
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
      // Ensure Z position is 0 for dropping new fruits, consistent with components/GameCanvas.tsx
      const newFruitPos = new CANNON.Vec3(clampedX, GAME_CONFIG.dropHeight, 0);
      addFruit(nextFruitTypeToDrop, newFruitPos, false);
      onFruitDropped(); 
    } else if (triggerDrop) {
      console.log('[GameCanvas] triggerDrop was true, but conditions not met for dropping. Calling onFruitDropped.');
      onFruitDropped();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerDrop, dropPositionX, nextFruitTypeToDrop, addFruit, onFruitDropped]); 

  return <div ref={mountRef} className="w-full h-full" />;
};

export default memo(GameCanvas);
