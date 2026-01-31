// 해피니언 아카데미 상수 및 설정

// 자격 기준 설정 (쉽게 변경 가능)
export const ELIGIBILITY_CONFIG = {
  // 최대 허용 미출석 횟수 (이 이상이면 not_eligible)
  MAX_ABSENCES: 2,
  // 최대 허용 과제 미제출 횟수 (이 이상이면 not_eligible)
  MAX_HOMEWORK_MISSING: 2,
};

// 알림 설정
export const NOTIFICATION_CONFIG = {
  // D-7 알림 (7일 전)
  D7_DAYS: 7,
  // D-1 알림 (1일 전)
  D1_DAYS: 1,
  // 알림 발송 시간 (KST)
  SEND_TIME_HOUR: 9,
  SEND_TIME_MINUTE: 0,
};

// 자동 승인 설정
export type AutoApproveMode = 'always' | 'conditional' | 'never';
export const AUTO_APPROVE_MODE: AutoApproveMode = 
  (process.env.AUTO_APPROVE_MODE as AutoApproveMode) || 'conditional';

// 자동 승인 조건 키워드
export const AUTO_APPROVE_KEYWORDS = ['해피니언'];

// 지역 목록
export const REGIONS = [
  '서울',
  '대구',
  '울산',
  '부산',
  '목포',
] as const;

// 레벨 목록
export const LEVELS = ['비기너/1LV', '러너/2LV', '챌린저/3LV', '위너//4LV'] as const;

// 과정 기간 타입
export const DURATION_TYPES = {
  '6m': '6개월',
  '12m': '12개월',
} as const;

// 사용자 상태 라벨
export const USER_STATUS_LABELS = {
  pending: '승인 대기',
  approved: '승인됨',
  rejected: '거절됨',
  suspended: '정지됨',
} as const;

// 사용자 역할 라벨
export const USER_ROLE_LABELS = {
  admin: '관리자',
  student: '수강생',
} as const;

// 영상 권한 라벨
export const VISIBILITY_LABELS = {
  public: '전체 공개',
  group: '그룹 제한',
  user: '개인 제한',
} as const;

// 요일 한글 매핑
export const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const;

// 앱 메타데이터
export const APP_METADATA = {
  name: '해피니언 아카데미',
  shortName: '해피니언',
  description: '해피니언 아카데미 강의 관리 시스템',
  version: '1.0.0',
};

// 페이지네이션 기본값
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
};

// API 응답 상태
export const API_STATUS = {
  SUCCESS: 'success',
  ERROR: 'error',
} as const;

// 캘린더 뷰 타입
export const CALENDAR_VIEW_TYPES = {
  WEEK: 'week',
  MONTH: 'month',
  LIST: 'list',
} as const;

// 응원 메시지 (출석/과제 미달 시)
export const ENCOURAGEMENT_MESSAGES = {
  ABSENCE: [
    '출석이 조금 부족해요. 다음 시간엔 꼭 만나요! 💪',
    '함께하는 시간이 그리워요. 다음 주엔 만날 수 있을까요? 🌟',
    '지금부터라도 출석하면 충분해요! 화이팅! ✨',
  ],
  HOMEWORK: [
    '과제가 밀렸네요. 조금씩이라도 해볼까요? 📝',
    '과제 마감이 다가와요. 지금 시작하면 할 수 있어요! 💪',
    '힘들면 간단하게라도 제출해봐요. 시작이 반이에요! 🌱',
  ],
  NOT_ELIGIBLE: [
    '아직 시험 응시 조건을 충족하지 못했어요. 담당 강사님께 상담해보세요.',
    '조건 미달이지만 포기하지 마세요. 앞으로의 출석과 과제로 만회할 수 있어요!',
  ],
} as const;

// 색상 팔레트 (지역별)
export const REGION_COLORS: Record<string, string> = {
  '서울': 'bg-violet-100 text-violet-700 border-violet-200',
  '대구': 'bg-blue-100 text-blue-700 border-blue-200',
  '울산': 'bg-red-100 text-red-700 border-red-200',
  '부산': 'bg-sky-100 text-sky-700 border-sky-200',
  '목포': 'bg-green-100 text-green-700 border-green-200',
};

// 레벨별 색상
export const LEVEL_COLORS: Record<string, string> = {
  '비기너/1LV': 'bg-green-100 text-green-700',
  '러너/2LV': 'bg-sky-100 text-sky-700',
  '챌린저/3LV': 'bg-purple-100 text-purple-700',
  '위너/4LV': 'bg-amber-100 text-amber-800',
};
