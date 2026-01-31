// src/lib/supabase/server.ts
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing env: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  return { url, anonKey };
}

/**
 * ✅ 일반 서버용(쿠키 기반) Supabase Client
 * - Server Components / Route Handlers 등에서 사용
 */
export function createClient() {
  const { url, anonKey } = getSupabaseEnv();
  const cookieStore = cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll().map((c) => ({
          name: c.name,
          value: c.value,
        }));
      },
      setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set({
            name,
            value,
            ...(options ?? {}),
          });
        });
      },
    },
  });
}

/**
 * ✅ 서비스 롤(관리자)용 Supabase Client
 * - Webhook / 서버 작업(결제 동기화 등)에서 사용
 * - 쿠키 세션 없이 동작
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createSupabaseClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}