import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { verifyWebhookRequest } from '@/lib/auth/webhook-security';
import { z } from 'zod';

// 요청 스키마 정의
const PaymentSchema = z.object({
  user_email: z.string().email(),
  month: z.string().regex(/^\d{4}-\d{2}$/), // YYYY-MM 형식
  amount: z.number().min(0),
  paid: z.boolean(),
  paid_at: z.string().optional(),
  memo: z.string().optional().default(''),
});

const RequestSchema = z.object({
  payments: z.array(PaymentSchema),
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

    const { payments } = validationResult.data;
    const supabase = await createServiceClient();

    // 각 납부 기록 처리
    const results = {
      success: 0,
      failed: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (const payment of payments) {
      try {
        // 이메일로 사용자 찾기
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('user_id')
          .eq('email', payment.user_email)
          .single();

        if (profileError || !profile) {
          results.skipped++;
          results.errors.push(`User not found: ${payment.user_email}`);
          continue;
        }

        // 납부 기록 upsert (user_id + month로 고유 식별)
        const { error: paymentError } = await supabase
          .from('payments')
          .upsert(
            {
              user_id: profile.user_id,
              month: payment.month,
              amount: payment.amount,
              paid: payment.paid,
              paid_at: payment.paid && payment.paid_at ? payment.paid_at : null,
              memo: payment.memo,
            },
            {
              onConflict: 'user_id,month',
              ignoreDuplicates: false,
            }
          );

        if (paymentError) {
          throw new Error(`Failed to upsert payment: ${paymentError.message}`);
        }

        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push(
          `Payment ${payment.user_email}/${payment.month}: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        );
      }
    }

    // 웹훅 로그 기록
    await supabase.from('webhook_logs').insert({
      event_type: 'sync_payments',
      payload: {
        total: payments.length,
        ...results,
      },
      status: results.failed === 0 ? 'success' : 'partial',
      error_message: results.errors.length > 0 ? results.errors.join('; ') : null,
    });

    return NextResponse.json({
      message: 'Sync completed',
      results,
    });
  } catch (error) {
    console.error('Sync payments error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
