
import React from 'react';
import { FruitType, FruitDefinition } from '../types';
import { FRUIT_DATA, COMBO_BASE_BONUS_POINTS } from '../constants'; 

// Helper function to format time from seconds to MM분 SS초
const formatTime = (totalSeconds: number): string => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}분 ${seconds.toString().padStart(2, '0')}초`;
};

const MAJOR_FRUITS_FOR_DISPLAY_ORDER: FruitType[] = [
  FruitType.PERSIMMON,
  FruitType.APPLE,
  FruitType.PEAR,
  FruitType.PEACH,
  FruitType.PINEAPPLE,
  FruitType.MELON,
  FruitType.WATERMELON,
];


interface UIControlsProps {
  score: number;
  highScore: number;
  nextFruit: FruitDefinition | null;
  isGameOver: boolean;
  onRestart: () => void;
  isLoading: boolean;
  isAutoplayActive: boolean;
  onToggleAutoplay: () => void;
  mergeCount: number;
  fruitsDroppedCount: number;
  largestFruitAchieved: FruitType | null;
  playTime: number; 
  firstAchievedFruitTimes: Record<FruitType, number | null>;
  finalFruitCounts: Record<string, number> | null;
  currentComboCount: number;
  isDropCooldownActive: boolean;
  dropCooldownProgress: number;
  isHelpVisible: boolean; // New
  onToggleHelp: () => void; // New
}

const NextFruitPreview: React.FC<{ fruit: FruitDefinition | null }> = ({ fruit }) => {
  if (!fruit) return <div className="w-16 h-16 bg-gray-300 rounded-full"></div>;

  const fruitStyle = {
    backgroundColor: typeof fruit.color === 'string' ? fruit.color : `#${fruit.color.toString(16).padStart(6, '0')}`,
    width: `${Math.max(1, fruit.radius * 2) * 16}px`, 
    height: `${Math.max(1, fruit.radius * 2) * 16}px`,
  };

  return (
    <div className="flex flex-col items-center">
      <span className="text-sm text-gray-600 mb-1">다음</span>
      <div 
        style={fruitStyle}
        className="rounded-full shadow-lg border-2 border-gray-400"
      ></div>
    </div>
  );
};

interface CooldownTimerProps {
  isActive: boolean;
  progress: number; // 0 to 1
}

const CooldownTimer: React.FC<CooldownTimerProps> = ({ isActive, progress }) => {
  if (!isActive) { 
    return null; 
  }

  return (
    <div className="w-full mt-1.5 mb-0.5 px-1">
      <div className="h-2 bg-slate-300 rounded-full overflow-hidden shadow-inner" aria-hidden="true">
        <div
          className="h-full bg-sky-500 rounded-full transition-width duration-[30ms] ease-linear"
          style={{ width: `${progress * 100}%` }}
        ></div>
      </div>
    </div>
  );
};


const UIControls: React.FC<UIControlsProps> = ({ 
  score, 
  highScore, 
  nextFruit, 
  isGameOver, 
  onRestart, 
  isLoading,
  isAutoplayActive,
  onToggleAutoplay,
  mergeCount,
  fruitsDroppedCount,
  largestFruitAchieved,
  playTime,
  firstAchievedFruitTimes,
  finalFruitCounts,
  currentComboCount,
  isDropCooldownActive,
  dropCooldownProgress,
  isHelpVisible,
  onToggleHelp,
}) => {

  const averageTimePerMerge = mergeCount > 0 ? (playTime / mergeCount).toFixed(1) : 'N/A';

  return (
    <div className="absolute top-0 left-0 right-0 p-4 flex flex-col items-center pointer-events-none text-gray-800 z-10">
      <div className="w-full max-w-md bg-white bg-opacity-80 backdrop-blur-sm p-4 rounded-lg shadow-xl flex justify-between items-start pointer-events-auto mb-4">
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-800">점수: {score}</h2>
          <p className="text-sm text-gray-600">최고 점수: {highScore}</p>
          <div className="mt-2">
            <label htmlFor="autoplayToggle" className="flex items-center cursor-pointer">
              <span className="mr-2 text-sm text-gray-700">자동 진행:</span>
              <div className="relative">
                <input 
                  type="checkbox" 
                  id="autoplayToggle" 
                  className="sr-only" 
                  checked={isAutoplayActive} 
                  onChange={onToggleAutoplay}
                  disabled={isGameOver || isLoading || isHelpVisible}
                />
                <div className={`block w-10 h-6 rounded-full transition-colors ${isAutoplayActive ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${isAutoplayActive ? 'translate-x-4' : ''}`}></div>
              </div>
            </label>
            {isAutoplayActive && !isGameOver && !isLoading && (
              <p className="text-xs text-blue-600 mt-1">자동 진행 활성화됨</p>
            )}
          </div>
        </div>
        <div className="flex items-start"> {/* Container for NextFruit, Cooldown and Help Button */}
          <div className="flex flex-col items-center w-20 mr-2"> {/* Wrapper for NextFruitPreview and CooldownTimer */}
            <NextFruitPreview fruit={nextFruit} />
            <CooldownTimer isActive={isDropCooldownActive} progress={dropCooldownProgress} />
          </div>
          <button
            onClick={onToggleHelp}
            className={`p-2 rounded-full hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 ${ (isLoading || isGameOver) ? 'opacity-50 cursor-not-allowed' : ''}`}
            aria-label="도움말 보기"
            title="도움말"
            disabled={isLoading || isGameOver}
          >
            <span className="text-xl" role="img" aria-label="도움말 아이콘">❓</span>
          </button>
        </div>
      </div>

      {/* Combo Display - Appears below the main score panel during active gameplay */}
      {!isLoading && !isGameOver && currentComboCount > 1 && (
        <div 
          key={currentComboCount} // Re-trigger animation on combo change
          className="mt-1 mb-2 px-5 py-2 sm:px-6 sm:py-3 bg-gradient-to-r from-orange-400 to-red-500 text-white text-lg sm:text-xl font-bold rounded-full shadow-lg animate-fadeInScaleUp pointer-events-auto"
          style={{ animationDuration: '0.3s' }} 
        >
          x{currentComboCount} COMBO! +{(currentComboCount - 1) * COMBO_BASE_BONUS_POINTS}점
        </div>
      )}

      {isLoading && (
         <div className="bg-indigo-500 text-white p-3 rounded-lg shadow-lg text-center font-semibold pointer-events-auto">
           물리 및 그래픽 로딩 중...
         </div>
      )}

      {isGameOver && (
        <div className="fixed inset-0 bg-white bg-opacity-95 flex flex-col justify-center items-center z-50 pointer-events-auto text-center p-4 overflow-y-auto">
          <h1 className="text-4xl sm:text-5xl font-bold mb-3 text-red-600">게임 오버!</h1>
          <p className="text-xl sm:text-2xl mb-1 text-gray-800">최종 점수: {score}</p>
          
          <div className="my-3 space-y-1 text-sm sm:text-lg text-gray-700 w-full max-w-md">
            <p>플레이 시간: {formatTime(playTime)}</p>
            <p>총 합체 횟수: {mergeCount}회</p>
            <p>평균 합체 시간: {averageTimePerMerge}초</p>
            <p>떨어뜨린 과일: {fruitsDroppedCount}개</p>
            <p className="flex items-center justify-center">
              <span className="mr-2">최대 달성 과일:</span>
              {largestFruitAchieved !== null && FRUIT_DATA[largestFruitAchieved] ? (
                <>
                  {FruitType[largestFruitAchieved]} 
                  <span style={{
                    display: 'inline-block',
                    width: '1.1em',
                    height: '1.1em',
                    borderRadius: '50%',
                    backgroundColor: typeof FRUIT_DATA[largestFruitAchieved].color === 'string'
                      ? FRUIT_DATA[largestFruitAchieved].color as string
                      : `#${(FRUIT_DATA[largestFruitAchieved].color as number).toString(16).padStart(6, '0')}`,
                    marginLeft: '0.5em',
                    border: '1px solid #ccc'
                  }}></span>
                </>
              ) : (
                '없음'
              )}
            </p>
          </div>

          <div className="my-3 w-full max-w-md">
            <h3 className="text-md sm:text-xl font-semibold mb-1 text-gray-800">주요 과일 첫 달성 시간:</h3>
            <ul className="list-disc list-inside text-left text-xs sm:text-base text-gray-600 bg-gray-50 p-2 rounded max-h-32 overflow-y-auto">
              {MAJOR_FRUITS_FOR_DISPLAY_ORDER.map(fruitType => {
                const timeAchieved = firstAchievedFruitTimes[fruitType];
                if (timeAchieved !== null) {
                  return <li key={fruitType}>{FruitType[fruitType]}: {formatTime(timeAchieved)}</li>;
                }
                return <li key={fruitType} className="text-gray-400">{FruitType[fruitType]}: 달성 못함</li>;
              })}
            </ul>
          </div>
          
          <div className="my-3 w-full max-w-md">
            <h3 className="text-md sm:text-xl font-semibold mb-1 text-gray-800">게임 종료 시 과일 분포:</h3>
            {finalFruitCounts && Object.keys(finalFruitCounts).length > 0 ? (
              <ul className="list-disc list-inside text-left text-xs sm:text-base text-gray-600 bg-gray-50 p-2 rounded max-h-32 overflow-y-auto">
                {Object.entries(finalFruitCounts)
                  .sort(([, countA], [, countB]) => countB - countA) 
                  .map(([fruitName, count]) => (
                  <li key={fruitName}>{fruitName}: {count}개</li>
                ))}
              </ul>
            ) : (
              <p className="text-xs sm:text-base text-gray-500">남아있는 과일 없음</p>
            )}
          </div>


          {score > highScore && <p className="text-lg sm:text-xl text-green-600 my-2">신기록 달성!</p>}
          {!isGameOver && score === highScore && highScore > 0 && <p className="text-lg sm:text-xl text-blue-600 my-2">최고 점수 동률!</p>}

          <button
            onClick={onRestart}
            className="px-6 py-2 sm:px-8 sm:py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-lg sm:text-xl shadow-lg transition-transform transform hover:scale-105 mt-3"
            aria-label="게임 다시 시작"
          >
            게임 다시 시작
          </button>
        </div>
      )}
    </div>
  );
};

export default UIControls;
