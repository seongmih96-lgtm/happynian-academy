'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { cn, formatKoreanDate, formatTimeRange } from '@/lib/utils';
import { UserSearchAdmin } from '@/app/(main)/profile/UserSearchAdmin';

// ===== 설정 =====
const BUCKET = 'student-uploads';
const SESSIONS_PER_REG = 9; // 등록 1개당 9회
const HOMEWORK_WINDOW_DAYS = 7;

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
  instructors?: SessionInstructorItem[];
  instructor?: string | null; // 기존 단일 강사 컬럼이 있을 수도 있으니 호환용(있으면)
};

type AttendanceRow = {
  session_id: string;
  user_id: string;
  status: string | null;
  checked_at: string | null;
};

// ✅ session_homework_submissions (url은 호환용, media_urls가 메인)
type HomeworkRow = {
  id: number;
  session_id: string;
  user_id: string;
  url: string | null;
  media_urls: string[]; // jsonb
  note: string | null;
  submitted_at: string | null;
};

// ✅ model_work_posts
type ModelWorkRow = {
  id: string;
  user_id: string;
  gender: 'male' | 'female' | null;
  title: string | null;
  comment: string | null;
  media_urls: string[]; // jsonb
  created_at: string | null;
};

type ProfileRow = {
  user_id: string;
  name: string | null;
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

function isVideoUrl(url?: string | null) {
  if (!url) return false;
  const u = url.toLowerCase().split('?')[0];
  return u.endsWith('.mp4') || u.endsWith('.mov') || u.endsWith('.webm') || u.endsWith('.m4v') || u.endsWith('.avi');
}

function MediaThumb({ url }: { url: string }) {
  const video = isVideoUrl(url);
  return (
    <div className="relative w-full overflow-hidden rounded-xl bg-neutral-100">
      <div className="pt-[133.333%]" />
      <div className="absolute inset-0">
        {video ? (
          <video src={url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-full w-full object-cover" />
        )}
      </div>

      {video && (
        <div className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-1 text-[11px] text-white">video</div>
      )}
    </div>
  );
}

function Modal({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-3xl rounded-t-3xl bg-white p-4 shadow-2xl">
        <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-neutral-200" />
        {children}
      </div>
    </div>
  );
}

function buildPublicUrl(path: string) {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

function uniquePath(uid: string, kind: 'homework' | 'model', fileName: string) {
  const safe = fileName.replace(/\s+/g, '_');
  const ext = safe.includes('.') ? safe.split('.').pop() : '';
  const stamp = Date.now();
  return `${uid}/${kind}/${stamp}.${ext || 'bin'}`;
}

export default function AttendancePage() {
  const [loading, setLoading] = useState(true);

  const [meId, setMeId] = useState<string | null>(null);
  const [myProfile, setMyProfile] = useState<ProfileRow | null>(null);

  const [mySessions, setMySessions] = useState<SessionRow[]>([]);
  const [todaySessions, setTodaySessions] = useState<SessionRow[]>([]);

  const [attendanceRows, setAttendanceRows] = useState<AttendanceRow[]>([]);
  const [homeworks, setHomeworks] = useState<HomeworkRow[]>([]);
  const [modelWorks, setModelWorks] = useState<ModelWorkRow[]>([]);

  const [userSearchOpen, setUserSearchOpen] = useState(false);

  // ✅ 분모 (등록 개수 * 9)
  const [totalSessions, setTotalSessions] = useState<number>(SESSIONS_PER_REG);

  // 탭
  const [tab, setTab] = useState<'all' | 'homework' | 'model'>('all');

  // 업로드 패널
  const [openHomeworkForm, setOpenHomeworkForm] = useState(false);
  const [openModelForm, setOpenModelForm] = useState(false);

  // 과제 입력
  const [hwTitle, setHwTitle] = useState('');
  const [hwNote, setHwNote] = useState('');
  const [hwFiles, setHwFiles] = useState<File[]>([]);
  const [hwUploading, setHwUploading] = useState(false);
  const [selectedHomeworkSessionId, setSelectedHomeworkSessionId] = useState<string | null>(null);

  // 모델작업 입력
  const [mwTitle, setMwTitle] = useState('');
  const [mwComment, setMwComment] = useState('');
  const [mwGender, setMwGender] = useState<'male' | 'female'>('male');
  const [mwFiles, setMwFiles] = useState<File[]>([]);
  const [mwUploading, setMwUploading] = useState(false);

  // 게시글 모달(디테일 + 수정/삭제)
  const [postModalOpen, setPostModalOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<
    | { kind: 'homework'; row: HomeworkRow }
    | { kind: 'model'; row: ModelWorkRow }
    | null
  >(null);

  const [editTitle, setEditTitle] = useState('');
  const [editNoteOrComment, setEditNoteOrComment] = useState('');
  const [editFiles, setEditFiles] = useState<File[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editUploadingMedia, setEditUploadingMedia] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ===== 업로드 공통(Storage) =====
  async function uploadToStorage(kind: 'homework' | 'model', file: File) {
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes?.user?.id;
    if (!uid) throw new Error('로그인이 필요해요.');

    const path = uniquePath(uid, kind, file.name);

    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || undefined,
    });

    if (upErr) throw new Error(upErr.message);
    return buildPublicUrl(path);
  }

  // ===== 데이터 로드(재사용) =====
  const loadAll = async () => {
    setLoading(true);

    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      window.location.href = '/login';
      return;
    }
    setMeId(user.id);

    // 내 프로필
    const { data: p } = await supabase.from('profiles').select('user_id,name').eq('user_id', user.id).maybeSingle();
    setMyProfile((p ?? null) as any);

    // registrations (region/level)
    const { data: regs, error: regsErr } = await supabase
      .from('my_lecture_registrations')
      .select('region,level')
      .eq('user_id', user.id);

    if (regsErr) {
      alert(`내 강의 등록 조회 실패: ${regsErr.message}`);
      setLoading(false);
      return;
    }

    const pairs = (regs ?? [])
      .map((r: any) => ({ region: String(r.region ?? '').trim(), level: String(r.level ?? '').trim() }))
      .filter((x: any) => x.region && x.level);

    // 분모 세팅
    setTotalSessions(Math.max(1, pairs.length * SESSIONS_PER_REG));

    if (!pairs.length) {
      setMySessions([]);
      setTodaySessions([]);
      setAttendanceRows([]);
      setHomeworks([]);
      setModelWorks([]);
      setLoading(false);
      return;
    }

    const regions = Array.from(new Set(pairs.map((x: any) => x.region)));
    const levels = Array.from(new Set(pairs.map((x: any) => x.level)));

    // sessions
    const { data: sData, error: sErr } = await supabase
      .from('sessions')
      .select('id,title,start_at,end_at,region,level')
      .in('region', regions)
      .in('level', levels)
      .order('start_at', { ascending: true });

    if (sErr) {
      alert(`강의 일정 조회 실패: ${sErr.message}`);
      setLoading(false);
      return;
    }

    const allowed = new Set(pairs.map((x: any) => `${x.region}|${x.level}`));
    const sessions = (sData ?? []).filter((s: any) =>
      allowed.has(`${String(s.region ?? '').trim()}|${String(s.level ?? '').trim()}`)
    ) as SessionRow[];

    // ✅ 강사 매핑(session_instructors + profiles)
const sessionIds = sessions.map((x) => x.id).filter(Boolean);

const { data: siData, error: siErr } = await supabase
  .from('session_instructors')
  .select(`
    session_id,
    role,
    sort_order,
    profiles:instructor_user_id ( user_id, name )
  `)
  .in('session_id', sessionIds);

if (siErr) {
  console.error('[attendance] session_instructors load error:', siErr);
  // 여기서 return하지 말고 그냥 강사표시만 포기(페이지는 계속)
}

const bySession: Record<string, SessionInstructorItem[]> = {};
(siData ?? []).forEach((r: any) => {
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

// ✅ sessions에 instructors 붙이기
const sessionsWithInstructors = sessions.map((s) => ({
  ...s,
  instructors: bySession[s.id] ?? [],
}));
    
    setMySessions(sessionsWithInstructors);

    // 오늘 세션
    const today0 = new Date();
    today0.setHours(0, 0, 0, 0);
    const tomorrow0 = new Date(today0);
    tomorrow0.setDate(tomorrow0.getDate() + 1);

const todays = sessionsWithInstructors
  .filter((s) => {
    const st = new Date(s.start_at).getTime();
    return st >= today0.getTime() && st < tomorrow0.getTime();
  })
  .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());

setTodaySessions(todays);

    // 출석
    const { data: aData, error: aErr } = await supabase
      .from('session_attendance')
      .select('session_id,user_id,status,checked_at')
      .eq('user_id', user.id)
      .in('session_id', sessionIds);

    if (aErr) {
      alert(`출석 조회 실패: ${aErr.message}`);
      setLoading(false);
      return;
    }
    setAttendanceRows((aData ?? []) as any);

    // 과제
    const { data: hData, error: hErr } = await supabase
      .from('session_homework_submissions')
      .select('id,session_id,user_id,url,media_urls,note,submitted_at')
      .eq('user_id', user.id)
      .order('submitted_at', { ascending: false });

    if (hErr) {
      alert(`과제 조회 실패: ${hErr.message}`);
      setLoading(false);
      return;
    }

    const cleanedHomework = (hData ?? []).map((x: any) => ({
      ...x,
      media_urls: Array.isArray(x.media_urls) ? x.media_urls : x.url ? [x.url] : [],
    }));
    setHomeworks(cleanedHomework as any);

    // 모델작업
    const { data: mData, error: mErr } = await supabase
      .from('model_work_posts')
      .select('id,user_id,gender,title,comment,media_urls,created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (mErr) {
      alert(`모델작업 조회 실패: ${mErr.message}`);
      setLoading(false);
      return;
    }

    const cleanedModel = (mData ?? []).map((x: any) => ({
      ...x,
      media_urls: Array.isArray(x.media_urls) ? x.media_urls : [],
    }));
    setModelWorks(cleanedModel as any);

    setLoading(false);
  };

  // ===== 초기 로드 =====
  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const attendanceSet = useMemo(() => {
    const set = new Set<string>();
    (attendanceRows ?? []).forEach((r) => {
      const ok = String(r.status ?? '').toLowerCase() === 'present';
      if (ok && r.session_id) set.add(r.session_id);
    });
    return set;
  }, [attendanceRows]);

  const hasHomeworkForSession = (sessionId: string) => (homeworks ?? []).some((h) => h.session_id === sessionId);

  // ===== 버튼 활성 조건 =====
  const canCheckAttendance = (s: SessionRow) => {
    const end = new Date(s.end_at).getTime();
    return Date.now() <= end && !attendanceSet.has(s.id);
  };

  const canUploadHomework = (s: SessionRow) => {
    const end = new Date(s.end_at).getTime();
    const limit = end + HOMEWORK_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const now = Date.now();
    return now >= end && now <= limit;
  };

  // ===== 지난 강의(업로드 가능한 것만) =====
  const pastSessions = useMemo(() => {
    const now = Date.now();
    const todayIds = new Set((todaySessions ?? []).map((x) => x.id));
    return (mySessions ?? [])
      .filter((s) => {
        if (todayIds.has(s.id)) return false; // 오늘 강의는 위에 표시
        const end = new Date(s.end_at).getTime();
        const limit = end + HOMEWORK_WINDOW_DAYS * 24 * 60 * 60 * 1000;
        return now >= end && now <= limit;
      })
      .sort((a, b) => new Date(b.end_at).getTime() - new Date(a.end_at).getTime());
  }, [mySessions, todaySessions]);

  // ===== 통계 =====
  const myStats = useMemo(() => {
    const attendedCount = attendanceSet.size;

    // 과제는 "제출 row 개수" (회차당 1개를 강제하면 곧 과제 회차수)
    const homeworkCount = (homeworks ?? []).length;

    const maleCount = (modelWorks ?? []).filter((x) => x.gender === 'male').length;
    const femaleCount = (modelWorks ?? []).filter((x) => x.gender === 'female').length;

    const denom = Math.max(1, totalSessions);
    const attendanceRate = Math.round((attendedCount / denom) * 100);
    const homeworkRate = Math.round((homeworkCount / denom) * 100);

    return { attendanceRate, homeworkRate, maleCount, femaleCount };
  }, [attendanceSet, homeworks, modelWorks, totalSessions]);

  // ===== 내 피드(3열) =====
  const myFeed = useMemo(() => {
    const hw = (homeworks ?? [])
      .filter((x) => (Array.isArray(x.media_urls) && x.media_urls.length > 0) || !!x.url)
      .map((x) => {
        const first = Array.isArray(x.media_urls) && x.media_urls[0] ? x.media_urls[0] : x.url!;
        return {
          kind: 'homework' as const,
          id: String(x.id),
          thumbUrl: first,
          created_at: x.submitted_at ?? new Date().toISOString(),
        };
      });

    const mw = (modelWorks ?? [])
      .filter((x) => Array.isArray(x.media_urls) && x.media_urls.length > 0)
      .map((x) => ({
        kind: 'model' as const,
        id: x.id,
        thumbUrl: x.media_urls[0]!,
        created_at: x.created_at ?? new Date().toISOString(),
      }));

    const all = [...hw, ...mw].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    if (tab === 'homework') return hw;
    if (tab === 'model') return mw;
    return all;
  }, [homeworks, modelWorks, tab]);

  // ===== 출석 체크 =====
  const onCheckAttendance = async (session: SessionRow) => {
    if (!meId) return;

    const end = new Date(session.end_at).getTime();
    if (Date.now() > end) return;

    const payload = {
      session_id: session.id,
      user_id: meId,
      status: 'present',
      checked_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('session_attendance').upsert(payload, {
      onConflict: 'session_id,user_id',
    });

    if (error) {
      alert(`출석 저장 실패: ${error.message}`);
      return;
    }

    setAttendanceRows((prev) => {
      const rest = (prev ?? []).filter((x) => x.session_id !== session.id);
      return [...rest, payload as any];
    });
  };

  // ===== 과제 업로드(회차당 1개만) =====
  const onUploadHomework = async () => {
    if (!meId) return;

    if (!selectedHomeworkSessionId) {
      alert('어떤 강의의 과제인지 선택이 필요해요.');
      return;
    }

    // ✅ 이미 제출했으면 막기(삭제하면 homeworks state에서 없어져서 다시 가능)
    if (hasHomeworkForSession(selectedHomeworkSessionId)) {
      alert('이 강의 과제는 이미 업로드했어요. (삭제하면 다시 업로드 가능)');
      return;
    }

    const session = mySessions.find((s) => s.id === selectedHomeworkSessionId);
    if (!session) {
      alert('선택된 강의를 찾을 수 없어요.');
      return;
    }

    const end = new Date(session.end_at).getTime();
    const limit = end + HOMEWORK_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const now = Date.now();

    if (now < end) {
      alert('과제 업로드는 강의가 끝난 뒤부터 가능해요.');
      return;
    }
    if (now > limit) {
      alert(`과제 업로드 기간(강의 종료 후 ${HOMEWORK_WINDOW_DAYS}일)이 지났어요.`);
      return;
    }
    if (!hwFiles.length) {
      alert('파일을 1개 이상 선택해줘!');
      return;
    }

    setHwUploading(true);
    try {
      const urls = await Promise.all(hwFiles.map((f) => uploadToStorage('homework', f)));
      const note = [hwTitle.trim(), hwNote.trim()].filter(Boolean).join('\n\n') || null;

      const payload = {
        session_id: selectedHomeworkSessionId,
        user_id: meId,
        url: urls[0] ?? null, // 호환용
        media_urls: urls,
        note,
        submitted_at: new Date().toISOString(),
      };

      /**
       * ✅ 중요(DB)
       * 아래 upsert가 제대로 "1회차 1개"로 동작하려면
       * session_homework_submissions에 (user_id, session_id) 유니크 인덱스가 있어야 해요.
       * (이미 만들었다면 OK)
       */
      const { data, error } = await supabase
        .from('session_homework_submissions')
        .upsert(payload, { onConflict: 'user_id,session_id' })
        .select('id,session_id,user_id,url,media_urls,note,submitted_at')
        .maybeSingle();

      if (error) throw new Error(error.message);

      // state: 같은 session_id 기존꺼 있으면 교체
      setHomeworks((prev) => {
        const rest = (prev ?? []).filter((x) => x.session_id !== payload.session_id);
        const cleaned = {
          ...(data as any),
          media_urls: Array.isArray((data as any)?.media_urls)
            ? (data as any).media_urls
            : (data as any)?.url
              ? [(data as any).url]
              : [],
        };
        return [cleaned as any, ...rest];
      });

      setHwTitle('');
      setHwNote('');
      setHwFiles([]);
      setOpenHomeworkForm(false);
      setSelectedHomeworkSessionId(null);
      alert('과제 업로드 완료 ✅');
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (msg.toLowerCase().includes('bucket') && msg.toLowerCase().includes('not')) {
        alert(`업로드 실패: Bucket not found\n\nSupabase Storage에 "${BUCKET}" 버킷을 생성해줘!`);
      } else {
        alert(`업로드 실패: ${msg}`);
      }
    } finally {
      setHwUploading(false);
    }
  };

  // ===== 모델작업 업로드(여러 장) =====
  const onUploadModelWork = async () => {
    if (!meId) return;
    if (!mwFiles.length) {
      alert('파일을 1개 이상 선택해줘!');
      return;
    }

    setMwUploading(true);
    try {
      const urls = await Promise.all(mwFiles.map((f) => uploadToStorage('model', f)));

      const payload = {
        user_id: meId,
        gender: mwGender,
        title: mwTitle.trim() || null,
        comment: mwComment.trim() || null,
        media_urls: urls,
      };

      const { data, error } = await supabase
        .from('model_work_posts')
        .insert(payload)
        .select('id,user_id,gender,title,comment,media_urls,created_at')
        .maybeSingle();

      if (error) throw new Error(error.message);

      const cleaned = {
        ...(data as any),
        media_urls: Array.isArray((data as any)?.media_urls) ? (data as any).media_urls : [],
      };
      setModelWorks((prev) => [cleaned as any, ...(prev ?? [])]);

      setMwTitle('');
      setMwComment('');
      setMwFiles([]);
      setMwGender('male');
      setOpenModelForm(false);
      alert('모델작업 업로드 완료 ✅');
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (msg.toLowerCase().includes('bucket') && msg.toLowerCase().includes('not')) {
        alert(`업로드 실패: Bucket not found\n\nSupabase Storage에 "${BUCKET}" 버킷을 생성해줘!`);
      } else {
        alert(`업로드 실패: ${msg}`);
      }
    } finally {
      setMwUploading(false);
    }
  };

  // ===== 게시글 클릭 -> 모달 =====
  const openPost = (p: { kind: 'homework' | 'model'; id: string }) => {
    setEditFiles([]);
    setEditUploadingMedia(false);

    if (p.kind === 'homework') {
      const row = (homeworks ?? []).find((x) => String(x.id) === p.id);
      if (!row) return;
      setSelectedPost({ kind: 'homework', row });
      setEditTitle(''); // 과제는 title 컬럼이 없으니 note로만 관리
      setEditNoteOrComment(row.note ?? '');
      setPostModalOpen(true);
    } else {
      const row = (modelWorks ?? []).find((x) => x.id === p.id);
      if (!row) return;
      setSelectedPost({ kind: 'model', row });
      setEditTitle(row.title ?? '');
      setEditNoteOrComment(row.comment ?? '');
      setPostModalOpen(true);
    }
  };

  // ===== 게시글 수정(미디어 교체 가능) =====
  const savePostEdit = async () => {
    if (!selectedPost) return;

    setSavingEdit(true);
    try {
      if (selectedPost.kind === 'homework') {
        let media_urls: string[] | undefined;

        if (editFiles.length) {
          setEditUploadingMedia(true);
          const urls = await Promise.all(editFiles.map((f) => uploadToStorage('homework', f)));
          media_urls = urls;
          setEditUploadingMedia(false);
        }

        const payload: any = {
          note: editNoteOrComment.trim() || null,
        };

        if (media_urls) {
          payload.media_urls = media_urls;
          payload.url = media_urls[0] ?? null; // 호환용
          payload.submitted_at = new Date().toISOString(); // 수정 시 갱신(원치 않으면 제거)
        }

        const { error } = await supabase
          .from('session_homework_submissions')
          .update(payload)
          .eq('id', selectedPost.row.id);

        if (error) throw new Error(error.message);

        // state 갱신
        setHomeworks((prev) =>
          (prev ?? []).map((x) =>
            x.id === selectedPost.row.id
              ? {
                  ...x,
                  note: payload.note,
                  ...(media_urls
                    ? { media_urls, url: media_urls[0] ?? null, submitted_at: payload.submitted_at ?? x.submitted_at }
                    : {}),
                }
              : x
          )
        );

        setEditFiles([]);
      } else {
        let media_urls: string[] | undefined;

        if (editFiles.length) {
          setEditUploadingMedia(true);
          const urls = await Promise.all(editFiles.map((f) => uploadToStorage('model', f)));
          media_urls = urls;
          setEditUploadingMedia(false);
        }

        const payload: any = {
          title: editTitle.trim() || null,
          comment: editNoteOrComment.trim() || null,
        };
        if (media_urls) payload.media_urls = media_urls;

        const { error } = await supabase.from('model_work_posts').update(payload).eq('id', selectedPost.row.id);
        if (error) throw new Error(error.message);

        setModelWorks((prev) =>
          (prev ?? []).map((x) =>
            x.id === selectedPost.row.id
              ? { ...x, title: payload.title, comment: payload.comment, ...(media_urls ? { media_urls } : {}) }
              : x
          )
        );

        setEditFiles([]);
      }

      alert('수정 완료 ✅');
    } catch (e: any) {
      alert(`수정 실패: ${String(e?.message ?? e)}`);
    } finally {
      setSavingEdit(false);
      setEditUploadingMedia(false);
    }
  };

  // ===== 게시글 삭제 =====
  const deletePost = async () => {
    if (!selectedPost) return;
    if (!confirm('정말 삭제할까요?')) return;

    setDeleting(true);
    try {
      if (selectedPost.kind === 'homework') {
        const { error } = await supabase.from('session_homework_submissions').delete().eq('id', selectedPost.row.id);
        if (error) throw new Error(error.message);

        setHomeworks((prev) => (prev ?? []).filter((x) => x.id !== selectedPost.row.id));
      } else {
        const { error } = await supabase.from('model_work_posts').delete().eq('id', selectedPost.row.id);
        if (error) throw new Error(error.message);

        setModelWorks((prev) => (prev ?? []).filter((x) => x.id !== selectedPost.row.id));
      }

      setPostModalOpen(false);
      setSelectedPost(null);
      alert('삭제 완료 ✅');

      // ✅ “다른 페이지 갔다오면 다시 살아남” 방지용으로 한번 더 동기화
      await loadAll();
    } catch (e: any) {
      alert(`삭제 실패: ${String(e?.message ?? e)}`);
    } finally {
      setDeleting(false);
    }
  };

  // ===== UI =====
  const headerTitle = '출석';
  const headerSub = '오늘 강의부터, 꾸준함을 기록해요 🌿';

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-sm text-neutral-600">불러오는 중…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      {/* 헤더 */}
      <div className="sticky top-0 z-20 bg-neutral-50/90 backdrop-blur border-b border-neutral-100">
        <div className="mx-auto w-full max-w-3xl px-4 py-3">
          <div className="text-sm font-semibold text-neutral-900">{headerTitle}</div>
          <div className="text-xs text-neutral-500 mt-0.5">{headerSub}</div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-3xl px-4 py-4 space-y-4">
        {/* 오늘 강의 */}
        <section className="bg-white rounded-2xl border border-neutral-100 p-4">
          <div className="text-sm font-semibold text-neutral-900">오늘 강의</div>

          {todaySessions.length === 0 ? (
            <div className="mt-3 text-sm text-neutral-500">오늘 예정된 강의가 없어요 🙂</div>
          ) : (
            <div className="mt-3 space-y-3">
              {todaySessions.map((s) => {
                const attended = attendanceSet.has(s.id);
                const canHw = canUploadHomework(s);
                const hasHw = hasHomeworkForSession(s.id);

                return (
                  <div key={s.id} className="rounded-2xl border border-neutral-100 p-3">
                    <div className="text-xs text-neutral-500 flex flex-wrap gap-2 items-center">
                      <span className="px-2 py-[2px] rounded-full bg-neutral-100 text-neutral-700">{s.title}</span>
                      <span className="px-2 py-[2px] rounded-full bg-neutral-100 text-neutral-700">{s.region ?? '지역'}</span>
                      <span className="px-2 py-[2px] rounded-full bg-neutral-100 text-neutral-700">{s.level ?? '레벨'}</span>
                      <span className="text-neutral-300">·</span>
                      <span>{formatKoreanDate(s.start_at)}</span>
                      <span className="text-neutral-300">·</span>
                      <span>{formatTimeRange(s.start_at, s.end_at)}</span>
                    </div>

                    {(s.instructors?.length ?? 0) > 0 ? (
  <div className="mt-2 text-[11px] text-neutral-600">
    강사: <span className="font-medium">{formatInstructors(s.instructors)}</span>
  </div>
) : null}

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => onCheckAttendance(s)}
                        disabled={attended || !canCheckAttendance(s)}
                        className={cn(
                          'rounded-2xl px-4 py-4 text-sm font-semibold border',
                          !attended && canCheckAttendance(s)
                            ? 'bg-neutral-900 text-white border-neutral-900'
                            : 'bg-neutral-100 text-neutral-400 border-neutral-100'
                        )}
                      >
                        {attended ? '출석 완료 ✅' : '출석하기'}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (!canHw || hasHw) return;
                          setSelectedHomeworkSessionId(s.id);
                          setOpenHomeworkForm(true);
                          setOpenModelForm(false);
                        }}
                        disabled={!canHw || hasHw}
                        className={cn(
                          'rounded-2xl px-4 py-4 text-sm font-semibold border',
                          canHw && !hasHw
                            ? 'bg-white text-neutral-900 border-neutral-200 hover:bg-neutral-50'
                            : 'bg-neutral-100 text-neutral-400 border-neutral-100'
                        )}
                      >
                        {hasHw ? '과제 업로드 완료됨' : '과제 업로드하기'}
                      </button>
                    </div>

                    <div className="mt-2 text-[11px] text-neutral-500">
                      · 출석: 강의가 끝나기 전까지만 가능 · 과제: 강의 종료 후 {HOMEWORK_WINDOW_DAYS}일까지 가능
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 지난 강의(업로드 가능한 것) */}
        <section className="bg-white rounded-2xl border border-neutral-100 p-4">
          <div className="text-sm font-semibold text-neutral-900">지난 강의</div>
          <div className="text-xs text-neutral-500 mt-1">강의 종료 후 {HOMEWORK_WINDOW_DAYS}일 이내 과제 업로드 가능</div>

          {pastSessions.length === 0 ? (
            <div className="mt-3 text-sm text-neutral-500">업로드 가능한 지난 강의가 없어요 🙂</div>
          ) : (
            <div className="mt-3 space-y-3">
              {pastSessions.map((s) => {
                const canHw = canUploadHomework(s);
                const hasHw = hasHomeworkForSession(s.id);

                return (
                  <div key={s.id} className="rounded-2xl border border-neutral-100 p-3">
                    <div className="text-xs text-neutral-500 flex flex-wrap gap-2 items-center">
                      <span className="px-2 py-[2px] rounded-full bg-neutral-100 text-neutral-700">{s.title}</span>
                      <span className="px-2 py-[2px] rounded-full bg-neutral-100 text-neutral-700">{s.region ?? '지역'}</span>
                      <span className="px-2 py-[2px] rounded-full bg-neutral-100 text-neutral-700">{s.level ?? '레벨'}</span>
                      <span className="text-neutral-300">·</span>
                      <span>{formatKoreanDate(s.start_at)}</span>
                      <span className="text-neutral-300">·</span>
                      <span>{formatTimeRange(s.start_at, s.end_at)}</span>
                    </div>

                    {(s.instructors?.length ?? 0) > 0 ? (
  <div className="mt-2 text-[11px] text-neutral-600">
    강사: <span className="font-medium">{formatInstructors(s.instructors)}</span>
  </div>
) : null}

                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => {
                          if (!canHw || hasHw) return;
                          setSelectedHomeworkSessionId(s.id);
                          setOpenHomeworkForm(true);
                          setOpenModelForm(false);
                        }}
                        disabled={!canHw || hasHw}
                        className={cn(
                          'w-full rounded-2xl px-4 py-4 text-sm font-semibold border',
                          canHw && !hasHw
                            ? 'bg-white text-neutral-900 border-neutral-200 hover:bg-neutral-50'
                            : 'bg-neutral-100 text-neutral-400 border-neutral-100'
                        )}
                      >
                        {hasHw ? '과제 업로드 완료됨' : '과제 업로드하기'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 내 현황 요약 */}
        <section className="bg-white rounded-2xl border border-neutral-100 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-neutral-900">내 현황 요약</div>
              <div className="text-xs text-neutral-500 mt-0.5">꾸준함이 실력이다. 오늘도 한 칸 ✅</div>
            </div>
            <div className="text-xs text-neutral-400">{totalSessions}회 기준</div>
          </div>

          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="rounded-2xl border border-neutral-100 p-3">
              <div className="text-[11px] text-neutral-500">출석률</div>
              <div className="mt-1 text-lg font-semibold text-neutral-900">{myStats.attendanceRate}%</div>
            </div>
            <div className="rounded-2xl border border-neutral-100 p-3">
              <div className="text-[11px] text-neutral-500">과제률</div>
              <div className="mt-1 text-lg font-semibold text-neutral-900">{myStats.homeworkRate}%</div>
            </div>
            <div className="rounded-2xl border border-neutral-100 p-3">
              <div className="text-[11px] text-neutral-500">남자 모델작업</div>
              <div className="mt-1 text-lg font-semibold text-neutral-900">{myStats.maleCount}개</div>
            </div>
            <div className="rounded-2xl border border-neutral-100 p-3">
              <div className="text-[11px] text-neutral-500">여자 모델작업</div>
              <div className="mt-1 text-lg font-semibold text-neutral-900">{myStats.femaleCount}개</div>
            </div>
          </div>

        </section>

        {/* 식구 검색 (검색바처럼) */}
<section className="bg-white rounded-2xl border border-neutral-100 p-4">
  <div className="text-sm font-semibold text-neutral-900">식구 검색</div>
  <div className="text-xs text-neutral-500 mt-1">강사 프로필탭과 동일한 UI로 식구 현황/피드 보기</div>

  <button
    type="button"
    onClick={() => setUserSearchOpen(true)}
    className="mt-3 w-full flex items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm hover:bg-neutral-50"
  >
    <div className="flex items-center gap-2 text-neutral-600">
      <span className="text-neutral-400">🔎</span>
      <span>이름/이메일/전화번호로 검색</span>
    </div>
    <span className="text-neutral-400">열기</span>
  </button>
</section>

        {/* 탭 */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTab('all')}
            className={cn(
              'px-4 py-2 rounded-full text-sm border',
              tab === 'all' ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white border-neutral-200 text-neutral-700'
            )}
          >
            전체
          </button>
          <button
            type="button"
            onClick={() => setTab('homework')}
            className={cn(
              'px-4 py-2 rounded-full text-sm border',
              tab === 'homework'
                ? 'bg-neutral-900 text-white border-neutral-900'
                : 'bg-white border-neutral-200 text-neutral-700'
            )}
          >
            과제
          </button>
          <button
            type="button"
            onClick={() => setTab('model')}
            className={cn(
              'px-4 py-2 rounded-full text-sm border',
              tab === 'model'
                ? 'bg-neutral-900 text-white border-neutral-900'
                : 'bg-white border-neutral-200 text-neutral-700'
            )}
          >
            모델작업
          </button>
        </div>

        {/* 과제 업로드 패널 */}
        {openHomeworkForm && (
          <section className="bg-white rounded-2xl border border-neutral-100 p-4">
            <div className="text-sm font-semibold text-neutral-900">과제 업로드</div>
            <div className="mt-1 text-xs text-neutral-500">
              {selectedHomeworkSessionId
                ? (() => {
                    const s = mySessions.find((x) => x.id === selectedHomeworkSessionId);
                    return s
                      ? `선택된 강의: ${s.title} · ${s.region ?? '지역'} · ${s.level ?? '레벨'}`
                      : '선택된 강의 정보를 찾을 수 없어요.';
                  })()
                : '강의를 선택해 주세요.'}
            </div>

            <div className="mt-3 space-y-2">
              <input
                value={hwTitle}
                onChange={(e) => setHwTitle(e.target.value)}
                placeholder="과제 제목(선택)"
                className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
              />
              <textarea
                value={hwNote}
                onChange={(e) => setHwNote(e.target.value)}
                placeholder="코멘트(선택)"
                className="w-full min-h-[90px] rounded-xl border border-neutral-200 px-3 py-2 text-sm"
              />
              <input
                type="file"
                multiple
                accept="image/*,video/*"
                onChange={(e) => setHwFiles(Array.from(e.target.files ?? []))}
                className="block w-full text-sm"
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onUploadHomework}
                  disabled={hwUploading}
                  className={cn(
                    'flex-1 rounded-xl px-4 py-3 text-sm font-semibold',
                    hwUploading ? 'bg-neutral-200 text-neutral-500' : 'bg-neutral-100 text-neutral-900 hover:bg-neutral-200'
                  )}
                >
                  {hwUploading ? '업로드 중…' : '과제 업로드 완료하기'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpenHomeworkForm(false);
                    setSelectedHomeworkSessionId(null);
                    setHwTitle('');
                    setHwNote('');
                    setHwFiles([]);
                  }}
                  className="rounded-xl px-4 py-3 text-sm font-semibold border border-neutral-200 bg-white hover:bg-neutral-50"
                >
                  닫기
                </button>
              </div>
            </div>
          </section>
        )}

        {/* 모델작업 업로드 */}
        <section className="bg-white rounded-2xl border border-neutral-100 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-neutral-900">모델작업 업로드</div>
              <div className="mt-1 text-xs text-neutral-500">사진/영상 여러 장 + 제목 + 코멘트 + 남/여 선택</div>
            </div>

            <button
              type="button"
              onClick={() => {
                setOpenModelForm((v) => !v);
                setOpenHomeworkForm(false);
              }}
              className="px-3 py-2 rounded-xl border border-neutral-200 bg-white text-sm hover:bg-neutral-50"
            >
              {openModelForm ? '닫기' : '모델작업 업로드하기'}
            </button>
          </div>

          {openModelForm && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMwGender('male')}
                  className={cn(
                    'px-3 py-2 rounded-xl text-sm border',
                    mwGender === 'male'
                      ? 'bg-neutral-900 text-white border-neutral-900'
                      : 'bg-white border-neutral-200 text-neutral-700'
                  )}
                >
                  남자
                </button>
                <button
                  type="button"
                  onClick={() => setMwGender('female')}
                  className={cn(
                    'px-3 py-2 rounded-xl text-sm border',
                    mwGender === 'female'
                      ? 'bg-neutral-900 text-white border-neutral-900'
                      : 'bg-white border-neutral-200 text-neutral-700'
                  )}
                >
                  여자
                </button>
              </div>

              <input
                value={mwTitle}
                onChange={(e) => setMwTitle(e.target.value)}
                placeholder="모델작업 제목"
                className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
              />
              <textarea
                value={mwComment}
                onChange={(e) => setMwComment(e.target.value)}
                placeholder="코멘트(선택)"
                className="w-full min-h-[90px] rounded-xl border border-neutral-200 px-3 py-2 text-sm"
              />
              <input
                type="file"
                multiple
                accept="image/*,video/*"
                onChange={(e) => setMwFiles(Array.from(e.target.files ?? []))}
                className="block w-full text-sm"
              />

              <button
                type="button"
                onClick={onUploadModelWork}
                disabled={mwUploading}
                className={cn(
                  'w-full rounded-xl px-4 py-3 text-sm font-semibold',
                  mwUploading ? 'bg-neutral-200 text-neutral-500' : 'bg-neutral-100 text-neutral-900 hover:bg-neutral-200'
                )}
              >
                {mwUploading ? '업로드 중…' : '모델작업 업로드 완료하기'}
              </button>
            </div>
          )}
        </section>

        {/* 내 피드 */}
        <section className="bg-white rounded-2xl border border-neutral-100 p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-neutral-900">내 피드</div>
            <div className="text-xs text-neutral-400">
              {tab === 'all' ? '전체' : tab === 'homework' ? '과제' : '모델작업'}
            </div>
          </div>

          {myFeed.length === 0 ? (
            <div className="mt-3 text-sm text-neutral-500">아직 업로드한 게시글이 없어요 🙂</div>
          ) : (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {myFeed.map((p) => (
                <button
                  key={`${p.kind}:${p.id}`}
                  type="button"
                  onClick={() => openPost({ kind: p.kind, id: p.id })}
                  className="text-left"
                  title="클릭해서 자세히 보기"
                >
                  <MediaThumb url={p.thumbUrl} />
                </button>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* 게시글 디테일 + 수정/삭제 모달 */}
      <Modal
        open={postModalOpen}
        onClose={() => {
          setPostModalOpen(false);
          setSelectedPost(null);
          setEditFiles([]);
          setEditUploadingMedia(false);
        }}
      >
        {!selectedPost ? null : (
          <div className="space-y-3 pb-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-neutral-900">
                  {selectedPost.kind === 'homework' ? '과제 게시글' : '모델작업 게시글'}
                </div>
                <div className="text-xs text-neutral-500 mt-1">{myProfile?.name ? myProfile.name : '나'}</div>

                {/* ✅ 과제: 어느 강의 과제인지 표시 */}
                {selectedPost.kind === 'homework' && (
                  <div className="mt-2 text-xs text-neutral-600">
                    {(() => {
                      const s = mySessions.find((x) => x.id === selectedPost.row.session_id);
                      if (!s) return '어느 강의 과제인지 정보를 찾을 수 없어요.';
                      return `강의: ${s.title} · ${s.region ?? '지역'} · ${s.level ?? '레벨'} · ${formatKoreanDate(
                        s.start_at
                      )} · ${formatTimeRange(s.start_at, s.end_at)}`;
                    })()}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setPostModalOpen(false);
                  setSelectedPost(null);
                  setEditFiles([]);
                  setEditUploadingMedia(false);
                }}
                className="px-3 py-2 rounded-xl border border-neutral-200 text-sm"
              >
                닫기
              </button>
            </div>

            {/* ✅ 미디어(여러 장 표시) */}
            {(() => {
              const urls =
                selectedPost.kind === 'homework'
                  ? selectedPost.row.media_urls?.length
                    ? selectedPost.row.media_urls
                    : selectedPost.row.url
                      ? [selectedPost.row.url]
                      : []
                  : selectedPost.row.media_urls?.length
                    ? selectedPost.row.media_urls
                    : [];

              if (!urls.length) return null;

              return (
                <div className="grid grid-cols-2 gap-2">
                  {urls.map((u) => (
                    <div key={u} className="rounded-2xl overflow-hidden border border-neutral-100">
                      {isVideoUrl(u) ? (
                        <video src={u} controls className="w-full max-h-[40vh] object-contain bg-black" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={u} alt="" className="w-full max-h-[40vh] object-contain bg-neutral-50" />
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* 수정 폼 */}
            <div className="rounded-2xl border border-neutral-100 p-3 space-y-2">
              {selectedPost.kind === 'model' && (
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="제목"
                  className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              )}

              <input
                type="file"
                multiple
                accept="image/*,video/*"
                onChange={(e) => setEditFiles(Array.from(e.target.files ?? []))}
                className="block w-full text-sm"
              />
              <div className="text-[11px] text-neutral-500">
                파일을 선택하면 <b>기존 미디어를 교체</b>합니다. (선택 안 하면 텍스트만 수정)
              </div>

              <textarea
                value={editNoteOrComment}
                onChange={(e) => setEditNoteOrComment(e.target.value)}
                placeholder={selectedPost.kind === 'homework' ? 'note(제목/코멘트 포함)' : '코멘트'}
                className="w-full min-h-[90px] rounded-xl border border-neutral-200 px-3 py-2 text-sm"
              />

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={savePostEdit}
                  disabled={savingEdit || editUploadingMedia}
                  className={cn(
                    'rounded-xl px-4 py-3 text-sm font-semibold',
                    savingEdit || editUploadingMedia ? 'bg-neutral-200 text-neutral-500' : 'bg-neutral-900 text-white'
                  )}
                >
                  {editUploadingMedia ? '미디어 업로드 중…' : savingEdit ? '저장 중…' : '수정 저장'}
                </button>

                <button
                  type="button"
                  onClick={deletePost}
                  disabled={deleting}
                  className={cn(
                    'rounded-xl px-4 py-3 text-sm font-semibold border',
                    deleting ? 'bg-neutral-100 text-neutral-400 border-neutral-100' : 'bg-white text-rose-700 border-rose-200'
                  )}
                >
                  {deleting ? '삭제 중…' : '삭제'}
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
      {/* ✅ 식구 검색 바텀시트 (강사 프로필탭과 동일 UI) */}
<Modal open={userSearchOpen} onClose={() => setUserSearchOpen(false)}>
  <div className="space-y-3 pb-4">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-neutral-900">식구 검색</div>
        <div className="text-xs text-neutral-500 mt-1">식구 현황 + 피드 보기</div>
      </div>

      <button
        type="button"
        onClick={() => setUserSearchOpen(false)}
        className="px-3 py-2 rounded-xl border border-neutral-200 text-sm"
      >
        닫기
      </button>
    </div>

    <UserSearchAdmin isAdmin={false} showAdminActions={false} />
  </div>
</Modal>
    </div>
  );
}