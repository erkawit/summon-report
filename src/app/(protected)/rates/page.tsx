import { ensureDb, getSettingsMap } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import RatesClient from '@/components/RatesClient';

export const dynamic = 'force-dynamic';

export default async function RatesPage() {
  const user = await getSessionUser();
  const sql = await ensureDb();
  const settings = await getSettingsMap();

  const paidRows = await sql`
    SELECT id, rate_type, district, subdistrict, exception_note, rate_amount::float AS rate_amount, sort_order
    FROM summon_rates WHERE rate_type='paid' ORDER BY sort_order ASC, id ASC
  `;
  const freeRows = await sql`
    SELECT id, rate_type, district, subdistrict, exception_note, rate_amount::float AS rate_amount, sort_order
    FROM summon_rates WHERE rate_type='free' ORDER BY sort_order ASC, id ASC
  `;

  return (
    <RatesClient
      isAdmin={user?.role === 'admin'}
      initialPaid={paidRows.map((r) => ({
        id: Number(r.id), rate_type: 'paid' as const, district: String(r.district),
        subdistrict: String(r.subdistrict), exception_note: String(r.exception_note || ''),
        rate_amount: Number(r.rate_amount), sort_order: Number(r.sort_order),
      }))}
      initialFree={freeRows.map((r) => ({
        id: Number(r.id), rate_type: 'free' as const, district: String(r.district),
        subdistrict: String(r.subdistrict), exception_note: String(r.exception_note || ''),
        rate_amount: Number(r.rate_amount), sort_order: Number(r.sort_order),
      }))}
      meta={{
        paid_header: settings.paid_header || '',
        paid_notes: settings.paid_notes || '',
        free_header_1: settings.free_header_1 || '',
        free_header_2: settings.free_header_2 || '',
        free_header_3: settings.free_header_3 || '',
        free_notes: settings.free_notes || '',
      }}
    />
  );
}
