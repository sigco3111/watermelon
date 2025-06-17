
import React from 'react';

interface HelpUIProps {
  onClose: () => void;
}

const HelpUI: React.FC<HelpUIProps> = ({ onClose }) => {
  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-[100] p-4 pointer-events-auto"
      onClick={onClose} // Close on backdrop click
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-dialog-title"
    >
      <div 
        className="bg-white p-6 sm:p-8 rounded-lg shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto text-gray-800 relative"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside the panel
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-2xl text-gray-500 hover:text-gray-800 transition-colors"
          aria-label="도움말 닫기"
        >
          &times;
        </button>
        
        <h2 id="help-dialog-title" className="text-2xl sm:text-3xl font-bold mb-6 text-center text-blue-600">게임 도움말</h2>

        <div className="space-y-5 text-sm sm:text-base">
          <section aria-labelledby="help-goal-title">
            <h3 id="help-goal-title" className="text-lg sm:text-xl font-semibold mb-2 text-blue-500">🎯 게임 목표</h3>
            <p>같은 과일을 합쳐 더 큰 과일로 만드세요. 체리에서 시작하여 점점 더 큰 과일을 만들어 최종적으로 수박을 만드는 것이 목표입니다. 합칠 때마다 점수를 얻고, 가장 높은 점수에 도전하세요!</p>
          </section>

          <section aria-labelledby="help-how-to-play-title">
            <h3 id="help-how-to-play-title" className="text-lg sm:text-xl font-semibold mb-2 text-blue-500">🎮 게임 방법</h3>
            <ul className="list-disc list-inside space-y-1 pl-1">
              <li><strong>수동 조작:</strong> 마우스를 움직여 과일을 떨어뜨릴 위치를 정하고, 마우스 왼쪽 버튼을 클릭하여 과일을 떨어뜨립니다.</li>
              <li><strong>자동 진행:</strong> 화면 상단의 "자동 진행" 스위치를 켜면 AI가 자동으로 최적의 위치를 판단하여 과일을 떨어뜨립니다.</li>
              <li><strong>드롭 딜레이:</strong> 과일은 한 번에 하나씩, 1초의 대기 시간을 가지고 떨어뜨릴 수 있습니다. 다음 과일 표시기 아래에 있는 진행 바로 확인할 수 있습니다.</li>
            </ul>
          </section>

          <section aria-labelledby="help-merging-title">
            <h3 id="help-merging-title" className="text-lg sm:text-xl font-semibold mb-2 text-blue-500">🍇 과일 합치기</h3>
            <p>같은 종류의 과일 두 개가 만나면 다음 단계의 더 큰 과일로 합쳐집니다. (예: 체리 🍒 + 체리 🍒 = 딸기 🍓)</p>
            <p className="mt-1 text-xs sm:text-sm text-gray-600">
              순서: 체리 → 딸기 → 포도 → 데코폰 → 감 → 사과 → 배 → 복숭아 → 파인애플 → 멜론 → 수박
            </p>
          </section>

          <section aria-labelledby="help-special-fruits-title">
            <h3 id="help-special-fruits-title" className="text-lg sm:text-xl font-semibold mb-2 text-blue-500">✨ 특수 과일</h3>
            <ul className="list-disc list-inside space-y-1 pl-1">
              <li><strong>주황색 큐브:</strong> 어떤 일반 과일(검은색 큐브 제외)과도 합쳐져 해당 과일을 다음 단계로 업그레이드합니다.</li>
              <li><strong>검은색 큐브:</strong> 다른 과일과 부딪히면 터지면서 주변의 작은 과일들(데코폰 이하)을 최대 5개까지 제거합니다. 검은색 큐브끼리는 합쳐지지 않고 서로를 밀어냅니다.</li>
            </ul>
          </section>

          <section aria-labelledby="help-scoring-title">
            <h3 id="help-scoring-title" className="text-lg sm:text-xl font-semibold mb-2 text-blue-500">💯 점수</h3>
            <ul className="list-disc list-inside space-y-1 pl-1">
              <li>과일을 합칠 때마다 합쳐져서 새로 생긴 과일의 기본 점수를 얻습니다.</li>
              <li><strong>콤보 보너스:</strong> 짧은 시간 안에 연속으로 과일을 합치면 "콤보"가 발동되어 추가 보너스 점수를 얻습니다. (예: 2콤보 시 +5점, 3콤보 시 +10점 등)</li>
            </ul>
          </section>

          <section aria-labelledby="help-game-over-title">
            <h3 id="help-game-over-title" className="text-lg sm:text-xl font-semibold mb-2 text-blue-500">⚠️ 게임 오버</h3>
            <p>과일들이 화면 상단에 표시된 게임 오버 라인 (보이지 않는 선) 위로 쌓이고, 더 이상 움직이지 않으면 게임이 종료됩니다.</p>
          </section>

          <section aria-labelledby="help-tips-title">
            <h3 id="help-tips-title" className="text-lg sm:text-xl font-semibold mb-2 text-blue-500">💡 간단 팁</h3>
            <ul className="list-disc list-inside space-y-1 pl-1">
                <li>큰 과일은 아래쪽에, 작은 과일은 위쪽에 배치하여 안정적으로 쌓으세요.</li>
                <li>양쪽 벽 근처에 과일이 너무 높이 쌓이지 않도록 주의하세요.</li>
                <li>주황색 큐브와 검은색 큐브를 전략적으로 사용하여 위기를 탈출하거나 높은 점수를 노려보세요.</li>
            </ul>
        </section>
        </div>

        <button
          onClick={onClose}
          className="mt-8 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-50"
          aria-label="도움말 닫기"
        >
          닫기
        </button>
      </div>
    </div>
  );
};

export default HelpUI;
