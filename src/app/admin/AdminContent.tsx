'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Users, Calendar, CreditCard, FileText, Check, X,
  AlertCircle, Clock, RefreshCw, Loader2, ChevronLeft,
  UserCheck, Pause
} from 'lucide-react';
import { cn, formatKoreanDate, formatCurrency, getRegionColor, getLevelColor } from '@/lib/utils';
import { USER_STATUS_LABELS } from '@/lib/constants';
import type { Profile, Session, Payment, WebhookLog } from '@/types';

type Tab = 'pending' | 'users' | 'sessions' | 'payments' | 'logs';
type Action = 'approve' | 'reject' | 'suspend' | 'reactivate';

interface AdminContentProps {
  pendingUsers: Profile[];
  recentUsers: Profile[];
  recentSessions: Session[];
  unpaidPayments: (Payment & { profile: { name: string; email: string; region: string; level: string } })[];
  webhookLogs: WebhookLog[];
}

export function AdminContent({
  pendingUsers,
  recentUsers,
  recentSessions,
  unpaidPayments,
  webhookLogs,
}: AdminContentProps) {
  const router = useRouter();

  // ✅ 서버에서 받은 데이터를 "화면용 상태"로 복사해 즉시 반영 가능하게 만듦
  const [pendingList, setPendingList] = useState<Profile[]>(pendingUsers);
  const [userList, setUserList] = useState<Profile[]>(recentUsers);

  // 서버 props가 바뀌면(=router.refresh 이후) 다시 동기화
  useEffect(() => setPendingList(pendingUsers), [pendingUsers]);
  useEffect(() => setUserList(recentUsers), [recentUsers]);

  const [activeTab, setActiveTab] = useState<Tab>('pending');
  const [loadingKey, setLoadingKey] = useState<string | null>(null); // 예: `${userId}:${action}`

  const tabs = useMemo(() => ([
    { id: 'pending' as Tab, label: '승인 대기', icon: Clock, count: pendingList.length },
    { id: 'users' as Tab, label: '회원 관리', icon: Users },
    { id: 'sessions' as Tab, label: '세션', icon: Calendar },
    { id: 'payments' as Tab, label: '납부', icon: CreditCard },
    { id: 'logs' as Tab, label: '로그', icon: FileText },
  ]), [pendingList.length]);

  const handleUserAction = async (userId: string, action: Action) => {
    const key = `${userId}:${action}`;
    setLoadingKey(key);

    try {
      const response = await fetch('/api/admin/approve-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, action }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        alert(`오류: ${error?.error ?? '처리 실패'}`);
        return;
      }

      // ✅ 1) 화면에서 즉시 제거/갱신 (체감 속도)
      if (action === 'approve' || action === 'reject') {
        setPendingList((prev) => prev.filter((u) => u.user_id !== userId));
      }

      if (action === 'suspend') {
        setUserList((prev) =>
          prev.map((u) => (u.user_id === userId ? { ...u, status: 'suspended' } : u))
        );
      }

      if (action === 'reactivate') {
        setUserList((prev) =>
          prev.map((u) => (u.user_id === userId ? { ...u, status: 'approved' } : u))
        );
      }

      // ✅ 2) 서버 데이터도 동기화 (권장)
      router.refresh();
    } catch {
      alert('처리 중 오류가 발생했습니다.');
    } finally {
      setLoadingKey(null);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="sticky top-0 z-40 bg-white border-b border-neutral-100">
        <div className="px-4 py-3 flex items-center gap-3">
          <Link href="/home" className="p-2 -ml-2 hover:bg-neutral-100 rounded-lg">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-lg font-bold text-neutral-900">관리자 대시보드</h1>
        </div>

        <div className="px-4 pb-2 flex gap-2 overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
                  activeTab === tab.id
                    ? 'bg-primary-500 text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span
                    className={cn(
                      'ml-1 px-1.5 py-0.5 text-xs rounded-full',
                      activeTab === tab.id ? 'bg-white/20' : 'bg-red-500 text-white'
                    )}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      <main className="px-4 py-4">
        {activeTab === 'pending' && (
          <div className="space-y-3">
            {pendingList.length === 0 ? (
              <div className="text-center py-12 text-neutral-500">
                <UserCheck className="w-12 h-12 mx-auto mb-3 text-neutral-300" />
                <p>승인 대기 중인 회원이 없습니다</p>
              </div>
            ) : (
              pendingList.map((user) => (
                <UserCard
                  key={user.user_id}
                  user={user}
                  loadingApprove={loadingKey === `${user.user_id}:approve`}
                  loadingReject={loadingKey === `${user.user_id}:reject`}
                  onApprove={() => handleUserAction(user.user_id, 'approve')}
                  onReject={() => handleUserAction(user.user_id, 'reject')}
                  showActions
                />
              ))
            )}
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-3">
            {userList.map((user) => (
              <UserCard
                key={user.user_id}
                user={user}
                loadingSuspend={loadingKey === `${user.user_id}:suspend`}
                loadingReactivate={loadingKey === `${user.user_id}:reactivate`}
                onSuspend={() => handleUserAction(user.user_id, 'suspend')}
                onReactivate={() => handleUserAction(user.user_id, 'reactivate')}
                showStatus
              />
            ))}
          </div>
        )}

        {activeTab === 'sessions' && (
          <div className="space-y-3">
            {recentSessions.map((session) => (
              <div key={session.id} className="card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className={cn('badge text-xs', getRegionColor(session.region))}>
                    {session.region}
                  </span>
                  <span className={cn('badge text-xs', getLevelColor(session.level))}>
                    {session.level}
                  </span>
                  <span className="text-xs text-neutral-400">{session.session_no}회차</span>
                </div>
                <h3 className="font-medium text-neutral-900">{session.title}</h3>
                <p className="text-sm text-neutral-500 mt-1">
                  {formatKoreanDate(session.start_at, 'M월 d일 (E) HH:mm')}
                </p>
                {session.instructor && (
                  <p className="text-sm text-neutral-400 mt-1">강사: {session.instructor}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="space-y-3">
            <div className="banner banner-warning">
              <AlertCircle className="w-5 h-5" />
              <p className="text-sm">미납 건수: {unpaidPayments.length}건</p>
            </div>
            {unpaidPayments.map((payment) => (
              <div key={payment.id} className="card p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-neutral-900">{payment.profile?.name}</h3>
                    <p className="text-sm text-neutral-500">{payment.profile?.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={cn('badge text-xs', getRegionColor(payment.profile?.region || ''))}>
                        {payment.profile?.region}
                      </span>
                      <span className={cn('badge text-xs', getLevelColor(payment.profile?.level || ''))}>
                        {payment.profile?.level}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-neutral-900">{formatCurrency(payment.amount)}</p>
                    <p className="text-sm text-neutral-500">{payment.month}</p>
                    <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded mt-1 inline-block">
                      미납
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="space-y-2">
            {webhookLogs.map((log) => (
              <div key={log.id} className="card p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'text-xs px-2 py-0.5 rounded',
                        log.status === 'success'
                          ? 'bg-green-100 text-green-700'
                          : log.status === 'partial'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-red-100 text-red-700'
                      )}
                    >
                      {log.status}
                    </span>
                    <span className="text-sm font-medium">{log.event_type}</span>
                  </div>
                  <span className="text-xs text-neutral-400">
                    {formatKoreanDate(log.created_at, 'M/d HH:mm')}
                  </span>
                </div>
                {log.error_message && (
                  <p className="text-xs text-red-500 mt-1 truncate">{log.error_message}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

interface UserCardProps {
  user: Profile;
  showActions?: boolean;
  showStatus?: boolean;

  loadingApprove?: boolean;
  loadingReject?: boolean;
  loadingSuspend?: boolean;
  loadingReactivate?: boolean;

  onApprove?: () => void;
  onReject?: () => void;
  onSuspend?: () => void;
  onReactivate?: () => void;
}

function UserCard({
  user,
  showActions,
  showStatus,
  loadingApprove,
  loadingReject,
  loadingSuspend,
  loadingReactivate,
  onApprove,
  onReject,
  onSuspend,
  onReactivate,
}: UserCardProps) {
  const anyLoading = !!(loadingApprove || loadingReject || loadingSuspend || loadingReactivate);

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium text-neutral-900">{user.name}</h3>
            {showStatus && (
              <span
                className={cn(
                  'text-xs px-2 py-0.5 rounded',
                  user.status === 'approved'
                    ? 'bg-green-100 text-green-700'
                    : user.status === 'pending'
                    ? 'bg-amber-100 text-amber-700'
                    : user.status === 'suspended'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-neutral-100 text-neutral-700'
                )}
              >
                {USER_STATUS_LABELS[user.status]}
              </span>
            )}
          </div>

          <p className="text-sm text-neutral-500">{user.email}</p>
          {user.phone && <p className="text-sm text-neutral-400">{user.phone}</p>}

          <div className="flex items-center gap-2 mt-2">
            <span className={cn('badge text-xs', getRegionColor(user.region || ''))}>
              {user.region || '미설정'}
            </span>
            <span className={cn('badge text-xs', getLevelColor(user.level || ''))}>
              {user.level || '미설정'}
            </span>
          </div>

          {user.referrer && (
            <p className="text-xs text-neutral-400 mt-2">추천인: {user.referrer}</p>
          )}
        </div>

        <div className="flex flex-col gap-2 ml-3">
          {showActions && (
            <>
              <button
                onClick={onApprove}
                disabled={anyLoading}
                className="flex items-center gap-1 px-3 py-1.5 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 disabled:opacity-50"
              >
                {loadingApprove ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                승인
              </button>

              <button
                onClick={onReject}
                disabled={anyLoading}
                className="flex items-center gap-1 px-3 py-1.5 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 disabled:opacity-50"
              >
                {loadingReject ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                거절
              </button>
            </>
          )}

          {showStatus && user.status === 'approved' && onSuspend && (
            <button
              onClick={onSuspend}
              disabled={anyLoading}
              className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 text-white text-sm rounded-lg hover:bg-amber-600 disabled:opacity-50"
            >
              {loadingSuspend ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pause className="w-4 h-4" />}
              정지
            </button>
          )}

          {showStatus && user.status === 'suspended' && onReactivate && (
            <button
              onClick={onReactivate}
              disabled={anyLoading}
              className="flex items-center gap-1 px-3 py-1.5 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 disabled:opacity-50"
            >
              {loadingReactivate ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              재활성화
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
