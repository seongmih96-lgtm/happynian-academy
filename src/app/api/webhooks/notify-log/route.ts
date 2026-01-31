import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { verifyWebhookRequest } from '@/lib/auth/webhook-security';
import { z } from 'zod';

// 요청 스키마 정의
const RequestSchema = z.object({
  event_type: z.enum(['alimtalk_sent', 'alimtalk_failed', 'reminder_sent']),
  recipients: z.array(z.string()),
  session_id: z.string().optional(),
  message_type: z.enum(['d7', 'd1', 'materials', 'instructor']).optional(),
  status: z.enum(['success', 'failed']),
  error: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // 요청 본문 읽기
    const body = await request.text();
    
    // 서명 검증
    const signature = request.headers.get('X-Webhook-Signature');
    const authHeader = request.headers.get('Authorization');
    
    const verification = verifyWebhookRequest(body, signature, authHeader);
    
    if (!verification.valid) {
      console.error('Webhook verification failed:', verification.method);
      return NextResponse.json(
        { error: 'Unauthorized', method: verification.method },
        { status: 401 }
      );
    }

    // JSON 파싱 및 유효성 검사
    const payload = JSON.parse(body);
    const validationResult = RequestSchema.safeParse(payload);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const logData = validationResult.data;
    const supabase = await createServiceClient();

    // 웹훅 로그 기록
    const { error } = await supabase.from('webhook_logs').insert({
      event_type: logData.event_type,
      payload: {
        recipients_count: logData.recipients.length,
        recipients: logData.recipients,
        session_id: logData.session_id,
        message_type: logData.message_type,
      },
      status: logData.status,
      error_message: logData.error || null,
    });

    if (error) {
      console.error('Failed to log notification:', error);
      return NextResponse.json(
        { error: 'Failed to log notification' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Log recorded',
      event_type: logData.event_type,
      recipients_count: logData.recipients.length,
    });
  } catch (error) {
    console.error('Notify log error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
