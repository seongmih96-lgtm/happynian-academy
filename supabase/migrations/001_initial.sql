-- ============================================
-- 해피니언 아카데미 데이터베이스 스키마
-- Supabase PostgreSQL + RLS
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. PROFILES (사용자 프로필)
-- ============================================
CREATE TABLE profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT NOT NULL,
  region TEXT,
  level TEXT,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('admin', 'student')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
  referrer TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Profiles RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 본인 프로필은 항상 조회 가능
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = user_id);

-- 본인 프로필 수정 가능 (role, status 제외)
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 관리자는 모든 프로필 조회 가능
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- 관리자는 모든 프로필 수정 가능
CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- 새 프로필 삽입 (회원가입 시)
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 2. COURSES (과정/트랙)
-- ============================================
CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  duration_type TEXT NOT NULL CHECK (duration_type IN ('6m', '12m')),
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Courses RLS
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

-- 승인된 사용자만 조회 가능
CREATE POLICY "Approved users can view courses"
  ON courses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND (profiles.status = 'approved' OR profiles.role = 'admin')
    )
  );

-- 관리자만 수정 가능
CREATE POLICY "Admins can manage courses"
  ON courses FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- ============================================
-- 3. SESSIONS (회차/강의 일정)
-- ============================================
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  region TEXT NOT NULL,
  level TEXT NOT NULL,
  session_no INTEGER NOT NULL,
  title TEXT NOT NULL,
  instructor TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  materials JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'group')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sessions 인덱스
CREATE INDEX idx_sessions_start_at ON sessions(start_at);
CREATE INDEX idx_sessions_region_level ON sessions(region, level);

-- Sessions RLS
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- 승인된 사용자만 조회 가능
CREATE POLICY "Approved users can view public sessions"
  ON sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND (profiles.status = 'approved' OR profiles.role = 'admin')
    )
    AND (
      visibility = 'public'
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'
      )
    )
  );

-- 관리자만 수정 가능
CREATE POLICY "Admins can manage sessions"
  ON sessions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- ============================================
-- 4. FAVORITES (즐겨찾기)
-- ============================================
CREATE TABLE favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  region TEXT NOT NULL,
  level TEXT NOT NULL,
  notify_enabled BOOLEAN NOT NULL DEFAULT false,
  notify_rules JSONB DEFAULT '{"d7": true, "d1": true, "materials": true, "instructor": true}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, region, level)
);

-- Favorites 인덱스
CREATE INDEX idx_favorites_user_id ON favorites(user_id);
CREATE INDEX idx_favorites_notify ON favorites(notify_enabled) WHERE notify_enabled = true;

-- Favorites RLS
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

-- 본인 즐겨찾기만 조회/수정/삭제 가능
CREATE POLICY "Users can manage own favorites"
  ON favorites FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 관리자는 모든 즐겨찾기 조회 가능 (알림 발송용)
CREATE POLICY "Admins can view all favorites"
  ON favorites FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- ============================================
-- 5. ATTENDANCE_RECORDS (출석/과제 기록)
-- ============================================
CREATE TABLE attendance_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  attended BOOLEAN NOT NULL DEFAULT false,
  homework_submitted BOOLEAN NOT NULL DEFAULT false,
  checked_at TIMESTAMPTZ,
  checked_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, session_id)
);

-- Attendance 인덱스
CREATE INDEX idx_attendance_user_id ON attendance_records(user_id);
CREATE INDEX idx_attendance_session_id ON attendance_records(session_id);

-- Attendance RLS
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

-- 본인 출석 기록 조회 가능
CREATE POLICY "Users can view own attendance"
  ON attendance_records FOR SELECT
  USING (auth.uid() = user_id);

-- 관리자만 출석 기록 관리 가능
CREATE POLICY "Admins can manage attendance"
  ON attendance_records FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- ============================================
-- 6. ELIGIBILITY_STATUS (자격 상태 캐시)
-- ============================================
CREATE TABLE eligibility_status (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  region TEXT NOT NULL,
  level TEXT NOT NULL,
  absent_count INTEGER NOT NULL DEFAULT 0,
  homework_missing_count INTEGER NOT NULL DEFAULT 0,
  eligibility TEXT NOT NULL DEFAULT 'eligible' CHECK (eligibility IN ('eligible', 'not_eligible')),
  reason TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Eligibility RLS
ALTER TABLE eligibility_status ENABLE ROW LEVEL SECURITY;

-- 본인 자격 상태 조회 가능
CREATE POLICY "Users can view own eligibility"
  ON eligibility_status FOR SELECT
  USING (auth.uid() = user_id);

-- 관리자는 모든 자격 상태 조회/수정 가능
CREATE POLICY "Admins can manage eligibility"
  ON eligibility_status FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- ============================================
-- 7. VIDEOS (영상 콘텐츠)
-- ============================================
CREATE TABLE videos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  duration_sec INTEGER,
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'group', 'user')),
  region TEXT,
  level TEXT,
  allowed_user_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Videos 인덱스
CREATE INDEX idx_videos_visibility ON videos(visibility);
CREATE INDEX idx_videos_region_level ON videos(region, level);

-- Videos RLS
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

-- 복잡한 권한 체크: public OR group(지역/레벨 일치) OR user(ID 포함)
CREATE POLICY "Users can view authorized videos"
  ON videos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
      AND (p.status = 'approved' OR p.role = 'admin')
    )
    AND (
      visibility = 'public'
      OR (visibility = 'group' AND EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.user_id = auth.uid()
        AND (p.region = videos.region OR videos.region IS NULL)
        AND (p.level = videos.level OR videos.level IS NULL)
      ))
      OR (visibility = 'user' AND auth.uid() = ANY(allowed_user_ids))
      OR EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.user_id = auth.uid() AND p.role = 'admin'
      )
    )
  );

-- 관리자만 영상 관리 가능
CREATE POLICY "Admins can manage videos"
  ON videos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- ============================================
-- 8. VIDEO_PROGRESS (영상 시청 진행률)
-- ============================================
CREATE TABLE video_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  progress_percent INTEGER NOT NULL DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  last_position_sec INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, video_id)
);

-- Video Progress 인덱스
CREATE INDEX idx_video_progress_user_id ON video_progress(user_id);

-- Video Progress RLS
ALTER TABLE video_progress ENABLE ROW LEVEL SECURITY;

-- 본인 진행률만 조회/수정 가능
CREATE POLICY "Users can manage own video progress"
  ON video_progress FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 9. PAYMENTS (수강료 납부 기록)
-- ============================================
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month TEXT NOT NULL, -- YYYY-MM 형식
  amount INTEGER NOT NULL DEFAULT 0,
  paid BOOLEAN NOT NULL DEFAULT false,
  paid_at TIMESTAMPTZ,
  memo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, month)
);

-- Payments 인덱스
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_month ON payments(month);

-- Payments RLS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- 본인 납부 기록 조회 가능
CREATE POLICY "Users can view own payments"
  ON payments FOR SELECT
  USING (auth.uid() = user_id);

-- 관리자만 납부 기록 관리 가능
CREATE POLICY "Admins can manage payments"
  ON payments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- ============================================
-- 10. WEBHOOK_LOGS (n8n 호출 로그)
-- ============================================
CREATE TABLE webhook_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type TEXT NOT NULL,
  payload JSONB,
  status TEXT DEFAULT 'success',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Webhook Logs 인덱스
CREATE INDEX idx_webhook_logs_event_type ON webhook_logs(event_type);
CREATE INDEX idx_webhook_logs_created_at ON webhook_logs(created_at DESC);

-- Webhook Logs RLS
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

-- 관리자만 로그 조회 가능
CREATE POLICY "Admins can view webhook logs"
  ON webhook_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- ============================================
-- TRIGGERS: updated_at 자동 갱신
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER courses_updated_at
  BEFORE UPDATE ON courses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER sessions_updated_at
  BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER attendance_records_updated_at
  BEFORE UPDATE ON attendance_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER eligibility_status_updated_at
  BEFORE UPDATE ON eligibility_status
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER videos_updated_at
  BEFORE UPDATE ON videos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER video_progress_updated_at
  BEFORE UPDATE ON video_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- FUNCTION: 회원가입 시 profiles 자동 생성
-- ============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  auto_mode TEXT;
  should_auto_approve BOOLEAN := false;
  new_status TEXT := 'pending';
BEGIN
  -- 환경변수 또는 설정에서 자동 승인 모드 확인
  auto_mode := COALESCE(current_setting('app.auto_approve_mode', true), 'conditional');
  
  -- 추천인에 '해피니언' 포함 여부 확인
  IF auto_mode = 'always' OR 
     (auto_mode = 'conditional' AND 
      NEW.raw_user_meta_data->>'referrer' ILIKE '%해피니언%') THEN
    new_status := 'approved';
  END IF;
  
  INSERT INTO public.profiles (user_id, email, name, phone, region, level, referrer, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'region', ''),
    COALESCE(NEW.raw_user_meta_data->>'level', ''),
    COALESCE(NEW.raw_user_meta_data->>'referrer', ''),
    new_status
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 기존 트리거 삭제 후 재생성
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- FUNCTION: 자격 상태 계산 및 갱신
-- ============================================
CREATE OR REPLACE FUNCTION calculate_eligibility(p_user_id UUID)
RETURNS void AS $$
DECLARE
  v_absent_count INTEGER;
  v_homework_missing INTEGER;
  v_region TEXT;
  v_level TEXT;
  v_eligibility TEXT := 'eligible';
  v_reason TEXT;
  -- 자격 기준 (상수)
  c_max_absences INTEGER := 2;
  c_max_homework_missing INTEGER := 2;
BEGIN
  -- 사용자의 지역/레벨 조회
  SELECT region, level INTO v_region, v_level
  FROM profiles
  WHERE user_id = p_user_id;
  
  -- 미출석 횟수 계산
  SELECT COUNT(*) INTO v_absent_count
  FROM attendance_records ar
  JOIN sessions s ON ar.session_id = s.id
  WHERE ar.user_id = p_user_id
    AND ar.attended = false
    AND s.region = v_region
    AND s.level = v_level;
  
  -- 과제 미제출 횟수 계산
  SELECT COUNT(*) INTO v_homework_missing
  FROM attendance_records ar
  JOIN sessions s ON ar.session_id = s.id
  WHERE ar.user_id = p_user_id
    AND ar.homework_submitted = false
    AND s.region = v_region
    AND s.level = v_level;
  
  -- 자격 판단
  IF v_absent_count >= c_max_absences THEN
    v_eligibility := 'not_eligible';
    v_reason := '미출석 ' || v_absent_count || '회 초과';
  ELSIF v_homework_missing >= c_max_homework_missing THEN
    v_eligibility := 'not_eligible';
    v_reason := '과제 미제출 ' || v_homework_missing || '회 초과';
  END IF;
  
  -- Upsert eligibility_status
  INSERT INTO eligibility_status (user_id, region, level, absent_count, homework_missing_count, eligibility, reason)
  VALUES (p_user_id, v_region, v_level, v_absent_count, v_homework_missing, v_eligibility, v_reason)
  ON CONFLICT (user_id)
  DO UPDATE SET
    region = EXCLUDED.region,
    level = EXCLUDED.level,
    absent_count = EXCLUDED.absent_count,
    homework_missing_count = EXCLUDED.homework_missing_count,
    eligibility = EXCLUDED.eligibility,
    reason = EXCLUDED.reason,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- TRIGGER: 출석 기록 변경 시 자격 자동 계산
-- ============================================
CREATE OR REPLACE FUNCTION trigger_calculate_eligibility()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM calculate_eligibility(NEW.user_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER attendance_eligibility_trigger
  AFTER INSERT OR UPDATE ON attendance_records
  FOR EACH ROW EXECUTE FUNCTION trigger_calculate_eligibility();
