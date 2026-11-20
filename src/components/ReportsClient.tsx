'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { alertError, confirmDelete, dtThaiLang, escHtml, toastSuccess } from '@/lib/swal';
import { formatMoney } from '@/lib/thai';

export interface ReportSummary {
  id: number;
  report_type: 'free' | 'paid';
  round_label: string;
  order_text: string;
  period_start: string;
  period_end: string;
  item_count: number;
  total_amount: number;
  reporter_name: string;
  reporter_position: string;
  created_by: number;
}

export default function ReportsClient({
  curUserId,
  isAdmin,
  initialReports,
}: {
  curUserId: number;
  isAdmin: boolean;
  initialReports: ReportSummary[];
}) {
  const [reports, setReports] = useState<ReportSummary[]>(initialReports);
  const [filter, setFilter] = useState<'' | 'free' | 'paid'>('');
  const tableRef = useRef<HTMLTableElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dtRef = useRef<any>(null);

  const filtered = filter ? reports.filter((r) => r.report_type === filter) : reports;

  async function reload() {
    const res = await fetch('/api/reports');
    const json = await res.json();
    if (json.ok) setReports(json.data);
  }

  useEffect(() => {
    let mounted = true;
    async function init() {
      const [{ default: DataTable }] = await Promise.all([
        import('datatables.net-dt'),
        import('datatables.net-responsive-dt'),
      ]);
      if (!mounted || !tableRef.current) return;
      dtRef.current?.destroy();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      dtRef.current = new (DataTable as any)(tableRef.current, {
        data: filtered,
        destroy: true,
        responsive: true,
        order: [[0, 'desc']],
        language: dtThaiLang,
        columns: [
          { data: 'id', className: 'text-center font-semibold text-slate-500' },
          {
            data: 'report_type',
            render: (d: string) =>
              d === 'free'
                ? '<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">หมายฟรี</span>'
                : '<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">หมายเงิน</span>',
          },
          {
            data: null,
            render: (r: ReportSummary) => {
              const title = escHtml(r.round_label || `รายงาน #${r.id}`);
              const per = r.report_type === 'paid' && r.period_start ? `<div class="text-xs text-amber-700">รอบ: ${escHtml(r.period_start)} – ${escHtml(r.period_end)}</div>` : '';
              return `<div class="font-bold text-brand-900">${title}</div>${per}<div class="text-[11px] text-slate-500 truncate max-w-xs" title="${escHtml(r.order_text)}">${escHtml(r.order_text)}</div>`;
            },
          },
          {
            data: null,
            render: (r: ReportSummary) => `<div class="font-medium text-slate-800">${escHtml(r.reporter_name)}</div><div class="text-xs text-slate-500">${escHtml(r.reporter_position)}</div>`,
          },
          { data: 'item_count', className: 'text-right font-semibold', render: (d: number) => `${d} เรื่อง` },
          { data: 'total_amount', className: 'text-right font-bold text-brand-900', render: (d: number) => formatMoney(d) },
          {
            data: null,
            orderable: false,
            searchable: false,
            render: (r: ReportSummary) => {
              let html = `<div class="flex flex-wrap gap-1">
                <a href="/api/export?action=memo_docx&id=${r.id}" class="px-2 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold">Word</a>
                <a href="/api/export?action=memo_pdf&id=${r.id}&inline=1" target="_blank" class="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold">PDF บันทึกฯ</a>`;
              if (r.report_type === 'free') {
                html += `<a href="/api/export?action=receipt_xlsx&id=${r.id}" class="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold">Excel ใบรับเงิน</a>
                         <a href="/api/export?action=receipt_pdf&id=${r.id}&inline=1" target="_blank" class="px-2 py-1 rounded-lg bg-slate-700 hover:bg-slate-800 text-white text-xs font-semibold">PDF ใบรับเงิน</a>`;
              }
              return html + '</div>';
            },
          },
          {
            data: null,
            orderable: false,
            searchable: false,
            className: 'text-center whitespace-nowrap',
            render: (r: ReportSummary) => {
              const canEdit = isAdmin || r.created_by === curUserId;
              if (!canEdit) return '<span class="text-xs text-slate-400">-</span>';
              return `<a href="/reports/form?id=${r.id}" class="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-semibold mr-1">แก้ไข</a>` +
                `<button data-del-rep="${r.id}" class="btn-del-rep px-2.5 py-1 rounded-lg bg-red-100 hover:bg-red-200 text-red-800 text-xs font-semibold">ลบ</button>`;
            },
          },
        ],
      });
    }
    init();
    return () => {
      mounted = false;
      dtRef.current?.destroy();
    };
  }, [filtered, curUserId, isAdmin]);

  useEffect(() => {
    const handler = async (ev: MouseEvent) => {
      const btn = (ev.target as HTMLElement).closest('.btn-del-rep') as HTMLElement | null;
      if (!btn) return;
      const id = Number(btn.dataset.delRep);
      const c = await confirmDelete('ต้องการลบรายงานนี้และรายการส่งหมายทั้งหมดในรอบนี้ใช่หรือไม่?');
      if (!c.isConfirmed) return;
      const res = await fetch(`/api/reports?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.ok) return alertError(data.message || 'ลบไม่สำเร็จ');
      toastSuccess(data.message);
      await reload();
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl p-4 shadow-card border border-slate-200/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="font-bold text-brand-900 text-base">ประวัติการจัดทำแบบรายงานผลและบันทึกข้อความ</h2>
          <p className="text-xs text-slate-500 mt-0.5">รายงานเดิมทุกรอบจะคงคำสั่งศาลเดิมที่เคยดึงไว้เสมอ สามารถส่งออก Word, PDF และ Excel ย้อนหลังได้ตลอดเวลา</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/reports/form?type=free" className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-sm transition">+ สร้างรายงานหมายฟรี</Link>
          <Link href="/reports/form?type=paid" className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold shadow-sm transition">+ สร้างรายงานหมายเงิน</Link>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-card border border-slate-200/80 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap gap-2">
          {([['', 'ทั้งหมด'], ['free', 'หมายฟรี (ตามระเบียบ)'], ['paid', 'หมายเงิน (คู่ความวางเงิน)']] as const).map(([val, lbl]) => (
            <button
              key={val}
              type="button"
              onClick={() => setFilter(val)}
              className={filter === val ? 'px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-800 text-white' : 'px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200'}
            >
              {lbl}
            </button>
          ))}
        </div>
        <div className="p-4 overflow-x-auto">
          <table ref={tableRef} className="display responsive nowrap w-full text-sm">
            <thead>
              <tr>
                <th className="w-14">ID</th>
                <th>ประเภท</th>
                <th>รอบ / คำสั่งศาลที่ใช้</th>
                <th>ผู้รายงาน</th>
                <th className="text-right">จำนวนเรื่อง</th>
                <th className="text-right">ยอดเบิก (บาท)</th>
                <th>ส่งออกเอกสาร</th>
                <th className="text-center">จัดการ</th>
              </tr>
            </thead>
          </table>
        </div>
      </div>
    </div>
  );
}
