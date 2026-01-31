// 해피니언 아카데미 TypeScript 타입 정의

export type UserRole = 'admin' | 'student';
export type UserStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
export type DurationType = '6m' | '12m';
export type Visibility = 'public' | 'group' | 'user';
export type Eligibility = 'eligible' | 'not_eligible';

// Profile 타입
export interface Profile {
  user_id: string;
  name: string;
  phone: string | null;
  email: string;
  region: string | null;
  level: string | null;
  role: UserRole;
  status: UserStatus;
  referrer: string | null;
  created_at: string;
  updated_at: string;
}

// Course 타입
export interface Course {
  id: string;
  title: string;
  duration_type: DurationType;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Session 타입 (강의 일정)
export type SessionInstructorItem = {
  user_id: string;
  name: string | null;
  role?: 'main' | 'sub' | null;
  sort_order?: number | null;
};

export interface Session {
  id: string;
  course_id: string | null;
  region: string;
  level: string;
  session_no: number;
  title: string;

  instructor: string | null; // (호환용 유지해도 됨)
  instructors?: SessionInstructorItem[]; // ✅ 이 줄 추가

  start_at: string;
  end_at: string;
  materials: string[];
  notes: string | null;
  visibility: 'public' | 'group';
  created_at: string;
  updated_at: string;
  course?: Course;
}

// Favorite 타입 (즐겨찾기)
export interface NotifyRules {
  d7: boolean;
  d1: boolean;
  materials: boolean;
  instructor: boolean;
}

export interface Favorite {
  id: string;
  user_id: string;
  region: string;
  level: string;
  notify_enabled: boolean;
  notify_rules: NotifyRules;
  created_at: string;
  is_favorite: boolean;
}

// Attendance Record 타입
export interface AttendanceRecord {
  id: string;
  user_id: string;
  session_id: string;
  attended: boolean;
  homework_submitted: boolean;
  checked_at: string | null;
  checked_by: string | null;
  created_at: string;
  updated_at: string;
  session?: Session;
}

// Eligibility Status 타입
export interface EligibilityStatus {
  user_id: string;
  region: string;
  level: string;
  absent_count: number;
  homework_missing_count: number;
  eligibility: Eligibility;
  reason: string | null;
  updated_at: string;
}

// Video 타입
export interface Video {
  id: string;
  title: string;
  description: string | null;
  url: string;
  thumbnail_url: string | null;
  duration_sec: number | null;
  visibility: Visibility;
  region: string | null;
  level: string | null;
  allowed_user_ids: string[];
  created_at: string;
  updated_at: string;
}

// Video Progress 타입
export interface VideoProgress {
  id: string;
  user_id: string;
  video_id: string;
  progress_percent: number;
  last_position_sec: number;
  updated_at: string;
  video?: Video;
}

// Payment 타입
export interface Payment {
  id: string;
  user_id: string;
  month: string;
  amount: number;
  paid: boolean;
  paid_at: string | null;
  memo: string | null;
  created_at: string;
  updated_at: string;
}

// Webhook Log 타입
export interface WebhookLog {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  status: string;
  error_message: string | null;
  created_at: string;
}

// API Request/Response 타입
export interface SyncSessionsPayload {
  sessions: Array<{
    course_title: string;
    duration_type: DurationType;
    region: string;
    level: string;
    session_no: number;
    title: string;

    instructors?: Array<{
      user_id: string;
      role?: 'main' | 'sub';
      sort_order?: number;
    }>;

    start_at: string;
    end_at: string;
    materials_json: string;
    notes: string;
    visibility?: 'public' | 'group';
  }>;
}

export interface SyncPaymentsPayload {
  payments: Array<{
    user_email: string;
    month: string;
    amount: number;
    paid: boolean;
    paid_at?: string;
    memo?: string;
  }>;
}

export interface ApproveUserPayload {
  user_id: string;
  action: 'approve' | 'reject' | 'suspend' | 'reactivate';
  reason?: string;
}

export interface NotifyLogPayload {
  event_type: 'alimtalk_sent' | 'alimtalk_failed' | 'reminder_sent';
  recipients: string[];
  session_id?: string;
  message_type?: 'd7' | 'd1' | 'materials' | 'instructor';
  status: 'success' | 'failed';
  error?: string;
}

// UI 표시용 확장 타입
export interface SessionWithCourse extends Session {
  role?: 'main' | 'sub';
}

export interface AttendanceWithSession extends AttendanceRecord {
  session: Session;
}

export interface VideoWithProgress extends Video {
  progress?: VideoProgress;
}

// 필터 타입
export interface SessionFilter {
  region?: string;
  level?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

// 지역/레벨 상수
export const REGIONS = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'] as const;
export const LEVELS = ['초급', '중급', '고급'] as const;

export type Region = typeof REGIONS[number];
export type Level = typeof LEVELS[number];
