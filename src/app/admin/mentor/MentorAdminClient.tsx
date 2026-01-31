'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

type MentorType = 'book' | 'youtube' | 'movie';

type MentorItem = {
  id: string;
  type: MentorType;
  title: string;
  creator: string | null;
  url: string | null;
  note: string | null;
  sort_index: number;
  created_at: string;
};

type LikeCountRow = { item_id: string; like_count: number };

export default function MentorAdminClient() {
  const router = useRouter();

  const [type, setType] = useState<MentorType>('book');
  const [title, setTitle] = useState('');
  const [creator, setCreator] = useState('');
  const [url, setUrl] = useState('');
  const [note, setNote] = useState('');
  const [sortIndex, setSortIndex] = useState<number>(0);

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const [items, setItems] = useState<MentorItem[]>([]);
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});

  const load = async () => {
    try {
      setLoading(true);

      const { data: list, error: lErr } = await supabase
        .from('mentor_items')
        .select('id,type,title,creator,url,note,sort_index,created_at')
        .order('created_at', { ascending: false });

      if (lErr) throw lErr;

      const arr = (list ?? []) as MentorItem[];
      const ids = arr.map((x) => x.id);

      const { data: counts, error: cErr } = await supabase
        .from('mentor_item_like_counts')
        .select('item_id,like_count')
        .in('item_id', ids);

      if (cErr) throw cErr;

      const map: Record<string, number> = {};
      (counts ?? []).forEach((r: LikeCountRow) => map[r.item_id] = Number(r.like_count ?? 0));

      setItems(arr);
      setLikeCounts(map);
    } catch (e: any) {
      alert(e?.message ?? '로드 실패');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async () => {
    if (!title.trim()) {
      alert('제목은 필수야!');
      return;
    }

    try {
      setSaving(true);

      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;
      if (!user) {
        router.replace('/login');
        return;
      }

      const payload = {
        type,
        title: title.trim(),
        creator: creator.trim() || null,
        url: url.trim() || null,
        note: note.trim() || null,
        sort_index: Number.isFinite(sortIndex) ? sortIndex : 0,
        created_by: user.id,
      };

      const { error } = await supabase.from('mentor_items').insert(payload);
      if (error) throw error;

      setTitle('');
      setCreator('');
      setUrl('');
      setNote('');
      setSortIndex(0);

      await load();
    } catch (e: any) {
      alert(e?.message ?? '등록 실패');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('삭제할까? (유저 찜/완료 기록도 같이 삭제됨)')) return;

    try {
      const { error } = await supabase.from('mentor_items').delete().eq('id', id);
      if (error) throw error;

      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch (e: any) {
      alert(e?.message ?? '삭제 실패');
      await load();
    }
  };

  // 관리자 페이지에서도 “추천순(찜 많은 순)”을 보기 좋게: like_count 기준으로 정렬된 뷰
  const sortedByLikes = useMemo(() => {
    return [...items].sort((a, b) => {
      const aLike = likeCounts[a.id] ?? 0;
      const bLike = likeCounts[b.id] ?? 0;
      if (bLike !== aLike) return bLike - aLike;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [items, likeCounts]);

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="sticky top-0 z-10 bg-neutral-50/90 backdrop-blur border-b border-neutral-100">
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center justify-between">
          <div className="text-sm font-semibold text-neutral-900">스승을 만나다 · 관리자 등록</div>
          <button
            type="button"
            onClick={() => router.push('/profile')}
            className="text-xs px-3 py-1.5 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50"
          >
            프로필로
          </button>
        </div>
      </div>

      <main className="mx-auto max-w-3xl px-4 py-4 space-y-4">
        {/* 등록 폼 */}
        <section className="bg-white rounded-2xl border border-neutral-100 p-4">
          <div className="text-sm font-semibold text-neutral-900">새 추천 등록</div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            {(['book', 'youtube', 'movie'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={cn(
                  'rounded-xl border px-3 py-2 text-sm',
                  type === t ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50'
                )}
              >
                {t === 'book' ? '책' : t === 'youtube' ? '유튜브' : '영화'}
              </button>
            ))}
          </div>

          <div className="mt-3 space-y-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="제목(필수)"
              className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
            />
            <input
              value={creator}
              onChange={(e) => setCreator(e.target.value)}
              placeholder={type === 'book' ? '저자' : type === 'movie' ? '감독' : '채널/제작자'}
              className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
            />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={type === 'youtube' ? '유튜브 링크(권장)' : '링크(선택)'}
              className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
            />
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="추천 이유/한줄 설명(선택)"
              className="w-full min-h-[90px] rounded-xl border border-neutral-200 px-3 py-2 text-sm"
            />
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-500">sort_index(표시용, 선택)</span>
              <input
                type="number"
                value={sortIndex}
                onChange={(e) => setSortIndex(Number(e.target.value))}
                className="w-24 rounded-xl border border-neutral-200 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={submit}
                disabled={saving}
                className={cn(
                  'ml-auto rounded-xl px-4 py-2 text-sm font-medium',
                  saving ? 'bg-neutral-200 text-neutral-500' : 'bg-neutral-900 text-white hover:bg-neutral-800'
                )}
              >
                {saving ? '등록 중…' : '등록'}
              </button>
            </div>
          </div>
        </section>

        {/* 리스트 */}
        <section className="bg-white rounded-2xl border border-neutral-100 p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-neutral-900">등록된 추천 (추천순: 찜 많은 순)</div>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm hover:bg-neutral-50"
            >
              {loading ? '새로고침…' : '새로고침'}
            </button>
          </div>

          <div className="mt-3 space-y-2">
            {sortedByLikes.length === 0 ? (
              <div className="text-sm text-neutral-500 py-6 text-center">아직 등록된 추천이 없어요 🙂</div>
            ) : (
              sortedByLikes.map((it) => (
                <div key={it.id} className="rounded-2xl border border-neutral-100 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-neutral-900 truncate">{it.title}</div>
                      <div className="mt-1 text-xs text-neutral-500 flex flex-wrap items-center gap-2">
                        <span className="px-2 py-[2px] rounded-full bg-neutral-100 text-neutral-700">
                          {it.type === 'book' ? '책' : it.type === 'youtube' ? '유튜브' : '영화'}
                        </span>
                        {it.creator && <span>{it.creator}</span>}
                        <span className="text-neutral-300">·</span>
                        <span>❤️ {likeCounts[it.id] ?? 0}</span>
                        <span className="text-neutral-300">·</span>
                        <span className="text-neutral-400">{new Date(it.created_at).toLocaleString()}</span>
                      </div>
                      {it.note && <div className="mt-2 text-sm text-neutral-700 whitespace-pre-wrap">{it.note}</div>}
                      {it.url && (
                        <a href={it.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-blue-600 underline">
                          링크 열기
                        </a>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => remove(it.id)}
                      className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm text-rose-700 hover:bg-rose-50"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}