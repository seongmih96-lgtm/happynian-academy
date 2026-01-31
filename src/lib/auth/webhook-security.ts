import { createHmac, timingSafeEqual } from 'crypto';

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';

/**
 * HMAC-SHA256 서명 생성
 */
export function createSignature(payload: string): string {
  return createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
}

/**
 * HMAC-SHA256 서명 검증
 * 
 * @param payload - 요청 본문 (JSON 문자열)
 * @param signature - 요청 헤더의 서명 (X-Webhook-Signature)
 * @returns 유효한 서명 여부
 */
export function verifySignature(payload: string, signature: string): boolean {
  if (!WEBHOOK_SECRET) {
    console.error('WEBHOOK_SECRET is not configured');
    return false;
  }

  if (!signature) {
    console.error('No signature provided');
    return false;
  }

  try {
    const expectedSignature = createSignature(payload);
    
    // Timing-safe comparison to prevent timing attacks
    const signatureBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    
    if (signatureBuffer.length !== expectedBuffer.length) {
      return false;
    }
    
    return timingSafeEqual(signatureBuffer, expectedBuffer);
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

/**
 * Bearer 토큰 검증 (간단한 대안)
 */
export function verifyBearerToken(authHeader: string | null): boolean {
  if (!WEBHOOK_SECRET) {
    console.error('WEBHOOK_SECRET is not configured');
    return false;
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.substring(7);
  return token === WEBHOOK_SECRET;
}

/**
 * 웹훅 요청 검증 (HMAC 또는 Bearer 토큰)
 */
export function verifyWebhookRequest(
  payload: string,
  signature: string | null,
  authHeader: string | null
): { valid: boolean; method: 'hmac' | 'bearer' | 'none' } {
  // HMAC 서명 우선 검증
  if (signature) {
    const valid = verifySignature(payload, signature);
    return { valid, method: 'hmac' };
  }

  // Bearer 토큰 대안 검증
  if (authHeader) {
    const valid = verifyBearerToken(authHeader);
    return { valid, method: 'bearer' };
  }

  return { valid: false, method: 'none' };
}

/**
 * n8n용 서명 생성 예시 (n8n Code 노드에서 사용)
 * 
 * JavaScript Code:
 * ```javascript
 * const crypto = require('crypto');
 * const payload = JSON.stringify($input.all()[0].json);
 * const signature = crypto
 *   .createHmac('sha256', $env.WEBHOOK_SECRET)
 *   .update(payload)
 *   .digest('hex');
 * 
 * return {
 *   json: {
 *     payload: $input.all()[0].json,
 *     signature: signature
 *   }
 * };
 * ```
 */
