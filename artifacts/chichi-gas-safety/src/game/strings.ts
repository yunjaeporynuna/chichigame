/**
 * Every player-facing string lives here so the game can be re-skinned or
 * translated without touching game logic or UI components.
 */
export const STR = {
  title: '치치의 가스안전 대작전',
  subtitle: '집사가 없는 사이, 작은 턱시도 고양이의 60초',
  start: '시작하기',
  restart: '다시 하기',
  toTitle: '타이틀로',
  skip: 'SKIP',
  loading: '방을 정리하는 중...',
  loadError: '에셋을 불러오지 못했습니다. 새로고침해 주세요.',

  controlsDesktop: 'WASD / 방향키 이동 · E 또는 스페이스로 상호작용',
  controlsTouch: '왼쪽 화면을 밀어 이동 · 오른쪽 버튼으로 상호작용',

  hudTime: '남은 시간',
  hudScore: '점수',
  hudCombo: '콤보',
  hudBadge: '안전 배지',
  hudSticker: '발바닥 스티커',
  goldenTime: '골든타임',
  guardianBonus: '안전 지킴이 보너스 ×1.5',
  bestScore: '최고 점수',
  newBest: '신기록',

  interactHint: '상호작용',
  gasWarning: '가스 냄새가 난다',

  introCaption: [
    '집사가 캐리어를 끌고 문을 나선다.',
    '문이 닫히고, 치치는 어질러진 방을 둘러본다.',
    '주방 쪽에서 희미한 가스 냄새가 흘러나온다.',
    '치치의 눈빛이 진지해진다.',
  ],

  endingCaption: [
    '며칠 뒤, 문이 다시 열린다.',
    '방은 완벽하진 않지만 꽤 정돈되어 있다.',
    '가스 경보기에는 초록불이 들어와 있다.',
    '치치는 아무 일도 없었다는 듯 그루밍을 한다.',
  ],
  fin: 'FIN',
  finNote: '치치의 하루가 끝났습니다',

  resultTitle: '라운드 종료',
  resultEvents: '해결한 사건',
  resultBadges: '가스안전',
  resultCombo: '최고 콤보',
  resultTotal: '최종 점수',
  toEnding: '엔딩 보기',

  ranks: {
    guardian: {
      name: '완벽한 안전 지킴이',
      comment: '가스도, 방도, 집사의 마음도 모두 지켰다.',
    },
    brave: {
      name: '용감한 치치',
      comment: '위험을 먼저 알아본 고양이. 집사는 아직 모른다.',
    },
    tidy: {
      name: '부지런한 정리왕',
      comment: '방은 반짝반짝. 다음엔 주방도 살펴보자.',
    },
    curious: {
      name: '호기심 많은 고양이',
      comment: '오늘은 구경만. 내일은 더 잘할 수 있다.',
    },
  },

  settings: '설정',
  bgm: '배경음악',
  sfx: '효과음',
  on: '켜짐',
  off: '꺼짐',

  badgeGained: '안전 배지 획득',
  stickerGained: '발바닥 스티커',
  goldenStart: '골든타임 시작 · 점수 2배',
  guardianStart: '안전 지킴이 보너스 발동',
} as const;
