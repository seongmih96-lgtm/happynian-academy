'use client';

import { useRouter } from 'next/navigation';
import ResourceHubView from '@/components/ResourceHub/ResourceHubView';
import { useResourceHub } from '@/hooks/useResourceHub';

export default function ClassroomClient({ profile, sessions }: any) {
  const router = useRouter();

  const hub = useResourceHub({
    profile,
    sessions,
  });

  return (
    <ResourceHubView
      hub={hub}
      headerTitle="강의실"
      headerSub="오늘의 배움이 식구의 하루를 더 단단하게 🌿"
      showInstructorButton={hub.isAdmin}
      onInstructorClick={() => router.push('/instructor')}
    />
  );
}