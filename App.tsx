
import React, { useState, useEffect, useCallback, useRef } from 'react';
import GameCanvas from './components/GameCanvas';
import UIControls from './components/UIControls';
import HelpUI from './components/HelpUI'; // Import HelpUI
import { FruitType, FruitDefinition, GameCanvasRef, ExposedFruitState } from './types';
import { 
  FRUIT_DATA, INITIAL_FRUIT_TYPES, GAME_CONFIG, AUTOPLAY_DROP_DELAY, 
  COMBO_WINDOW_MS, COMBO_BASE_BONUS_POINTS, SPECIAL_FRUIT_SPAWN_CHANCE,
  DROP_COOLDOWN_MS
} from './constants';

const MAJOR_FRUITS_TO_TRACK_ACHIEVEMENT: FruitType[] = [
  FruitType.PERSIMMON,
  FruitType.APPLE,
  FruitType.PEAR,
  FruitType.PEACH,
  FruitType.PINEAPPLE,
  FruitType.MELON,
  FruitType.WATERMELON,
];

const App: React.FC = () => {
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const savedHighScore = localStorage.getItem('suika3DHighScore');
    return savedHighScore ? parseInt(savedHighScore, 10) : 0;
  });
  
  const [currentFruitTypeToDrop, setCurrentFruitTypeToDrop] = useState<FruitType>(INITIAL_FRUIT_TYPES[0]);
  const [nextFruitTypeForPreview, setNextFruitTypeForPreview] = useState<FruitType>(INITIAL_FRUIT_TYPES[1 % INITIAL_FRUIT_TYPES.length]);
  
  const [isGameOver, setIsGameOver] = useState(false);
  const [gameKey, setGameKey] = useState(0); 
  
  const [isLoading, setIsLoading] = useState(true); 

  const [triggerDrop, setTriggerDrop] = useState(false);
  const [dropPositionX, setDropPositionX] = useState(0);
  const gameAreaRef = useRef<HTMLDivElement>(null);
  const gameCanvasRef = useRef<GameCanvasRef>(null);

  const [isAutoplayActive, setIsAutoplayActive] = useState(false);
  const autoplayTimeoutRef = useRef<number | null>(null);

  // Drop cooldown state
  const [isDropCooldownActive, setIsDropCooldownActive] = useState(false);
  const dropCooldownTimeoutRef = useRef<number | null>(null);
  const [dropCooldownProgress, setDropCooldownProgress] = useState(0); // 0 to 1
  const dropCooldownProgressIntervalRef = useRef<number | null>(null);

  // Help UI State
  const [isHelpVisible, setIsHelpVisible] = useState(false);


  // Game history stats
  const [mergeCount, setMergeCount] = useState(0);
  const [fruitsDroppedCount, setFruitsDroppedCount] = useState(0);
  const [largestFruitAchieved, setLargestFruitAchieved] = useState<FruitType | null>(null);

  // Enhanced game over stats
  const [gameStartTime, setGameStartTime] = useState<number | null>(null);
  const [playTime, setPlayTime] = useState<number>(0); // in seconds
  const [firstAchievedFruitTimes, setFirstAchievedFruitTimes] = useState<Record<FruitType, number | null>>(
    Object.fromEntries(MAJOR_FRUITS_TO_TRACK_ACHIEVEMENT.map(type => [type, null])) as Record<FruitType, number | null>
  );
  const [finalFruitCounts, setFinalFruitCounts] = useState<Record<string, number> | null>(null);

  // Combo system state
  const [currentComboCount, setCurrentComboCount] = useState(0);
  const comboTimeoutRef = useRef<number | null>(null);

  const getRandomFruitType = useCallback((): FruitType => {
    const roll = Math.random();
    if (roll < SPECIAL_FRUIT_SPAWN_CHANCE) {
      return Math.random() < 0.5 ? FruitType.RAINBOW : FruitType.BOMB;
    } else {
      return INITIAL_FRUIT_TYPES[Math.floor(Math.random() * INITIAL_FRUIT_TYPES.length)];
    }
  }, []);


  const selectNextFruitPair = useCallback(() => {
    setCurrentFruitTypeToDrop(getRandomFruitType());
    setNextFruitTypeForPreview(getRandomFruitType());
  }, [getRandomFruitType]);

  useEffect(() => {
    selectNextFruitPair();
  }, [selectNextFruitPair]);

  const startCooldownVisualizer = useCallback(() => {
    if (dropCooldownProgressIntervalRef.current) {
      clearInterval(dropCooldownProgressIntervalRef.current);
    }
    const startTime = Date.now();
    setDropCooldownProgress(0); // Reset progress

    dropCooldownProgressIntervalRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / DROP_COOLDOWN_MS);
      setDropCooldownProgress(progress);

      if (progress >= 1) {
        if (dropCooldownProgressIntervalRef.current) {
          clearInterval(dropCooldownProgressIntervalRef.current);
          dropCooldownProgressIntervalRef.current = null;
        }
      }
    }, 30); // Update frequently for smooth animation
  }, []);

  const stopCooldownVisualizer = useCallback(() => {
    if (dropCooldownProgressIntervalRef.current) {
      clearInterval(dropCooldownProgressIntervalRef.current);
      dropCooldownProgressIntervalRef.current = null;
    }
    setDropCooldownProgress(0); // Reset progress visually
  }, []);

  const toggleHelpVisibility = useCallback(() => {
    setIsHelpVisible(prev => !prev);
  }, []);


  // General cleanup for all timers on component unmount
  useEffect(() => {
    return () => {
      if (autoplayTimeoutRef.current) {
        clearTimeout(autoplayTimeoutRef.current);
      }
      if (comboTimeoutRef.current) {
        clearTimeout(comboTimeoutRef.current);
      }
      if (dropCooldownTimeoutRef.current) {
        clearTimeout(dropCooldownTimeoutRef.current);
      }
      if (dropCooldownProgressIntervalRef.current) {
        clearInterval(dropCooldownProgressIntervalRef.current);
      }
    };
  }, []);

  const handleToggleAutoplay = useCallback(() => {
    setIsAutoplayActive(prev => {
      const newState = !prev;
      if (!newState && autoplayTimeoutRef.current) { 
        clearTimeout(autoplayTimeoutRef.current);
        autoplayTimeoutRef.current = null;
      }
      return newState;
    });
  }, []);

  const handleScoreUpdate = useCallback((pointsFromMergeEvent: number, mergedFruitType: FruitType) => {
    let currentScoreIncrease = pointsFromMergeEvent; 

    if (comboTimeoutRef.current) {
      clearTimeout(comboTimeoutRef.current);
    }

    const newComboCount = currentComboCount + 1;
    setCurrentComboCount(newComboCount);

    if (newComboCount > 1) {
      const comboBonus = (newComboCount - 1) * COMBO_BASE_BONUS_POINTS;
      currentScoreIncrease += comboBonus;
    }
    
    setScore(prevScore => prevScore + currentScoreIncrease);
    
    if (mergedFruitType !== FruitType.BOMB) {
        setMergeCount(prev => prev + 1);
    }

    setLargestFruitAchieved(prevLargest => {
      if (mergedFruitType !== FruitType.RAINBOW && mergedFruitType !== FruitType.BOMB) {
        if (prevLargest === null || FRUIT_DATA[mergedFruitType].score > FRUIT_DATA[prevLargest].score) {
          return mergedFruitType;
        }
      }
      return prevLargest;
    });

    if (gameStartTime && MAJOR_FRUITS_TO_TRACK_ACHIEVEMENT.includes(mergedFruitType)) {
      setFirstAchievedFruitTimes(prevTimes => {
        if (prevTimes[mergedFruitType] === null) {
          const currentTimeInSeconds = (Date.now() - gameStartTime) / 1000;
          return { ...prevTimes, [mergedFruitType]: currentTimeInSeconds };
        }
        return prevTimes;
      });
    }
    
    comboTimeoutRef.current = window.setTimeout(() => {
      setCurrentComboCount(0);
    }, COMBO_WINDOW_MS);

  }, [currentComboCount, gameStartTime]); 

  const handleGameOver = useCallback(() => {
    setIsGameOver(true);
    if (isAutoplayActive) setIsAutoplayActive(false); 
    if (autoplayTimeoutRef.current) {
      clearTimeout(autoplayTimeoutRef.current);
      autoplayTimeoutRef.current = null;
    }
    if (comboTimeoutRef.current) { 
        clearTimeout(comboTimeoutRef.current);
        comboTimeoutRef.current = null;
    }
    
    // Cooldown visualizer will stop on its own or when isDropCooldownActive becomes false.
    // Ensure isDropCooldownActive is false if game over happens mid-cooldown.
    if (isDropCooldownActive) {
        setIsDropCooldownActive(false); 
        stopCooldownVisualizer();
    }
    if (dropCooldownTimeoutRef.current) {
        clearTimeout(dropCooldownTimeoutRef.current);
        dropCooldownTimeoutRef.current = null;
    }


    if (gameStartTime) {
      setPlayTime((Date.now() - gameStartTime) / 1000);
    }

    if (gameCanvasRef.current) {
      const finalFruits: ExposedFruitState[] = gameCanvasRef.current.getFruitStates();
      const counts: Record<string, number> = {};
      finalFruits.forEach(fruit => {
        const fruitName = FruitType[fruit.type];
        counts[fruitName] = (counts[fruitName] || 0) + 1;
      });
      setFinalFruitCounts(counts);
    }

    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('suika3DHighScore', score.toString());
    }
  }, [score, highScore, isAutoplayActive, gameStartTime, isDropCooldownActive, stopCooldownVisualizer]);

  const handleRestart = useCallback(() => {
    setScore(0);
    setMergeCount(0);
    setFruitsDroppedCount(0);
    setLargestFruitAchieved(null);
    setIsGameOver(false);
    setIsLoading(true); 
    if (isAutoplayActive) setIsAutoplayActive(false); 
    setIsHelpVisible(false); // Close help on restart

    if (autoplayTimeoutRef.current) {
      clearTimeout(autoplayTimeoutRef.current);
      autoplayTimeoutRef.current = null;
    }
    if (dropCooldownTimeoutRef.current) { 
        clearTimeout(dropCooldownTimeoutRef.current);
        dropCooldownTimeoutRef.current = null;
    }
    setIsDropCooldownActive(false); 
    stopCooldownVisualizer(); 

    selectNextFruitPair(); 
    setGameKey(prevKey => prevKey + 1); 
    setTriggerDrop(false);

    setGameStartTime(Date.now());
    setPlayTime(0);
    setFirstAchievedFruitTimes(
      Object.fromEntries(MAJOR_FRUITS_TO_TRACK_ACHIEVEMENT.map(type => [type, null])) as Record<FruitType, number | null>
    );
    setFinalFruitCounts(null);
    
    if (comboTimeoutRef.current) {
        clearTimeout(comboTimeoutRef.current);
        comboTimeoutRef.current = null;
    }
    setCurrentComboCount(0);

  }, [selectNextFruitPair, isAutoplayActive, stopCooldownVisualizer]);

  const handleGameReady = useCallback(() => {
    setIsLoading(false);
    if (!gameStartTime) { 
        setGameStartTime(Date.now());
    }
  }, [gameStartTime]);

  const handleFruitDropped = useCallback(() => {
    setTriggerDrop(false); 
    if (isGameOver) return;

    setFruitsDroppedCount(prev => prev + 1);

    setCurrentFruitTypeToDrop(nextFruitTypeForPreview);
    setNextFruitTypeForPreview(getRandomFruitType());

  }, [isGameOver, nextFruitTypeForPreview, getRandomFruitType]);
  
  const currentDroppableFruitDef: FruitDefinition | null = FRUIT_DATA[currentFruitTypeToDrop] || null;

  const calculateBestDropPosition = useCallback((): number => {
    if (!gameCanvasRef.current || !currentDroppableFruitDef) return 0;

    const existingFruits = gameCanvasRef.current.getFruitStates();
    const currentRadius = currentDroppableFruitDef.radius;
    const currentType = currentDroppableFruitDef.type;

    if (currentType !== FruitType.BOMB && currentType !== FruitType.RAINBOW) {
        const mergeCandidates = existingFruits
          .filter(f => f.type === currentType)
          .sort((a, b) => a.y - b.y); 

        for (const candidate of mergeCandidates) {
          if (candidate.y + currentRadius < GAME_CONFIG.gameOverLineY - (currentRadius * 2.5) ) { 
            const targetX = Math.max(-GAME_CONFIG.containerWidth / 2 + currentRadius, Math.min(GAME_CONFIG.containerWidth / 2 - currentRadius, candidate.x));
            return targetX;
          }
        }
    }
    
    let bestX = 0; 
    let minHighestYInColumn = Infinity;
    const numSegments = 15; 
    const segmentWidth = (GAME_CONFIG.containerWidth - 2 * currentRadius) / (numSegments - 1);

    for (let i = 0; i < numSegments; i++) {
      const candidateX = -GAME_CONFIG.containerWidth / 2 + currentRadius + (i * segmentWidth);
      let highestYInThisSegment = 0; 

      for (const fruit of existingFruits) {
        const fruitLeft = fruit.x - fruit.radius;
        const fruitRight = fruit.x + fruit.radius;
        const dropZoneLeft = candidateX - currentRadius;
        const dropZoneRight = candidateX + currentRadius;

        if (Math.max(fruitLeft, dropZoneLeft) < Math.min(fruitRight, dropZoneRight)) {
          highestYInThisSegment = Math.max(highestYInThisSegment, fruit.y + fruit.radius);
        }
      }
      
      if (highestYInThisSegment < minHighestYInColumn) {
        minHighestYInColumn = highestYInThisSegment;
        bestX = candidateX;
      } else if (highestYInThisSegment === minHighestYInColumn) {
        if (Math.abs(candidateX) < Math.abs(bestX)) {
          bestX = candidateX;
        }
      }
    }
    
    const finalClampedX = Math.max(-GAME_CONFIG.containerWidth / 2 + currentRadius + 0.01, Math.min(GAME_CONFIG.containerWidth / 2 - currentRadius - 0.01, bestX));
    return finalClampedX;

  }, [currentDroppableFruitDef]);

  useEffect(() => {
    if (isAutoplayActive && !isLoading && !isGameOver && !triggerDrop && gameCanvasRef.current && currentDroppableFruitDef) {
      if (autoplayTimeoutRef.current) clearTimeout(autoplayTimeoutRef.current);

      autoplayTimeoutRef.current = window.setTimeout(() => {
        const bestX = calculateBestDropPosition();
        setDropPositionX(bestX);
        
        const innerTimeoutId = setTimeout(() => { 
            if (isAutoplayActive && !isGameOver && !isLoading && !triggerDrop && !isDropCooldownActive) { 
                 setIsDropCooldownActive(true);
                 startCooldownVisualizer();
                 setTriggerDrop(true);
                 if (dropCooldownTimeoutRef.current) clearTimeout(dropCooldownTimeoutRef.current);
                 dropCooldownTimeoutRef.current = window.setTimeout(() => {
                    setIsDropCooldownActive(false);
                 }, DROP_COOLDOWN_MS);
            }
        }, 150); 
      }, AUTOPLAY_DROP_DELAY);
    }
    
    return () => { 
      if (autoplayTimeoutRef.current) {
        clearTimeout(autoplayTimeoutRef.current);
        autoplayTimeoutRef.current = null;
      }
    };
  }, [isAutoplayActive, isLoading, isGameOver, triggerDrop, calculateBestDropPosition, currentDroppableFruitDef, isDropCooldownActive, startCooldownVisualizer]);


  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (isAutoplayActive || !gameAreaRef.current || isGameOver || isLoading) return;
    const rect = gameAreaRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const relativeX = (x / rect.width - 0.5) * GAME_CONFIG.containerWidth;
    
    if (!currentDroppableFruitDef) return;

    const clampedX = Math.max(
        -GAME_CONFIG.containerWidth / 2 + currentDroppableFruitDef.radius,
        Math.min(GAME_CONFIG.containerWidth / 2 - currentDroppableFruitDef.radius, relativeX)
    );
    setDropPositionX(clampedX);
  };
  
  const handleClickToDrop = () => {
    if (isAutoplayActive || isGameOver || isLoading || triggerDrop || isDropCooldownActive) {
      return;
    }
    setIsDropCooldownActive(true);
    startCooldownVisualizer();
    setTriggerDrop(true);

    if (dropCooldownTimeoutRef.current) clearTimeout(dropCooldownTimeoutRef.current);
    dropCooldownTimeoutRef.current = window.setTimeout(() => {
        setIsDropCooldownActive(false);
    }, DROP_COOLDOWN_MS);
  };

  const nextFruitDefForPreview: FruitDefinition | null = FRUIT_DATA[nextFruitTypeForPreview] || null;
  
  const gameAreaCursor = isLoading || isGameOver ? 'default' : (isAutoplayActive ? 'default' : 'none');

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-100 text-gray-800 select-none overflow-hidden">
      <div className="flex-grow w-full flex flex-col items-center justify-center relative">
        <UIControls
          score={score}
          highScore={highScore}
          nextFruit={nextFruitDefForPreview}
          isGameOver={isGameOver}
          onRestart={handleRestart}
          isLoading={isLoading}
          isAutoplayActive={isAutoplayActive}
          onToggleAutoplay={handleToggleAutoplay}
          mergeCount={mergeCount}
          fruitsDroppedCount={fruitsDroppedCount}
          largestFruitAchieved={largestFruitAchieved}
          playTime={playTime}
          firstAchievedFruitTimes={firstAchievedFruitTimes}
          finalFruitCounts={finalFruitCounts}
          currentComboCount={currentComboCount}
          isDropCooldownActive={isDropCooldownActive}
          dropCooldownProgress={dropCooldownProgress}
          isHelpVisible={isHelpVisible} 
          onToggleHelp={toggleHelpVisibility} 
        />
        {isHelpVisible && <HelpUI onClose={toggleHelpVisibility} />}
        <div 
          ref={gameAreaRef}
          className="relative w-full max-w-lg bg-white shadow-2xl overflow-hidden mt-40 md:mt-36 border border-gray-300 rounded-md aspect-[3/4]"
          style={{ cursor: gameAreaCursor }} 
          onMouseMove={handleMouseMove}
          onClick={handleClickToDrop}
          onMouseLeave={() => { if(!isLoading && !isGameOver && !isAutoplayActive && currentDroppableFruitDef) setDropPositionX(0); }}
          aria-label="게임 영역"
          role="application"
        >
          {!isLoading && !isGameOver && currentDroppableFruitDef && gameAreaRef.current && (
              <div style={{
                  position: 'absolute',
                  left: `calc(50% + ${(dropPositionX / GAME_CONFIG.containerWidth) * 100}%)`,
                  transform: 'translateX(-50%)',
                  top: `${((GAME_CONFIG.containerHeight - GAME_CONFIG.dropHeight) / GAME_CONFIG.containerHeight) * 100}%`,
                  width: `${currentDroppableFruitDef.radius * 2 * (gameAreaRef.current.clientWidth / GAME_CONFIG.containerWidth)}px`,
                  height: `${currentDroppableFruitDef.radius * 2 * (gameAreaRef.current.clientWidth / GAME_CONFIG.containerWidth)}px`,
                  backgroundColor: typeof currentDroppableFruitDef.color === 'string' 
                      ? currentDroppableFruitDef.color 
                      : `#${currentDroppableFruitDef.color.toString(16).padStart(6, '0')}`,
                  borderRadius: currentDroppableFruitDef.type === FruitType.BOMB || currentDroppableFruitDef.type === FruitType.RAINBOW ? '0%' : '50%', 
                  opacity: 0.3,
                  pointerEvents: 'none',
                  zIndex: 4, 
              }} aria-hidden="true"></div>
          )}

          <GameCanvas
            key={gameKey}
            ref={gameCanvasRef}
            onScoreUpdate={handleScoreUpdate}
            onGameOver={handleGameOver}
            onReady={handleGameReady}
            isGameOver={isGameOver}
            nextFruitTypeToDrop={currentFruitTypeToDrop}
            triggerDrop={triggerDrop}
            dropPositionX={dropPositionX}
            onFruitDropped={handleFruitDropped}
          />
        </div>
      </div>
      <div className="p-3 bg-gray-200 rounded-lg shadow-md max-w-lg w-full text-center mb-4 mx-auto">
        {!isAutoplayActive && <p className="text-sm text-gray-700">마우스를 움직여 위치를 정하고, 클릭해서 과일을 떨어뜨리세요.</p>}
        {isAutoplayActive && <p className="text-sm text-blue-600 font-semibold">자동 진행 중입니다...</p>}
        <p className="text-xs text-gray-500 mt-1">같은 과일 두 개를 합치면 더 큰 과일이 됩니다! (주황색 큐브는 업그레이드!)</p>
      </div>
    </div>
  );
};

export default App;
