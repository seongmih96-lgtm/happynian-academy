-- ============================================
-- 해피니언 아카데미 더미 데이터
-- 테스트용 시드 데이터
-- ============================================

-- 과정(Courses) 데이터
INSERT INTO courses (id, title, duration_type, description, is_active) VALUES
  ('11111111-1111-1111-1111-111111111111', '6개월 기본과정', '6m', '해피니언 아카데미 6개월 기본 과정입니다. 자기이해와 관계맺기의 기초를 배웁니다.', true),
  ('22222222-2222-2222-2222-222222222222', '12개월 심화과정', '12m', '해피니언 아카데미 12개월 심화 과정입니다. 깊은 자기탐색과 리더십을 배웁니다.', true);

-- 세션(강의 일정) 데이터 - 서울/초급
INSERT INTO sessions (id, course_id, region, level, session_no, title, instructor, start_at, end_at, materials, notes, visibility) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', '서울', '초급', 1, '오리엔테이션 - 해피니언을 시작하며', '김해피 강사', '2025-01-20 14:00:00+09', '2025-01-20 17:00:00+09', '["필기도구", "개인 노트"]', '편한 복장으로 참석해주세요', 'public'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', '서울', '초급', 2, '자기소개와 관계맺기 기초', '이기쁨 강사', '2025-01-27 14:00:00+09', '2025-01-27 17:00:00+09', '["필기도구", "스마트폰(녹음용)"]', '자기소개 2분 준비해오세요', 'public'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', '서울', '초급', 3, '감정 인식과 표현', '박사랑 강사', '2025-02-03 14:00:00+09', '2025-02-03 17:00:00+09', '["필기도구", "색연필 12색"]', '', 'public'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', '서울', '초급', 4, '경청과 공감의 기술', '김해피 강사', '2025-02-10 14:00:00+09', '2025-02-10 17:00:00+09', '["필기도구"]', '', 'public');

-- 세션(강의 일정) 데이터 - 부산/초급
INSERT INTO sessions (id, course_id, region, level, session_no, title, instructor, start_at, end_at, materials, notes, visibility) VALUES
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111', '부산', '초급', 1, '오리엔테이션 - 해피니언을 시작하며', '최행복 강사', '2025-01-21 14:00:00+09', '2025-01-21 17:00:00+09', '["필기도구", "개인 노트"]', '편한 복장으로 참석해주세요', 'public'),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', '11111111-1111-1111-1111-111111111111', '부산', '초급', 2, '자기소개와 관계맺기 기초', '최행복 강사', '2025-01-28 14:00:00+09', '2025-01-28 17:00:00+09', '["필기도구", "스마트폰(녹음용)"]', '자기소개 2분 준비해오세요', 'public');

-- 세션(강의 일정) 데이터 - 서울/중급
INSERT INTO sessions (id, course_id, region, level, session_no, title, instructor, start_at, end_at, materials, notes, visibility) VALUES
  ('11111111-aaaa-aaaa-aaaa-111111111111', '22222222-2222-2222-2222-222222222222', '서울', '중급', 1, '심화과정 오리엔테이션', '김해피 강사', '2025-01-22 10:00:00+09', '2025-01-22 13:00:00+09', '["필기도구", "지난 기본과정 노트"]', '', 'public'),
  ('22222222-aaaa-aaaa-aaaa-222222222222', '22222222-2222-2222-2222-222222222222', '서울', '중급', 2, '리더십의 이해', '박사랑 강사', '2025-01-29 10:00:00+09', '2025-01-29 13:00:00+09', '["필기도구"]', '', 'public');

-- 비디오 데이터
INSERT INTO videos (id, title, description, url, duration_sec, visibility, region, level) VALUES
  ('vid11111-1111-1111-1111-111111111111', '해피니언 아카데미 소개', '해피니언 아카데미가 무엇인지 소개하는 영상입니다.', 'https://www.youtube.com/watch?v=example1', 300, 'public', NULL, NULL),
  ('vid22222-2222-2222-2222-222222222222', '기본과정 1회차 다시보기', '서울 초급 1회차 강의 녹화본입니다.', 'https://www.youtube.com/watch?v=example2', 10800, 'group', '서울', '초급'),
  ('vid33333-3333-3333-3333-333333333333', '기본과정 2회차 다시보기', '서울 초급 2회차 강의 녹화본입니다.', 'https://www.youtube.com/watch?v=example3', 10800, 'group', '서울', '초급'),
  ('vid44444-4444-4444-4444-444444444444', '심화과정 특별 강연', '심화과정 수강생을 위한 특별 강연입니다.', 'https://www.youtube.com/watch?v=example4', 7200, 'group', '서울', '중급');

-- ============================================
-- 테스트 사용자 생성 (Supabase Auth에서 별도 생성 필요)
-- 아래는 profiles 테이블에 직접 삽입하는 예시
-- 실제로는 Auth 회원가입 후 자동 생성됨
-- ============================================

-- 관리자 계정 (auth.users에 먼저 생성 필요)
-- INSERT INTO profiles (user_id, email, name, phone, region, level, role, status, referrer) VALUES
--   ('admin-uuid-here', 'admin@happynian.com', '관리자', '010-1234-5678', '서울', NULL, 'admin', 'approved', '해피니언 운영팀');

-- 일반 학생 계정 (auth.users에 먼저 생성 필요)
-- INSERT INTO profiles (user_id, email, name, phone, region, level, role, status, referrer) VALUES
--   ('student1-uuid', 'student1@example.com', '홍길동', '010-1111-2222', '서울', '초급', 'student', 'approved', '해피니언 지인 소개'),
--   ('student2-uuid', 'student2@example.com', '김철수', '010-3333-4444', '부산', '초급', 'student', 'pending', '네이버 검색');

-- ============================================
-- 관리자용 뷰 (통계 및 요약)
-- ============================================

-- 지역별/레벨별 세션 수
CREATE OR REPLACE VIEW session_summary AS
SELECT 
  region,
  level,
  COUNT(*) as total_sessions,
  COUNT(CASE WHEN start_at > NOW() THEN 1 END) as upcoming_sessions
FROM sessions
GROUP BY region, level
ORDER BY region, level;

-- 알림 대상자 목록 (n8n에서 조회용)
CREATE OR REPLACE VIEW notify_targets AS
SELECT 
  f.user_id,
  p.name,
  p.email,
  p.phone,
  f.region,
  f.level,
  f.notify_rules
FROM favorites f
JOIN profiles p ON f.user_id = p.user_id
WHERE f.notify_enabled = true
  AND p.status = 'approved';
