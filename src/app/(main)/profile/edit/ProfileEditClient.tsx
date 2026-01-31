'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

const AVATAR_BUCKET = 'avatars';

function getExt(name: string) {
  const idx = name.lastIndexOf('.');
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : 'jpg';
}

function buildPublicUrl(path: string) {
  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export default function ProfileEditClient({ profile }: { profile: any }) {
  const router = useRouter();
  const [name, setName] = useState(profile?.name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [saving, setSaving] = useState(false);

  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile?.avatar_url ?? null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  const canSave = useMemo(() => name.trim().length > 0, [name]);

  const onPickAvatar = (file: File | null) => {
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const uploadAvatarIfNeeded = async () => {
    if (!avatarFile) return profile?.avatar_url ?? null;

    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) throw new Error('로그인이 필요해요.');

    const ext = getExt(avatarFile.name);
    const path = `u/${user.id}/avatar.${ext}`;

    const { error: upErr } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(path, avatarFile, { upsert: true, contentType: avatarFile.type });

    if (upErr) throw upErr;

    return buildPublicUrl(path);
  };

  const save = async () => {
    if (!canSave) return;
    try {
      setSaving(true);

      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;
      if (!user) throw new Error('로그인이 필요해요.');

      const avatar_url = await uploadAvatarIfNeeded();

      const { error } = await supabase
        .from('profiles')
        .update({
          name: name.trim(),
          phone: phone.trim() || null,
          avatar_url,
        })
        .eq('user_id', user.id);

      if (error) throw error;

      router.replace('/profile');
      router.refresh();
    } catch (e: any) {
      alert(e?.message ?? '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="px-4 py-4 space-y-4">
      <div className="bg-white rounded-2xl border border-neutral-100 p-4">
        <div className="text-sm font-semibold text-neutral-900">프로필 수정</div>

        <div className="mt-4 flex items-center gap-3">
          <div className="w-16 h-16 rounded-full bg-neutral-200 overflow-hidden">
            {avatarPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" />
            ) : null}
          </div>

          <label className="text-sm">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onPickAvatar(e.target.files?.[0] ?? null)}
            />
            <span className="inline-flex items-center px-3 py-2 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 cursor-pointer">
              아바타 업로드
            </span>
          </label>
        </div>

        <div className="mt-4 space-y-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="이름"
            className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="전화번호"
            className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
          />
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 text-sm"
          >
            취소
          </button>
          <button
            type="button"
            disabled={!canSave || saving}
            onClick={save}
            className="ml-auto px-4 py-2 rounded-xl bg-neutral-900 text-white text-sm disabled:bg-neutral-200 disabled:text-neutral-500"
          >
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </main>
  );
}