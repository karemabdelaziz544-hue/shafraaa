import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-lg">
      <Skeleton className="h-14 w-14 rounded-2xl mx-auto" />
      <Skeleton className="h-6 w-48 mx-auto" />
      <Skeleton className="h-3 w-40 mx-auto" />
      <Skeleton className="h-11 w-full rounded-xl" />
      <Skeleton className="h-11 w-full rounded-xl" />
      <Skeleton className="h-12 w-full rounded-xl" />
    </div>
  );
}
