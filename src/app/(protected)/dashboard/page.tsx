import Link from 'next/link';
import { ensureDb, getLatestOrder } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { formatMoney } from '@/lib/thai';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const [user, sql] = await Promise.all([getSessionUser(), ensureDb()]);

  const [
    [rateStats],
    [repStats],
    latestOrder,
    recentReports,
  ] = await Promise.all([
    sql`
      SELECT
        COUNT(*) FILTER (WHERE rate_type='paid')::int AS paid_count,
        COUNT(*) FILTER (WHERE rate_type='free')::int AS free_count
      FROM summon_rates
    `,
    sql`
      SELECT
        COUNT(*) FILTER (WHERE report_type='free')::int AS free_rep_count,
        COALESCE(SUM(total_amount) FILTER (WHERE report_type='free'), 0)::float AS free_sum,
        COUNT(*) FILTER (WHERE report_type='paid')::int AS paid_rep_count,
        COALESCE(SUM(total_amount) FILTER (WHERE report_type='paid'), 0)::float AS paid_sum
      FROM reports
    `,
    getLatestOrder(),
    sql`SELECT *, total_amount::float AS total_amount FROM reports ORDER BY id DESC LIMIT 8`,
  ]);

  const paidCount = Number(rateStats?.paid_count || 0);
  const freeCount = Number(rateStats?.free_count || 0);
  const freeRepCount = Number(repStats?.free_rep_count || 0);
  const freeSum = Number(repStats?.free_sum || 0);
  const paidRepCount = Number(repStats?.paid_rep_count || 0);
  const paidSum = Number(repStats?.paid_sum || 0);

  return (
    <div className="space-y-6">
      {/* Active Court Order Banner */}
      <div className="bg-gradient-to-r from-brand-900 to-brand-700 rounded-2xl p-5 text-white shadow-card flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold-400 mb-1">
            <span className="w-2 h-2 rounded-full bg-gold-400" /> คำสั่งศาลฉบับปัจจุบัน (ใช้กับรายงานรอบใหม่โดยอัตโนมัติ)
          </div>
          <div className="text-base sm:text-lg font-bold underline decoration-gold-400/70 underline-offset-4">
            {latestOrder?.order_text || '-'}
          </div>
          <div className="text-xs text-brand-200 mt-1">
            รายงานเดิมที่เคยบันทึกไว้แล้วจะคงคำสั่งศาลเดิมไว้เสมอ ไม่เปลี่ยนแปลงตามคำสั่งใหม่
          </div>
        </div>
        {user?.role === 'admin' && (
          <Link href="/orders" className="shrink-0 inline-flex items-center justify-center px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-sm font-semibold transition">
            จัดการคำสั่งศาล &rarr;
          </Link>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-card border border-slate-200/80">
          <div className="text-xs font-semibold text-slate-500 uppercase">อัตราหมายเงิน / หมายฟรี</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-brand-900">{paidCount}</span>
            <span className="text-sm text-slate-500">/ {freeCount} ตำบล</span>
          </div>
          <Link href="/rates" className="mt-3 inline-block text-xs font-semibold text-brand-700 hover:underline">ดูตารางอัตราค่านำหมาย &rarr;</Link>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-card border border-slate-200/80">
          <div className="text-xs font-semibold text-slate-500 uppercase">รายงานเบิกหมายฟรี</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-700">{freeRepCount}</span>
            <span className="text-sm text-slate-500">รอบ ({formatMoney(freeSum)} บาท)</span>
          </div>
          <Link href="/reports/form?type=free" className="mt-3 inline-block text-xs font-semibold text-emerald-700 hover:underline">+ สร้างรายงานหมายฟรี &rarr;</Link>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-card border border-slate-200/80">
          <div className="text-xs font-semibold text-slate-500 uppercase">รายงานเบิกหมายเงิน</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-700">{paidRepCount}</span>
            <span className="text-sm text-slate-500">รอบ ({formatMoney(paidSum)} บาท)</span>
          </div>
          <Link href="/reports/form?type=paid" className="mt-3 inline-block text-xs font-semibold text-amber-700 hover:underline">+ สร้างรายงานหมายเงิน &rarr;</Link>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-card border border-slate-200/80">
          <div className="text-xs font-semibold text-slate-500 uppercase">ส่งออกอัตราค่านำหมายล่าสุด</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href="/api/export?action=rates_xlsx&scope=all" className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition">Excel (.xlsx)</a>
            <a href="/api/export?action=rates_pdf&scope=all&inline=1" target="_blank" className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition">PDF</a>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/reports/form?type=free" className="group bg-white rounded-2xl p-5 shadow-card border border-slate-200/80 hover:border-brand-500 transition flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          </div>
          <div>
            <div className="font-bold text-slate-900">สร้างรายงานเบิกหมายฟรี</div>
            <div className="text-xs text-slate-500">กรอกใบสำคัญรับเงิน + ออกบันทึกข้อความ (Word/PDF/Excel)</div>
          </div>
        </Link>

        <Link href="/reports/form?type=paid" className="group bg-white rounded-2xl p-5 shadow-card border border-slate-200/80 hover:border-brand-500 transition flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 group-hover:bg-amber-600 group-hover:text-white transition">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 1v8m0 0v1m9-5a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div>
            <div className="font-bold text-slate-900">สร้างรายงานเบิกหมายเงิน</div>
            <div className="text-xs text-slate-500">ออกบันทึกข้อความเบิกค่านำส่งที่คู่ความวางเงิน (Word/PDF)</div>
          </div>
        </Link>

        <Link href="/rates" className="group bg-white rounded-2xl p-5 shadow-card border border-slate-200/80 hover:border-brand-500 transition flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center shrink-0 group-hover:bg-brand-700 group-hover:text-white transition">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
          </div>
          <div>
            <div className="font-bold text-slate-900">ตรวจสอบ / จัดการอัตราค่าหมาย</div>
            <div className="text-xs text-slate-500">ตาราง DataTables แยกหมายเงินและหมายฟรี + นำเข้า/ส่งออก</div>
          </div>
        </Link>
      </div>

      {/* Recent Reports */}
      <div className="bg-white rounded-2xl shadow-card border border-slate-200/80 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-bold text-brand-900">รายงานผลและบันทึกข้อความล่าสุด</h2>
          <Link href="/reports" className="text-xs font-semibold text-brand-700 hover:underline">ดูทั้งหมด &rarr;</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left">ประเภท</th>
                <th className="px-4 py-3 text-left">รอบ / คำสั่งศาลที่ใช้</th>
                <th className="px-4 py-3 text-left">ผู้รายงาน</th>
                <th className="px-4 py-3 text-right">จำนวนเรื่อง</th>
                <th className="px-4 py-3 text-right">ยอดเบิก (บาท)</th>
                <th className="px-4 py-3 text-center">ส่งออกเอกสาร</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentReports.map((r) => (
                <tr key={String(r.id)} className="hover:bg-slate-50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    {r.report_type === 'free' ? (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">หมายฟรี</span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">หมายเงิน</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/reports/form?id=${r.id}`} className="font-semibold text-brand-800 hover:underline">
                      {String(r.round_label || `รายงาน #${r.id}`)}
                    </Link>
                    <div className="text-xs text-slate-500 truncate max-w-md">{String(r.order_text)}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-700">{String(r.reporter_name)}</td>
                  <td className="px-4 py-3 text-right font-medium">{Number(r.item_count)}</td>
                  <td className="px-4 py-3 text-right font-bold text-brand-900">{formatMoney(Number(r.total_amount))}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    <div className="inline-flex flex-wrap justify-center gap-1">
                      <a href={`/api/export?action=memo_docx&id=${r.id}`} className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold">Word</a>
                      <a href={`/api/export?action=memo_pdf&id=${r.id}&inline=1`} target="_blank" className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold">PDF บันทึกฯ</a>
                      {r.report_type === 'free' && (
                        <>
                          <a href={`/api/export?action=receipt_xlsx&id=${r.id}`} className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold">Excel ใบรับเงิน</a>
                          <a href={`/api/export?action=receipt_pdf&id=${r.id}&inline=1`} target="_blank" className="px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-800 text-white text-xs font-semibold">PDF ใบรับเงิน</a>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
