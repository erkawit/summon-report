import { ensureDb } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import ReportsClient from '@/components/ReportsClient';

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const user = await getSessionUser();
  const sql = await ensureDb();
  const rows = await sql`SELECT *, total_amount::float AS total_amount FROM reports ORDER BY id DESC`;

  return (
    <ReportsClient
      curUserId={user?.id || 0}
      isAdmin={user?.role === 'admin'}
      initialReports={rows.map((r) => ({
        id: Number(r.id),
        report_type: r.report_type === 'paid' ? 'paid' : 'free',
        round_label: String(r.round_label || ''),
        order_text: String(r.order_text || ''),
        period_start: String(r.period_start || ''),
        period_end: String(r.period_end || ''),
        item_count: Number(r.item_count || 0),
        total_amount: Number(r.total_amount || 0),
        reporter_name: String(r.reporter_name || ''),
        reporter_position: String(r.reporter_position || ''),
        created_by: Number(r.created_by || 0),
      }))}
    />
  );
}
