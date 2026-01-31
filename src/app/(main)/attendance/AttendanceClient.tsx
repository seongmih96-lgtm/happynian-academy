'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { cn, formatKoreanDate, formatTimeRange } from '@/lib/utils';

const BUCKET = 'student-uploads';
const SESSIONS_PER_REG = 9; // 등록 1개당 9회 기준

type SessionInstructorItem = {
  user_id: string;
  name?: string | null;
  role?: string | null;      // main | sub | null
  sort_order?: number | null;
};

type SessionRow = {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  region?: string | null;
  level?: string | null;
  session_no?: number | null;
  instructor?: string | null;
  instructors?: SessionInstructorItem[];
};

type AttendanceRow = {
  session_id: string;
  user_id: string;
  status?: string | null;
  checked_at?: string | null;
};

type HomeworkRow = {
  session_id: string;
  user_id: string;
  submitted_at?: string | null;
  // submitted?: boolean | null; // 혹시 있으면 대응
};

type PostRow = {
  id: string;
  user_id: string;
  session_id: string | null;
  kind: 'homework' | 'model';
  gender: 'male' | 'female' | null;
  title: string;
  comment: string | null;
  media: string[]; // public urls
  created_at: string;
};

type Profile = {
  user_id: string;
  role?: string | null;
  name?: string | null;
};

function formatInstructors(items?: SessionInstructorItem[] | null) {
  const list = (items ?? [])
    .filter(Boolean)
    .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999));

  if (!list.length) return '';

  return list
    .map((x) => {
      const n = String(x.name ?? '').trim();
      if (!n) return '';
      const tag = String(x.role ?? '').toLowerCase() === 'sub' ? ' (서브)' : '';
      return `${n}${tag}`;
    })
    .filter(Boolean)
    .join(' · ');
}

function isVideoUrl(url: string) {
  const u = url.toLowerCase().split('?')[0];
  return u.endsWith('.mp4') || u.endsWith('.webm') || u.endsWith('.mov') || u.endsWith('.m4v') || u.endsWith('.avi');
}

function Summary({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-neutral-100 p-3">
      <div className="text-[11px] text-neutral-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-neutral-900">{value}</div>
      <div className="mt-1 text-[11px] text-neutral-500">{sub}</div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-4 py-2 rounded-xl text-sm border',
        active ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
      )}
    >
      {children}
    </button>
  );
}

function MediaGrid({ media }: { media: string[] }) {
  const list = (media ?? []).slice(0, 6);
  if (!list.length) return null;

  return (
    <div className="grid grid-cols-2 gap-[1px] bg-neutral-100">
      {list.map((url) => (
        <div key={url} className="bg-black">
          {isVideoUrl(url) ? (
            <video src={url} controls playsInline className="w-full h-44 object-cover" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="w-full h-44 object-cover" />
          )}
        </div>
      ))}
    </div>
  );
}

function PostCard({
  post,
  onClick,
}: {
  post: PostRow;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="w-full text-left bg-white rounded-2xl border border-neutral-100 overflow-hidden">
      <MediaGrid media={Array.isArray(post.media) ? post.media : []} />
      <div className="p-4">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-sm font-semibold text-neutral-900">{post.title}</div>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700">
            {post.kind === 'homework' ? '과제' : `모델(${post.gender === 'male' ? '남' : '여'})`}
          </span>
        </div>
        {post.comment && <div className="mt-2 text-sm text-neutral-700 whitespace-pre-wrap">{post.comment}</div>}
        <div className="mt-2 text-[11px] text-neutral-500">{new Date(post.created_at).toLocaleString()}</div>
      </div>
    </button>
  );
}

export default function AttendanceClient({
  profile,
  sessions,
  attendanceRows,
  homeworkRows,
  posts,
}: {
  profile: Profile;
  sessions: SessionRow[];
  attendanceRows: AttendanceRow[];
  homeworkRows: HomeworkRow[];
  posts: PostRow[];
}) {
  const router = useRouter();

  const [localSessions, setLocalSessions] = useState<SessionRow[]>(sessions ?? []);

useEffect(() => {
  setLocalSessions(sessions ?? []);
}, [sessions]);

const sessionIdsKey = useMemo(
  () => (localSessions ?? []).map((s) => s.id).filter(Boolean).join(','),
  [localSessions]
);

useEffect(() => {
  const run = async () => {
    if (!localSessions.length) return;

    const ids = localSessions.map((s) => s.id).filter(Boolean);
    if (!ids.length) return;

    const { data, error } = await supabase
      .from('session_instructors')
      .select(`
        session_id,
        role,
        sort_order,
        profiles:instructor_user_id ( user_id, name )
      `)
      .in('session_id', ids);

    if (error) {
      console.error('[attendance] session_instructors load error:', error);
      return;
    }

    const bySession: Record<string, SessionInstructorItem[]> = {};
    (data ?? []).forEach((r: any) => {
      const sid = String(r.session_id ?? '').trim();
      if (!sid) return;

      const p = r.profiles;
      const item: SessionInstructorItem = {
        user_id: String(p?.user_id ?? '').trim(),
        name: p?.name ?? null,
        role: r.role ?? null,
        sort_order: r.sort_order ?? null,
      };

      if (!bySession[sid]) bySession[sid] = [];
      bySession[sid].push(item);
    });

    setLocalSessions((prev) =>
      (prev ?? []).map((s) => ({
        ...s,
        instructors: bySession[s.id] ?? [],
      }))
    );
  };

  run();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [sessionIdsKey]);

  // 서버 props -> 클라 state (삭제/수정 후에도 즉시 반영 + refresh로 동기화)
  const [localPosts, setLocalPosts] = useState<PostRow[]>(posts ?? []);

  const [tab, setTab] = useState<'all' | 'homework' | 'model'>('all');
  const [busy, setBusy] = useState(false);

  // 업로드 모달
  const [openUpload, setOpenUpload] = useState<null | { kind: 'homework' | 'model'; sessionId?: string }>(null);
  const [uTitle, setUTitle] = useState('');
  const [uComment, setUComment] = useState('');
  const [uGender, setUGender] = useState<'male' | 'female'>('male');
  const [uFiles, setUFiles] = useState<File[]>([]);

  // 게시글 상세/수정 모달
  const [openDetail, setOpenDetail] = useState<null | { postId: string }>(null);
  const selectedPost = useMemo(() => {
    if (!openDetail) return null;
    return (localPosts ?? []).find((p) => p.id === openDetail.postId) ?? null;
  }, [openDetail, localPosts]);

  const [eTitle, setETitle] = useState('');
  const [eComment, setEComment] = useState('');
  const [eGender, setEGender] = useState<'male' | 'female'>('male');
  const [eFiles, setEFiles] = useState<File[]>([]);
  const [eReplaceMedia, setEReplaceMedia] = useState(false);

  // 유저 검색
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [viewUserId, setViewUserId] = useState<string | null>(null);
  const [viewUserSummary, setViewUserSummary] = useState<any>(null);
  const [viewUserPosts, setViewUserPosts] = useState<PostRow[]>([]);
  const [viewUserTab, setViewUserTab] = useState<'all' | 'homework' | 'model'>('all');

  // ---------- 기준 회차(등록 1개당 9회) ----------
  const regCount = useMemo(() => {
    // sessions에서 region|level 조합의 유니크 개수 = 등록 개수로 가정
    const set = new Set<string>();
    (localSessions ?? []).forEach((s) => {
      const key = `${String(s.region ?? '').trim()}|${String(s.level ?? '').trim()}`;
      if (key !== '|') set.add(key);
    });
    return Math.max(0, set.size);
  }, [localSessions]);

  const denomTotal = useMemo(() => {
    // 등록이 0이면 0 (표시용)
    return regCount * SESSIONS_PER_REG;
  }, [regCount]);

  // ---------- 출석/과제 “세션별 1회” 판정 ----------
  const attendOkSet = useMemo(() => {
    const s = new Set<string>();
    (attendanceRows ?? []).forEach((r) => {
      const st = String(r.status ?? '').toLowerCase();
      if (st === 'present' || st === 'checked' || st === 'attended') s.add(r.session_id);
    });
    return s;
  }, [attendanceRows]);

  const homeworkOkSet = useMemo(() => {
    const s = new Set<string>();
    (homeworkRows ?? []).forEach((r: any) => {
      if (r?.submitted_at) s.add(r.session_id);
      // if (r?.submitted) s.add(r.session_id); // 필요시
    });
    return s;
  }, [homeworkRows]);

  // ✅ “과제 업로드 버튼”은 session_homework_submissions가 존재할 때 막아야 함 (중복 방지)
  const hasHomeworkForSession = (sessionId: string) => homeworkOkSet.has(sessionId);

  // ---------- 요약 ----------
  const attendanceRate = useMemo(() => {
    const denom = denomTotal || 0;
    if (!denom) return 0;
    return Math.round((attendOkSet.size / denom) * 100);
  }, [attendOkSet.size, denomTotal]);

  const homeworkRate = useMemo(() => {
    const denom = denomTotal || 0;
    if (!denom) return 0;
    return Math.round((homeworkOkSet.size / denom) * 100);
  }, [homeworkOkSet.size, denomTotal]);

  const myModelCounts = useMemo(() => {
    let male = 0,
      female = 0;
    (localPosts ?? []).forEach((p) => {
      if (p.kind !== 'model') return;
      if (p.gender === 'male') male++;
      if (p.gender === 'female') female++;
    });
    return { male, female, total: male + female };
  }, [localPosts]);

  const filteredPosts = useMemo(() => {
    const list = localPosts ?? [];
    if (tab === 'all') return list;
    return list.filter((p) => p.kind === tab);
  }, [localPosts, tab]);

  // ---------- 세션 분리: 오늘 / 지난(종료~7일) ----------
  const nowMs = Date.now();

  const todaySessions = useMemo(() => {
  const today0 = new Date();
  today0.setHours(0, 0, 0, 0);
  const tomorrow0 = new Date(today0.getTime() + 24 * 60 * 60 * 1000);

  return (localSessions ?? [])
    .filter((s) => {
      const st = new Date(s.start_at).getTime();
      return st >= today0.getTime() && st < tomorrow0.getTime();
    })
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
}, [localSessions]);

const pastUploadableSessions = useMemo(() => {
  return (localSessions ?? [])
    .filter((s) => {
      const end = new Date(s.end_at).getTime();
      const limit = end + 7 * 24 * 60 * 60 * 1000;
      return nowMs >= end && nowMs <= limit;
    })
    .sort((a, b) => new Date(b.end_at).getTime() - new Date(a.end_at).getTime());
}, [localSessions, nowMs]);

  const canAttend = (s: SessionRow) => nowMs <= new Date(s.end_at).getTime();

  // ✅ 과제 업로드: “종료 후” ~ “7일”
  const canHomeworkUpload = (s: SessionRow) => {
    const end = new Date(s.end_at).getTime();
    const limit = end + 7 * 24 * 60 * 60 * 1000;
    return nowMs >= end && nowMs <= limit;
  };

  // ---------- Storage 업로드 ----------
  const uploadFiles = async (fs: File[], folder: 'posts' | 'edit') => {
    const urls: string[] = [];
    for (const f of fs) {
      const ext = (f.name.split('.').pop() || 'bin').toLowerCase();
      const path = `u/${profile.user_id}/${folder}/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;

      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, f, {
        upsert: false,
        contentType: f.type || undefined,
      });
      if (upErr) throw upErr;

      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      if (!data?.publicUrl) throw new Error('public url 생성 실패');
      urls.push(data.publicUrl);
    }
    return urls;
  };

  // ---------- 출석 처리 ----------
  const doAttend = async (sessionId: string) => {
    try {
      setBusy(true);
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;
      if (!user) {
        router.replace('/login');
        return;
      }

      const { error } = await supabase
        .from('session_attendance')
        .upsert({ session_id: sessionId, user_id: user.id, status: 'present', checked_at: new Date().toISOString() }, { onConflict: 'session_id,user_id' });

      if (error) throw error;

      // ✅ 버튼이 “해당 세션만” 완료되게: refresh로 rows 재수신
      router.refresh();
    } catch (e: any) {
      alert(e?.message ?? '출석 처리 중 오류가 발생했어요.');
    } finally {
      setBusy(false);
    }
  };

  // ---------- 업로드(과제/모델) ----------
  const submitPost = async () => {
    if (!openUpload) return;

    // ✅ 과제는 “세션 선택 필수”
    if (openUpload.kind === 'homework' && !openUpload.sessionId) {
      alert('과제는 어떤 강의의 과제인지 선택이 필요해.');
      return;
    }

    if (!uTitle.trim()) {
      alert('제목을 입력해줘!');
      return;
    }
    if (!uFiles.length) {
      alert('사진/영상 파일을 1개 이상 선택해줘!');
      return;
    }

    try {
      setBusy(true);

      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;
      if (!user) {
        router.replace('/login');
        return;
      }

      // ✅ 과제: 기간 + 중복(세션당 1번) 방지
      if (openUpload.kind === 'homework' && openUpload.sessionId) {
        const s = (localSessions ?? []).find((x) => x.id === openUpload.sessionId);
        if (s && !canHomeworkUpload(s)) {
          alert('과제 업로드는 강의 종료 후 ~ 7일까지만 가능해요.');
          return;
        }
        if (hasHomeworkForSession(openUpload.sessionId)) {
          // 이미 제출되어있으면 막기 (삭제하면 다시 가능)
          alert('이 회차 과제는 이미 업로드했어요. (삭제하면 7일 내 재업로드 가능)');
          return;
        }
      }

      const mediaUrls = await uploadFiles(uFiles, 'posts');

      // 1) student_posts insert
      const payload: any = {
        user_id: user.id,
        session_id: openUpload.sessionId ?? null,
        kind: openUpload.kind,
        gender: openUpload.kind === 'model' ? uGender : null,
        title: uTitle.trim(),
        comment: uComment.trim() || null,
        media: mediaUrls,
      };

      const { data: inserted, error: pErr } = await supabase
        .from('student_posts')
        .insert(payload)
        .select('id,user_id,session_id,kind,gender,title,comment,media,created_at')
        .maybeSingle();

      if (pErr) throw pErr;

      // 2) 과제면: session_homework_submissions upsert(세션당 1번)
      if (openUpload.kind === 'homework' && openUpload.sessionId) {
        const { error: hErr } = await supabase
          .from('session_homework_submissions')
          .upsert({ session_id: openUpload.sessionId, user_id: user.id, submitted_at: new Date().toISOString() }, { onConflict: 'session_id,user_id' });

        if (hErr) throw hErr;
      }

      // UI 즉시 반영 + 서버 동기화
      if (inserted) setLocalPosts((prev) => [inserted as any, ...(prev ?? [])]);

      // reset
      setOpenUpload(null);
      setUTitle('');
      setUComment('');
      setUFiles([]);
      setUGender('male');

      router.refresh();
    } catch (e: any) {
      const msg = String(e?.message ?? '업로드 중 오류가 발생했어요.');
      if (msg.toLowerCase().includes('bucket') && msg.toLowerCase().includes('not')) {
        alert(`업로드 실패: Bucket not found\n\nSupabase Storage에 "${BUCKET}" 버킷이 실제로 있는지 확인해줘!`);
      } else {
        alert(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  // ---------- 상세 모달 열기 ----------
  const openPostDetail = (postId: string) => {
    setOpenDetail({ postId });
    const p = (localPosts ?? []).find((x) => x.id === postId);
    if (!p) return;

    setETitle(p.title ?? '');
    setEComment(p.comment ?? '');
    setEGender(p.gender === 'female' ? 'female' : 'male');
    setEFiles([]);
    setEReplaceMedia(false);
  };

  // ---------- 게시글 수정(텍스트 + 미디어 교체 옵션) ----------
  const saveEdit = async () => {
    if (!selectedPost) return;

    try {
      setBusy(true);

      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;
      if (!user) {
        router.replace('/login');
        return;
      }

      if (selectedPost.user_id !== user.id) {
        alert('내 게시글만 수정할 수 있어요.');
        return;
      }

      // ✅ 과제 게시글이면: 어떤 강의인지 유지. (media 교체/텍스트 수정만)
      // ✅ 모델 게시글이면: gender도 수정 가능

      let newMedia: string[] | undefined = undefined;
      if (eReplaceMedia) {
        if (!eFiles.length) {
          alert('미디어 교체를 켰으면 파일을 1개 이상 선택해줘!');
          return;
        }
        newMedia = await uploadFiles(eFiles, 'edit');
      }

      const updatePayload: any = {
        title: eTitle.trim() || selectedPost.title,
        comment: eComment.trim() || null,
      };

      if (selectedPost.kind === 'model') {
        updatePayload.gender = eGender;
      } else {
        updatePayload.gender = null;
      }

      if (newMedia) updatePayload.media = newMedia;

      const { data: updated, error } = await supabase
        .from('student_posts')
        .update(updatePayload)
        .eq('id', selectedPost.id)
        .select('id,user_id,session_id,kind,gender,title,comment,media,created_at')
        .maybeSingle();

      if (error) throw error;

      if (updated) {
        setLocalPosts((prev) => (prev ?? []).map((p) => (p.id === updated.id ? (updated as any) : p)));
      }

      setOpenDetail(null);
      router.refresh();
    } catch (e: any) {
      alert(e?.message ?? '수정 중 오류가 발생했어요.');
    } finally {
      setBusy(false);
    }
  };

  // ---------- 게시글 삭제 (삭제하면: 과제 제출도 같이 삭제 => 7일 이내면 버튼 다시 뜸) ----------
  const deletePost = async () => {
    if (!selectedPost) return;
    if (!confirm('정말 삭제할까요?')) return;

    try {
      setBusy(true);

      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;
      if (!user) {
        router.replace('/login');
        return;
      }

      if (selectedPost.user_id !== user.id) {
        alert('내 게시글만 삭제할 수 있어요.');
        return;
      }

      // 1) student_posts 삭제
      const { error: dErr } = await supabase.from('student_posts').delete().eq('id', selectedPost.id);
      if (dErr) throw dErr;

      // 2) 과제 게시글이면: homework 제출 테이블도 삭제 (세션당 1번 규칙 + 삭제 시 재업로드 가능)
      if (selectedPost.kind === 'homework' && selectedPost.session_id) {
        const { error: hErr } = await supabase
          .from('session_homework_submissions')
          .delete()
          .eq('user_id', user.id)
          .eq('session_id', selectedPost.session_id);
        if (hErr) throw hErr;
      }

      // UI 즉시 반영
      setLocalPosts((prev) => (prev ?? []).filter((p) => p.id !== selectedPost.id));
      setOpenDetail(null);

      router.refresh();
    } catch (e: any) {
      alert(e?.message ?? '삭제 중 오류가 발생했어요.');
    } finally {
      setBusy(false);
    }
  };

  // ---------- 유저 검색 ----------
  const searchUsers = async () => {
    try {
      setSearching(true);
      setUsers([]);
      setViewUserId(null);
      setViewUserSummary(null);
      setViewUserPosts([]);
      setViewUserTab('all');

      const keyword = q.trim();
      if (!keyword) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('user_id,name,role')
        .ilike('name', `%${keyword}%`)
        .limit(30);

      if (error) throw error;
      setUsers((data ?? []).filter((x: any) => x.user_id && x.user_id !== profile.user_id));
    } catch (e: any) {
      // ✅ 여기서 막히면 거의 RLS 문제
      alert(
        (e?.message ?? '검색 중 오류') +
          '\n\n(힌트) profiles 테이블 RLS에서 authenticated 사용자의 select(최소 user_id,name,role) 정책이 열려있어야 검색돼요.'
      );
    } finally {
      setSearching(false);
    }
  };

  // ✅ 상대 요약 + 피드
  const openUser = async (userId: string) => {
    try {
      setViewUserId(userId);
      setViewUserSummary(null);
      setViewUserPosts([]);
      setViewUserTab('all');

      // 0) 상대 프로필
      const { data: u, error: uErr } = await supabase.from('profiles').select('user_id,name,role').eq('user_id', userId).maybeSingle();
      if (uErr) throw uErr;

      // 1) 상대 등록(region/level)
      const { data: regs, error: rErr } = await supabase.from('my_lecture_registrations').select('region,level').eq('user_id', userId);
      if (rErr) throw rErr;

      const pairs = (regs ?? [])
        .map((r: any) => ({ region: String(r.region ?? '').trim(), level: String(r.level ?? '').trim() }))
        .filter((x: any) => x.region && x.level);

      const regCnt = pairs.length;
      const denom = regCnt * SESSIONS_PER_REG;

      let attendRate = 0;
      let hwRate = 0;

      if (denom > 0) {
        // ✅ 상대 출석: “present” 수
        const { data: aRows, error: aErr } = await supabase.from('session_attendance').select('session_id,status').eq('user_id', userId);
        if (aErr) throw aErr;

        const okA = new Set<string>();
        (aRows ?? []).forEach((r: any) => {
          const st = String(r.status ?? '').toLowerCase();
          if (st === 'present' || st === 'checked' || st === 'attended') okA.add(r.session_id);
        });

        // ✅ 상대 과제: 제출 rows (세션당 1개로 관리)
        const { data: hRows, error: hErr } = await supabase.from('session_homework_submissions').select('session_id,submitted_at').eq('user_id', userId);
        if (hErr) throw hErr;

        const okH = new Set<string>();
        (hRows ?? []).forEach((r: any) => {
          if (r.submitted_at) okH.add(r.session_id);
        });

        attendRate = Math.round((okA.size / denom) * 100);
        hwRate = Math.round((okH.size / denom) * 100);
      }

      // 2) 상대 피드
      const { data: p, error: pErr } = await supabase
        .from('student_posts')
        .select('id,user_id,session_id,kind,gender,title,comment,media,created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (pErr) throw pErr;

      let modelMale = 0,
        modelFemale = 0;
      (p ?? []).forEach((x: any) => {
        if (x.kind !== 'model') return;
        if (x.gender === 'male') modelMale++;
        if (x.gender === 'female') modelFemale++;
      });

      setViewUserSummary({
        name: u?.name ?? '이름없음',
        regCount: regCnt,
        denom,
        attendanceRate: denom ? attendRate : 0,
        homeworkRate: denom ? hwRate : 0,
        modelMale,
        modelFemale,
        modelTotal: modelMale + modelFemale,
      });

      setViewUserPosts((p ?? []) as any);
    } catch (e: any) {
      alert(e?.message ?? '유저 보기 중 오류가 발생했어요.');
    }
  };

  const viewUserFilteredPosts = useMemo(() => {
    if (!viewUserPosts?.length) return [];
    if (viewUserTab === 'all') return viewUserPosts;
    return viewUserPosts.filter((p) => p.kind === viewUserTab);
  }, [viewUserPosts, viewUserTab]);

  // ---------- UI ----------
  const sessionLabel = (s: SessionRow) => {
    const parts = [
      s.region ? String(s.region) : null,
      s.level ? String(s.level) : null,
      s.session_no != null ? `회차 ${s.session_no}` : null,
    ].filter(Boolean);
    return parts.join(' / ');
  };

  const renderSessionCard = (s: SessionRow, mode: 'today' | 'past') => {
    const attended = attendOkSet.has(s.id);
    const canA = canAttend(s) && !attended;

    const hwDone = hasHomeworkForSession(s.id);
    const canHw = canHomeworkUpload(s) && !hwDone;

    return (
      <div key={s.id} className="rounded-2xl border border-neutral-100 p-3">
        <div className="text-xs text-neutral-500 flex flex-wrap gap-2 items-center">
          <span className="px-2 py-[2px] rounded-full bg-neutral-100 text-neutral-700">{s.title}</span>
          <span className="px-2 py-[2px] rounded-full bg-neutral-100 text-neutral-700">{sessionLabel(s) || '강의'}</span>
          <span className="text-neutral-300">·</span>
          <span>{formatKoreanDate(s.start_at)}</span>
          <span className="text-neutral-300">·</span>
          <span>{formatTimeRange(s.start_at, s.end_at)}</span>
        </div>

        {/* ✅ 강사 여러명 표시 */}
{(s.instructors?.length ?? 0) > 0 ? (
  <div className="mt-2 text-[11px] text-neutral-600">
    강사: <span className="font-medium">{formatInstructors(s.instructors)}</span>
  </div>
) : s.instructor ? (
  <div className="mt-2 text-[11px] text-neutral-600">
    강사: <span className="font-medium">{s.instructor}</span>
  </div>
) : null}

        {mode === 'today' && (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              disabled={busy || !canA}
              onClick={() => doAttend(s.id)}
              className={cn(
                'w-full rounded-xl px-4 py-3 text-sm font-medium border',
                attended
                  ? 'bg-neutral-100 text-neutral-500 border-neutral-100'
                  : !canAttend(s)
                  ? 'bg-neutral-100 text-neutral-400 border-neutral-100'
                  : 'bg-neutral-900 text-white border-neutral-900 hover:bg-neutral-800'
              )}
            >
              {attended ? '출석 완료 ✅' : !canAttend(s) ? '출석 마감' : '출석하기'}
            </button>

            <button
              type="button"
              disabled={busy || !canHw}
              onClick={() => {
                if (!canHw) return;
                setOpenUpload({ kind: 'homework', sessionId: s.id });
                setUTitle('');
                setUComment('');
                setUFiles([]);
              }}
              className={cn(
                'w-full rounded-xl px-4 py-3 text-sm font-medium border',
                canHw ? 'bg-white text-neutral-900 border-neutral-200 hover:bg-neutral-50' : 'bg-neutral-100 text-neutral-400 border-neutral-100'
              )}
            >
              {hwDone ? '과제 업로드 완료됨' : canHomeworkUpload(s) ? '과제 업로드하기' : '과제 업로드 마감'}
            </button>
          </div>
        )}

        {mode === 'past' && (
          <div className="mt-3">
            <button
              type="button"
              disabled={busy || !canHw}
              onClick={() => {
                if (!canHw) return;
                setOpenUpload({ kind: 'homework', sessionId: s.id });
                setUTitle('');
                setUComment('');
                setUFiles([]);
              }}
              className={cn(
                'w-full rounded-xl px-4 py-3 text-sm font-medium border',
                canHw ? 'bg-white text-neutral-900 border-neutral-200 hover:bg-neutral-50' : 'bg-neutral-100 text-neutral-400 border-neutral-100'
              )}
            >
              {hwDone ? '과제 업로드 완료됨' : '과제 업로드하기'}
            </button>
            <div className="mt-2 text-[11px] text-neutral-500">강의 종료 후 7일 이내만 업로드 가능</div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      <div className="sticky top-0 z-20 bg-neutral-50/90 backdrop-blur border-b border-neutral-100">
        <div className="mx-auto w-full max-w-3xl px-4 py-3">
          <div className="text-sm font-semibold text-neutral-900">출석</div>
          <div className="text-xs text-neutral-500 mt-0.5">오늘의 성장 체크 🌿</div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-3xl px-4 py-4 space-y-4">
        {/* ✅ 오늘 강의(여러개) */}
        <section className="bg-white rounded-2xl border border-neutral-100 p-4">
          <div className="text-sm font-semibold text-neutral-900">오늘 강의</div>

          {regCount === 0 ? (
            <div className="mt-2 text-sm text-neutral-600">등록된 강의가 없어요. (프로필 → 내 강의 등록하기)</div>
          ) : todaySessions.length === 0 ? (
            <div className="mt-2 text-sm text-neutral-600">오늘 예정된 강의가 없어요 🙂</div>
          ) : (
            <div className="mt-3 space-y-3">{todaySessions.map((s) => renderSessionCard(s, 'today'))}</div>
          )}

          <div className="mt-3 text-[11px] text-neutral-500">
            출석: 강의 종료 전까지만 가능 · 과제: 종료 후 7일까지 업로드 가능(세션당 1회)
          </div>
        </section>

        {/* ✅ 지난 강의(종료~7일) */}
        <section className="bg-white rounded-2xl border border-neutral-100 p-4">
          <div className="text-sm font-semibold text-neutral-900">지난 강의</div>
          <div className="text-xs text-neutral-500 mt-1">강의 종료 후 7일 이내 과제 업로드 가능</div>

          {regCount === 0 ? (
            <div className="mt-2 text-sm text-neutral-600">등록된 강의가 없어요 🙂</div>
          ) : pastUploadableSessions.length === 0 ? (
            <div className="mt-2 text-sm text-neutral-600">업로드 가능한 지난 강의가 없어요 🙂</div>
          ) : (
            <div className="mt-3 space-y-3">{pastUploadableSessions.map((s) => renderSessionCard(s, 'past'))}</div>
          )}
        </section>

        {/* ✅ 요약 (등록 1개당 9회 기준) */}
        <section className="bg-white rounded-2xl border border-neutral-100 p-4">
          <div className="flex items-end justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-neutral-900">내 현황 요약</div>
              <div className="mt-1 text-xs text-neutral-500">등록 {regCount}개 · 기준 {denomTotal}회</div>
            </div>
            <button
              type="button"
              onClick={() => {
                setOpenUpload({ kind: 'model' });
                setUTitle('');
                setUComment('');
                setUFiles([]);
                setUGender('male');
              }}
              className="px-4 py-2 rounded-xl bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-800"
            >
              + 모델작업 업로드
            </button>
          </div>

          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Summary label="출석률" value={`${attendanceRate}%`} sub={`${attendOkSet.size}/${denomTotal || 0}`} />
            <Summary label="과제률" value={`${homeworkRate}%`} sub={`${homeworkOkSet.size}/${denomTotal || 0}`} />
            <Summary label="남 모델" value={`${myModelCounts.male}개`} sub="업로드" />
            <Summary label="여 모델" value={`${myModelCounts.female}개`} sub="업로드" />
          </div>
        </section>

        {/* ✅ 내 피드 탭 */}
        <div className="flex items-center gap-2">
          <TabBtn active={tab === 'all'} onClick={() => setTab('all')}>
            전체
          </TabBtn>
          <TabBtn active={tab === 'homework'} onClick={() => setTab('homework')}>
            과제
          </TabBtn>
          <TabBtn active={tab === 'model'} onClick={() => setTab('model')}>
            모델작업
          </TabBtn>
        </div>

        {/* ✅ 내 피드 (삭제/수정 반영 + 상세보기) */}
        <section className="space-y-3">
          {filteredPosts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-neutral-100 p-6 text-sm text-neutral-600">아직 업로드한 게시물이 없어요 🙂</div>
          ) : (
            filteredPosts.map((p) => <PostCard key={p.id} post={p} onClick={() => openPostDetail(p.id)} />)
          )}
        </section>

        {/* ✅ 유저검색 */}
        <section className="bg-white rounded-2xl border border-neutral-100 p-4">
          <div className="text-sm font-semibold text-neutral-900">유저 검색</div>
          <div className="mt-3 flex gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="이름으로 검색"
              className="flex-1 rounded-xl border border-neutral-200 px-3 py-2 text-sm"
            />
            <button type="button" onClick={searchUsers} disabled={searching} className="px-4 py-2 rounded-xl bg-neutral-900 text-white text-sm font-medium">
              {searching ? '검색…' : '검색'}
            </button>
          </div>

          {users.length > 0 && (
            <div className="mt-3 space-y-2">
              {users.map((u) => (
                <button
                  key={u.user_id}
                  type="button"
                  onClick={() => openUser(u.user_id)}
                  className="w-full text-left rounded-xl border border-neutral-100 px-3 py-2 hover:bg-neutral-50"
                >
                  <div className="text-sm text-neutral-900">{u.name ?? '이름없음'}</div>
                  <div className="text-[11px] text-neutral-500">프로필 보기</div>
                </button>
              ))}
            </div>
          )}

          {/* ✅ 상대 프로필/요약/피드 */}
          {viewUserId && viewUserSummary && (
            <div className="mt-4 border-t border-neutral-100 pt-4">
              <div className="text-sm font-semibold text-neutral-900">{viewUserSummary.name}님의 요약</div>
              <div className="mt-1 text-xs text-neutral-500">등록 {viewUserSummary.regCount}개 · 기준 {viewUserSummary.denom}회</div>

              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Summary label="출석률" value={`${viewUserSummary.attendanceRate}%`} sub={`${viewUserSummary.denom}회 기준`} />
                <Summary label="과제률" value={`${viewUserSummary.homeworkRate}%`} sub={`${viewUserSummary.denom}회 기준`} />
                <Summary label="남 모델" value={`${viewUserSummary.modelMale}개`} sub="업로드" />
                <Summary label="여 모델" value={`${viewUserSummary.modelFemale}개`} sub="업로드" />
              </div>

              <div className="mt-3 flex items-center gap-2">
                <TabBtn active={viewUserTab === 'all'} onClick={() => setViewUserTab('all')}>
                  전체
                </TabBtn>
                <TabBtn active={viewUserTab === 'homework'} onClick={() => setViewUserTab('homework')}>
                  과제
                </TabBtn>
                <TabBtn active={viewUserTab === 'model'} onClick={() => setViewUserTab('model')}>
                  모델작업
                </TabBtn>
              </div>

              <div className="mt-3 space-y-3">
                {viewUserFilteredPosts.length === 0 ? (
                  <div className="rounded-2xl border border-neutral-100 p-6 text-sm text-neutral-600">아직 업로드한 게시물이 없어요 🙂</div>
                ) : (
                  viewUserFilteredPosts.map((p) => (
                    <div key={p.id} className="bg-white rounded-2xl border border-neutral-100 overflow-hidden">
                      <MediaGrid media={Array.isArray(p.media) ? p.media : []} />
                      <div className="p-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="text-sm font-semibold text-neutral-900">{p.title}</div>
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700">
                            {p.kind === 'homework' ? '과제' : `모델(${p.gender === 'male' ? '남' : '여'})`}
                          </span>
                        </div>
                        {p.comment && <div className="mt-2 text-sm text-neutral-700 whitespace-pre-wrap">{p.comment}</div>}
                        <div className="mt-2 text-[11px] text-neutral-500">{new Date(p.created_at).toLocaleString()}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </section>
      </main>

      {/* ✅ 업로드 모달 */}
      {openUpload && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl p-4 border border-neutral-100">
            <div className="text-sm font-semibold text-neutral-900">{openUpload.kind === 'homework' ? '과제 업로드' : '모델작업 업로드'}</div>

            {/* ✅ 과제: 어떤 강의인지 표시 */}
            {openUpload.kind === 'homework' && openUpload.sessionId && (
              <div className="mt-2 text-[12px] text-neutral-700">
                과제 강의:{' '}
                <span className="font-semibold">
                  {(localSessions ?? []).find((s) => s.id === openUpload.sessionId)?.title ?? '선택됨'}
                </span>{' '}
                <span className="text-neutral-500">
                  · {(localSessions ?? []).find((s) => s.id === openUpload.sessionId) ? sessionLabel((localSessions ?? []).find((s) => s.id === openUpload.sessionId)!) : ''}
                </span>
              </div>
            )}

            {openUpload.kind === 'model' && (
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setUGender('male')}
                  className={cn(
                    'flex-1 rounded-xl px-3 py-2 text-sm border',
                    uGender === 'male' ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white border-neutral-200'
                  )}
                >
                  남자
                </button>
                <button
                  type="button"
                  onClick={() => setUGender('female')}
                  className={cn(
                    'flex-1 rounded-xl px-3 py-2 text-sm border',
                    uGender === 'female' ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white border-neutral-200'
                  )}
                >
                  여자
                </button>
              </div>
            )}

            <div className="mt-3 space-y-2">
              <input value={uTitle} onChange={(e) => setUTitle(e.target.value)} placeholder="제목" className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
              <textarea
                value={uComment}
                onChange={(e) => setUComment(e.target.value)}
                placeholder="코멘트"
                className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm min-h-[90px]"
              />
              <input
                type="file"
                multiple
                accept="image/*,video/*"
                onChange={(e) => setUFiles(Array.from(e.target.files ?? []))}
                className="w-full text-sm"
              />
              <div className="text-[11px] text-neutral-500">✅ 사진/영상 여러개 가능 · 업로드 후 피드에 자동 반영</div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setOpenUpload(null)} className="rounded-xl px-4 py-3 text-sm border border-neutral-200 hover:bg-neutral-50">
                취소
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={submitPost}
                className="rounded-xl px-4 py-3 text-sm bg-neutral-900 text-white hover:bg-neutral-800"
              >
                {busy ? '업로드 중…' : '업로드'}
              </button>
            </div>

            <div className="mt-2 text-[11px] text-neutral-500">
              ⚠️ “Bucket not found”가 뜨면: Storage에 <b>{BUCKET}</b> 버킷이 실제로 있는지 확인!
            </div>
          </div>
        </div>
      )}

      {/* ✅ 상세/수정/삭제 모달 */}
      {selectedPost && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white rounded-2xl border border-neutral-100 overflow-hidden">
            {/* 헤더 */}
            <div className="p-4 border-b border-neutral-100 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-neutral-900">게시글 상세</div>

                {/* ✅ 과제면: 어느 강의 과제인지 표시 */}
                {selectedPost.kind === 'homework' && selectedPost.session_id && (
                  <div className="mt-1 text-xs text-neutral-600">
                    과제 강의:{' '}
                    <span className="font-semibold">
                      {(localSessions ?? []).find((s) => s.id === selectedPost.session_id)?.title ?? '알 수 없음'}
                    </span>{' '}
                    <span className="text-neutral-500">
                      · {(localSessions ?? []).find((s) => s.id === selectedPost.session_id)
                        ? sessionLabel((localSessions ?? []).find((s) => s.id === selectedPost.session_id)!)
                        : ''}
                    </span>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setOpenDetail(null)}
                className="px-3 py-2 rounded-xl border border-neutral-200 text-sm hover:bg-neutral-50"
              >
                닫기
              </button>
            </div>

            {/* 미디어 */}
            <MediaGrid media={Array.isArray(selectedPost.media) ? selectedPost.media : []} />

            {/* 수정 영역 */}
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700">
                  {selectedPost.kind === 'homework' ? '과제' : `모델(${selectedPost.gender === 'male' ? '남' : '여'})`}
                </span>
                <span className="text-[11px] text-neutral-500">{new Date(selectedPost.created_at).toLocaleString()}</span>
              </div>

              {selectedPost.kind === 'model' && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEGender('male')}
                    className={cn(
                      'flex-1 rounded-xl px-3 py-2 text-sm border',
                      eGender === 'male' ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white border-neutral-200'
                    )}
                  >
                    남자
                  </button>
                  <button
                    type="button"
                    onClick={() => setEGender('female')}
                    className={cn(
                      'flex-1 rounded-xl px-3 py-2 text-sm border',
                      eGender === 'female' ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white border-neutral-200'
                    )}
                  >
                    여자
                  </button>
                </div>
              )}

              <input value={eTitle} onChange={(e) => setETitle(e.target.value)} placeholder="제목" className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />

              <textarea
                value={eComment}
                onChange={(e) => setEComment(e.target.value)}
                placeholder="코멘트"
                className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm min-h-[90px]"
              />

              {/* ✅ 미디어 수정(교체) */}
              <div className="rounded-xl border border-neutral-200 p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-neutral-900">미디어 수정</div>
                  <label className="flex items-center gap-2 text-sm text-neutral-700">
                    <input
                      type="checkbox"
                      checked={eReplaceMedia}
                      onChange={(e) => setEReplaceMedia(e.target.checked)}
                    />
                    교체하기
                  </label>
                </div>

                <div className="mt-2 text-[11px] text-neutral-500">
                  교체하기를 켜면, 선택한 파일로 <b>기존 미디어를 통째로 교체</b>합니다.
                </div>

                <input
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  disabled={!eReplaceMedia}
                  onChange={(e) => setEFiles(Array.from(e.target.files ?? []))}
                  className="mt-2 w-full text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={saveEdit}
                  className="rounded-xl px-4 py-3 text-sm bg-neutral-900 text-white hover:bg-neutral-800"
                >
                  {busy ? '저장 중…' : '수정 저장'}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={deletePost}
                  className="rounded-xl px-4 py-3 text-sm border border-rose-200 text-rose-700 hover:bg-rose-50"
                >
                  {busy ? '삭제 중…' : '삭제'}
                </button>
              </div>

              <div className="text-[11px] text-neutral-500">
                ✅ 과제 게시글을 삭제하면(7일 이내라면) 해당 회차 “과제 업로드하기” 버튼이 다시 떠요.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}