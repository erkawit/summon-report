import { redirect } from 'next/navigation';
import { ensureDb, getDirectorSigners, getLatestOrder, getSettingsMap } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import ReportFormClient, { type ReportFormInitial } from '@/components/ReportFormClient';

export const dynamic = 'force-dynamic';

export default async function ReportFormPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; type?: string }>;
}) {
  const [user, sp, sql] = await Promise.all([getSessionUser(), searchParams, ensureDb()]);
  if (!user) redirect('/login');

  const id = Number(sp.id) || 0;
  const [settings, latestOrder, directors, allRates] = await Promise.all([
    getSettingsMap(),
    getLatestOrder(),
    getDirectorSigners(),
    sql`SELECT rate_type, district, subdistrict, exception_note, rate_amount::float AS rate_amount FROM summon_rates ORDER BY sort_order ASC, id ASC`,
  ]);

  const defaultDir = directors.find((d) => d.is_default) || directors[0];
  let initial: ReportFormInitial;

  if (id > 0) {
    const [rows, itemRows] = await Promise.all([
      sql`SELECT *, total_amount::float AS total_amount FROM reports WHERE id = ${id} LIMIT 1`,
      sql`SELECT *, base_rate::float AS base_rate, claim_rate::float AS claim_rate FROM report_items WHERE report_id = ${id} ORDER BY seq ASC, id ASC`,
    ]);
    if (rows.length === 0) redirect('/reports');
    const r = rows[0];
    if (user.role !== 'admin' && Number(r.created_by) !== user.id) redirect('/reports');

    initial = {
      id: Number(r.id),
      report_type: r.report_type === 'paid' ? 'paid' : 'free',
      round_label: String(r.round_label || ''),
      doc_no: String(r.doc_no || ''),
      doc_date: String(r.doc_date || ''),
      order_text: String(r.order_text || ''),
      period_start: String(r.period_start || ''),
      period_end: String(r.period_end || ''),
      item_count: Number(r.item_count || 0),
      total_amount: Number(r.total_amount || 0),
      amount_text: String(r.amount_text || ''),
      reporter_name: String(r.reporter_name || ''),
      reporter_position: String(r.reporter_position || ''),
      reporter_address: String(r.reporter_address || ''),
      officer_name: String(r.officer_name || ''),
      officer_position: String(r.officer_position || ''),
      director_name: String(r.director_name || ''),
      director_acting: String(r.director_acting || ''),
      payer_name: String(r.payer_name || ''),
      payer_position: String(r.payer_position || ''),
      receipt_date: String(r.receipt_date || ''),
      note: String(r.note || ''),
      items: itemRows.map((it) => ({
        case_prefix: String(it.case_prefix || 'คดีดำ'),
        case_no: String(it.case_no || ''),
        issue_date: String(it.issue_date || ''),
        serve_date: String(it.serve_date || ''),
        summon_type: String(it.summon_type || ''),
        recipient_role: String(it.recipient_role || ''),
        house_no: String(it.house_no || ''),
        moo: String(it.moo || ''),
        subdistrict: String(it.subdistrict || ''),
        district: String(it.district || ''),
        province: String(it.province || 'จ.อุดรธานี'),
        base_rate: Number(it.base_rate || 0),
      })),
    };
  } else {
    const reportType: 'free' | 'paid' = sp.type === 'paid' ? 'paid' : 'free';
    initial = {
      id: 0,
      report_type: reportType,
      round_label: '',
      doc_no: '',
      doc_date: '',
      order_text: latestOrder?.order_text || 'คำสั่งศาลจังหวัดอุดรธานี ที่ 28/2569 ลงวันที่  23 มีนาคม 2569',
      period_start: '',
      period_end: '',
      item_count: 0,
      total_amount: 0,
      amount_text: '',
      reporter_name: user.full_name,
      reporter_position: user.position,
      reporter_address: user.address || '2 ถ.อธิบดี ตำบลหมากแข้ง อำเภอเมือง จังหวัดอุดรธานี',
      officer_name: settings.officer_name || 'นายณัฐพงศ์  กุบแก้ว',
      officer_position: settings.officer_position || 'เจ้าพนักงานศาลยุติธรรมชำนาญการพิเศษ',
      director_name: defaultDir?.full_name || settings.director_name || 'นางสาวเนตรดาว  เฝ้าทรัพย์',
      director_acting: defaultDir ? (defaultDir.is_acting ? 'รักษาราชการแทน' : '') : (settings.director_acting || 'รักษาราชการแทน'),
      payer_name: settings.payer_name || 'นางราตรี  ศรีจันทร์',
      payer_position: settings.payer_position || 'นักวิชาการเงินและบัญชีชำนาญการพิเศษ',
      receipt_date: '',
      note: '',
      items: [],
    };
  }

  const mapRates = (type: string) =>
    allRates
      .filter((r) => r.rate_type === type)
      .map((r) => ({
        district: String(r.district),
        subdistrict: String(r.subdistrict),
        exception_note: String(r.exception_note || ''),
        rate_amount: Number(r.rate_amount),
      }));

  return (
    <ReportFormClient
      initial={initial}
      freeRates={mapRates('free')}
      paidRates={mapRates('paid')}
      directors={directors}
    />
  );
}
