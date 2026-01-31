import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoaderProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  fullScreen?: boolean;
}

export function Loader({ size = 'md', className, fullScreen = false }: LoaderProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-10 h-10',
  };

  const loader = (
    <Loader2 className={cn('animate-spin text-primary-500', sizeClasses[size], className)} />
  );

  if (fullScreen) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        {loader}
      </div>
    );
  }

  return loader;
}

export function LoadingOverlay({ message }: { message?: string }) {
  return (
    <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
      <Loader size="lg" />
      {message && <p className="mt-4 text-sm text-neutral-600">{message}</p>}
    </div>
  );
}

export function LoadingCard() {
  return (
    <div className="card p-4 animate-pulse">
      <div className="flex gap-2 mb-3">
        <div className="h-6 w-16 bg-neutral-200 rounded-full" />
        <div className="h-6 w-12 bg-neutral-200 rounded-full" />
      </div>
      <div className="h-5 w-3/4 bg-neutral-200 rounded mb-3" />
      <div className="h-4 w-1/2 bg-neutral-200 rounded mb-2" />
      <div className="h-4 w-2/3 bg-neutral-200 rounded" />
    </div>
  );
}
