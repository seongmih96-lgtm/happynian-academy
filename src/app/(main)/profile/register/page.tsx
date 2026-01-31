import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import MyLectureRegisterClient from './register-client';

export default async function MyLectureRegisterPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // 1) 모든 세션에서 region/level 조합 뽑기
  const { data: sessions } = await supabase
    .from('sessions')
    .select('region, level')
    .not('region', 'is', null)
    .not('level', 'is', null);

  // 2) 내 등록 목록
  const { data: myRegs } = await supabase
    .from('my_lecture_registrations')
    .select('*')
    .eq('user_id', user.id);

  // 3) region/level unique 만들기
  const map = new Map<string, { region: string; level: string; count: number }>();
  (sessions ?? []).forEach((s: any) => {
    const r = String(s?.region ?? '').trim();
    const l = String(s?.level ?? '').trim();
    if (!r || !l) return;
    const key = `${r}|${l}`;
    const prev = map.get(key);
    map.set(key, { region: r, level: l, count: (prev?.count ?? 0) + 1 });
  });

  const combos = Array.from(map.values()).sort((a, b) => {
    const ga = `${a.region}|${a.level}`;
    const gb = `${b.region}|${b.level}`;
    return ga.localeCompare(gb, 'ko');
  });

  return (
    <MyLectureRegisterClient
      initialCombos={combos}
      initialRegs={(myRegs ?? []) as any[]}
    />
  );
}