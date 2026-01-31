import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { verifyWebhookRequest } from '@/lib/auth/webhook-security';
import { z } from 'zod';

// 요청 스키마 정의
const SessionSchema = z.object({
  course_title: z.string(),
  duration_type: z.enum(['6m', '12m']),
  region: z.string(),
  level: z.string(),
  session_no: z.number(),
  title: z.string(),
  instructor: z.string().optional().default(''),
  start_at: z.string(), // ISO 8601
  end_at: z.string(),
  materials_json: z.string().optional().default('[]'),
  notes: z.string().optional().default(''),
  visibility: z.enum(['public', 'group']).optional().default('public'),
});

const RequestSchema = z.object({
  sessions: z.array(SessionSchema),
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

    const { sessions } = validationResult.data;
    const supabase = await createServiceClient();

    // 각 세션을 upsert
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const session of sessions) {
      try {
        // 과정(course) 찾기 또는 생성
        let courseId: string | null = null;
        
        const { data: existingCourse } = await supabase
          .from('courses')
          .select('id')
          .eq('title', session.course_title)
          .eq('duration_type', session.duration_type)
          .single();

        if (existingCourse) {
          courseId = existingCourse.id;
        } else {
          const { data: newCourse, error: courseError } = await supabase
            .from('courses')
            .insert({
              title: session.course_title,
              duration_type: session.duration_type,
              is_active: true,
            })
            .select('id')
            .single();

          if (courseError) {
            throw new Error(`Failed to create course: ${courseError.message}`);
          }
          courseId = newCourse.id;
        }

        // 준비물 JSON 파싱
        let materials: string[] = [];
        try {
          materials = JSON.parse(session.materials_json);
        } catch {
          // 파싱 실패 시 빈 배열 사용
        }

        // 세션 upsert (region + level + session_no로 고유 식별)
        const { error: sessionError } = await supabase
          .from('sessions')
          .upsert(
            {
              course_id: courseId,
              region: session.region,
              level: session.level,
              session_no: session.session_no,
              title: session.title,
              instructor: session.instructor,
              start_at: session.start_at,
              end_at: session.end_at,
              materials,
              notes: session.notes,
              visibility: session.visibility,
            },
            {
              onConflict: 'region,level,session_no',
              ignoreDuplicates: false,
            }
          );

        if (sessionError) {
          throw new Error(`Failed to upsert session: ${sessionError.message}`);
        }

        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push(
          `Session ${session.region}/${session.level}/${session.session_no}: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        );
      }
    }

    // 웹훅 로그 기록
    await supabase.from('webhook_logs').insert({
      event_type: 'sync_sessions',
      payload: {
        total: sessions.length,
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
    console.error('Sync sessions error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
