'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { alertError, alertSuccess, confirmDelete, dtThaiLang, escHtml, Swal, toastSuccess } from '@/lib/swal';
import { formatMoney } from '@/lib/thai';

export interface RateItem {
  id: number;
  rate_type: 'paid' | 'free';
  district: string;
  subdistrict: string;
  exception_note: string;
  rate_amount: number;
  sort_order: number;
}

interface Props {
  isAdmin: boolean;
  initialPaid: RateItem[];
  initialFree: RateItem[];
  meta: {
    paid_header: string;
    paid_notes: string;
    free_header_1: string;
    free_header_2: string;
    free_header_3: string;
    free_notes: string;
  };
}

export default function RatesClient({ isAdmin, initialPaid, initialFree, meta }: Props) {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<'both' | 'paid' | 'free'>('both');
  const [paidData, setPaidData] = useState<RateItem[]>(initialPaid);
  const [freeData, setFreeData] = useState<RateItem[]>(initialFree);
  const paidTableRef = useRef<HTMLTableElement>(null);
  const freeTableRef = useRef<HTMLTableElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const paidDtRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const freeDtRef = useRef<any>(null);

  const paidDistricts = Array.from(new Set(paidData.map((r) => r.district)));
  const freeDistricts = Array.from(new Set(freeData.map((r) => r.district)));

  async function reloadType(type: 'paid' | 'free') {
    const res = await fetch(`/api/rates?type=${type}`);
    const json = await res.json();
    if (json.ok) {
      if (type === 'paid') setPaidData(json.data);
      else setFreeData(json.data);
    }
  }

  useEffect(() => {
    let mounted = true;
    async function initDT() {
      const [{ default: DataTable }] = await Promise.all([
        import('datatables.net-dt'),
        import('datatables.net-responsive-dt'),
        import('datatables.net-rowgroup-dt'),
      ]);
      if (!mounted) return;

      const build = (el: HTMLTableElement | null, rows: RateItem[], type: 'paid' | 'free') => {
        if (!el) return null;
        const cols: unknown[] = [
          { data: null, render: (_d: unknown, _t: unknown, _r: unknown, m: { row: number }) => m.row + 1, className: 'text-center text-slate-500' },
          { data: 'district', render: (d: string) => `อำเภอ${escHtml(d)}` },
          { data: 'subdistrict', render: (d: string) => `ตำบล${escHtml(d)}`, className: 'font-medium text-slate-900' },
          {
            data: 'exception_note',
            render: (d: string) => d ? `<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">${escHtml(d)}</span>` : '<span class="text-slate-300">-</span>',
          },
          {
            data: 'rate_amount',
            className: 'text-right font-bold text-brand-900',
            render: (d: number) => `${formatMoney(d)} บาท`,
          },
        ];
        if (isAdmin) {
          cols.push({
            data: null,
            orderable: false,
            searchable: false,
            className: 'text-center whitespace-nowrap',
            render: (row: RateItem) =>
              `<button data-edit-type="${type}" data-id="${row.id}" class="btn-edit-rate px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-semibold mr-1">แก้ไข</button>` +
              `<button data-del-type="${type}" data-id="${row.id}" class="btn-del-rate px-2.5 py-1 rounded-lg bg-red-100 hover:bg-red-200 text-red-800 text-xs font-semibold">ลบ</button>`,
          });
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return new (DataTable as any)(el, {
          data: rows,
          columns: cols,
          destroy: true,
          responsive: true,
          ordering: false,
          pageLength: 25,
          lengthMenu: [[15, 25, 50, 100, -1], [15, 25, 50, 100, 'ทั้งหมด']],
          rowGroup: { dataSrc: 'district', startRender: (r: { count: () => number }, g: string) => `อำเภอ${g} (${r.count()} รายการ)` },
          language: dtThaiLang,
        });
      };

      paidDtRef.current?.destroy();
      freeDtRef.current?.destroy();
      paidDtRef.current = build(paidTableRef.current, paidData, 'paid');
      freeDtRef.current = build(freeTableRef.current, freeData, 'free');
    }

    initDT();
    return () => {
      mounted = false;
      paidDtRef.current?.destroy();
      freeDtRef.current?.destroy();
    };
  }, [paidData, freeData, isAdmin]);

  // Event delegation for DataTables action buttons
  useEffect(() => {
    const handler = (ev: MouseEvent) => {
      const target = ev.target as HTMLElement;
      const editBtn = target.closest('.btn-edit-rate') as HTMLElement | null;
      if (editBtn) {
        const type = editBtn.dataset.editType as 'paid' | 'free';
        const id = Number(editBtn.dataset.id);
        const list = type === 'paid' ? paidData : freeData;
        const row = list.find((x) => x.id === id) || null;
        openRateModal(type, row);
        return;
      }
      const delBtn = target.closest('.btn-del-rate') as HTMLElement | null;
      if (delBtn) {
        const type = delBtn.dataset.delType as 'paid' | 'free';
        const id = Number(delBtn.dataset.id);
        handleDeleteRate(id, type);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  });

  async function openRateModal(type: 'paid' | 'free', row: RateItem | null = null) {
    const label = type === 'paid' ? 'อัตราหมายเงิน' : 'อัตราหมายฟรี';
    const { value } = await Swal.fire({
      title: (row ? 'แก้ไข' : 'เพิ่ม') + label,
      html: `
        <div class="text-left space-y-3 mt-2 text-sm">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">อำเภอ (ไม่ต้องพิมพ์คำว่า "อำเภอ")</label>
            <input id="swDist" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value="${escHtml(row?.district || '')}" placeholder="เช่น เมือง, กุมภวาปี">
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">ตำบล (ไม่ต้องพิมพ์คำว่า "ตำบล")</label>
            <input id="swSub" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value="${escHtml(row?.subdistrict || '')}" placeholder="เช่น หมากแข้ง, บ้านเลื่อม">
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">หมายเหตุ / ข้อยกเว้น (ถ้ามี)</label>
            <input id="swExc" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value="${escHtml(row?.exception_note || '')}" placeholder="เช่น ยกเว้นหมู่ 18">
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block font-semibold text-slate-700 mb-1">อัตราค่าหมาย (บาท)</label>
              <input id="swAmt" type="number" step="0.01" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value="${row?.rate_amount ?? ''}" placeholder="800">
            </div>
            <div>
              <label class="block font-semibold text-slate-700 mb-1">ลำดับการแสดงผล</label>
              <input id="swSort" type="number" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value="${row?.sort_order ?? 0}">
            </div>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'บันทึก',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#1c3d70',
      preConfirm: () => {
        const district = (document.getElementById('swDist') as HTMLInputElement).value.trim();
        const subdistrict = (document.getElementById('swSub') as HTMLInputElement).value.trim();
        const rate_amount = parseFloat((document.getElementById('swAmt') as HTMLInputElement).value);
        if (!district || !subdistrict || !rate_amount || rate_amount <= 0) {
          Swal.showValidationMessage('กรุณากรอกอำเภอ ตำบล และอัตราค่าหมายให้ครบถ้วน');
          return false;
        }
        return {
          id: row?.id || 0,
          rate_type: type,
          district,
          subdistrict,
          exception_note: (document.getElementById('swExc') as HTMLInputElement).value.trim(),
          rate_amount,
          sort_order: Number((document.getElementById('swSort') as HTMLInputElement).value) || 0,
        };
      },
    });
    if (!value) return;
    const res = await fetch('/api/rates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(value),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) return alertError(data.message || 'บันทึกไม่สำเร็จ');
    toastSuccess(data.message);
    await reloadType(type);
  }

  async function handleDeleteRate(id: number, type: 'paid' | 'free') {
    const c = await confirmDelete('ต้องการลบรายการอัตราค่านำหมายนี้ใช่หรือไม่?');
    if (!c.isConfirmed) return;
    const res = await fetch(`/api/rates?id=${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok || !data.ok) return alertError(data.message || 'ลบไม่สำเร็จ');
    toastSuccess(data.message);
    await reloadType(type);
  }

  async function openImportModal() {
    const { value } = await Swal.fire({
      title: 'นำเข้าอัตราค่านำหมาย (Excel / PDF)',
      html: `
        <div class="text-left space-y-3 mt-2 text-sm">
          <div class="p-3 rounded-lg bg-brand-50 text-brand-900 text-xs">
            รองรับไฟล์ <b>Excel (.xlsx)</b> รูปแบบเดียวกับไฟล์ "อัตราหมายเงิน และ หมายฟรี" (ทั้งแบบ 4 คอลัมน์ และตารางปกติ) และไฟล์ <b>PDF (.pdf)</b> ที่มีตารางข้อมูล
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">เลือกไฟล์ (.xlsx, .pdf)</label>
            <input id="impFile" type="file" accept=".xlsx,.pdf" class="w-full text-xs border border-slate-300 rounded-lg p-2">
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block font-semibold text-slate-700 mb-1">ประเภทข้อมูล</label>
              <select id="impTarget" class="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm">
                <option value="auto">อัตโนมัติ (ตามชื่อชีต Excel)</option>
                <option value="paid">อัตราหมายเงิน</option>
                <option value="free">อัตราหมายฟรี</option>
              </select>
            </div>
            <div>
              <label class="block font-semibold text-slate-700 mb-1">รูปแบบการนำเข้า</label>
              <select id="impMode" class="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm">
                <option value="replace">แทนที่ข้อมูลเดิมทั้งหมด</option>
                <option value="append">เพิ่มต่อจากข้อมูลเดิม</option>
              </select>
            </div>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'นำเข้าข้อมูล',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#1c3d70',
      preConfirm: () => {
        const f = (document.getElementById('impFile') as HTMLInputElement).files?.[0];
        if (!f) {
          Swal.showValidationMessage('กรุณาเลือกไฟล์ก่อนนำเข้า');
          return false;
        }
        const fd = new FormData();
        fd.append('file', f);
        fd.append('target_type', (document.getElementById('impTarget') as HTMLSelectElement).value);
        fd.append('mode', (document.getElementById('impMode') as HTMLSelectElement).value);
        return fd;
      },
    });
    if (!value) return;
    Swal.fire({ title: 'กำลังนำเข้าข้อมูล...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    const res = await fetch('/api/rates/import', { method: 'POST', body: value });
    const data = await res.json();
    if (!res.ok || !data.ok) return alertError(data.message || 'นำเข้าไม่สำเร็จ');
    await alertSuccess(data.message);
    await Promise.all([reloadType('paid'), reloadType('free')]);
    router.refresh();
  }

  async function openMetaModal() {
    const { value } = await Swal.fire({
      title: 'แก้ไขข้อความหัวประกาศและหมายเหตุ',
      width: 680,
      html: `
        <div class="text-left space-y-3 mt-2 text-sm">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">หัวตารางอัตราหมายเงิน</label>
            <input id="mPaidH" class="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm" value="${escHtml(meta.paid_header)}">
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">หมายเหตุอัตราหมายเงิน</label>
            <textarea id="mPaidN" rows="3" class="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs">${escHtml(meta.paid_notes)}</textarea>
          </div>
          <hr>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">หัวตารางอัตราหมายฟรี (บรรทัดที่ 1-3)</label>
            <input id="mFreeH1" class="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm mb-1.5" value="${escHtml(meta.free_header_1)}">
            <input id="mFreeH2" class="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm mb-1.5" value="${escHtml(meta.free_header_2)}">
            <input id="mFreeH3" class="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm" value="${escHtml(meta.free_header_3)}">
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">หมายเหตุอัตราหมายฟรี</label>
            <textarea id="mFreeN" rows="2" class="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs">${escHtml(meta.free_notes)}</textarea>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'บันทึก',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#1c3d70',
      preConfirm: () => ({
        paid_header: (document.getElementById('mPaidH') as HTMLInputElement).value,
        paid_notes: (document.getElementById('mPaidN') as HTMLTextAreaElement).value,
        free_header_1: (document.getElementById('mFreeH1') as HTMLInputElement).value,
        free_header_2: (document.getElementById('mFreeH2') as HTMLInputElement).value,
        free_header_3: (document.getElementById('mFreeH3') as HTMLInputElement).value,
        free_notes: (document.getElementById('mFreeN') as HTMLTextAreaElement).value,
      }),
    });
    if (!value) return;
    const res = await fetch('/api/rates/meta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(value),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) return alertError(data.message);
    await alertSuccess(data.message);
    router.refresh();
  }

  function filterDistrict(type: 'paid' | 'free', dist: string) {
    const dt = type === 'paid' ? paidDtRef.current : freeDtRef.current;
    if (!dt) return;
    dt.column(1).search(dist ? `^อำเภอ${dist.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$` : '', true, false).draw();
  }

  return (
    <div className="space-y-5">
      {/* Top Toolbar */}
      <div className="bg-white rounded-2xl p-4 shadow-card border border-slate-200/80 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h2 className="font-bold text-brand-900 text-base">ตารางอัตราค่านำส่งคำคู่ความและเอกสารทางคดี ศาลจังหวัดอุดรธานี</h2>
          <p className="text-xs text-slate-500 mt-0.5">แยกตารางอัตราหมายเงิน และ อัตราหมายฟรี ชัดเจนตามอำเภอและตำบล ค้นหา/กรอง/ส่งออกได้ทันที</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/api/export?action=rates_xlsx&scope=all" className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold shadow-sm transition">
            ส่งออก Excel (ทั้ง 2 ชีต)
          </a>
          <a href="/api/export?action=rates_pdf&scope=all&inline=1" target="_blank" className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-semibold shadow-sm transition">
            ส่งออก PDF (ทั้ง 2 ตาราง)
          </a>
          {isAdmin && (
            <>
              <button type="button" onClick={openImportModal} className="px-3.5 py-2 rounded-xl bg-brand-700 hover:bg-brand-800 text-white text-xs sm:text-sm font-semibold shadow-sm transition">
                นำเข้า Excel / PDF
              </button>
              <button type="button" onClick={openMetaModal} className="px-3.5 py-2 rounded-xl bg-slate-700 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold shadow-sm transition">
                แก้ไขหัวประกาศ/หมายเหตุ
              </button>
            </>
          )}
        </div>
      </div>

      {/* View Switcher */}
      <div className="flex flex-wrap gap-2">
        {(['both', 'paid', 'free'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setViewMode(m)}
            className={
              viewMode === m
                ? 'px-4 py-2 rounded-xl text-sm font-semibold bg-brand-800 text-white shadow-sm'
                : 'px-4 py-2 rounded-xl text-sm font-semibold bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
            }
          >
            {m === 'both' ? 'แสดงทั้ง 2 ตารางแยกกัน' : m === 'paid' ? 'เฉพาะอัตราหมายเงิน' : 'เฉพาะอัตราหมายฟรี'}
          </button>
        ))}
      </div>

      {/* SECTION 1: PAID */}
      <section className={`bg-white rounded-2xl shadow-card border border-slate-200/80 overflow-hidden ${viewMode === 'free' ? 'hidden' : ''}`}>
        <div className="px-5 py-4 bg-gradient-to-r from-amber-50 to-white border-b border-amber-200/70 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-600 text-white">ตารางที่ 1</span>
              <h3 className="font-bold text-brand-900 text-base">อัตราค่านำหมายเงิน (คู่ความวางเงิน)</h3>
            </div>
            <p className="text-xs text-slate-600 mt-1">{meta.paid_header}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select onChange={(e) => filterDistrict('paid', e.target.value)} className="rounded-lg border-slate-300 text-xs sm:text-sm py-1.5">
              <option value="">-- ทุกอำเภอ --</option>
              {paidDistricts.map((d) => <option key={d} value={d}>อำเภอ{d}</option>)}
            </select>
            <a href="/api/export?action=rates_xlsx&scope=paid" className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 text-xs font-semibold">Excel</a>
            <a href="/api/export?action=rates_pdf&scope=paid&inline=1" target="_blank" className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100 text-xs font-semibold">PDF</a>
            {isAdmin && (
              <button type="button" onClick={() => openRateModal('paid')} className="px-3 py-1.5 rounded-lg bg-brand-700 hover:bg-brand-800 text-white text-xs font-semibold">+ เพิ่มรายการ</button>
            )}
          </div>
        </div>
        <div className="p-4 overflow-x-auto">
          <table ref={paidTableRef} className="display responsive nowrap w-full text-sm">
            <thead>
              <tr>
                <th className="w-14">ลำดับ</th>
                <th>อำเภอ</th>
                <th>ตำบล</th>
                <th>หมายเหตุ / ข้อยกเว้น</th>
                <th className="text-right">ค่าหมาย (บาท)</th>
                {isAdmin && <th className="w-28 text-center">จัดการ</th>}
              </tr>
            </thead>
          </table>
          {meta.paid_notes && (
            <div className="mt-4 p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-950 whitespace-pre-line leading-relaxed">{meta.paid_notes}</div>
          )}
        </div>
      </section>

      {/* SECTION 2: FREE */}
      <section className={`bg-white rounded-2xl shadow-card border border-slate-200/80 overflow-hidden ${viewMode === 'paid' ? 'hidden' : ''}`}>
        <div className="px-5 py-4 bg-gradient-to-r from-emerald-50 to-white border-b border-emerald-200/70 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-600 text-white">ตารางที่ 2</span>
              <h3 className="font-bold text-brand-900 text-base">อัตราค่านำหมายฟรี (หมายศาล / ตามระเบียบ)</h3>
            </div>
            <p className="text-xs text-slate-600 mt-1">{meta.free_header_3}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select onChange={(e) => filterDistrict('free', e.target.value)} className="rounded-lg border-slate-300 text-xs sm:text-sm py-1.5">
              <option value="">-- ทุกอำเภอ --</option>
              {freeDistricts.map((d) => <option key={d} value={d}>อำเภอ{d}</option>)}
            </select>
            <a href="/api/export?action=rates_xlsx&scope=free" className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 text-xs font-semibold">Excel</a>
            <a href="/api/export?action=rates_pdf&scope=free&inline=1" target="_blank" className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100 text-xs font-semibold">PDF</a>
            {isAdmin && (
              <button type="button" onClick={() => openRateModal('free')} className="px-3 py-1.5 rounded-lg bg-brand-700 hover:bg-brand-800 text-white text-xs font-semibold">+ เพิ่มรายการ</button>
            )}
          </div>
        </div>
        <div className="p-4 overflow-x-auto">
          <table ref={freeTableRef} className="display responsive nowrap w-full text-sm">
            <thead>
              <tr>
                <th className="w-14">ลำดับ</th>
                <th>อำเภอ</th>
                <th>ตำบล</th>
                <th>หมายเหตุ / ข้อยกเว้น</th>
                <th className="text-right">ค่าหมาย (บาท)</th>
                {isAdmin && <th className="w-28 text-center">จัดการ</th>}
              </tr>
            </thead>
          </table>
          {meta.free_notes && (
            <div className="mt-4 p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-950 whitespace-pre-line leading-relaxed">{meta.free_notes}</div>
          )}
        </div>
      </section>
    </div>
  );
}
