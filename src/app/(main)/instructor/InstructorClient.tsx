'use client';

import ResourceHubView from '@/components/ResourceHub/ResourceHubView';
import { useInstructorResourceHub } from '@/hooks/useInstructorResourceHub';
import type { Session } from '@/types';

type Props = {
  profile: any;
  sessions: Session[];
};

export default function InstructorClient({ profile, sessions }: Props) {
  // hook이 sessions를 안 받는 구조면 그냥 profile만 넣어도 됨
  // (나중에 hub에서 sessions를 쓰고 싶으면 hook 시그니처를 바꾸면 됨)
  const instructorHub = useInstructorResourceHub(profile);

  // ✅ 권한 컷 (hook 내부 판단)
  if (!instructorHub.isAdmin && !instructorHub.isInstructor) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="bg-white border border-neutral-200 rounded-2xl p-6 text-sm text-neutral-700">
          접근 권한이 없어요.
        </div>
      </div>
    );
  }

  return (
    <ResourceHubView
      hub={instructorHub}
      hubType="instructor"
      headerTitle="강사 전용"
      headerSub="영상/줌/자료를 모아두는 공간이에요 🎓"
      showInstructorButton={false}
      // 만약 ResourceHubView가 sessions를 받는 구조면 여기로 넘겨도 됨:
      // sessions={sessions}
    />
  );
}