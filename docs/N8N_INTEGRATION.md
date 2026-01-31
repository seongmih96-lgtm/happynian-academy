# n8n 연동 가이드

해피니언 아카데미 웹앱과 n8n을 연동하기 위한 상세 가이드입니다.

## 목차
- [사전 준비](#사전-준비)
- [웹훅 보안 설정](#웹훅-보안-설정)
- [시나리오 1: 강의 일정 동기화](#시나리오-1-강의-일정-동기화)
- [시나리오 2: 알림 발송](#시나리오-2-알림-발송)
- [시나리오 3: 납부 기록 동기화](#시나리오-3-납부-기록-동기화)
- [트러블슈팅](#트러블슈팅)

---

## 사전 준비

### 1. n8n 환경 변수 설정
n8n 인스턴스에 다음 환경 변수를 설정합니다:

```bash
# n8n credentials 또는 환경 변수
WEBHOOK_SECRET=your-super-secret-webhook-key-min-32-characters
WEBAPP_URL=https://your-app.vercel.app
```

### 2. 구글 시트 준비

#### 강의 일정 시트 (Sessions)
| course_title | duration_type | region | level | session_no | title | instructor | start_at | end_at | materials_json | notes | visibility |
|--------------|---------------|--------|-------|------------|-------|------------|----------|--------|----------------|-------|------------|
| 6개월 기본과정 | 6m | 서울 | 초급 | 1 | 오리엔테이션 | 김해피 강사 | 2025-01-20 14:00:00 | 2025-01-20 17:00:00 | ["필기도구","노트"] | 편한 복장 | public |

#### 납부 기록 시트 (Payments)
| user_email | month | amount | paid | paid_at | memo |
|------------|-------|--------|------|---------|------|
| user@email.com | 2025-01 | 150000 | TRUE | 2025-01-15 | 계좌이체 |

---

## 웹훅 보안 설정

모든 웹훅 요청에는 HMAC-SHA256 서명 또는 Bearer 토큰이 필요합니다.

### 방법 1: HMAC 서명 (권장)

n8n Code 노드에서 서명 생성:

```javascript
const crypto = require('crypto');

// 이전 노드에서 받은 데이터
const payload = JSON.stringify($input.all()[0].json);

// HMAC 서명 생성
const signature = crypto
  .createHmac('sha256', $env.WEBHOOK_SECRET)
  .update(payload)
  .digest('hex');

return {
  json: {
    payload: JSON.parse(payload),
    headers: {
      'X-Webhook-Signature': signature
    }
  }
};
```

HTTP Request 노드에서 헤더 설정:
- Header: `X-Webhook-Signature`
- Value: `{{ $json.headers['X-Webhook-Signature'] }}`

### 방법 2: Bearer 토큰 (간단)

HTTP Request 노드에서:
- Authentication: None
- Header: `Authorization`
- Value: `Bearer {{ $env.WEBHOOK_SECRET }}`

---

## 시나리오 1: 강의 일정 동기화

구글 시트에서 강의 일정을 읽어 웹앱 DB에 동기화합니다.

### 워크플로우 구성

```
[Schedule Trigger] → [Google Sheets: Read] → [Code: Transform] → [HTTP Request: Sync]
```

### 1. Schedule Trigger
- **Cron Expression**: `*/30 * * * *` (30분마다)
- 또는: `0 * * * *` (매시간)

### 2. Google Sheets: Read
- **Operation**: Read Rows
- **Document**: 강의 일정 시트
- **Sheet**: Sessions
- **Options**: Read all rows

### 3. Code 노드 (데이터 변환)

```javascript
const sessions = $input.all().map(item => ({
  course_title: item.json.course_title,
  duration_type: item.json.duration_type,
  region: item.json.region,
  level: item.json.level,
  session_no: parseInt(item.json.session_no),
  title: item.json.title,
  instructor: item.json.instructor || '',
  start_at: new Date(item.json.start_at).toISOString(),
  end_at: new Date(item.json.end_at).toISOString(),
  materials_json: item.json.materials_json || '[]',
  notes: item.json.notes || '',
  visibility: item.json.visibility || 'public'
}));

return {
  json: { sessions }
};
```

### 4. HTTP Request (API 호출)
- **Method**: POST
- **URL**: `{{ $env.WEBAPP_URL }}/api/webhooks/sync-sessions`
- **Authentication**: None (서명 사용)
- **Headers**:
  - `Content-Type`: `application/json`
  - `Authorization`: `Bearer {{ $env.WEBHOOK_SECRET }}`
- **Body**: `{{ JSON.stringify($json) }}`

---

## 시나리오 2: 알림 발송

D-7, D-1 알림을 카카오 알림톡으로 발송합니다.

### 워크플로우 구성

```
[Schedule Trigger] → [Supabase: Query Favorites] → [Supabase: Query Sessions] 
    → [IF: Has Targets] → [Code: Build Messages] → [KakaoTalk API] → [HTTP: Log]
```

### 1. Schedule Trigger
- **Cron Expression**: `0 9 * * *` (매일 오전 9시 KST)

### 2. Supabase: Query (알림 대상자 조회)

```sql
SELECT 
  f.user_id, f.region, f.level, f.notify_rules,
  p.name, p.phone, p.email
FROM favorites f
JOIN profiles p ON f.user_id = p.user_id
WHERE f.notify_enabled = true
  AND p.status = 'approved'
  AND p.phone IS NOT NULL
```

### 3. Supabase: Query (D-7, D-1 세션 조회)

```sql
SELECT *
FROM sessions
WHERE 
  DATE(start_at) = CURRENT_DATE + INTERVAL '7 days'
  OR DATE(start_at) = CURRENT_DATE + INTERVAL '1 day'
```

### 4. Code 노드 (메시지 생성)

```javascript
const favorites = $('Supabase: Query Favorites').all();
const sessions = $('Supabase: Query Sessions').all();
const today = new Date();

const messages = [];

for (const session of sessions) {
  const sessionDate = new Date(session.json.start_at);
  const daysUntil = Math.ceil((sessionDate - today) / (1000 * 60 * 60 * 24));
  const messageType = daysUntil === 7 ? 'd7' : 'd1';
  
  // 해당 지역/레벨의 즐겨찾기 사용자 찾기
  const targets = favorites.filter(f => 
    f.json.region === session.json.region &&
    f.json.level === session.json.level &&
    f.json.notify_rules[messageType] === true
  );
  
  for (const target of targets) {
    messages.push({
      phone: target.json.phone,
      name: target.json.name,
      session_title: session.json.title,
      session_date: sessionDate.toLocaleDateString('ko-KR'),
      session_time: sessionDate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      instructor: session.json.instructor,
      materials: JSON.parse(session.json.materials || '[]').join(', '),
      days_until: daysUntil,
      message_type: messageType
    });
  }
}

return messages.map(m => ({ json: m }));
```

### 5. KakaoTalk 알림톡 API
(실제 API는 비즈니스 채널 설정에 따라 다름)

```javascript
// HTTP Request 노드 설정 예시
// URL: https://alimtalk-api.kakao.com/v2/send
// Method: POST
// Body: { templateCode: 'YOUR_TEMPLATE', ... }
```

### 6. HTTP Request: Log (발송 로그 기록)
- **URL**: `{{ $env.WEBAPP_URL }}/api/webhooks/notify-log`
- **Body**:
```json
{
  "event_type": "alimtalk_sent",
  "recipients": ["phone1", "phone2"],
  "session_id": "{{ $json.session_id }}",
  "message_type": "{{ $json.message_type }}",
  "status": "success"
}
```

---

## 시나리오 3: 납부 기록 동기화

### 워크플로우 구성

```
[Schedule Trigger] → [Google Sheets: Read] → [Code: Transform] → [HTTP Request: Sync]
```

### 1. Schedule Trigger
- **Cron Expression**: `0 0 * * *` (매일 자정)

### 2. Google Sheets: Read
- **Document**: 납부 기록 시트
- **Sheet**: Payments

### 3. Code 노드

```javascript
const payments = $input.all().map(item => ({
  user_email: item.json.user_email,
  month: item.json.month, // YYYY-MM 형식
  amount: parseInt(item.json.amount),
  paid: item.json.paid === 'TRUE' || item.json.paid === true,
  paid_at: item.json.paid_at || null,
  memo: item.json.memo || ''
}));

return {
  json: { payments }
};
```

### 4. HTTP Request
- **URL**: `{{ $env.WEBAPP_URL }}/api/webhooks/sync-payments`
- **Headers**: `Authorization: Bearer {{ $env.WEBHOOK_SECRET }}`

---

## 트러블슈팅

### 401 Unauthorized 오류
- `WEBHOOK_SECRET` 환경 변수가 올바르게 설정되었는지 확인
- 서명 계산 로직이 정확한지 확인
- Bearer 토큰 형식이 `Bearer <token>` 인지 확인

### 400 Bad Request 오류
- JSON 스키마가 올바른지 확인
- 필수 필드가 누락되지 않았는지 확인
- 날짜 형식이 ISO 8601인지 확인

### 세션 동기화가 안 되는 경우
- 구글 시트 컬럼명이 정확한지 확인
- `session_no`가 숫자인지 확인
- `start_at`, `end_at` 형식 확인

### 알림이 발송되지 않는 경우
- 사용자의 `notify_enabled`가 true인지 확인
- 사용자의 `status`가 'approved'인지 확인
- 즐겨찾기의 지역/레벨이 세션과 일치하는지 확인

---

## 유용한 n8n 표현식

```javascript
// 오늘 날짜 (KST)
{{ $now.setZone('Asia/Seoul').toFormat('yyyy-MM-dd') }}

// 7일 후 날짜
{{ $now.plus({ days: 7 }).toFormat('yyyy-MM-dd') }}

// JSON 파싱
{{ JSON.parse($json.materials_json) }}

// 조건부 값
{{ $json.paid ? '납부완료' : '미납' }}
```

---

## 참고 링크
- [n8n 공식 문서](https://docs.n8n.io/)
- [Supabase n8n 노드](https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-base.supabase/)
- [카카오 알림톡 API](https://developers.kakao.com/docs/latest/ko/message/rest-api)
