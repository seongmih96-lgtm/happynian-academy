'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

export default function PendingPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState<string | null>(null)
  const [name, setName] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('pending')
  const [role, setRole] = useState<string>('student')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      setErrorMsg(null)

      const { data: userRes, error: userErr } = await supabase.auth.getUser()
      const user = userRes?.user

      if (userErr || !user) {
        router.replace('/login')
        return
      }

      setEmail(user.email ?? null)

      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('name, status, role')     // ✅ role
        .eq('user_id', user.id)
        .single()

      if (profileErr || !profile) {
        setErrorMsg(`프로필을 불러오지 못했어요. (${profileErr?.message ?? 'unknown'})`)
        setLoading(false)
        return
      }

      const nextRole = profile.role ?? 'student'
      const nextStatus = profile.status ?? 'pending'

      setName(profile.name ?? null)
      setRole(nextRole)
      setStatus(nextStatus)

      // ✅ 우선순위: admin 먼저 보내기
      if (nextRole === 'admin') {
        router.replace('/admin/approvals')
        return
      }

      if (nextStatus === 'approved') {
        router.replace('/home')
        return
      }

      setLoading(false)
    }

    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleLogout = async () => {
    setErrorMsg(null)
    const { error } = await supabase.auth.signOut()
    if (error) {
      setErrorMsg('로그아웃에 실패했어요. 다시 시도해 주세요.')
      return
    }
    router.replace('/login')
    router.refresh()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-lg font-semibold">확인 중...</div>
          <div className="text-sm text-gray-500 mt-2">잠시만 기다려 주세요</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow p-6">
        <div className="text-2xl font-bold">승인 대기 중</div>
        <div className="text-sm text-gray-500 mt-2">
          관리자가 확인 후 승인하면 바로 이용할 수 있어요.
        </div>

        <div className="mt-6 space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">이메일</span>
            <span className="font-medium">{email ?? '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">이름</span>
            <span className="font-medium">{name ?? '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">상태</span>
            <span className="font-medium">{status}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">권한</span>
            <span className="font-medium">{role}</span>
          </div>
        </div>

        {errorMsg && (
          <div className="mt-4 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
            {errorMsg}
          </div>
        )}

        <div className="mt-6">
          <button
            onClick={handleLogout}
            className="w-full rounded-xl bg-black text-white py-3 font-semibold"
          >
            로그아웃
          </button>
          <div className="text-xs text-gray-500 mt-3 text-center">
            승인 완료 후 다시 로그인하면 자동으로 홈으로 이동해요.
          </div>
        </div>
      </div>
    </div>
  )
}