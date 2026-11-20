import { redirect } from 'next/navigation';
import { ensureDb, getSettingsMap } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import OrdersClient from '@/components/OrdersClient';

export const dynamic = 'force-dynamic';

export default async function OrdersPage() {
  const user = await getSessionUser();
  if (!user || user.role !== 'admin') redirect('/dashboard');

  const sql = await ensureDb();
  const orders = await sql`
    SELECT o.id, o.order_text, o.order_no, o.order_date, o.note, o.created_at,
           (SELECT COUNT(*)::int FROM reports r WHERE r.order_id = o.id) AS used_count
    FROM court_orders o
    ORDER BY o.id DESC
  `;
  const settings = await getSettingsMap();

  return (
    <OrdersClient
      orders={orders.map((o) => ({
        id: Number(o.id),
        order_text: String(o.order_text),
        order_no: String(o.order_no || ''),
        order_date: String(o.order_date || ''),
        note: String(o.note || ''),
        created_at: new Date(String(o.created_at)).toLocaleString('th-TH'),
        used_count: Number(o.used_count || 0),
      }))}
      signers={{
        director_name: settings.director_name || '',
        director_acting: settings.director_acting || '',
        officer_name: settings.officer_name || '',
        officer_position: settings.officer_position || '',
        payer_name: settings.payer_name || '',
        payer_position: settings.payer_position || '',
      }}
    />
  );
}
