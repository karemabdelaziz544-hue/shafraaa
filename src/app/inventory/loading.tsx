import { TablePageSkeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return <TablePageSkeleton columns={6} rows={5} showSummaryCards />;
}
