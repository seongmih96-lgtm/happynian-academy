'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

type PendingUser = {
  id: string
  email: string
  name: string | null
}

export default function AdminApprovalsPage() {
  const [users, setUsers] = useState<PendingUser[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPendingUsers = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, email, name')
        .eq('status', 'pending')

      if (!error && data) {
        setUsers(
          data.map((u) => ({
            id: u.user_id,
            email: u.email,
            name: u.name,
          }))
        )
      }

      setLoading(false)
    }

    fetchPendingUsers()
  }, [])

  const updateStatus = async (userId: string, status: 'approved' | 'rejected') => {
    await supabase
      .from('profiles')
      .update({ status })
      .eq('user_id', userId)

    // 화면에서도 제거
    setUsers((prev) => prev.filter((u) => u.id !== userId))
  }

  if (loading) return <p style={{ padding: 40 }}>로딩 중...</p>

  return (
    <div style={{ padding: 40 }}>
      <h1>관리자 승인 페이지</h1>
      <p>승인 대기 중인 사용자 목록입니다.</p>

      {users.length === 0 ? (
        <p>승인 대기 사용자가 없습니다.</p>
      ) : (
        <table border={1} cellPadding={10} style={{ marginTop: 20 }}>
          <thead>
            <tr>
              <th>이름</th>
              <th>이메일</th>
              <th>액션</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.name ?? '-'}</td>
                <td>{user.email}</td>
                <td>
                  <button
                    style={{ marginRight: 8 }}
                    onClick={() => updateStatus(user.id, 'approved')}
                  >
                    승인
                  </button>
                  <button onClick={() => updateStatus(user.id, 'rejected')}>
                    거절
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
