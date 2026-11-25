import { TablePageSkeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return <TablePageSkeleton columns={5} rows={4} showSummaryCards />;
}
