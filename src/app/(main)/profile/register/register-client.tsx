'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { ChevronLeft } from 'lucide-react';

type Combo = { region: string; level: string; count: number };
type Reg = { id: string; region: string; level: string };

export default function MyLectureRegisterClient({
  initialCombos,
  initialRegs,
}: {
  initialCombos: Combo[];
  initialRegs: any[];
}) {
  const router = useRouter();
  const [regs, setRegs] = useState<Reg[]>(
    (initialRegs ?? []).map((r: any) => ({ id: r.id, region: r.region, level: r.level }))
  );
  const [busyKey, setBusyKey] = useState<string | null>(null);

  useEffect(() => {
  const guard = async () => {
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;

    if (!user) {
      router.replace('/login');
      return;
    }

    const { data: p, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('[register] profile role load error:', error);
      router.replace('/profile');
      return;
    }

    // ✅ 수강생만 접근 가능
    if (!p || p.role !== 'student') {
      router.replace('/profile');
      return;
    }
  };

  guard();
}, [router]);

  const regSet = useMemo(() => {
    const s = new Set<string>();
    regs.forEach((r) => s.add(`${r.region}|${r.level}`));
    return s;
  }, [regs]);

  const toggle = async (region: string, level: string) => {
    const key = `${region}|${level}`;
    try {
      setBusyKey(key);

      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;
      if (!user) {
        router.replace('/login');
        return;
      }

      if (regSet.has(key)) {
        // 삭제
        const target = regs.find((r) => r.region === region && r.level === level);
        if (!target) return;

        const { error } = await supabase
          .from('my_lecture_registrations')
          .delete()
          .eq('id', target.id)
          .eq('user_id', user.id);

        if (error) throw error;

        setRegs((prev) => prev.filter((x) => x.id !== target.id));
      } else {
        // 추가
        const { data, error } = await supabase
          .from('my_lecture_registrations')
          .insert({ user_id: user.id, region, level })
          .select('id, region, level')
          .single();

        if (error) throw error;

        setRegs((prev) => [...prev, { id: data.id, region: data.region, level: data.level }]);
      }

      // 프로필/내강의 갱신
      router.refresh();
    } catch (e: any) {
      alert(e?.message ?? '처리 중 오류가 발생했어요.');
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="sticky top-0 z-10 bg-neutral-50/90 backdrop-blur border-b border-neutral-100">
        <div className="mx-auto w-full max-w-3xl px-4 py-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="w-9 h-9 rounded-xl border border-neutral-200 bg-white flex items-center justify-center"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="text-sm font-semibold text-neutral-900">내 강의 등록하기</div>
            <div className="text-xs text-neutral-500">지역 + 레벨만 선택해서 “내 강의”로 등록해요 ✅</div>
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-3xl px-4 py-4 space-y-3">
        {initialCombos.length === 0 ? (
          <div className="bg-white border border-neutral-200 rounded-2xl p-6 text-sm text-neutral-600">
            아직 등록 가능한 지역/레벨이 없어요. (sessions 테이블의 region/level 확인)
          </div>
        ) : (
          initialCombos.map((c) => {
            const key = `${c.region}|${c.level}`;
            const selected = regSet.has(key);
            const busy = busyKey === key;

            return (
              <div key={key} className="bg-white border border-neutral-200 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-neutral-900">
                    {c.region} / {c.level}
                  </div>
                  <div className="text-xs text-neutral-500 mt-1">해당 조합 세션 {c.count}개</div>
                </div>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => toggle(c.region, c.level)}
                  className={[
                    'px-4 py-2 rounded-xl text-sm font-medium border',
                    busy ? 'opacity-60' : '',
                    selected
                      ? 'bg-neutral-900 text-white border-neutral-900'
                      : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50',
                  ].join(' ')}
                >
                  {selected ? '등록됨' : '내 강의로 등록'}
                </button>
              </div>
            );
          })
        )}
      </main>
    </div>
  );
}