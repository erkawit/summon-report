'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { alertError, confirmDelete, showLoading, Swal, toastInfo, toastSuccess } from '@/lib/swal';
import { bahtText, evaluateFreeSummonItems, formatMoney } from '@/lib/thai';
import type { DirectorSigner } from '@/lib/db';

export interface SimpleRate {
  district: string;
  subdistrict: string;
  exception_note: string;
  rate_amount: number;
}

export interface FormItemRow {
  case_prefix: string;
  case_no: string;
  issue_date: string;
  serve_date: string;
  summon_type: string;
  recipient_role: string;
  house_no: string;
  moo: string;
  subdistrict: string;
  district: string;
  province: string;
  base_rate: number | '';
}

export interface ReportFormInitial {
  id: number;
  report_type: 'free' | 'paid';
  round_label: string;
  doc_no: string;
  doc_date: string;
  order_text: string;
  period_start: string;
  period_end: string;
  item_count: number;
  total_amount: number;
  amount_text: string;
  reporter_name: string;
  reporter_position: string;
  reporter_address: string;
  officer_name: string;
  officer_position: string;
  director_name: string;
  director_acting: string;
  payer_name: string;
  payer_position: string;
  receipt_date: string;
  note: string;
  items: FormItemRow[];
}

const emptyRow = (): FormItemRow => ({
  case_prefix: 'คดีดำ',
  case_no: '',
  issue_date: '',
  serve_date: '',
  summon_type: '',
  recipient_role: '',
  house_no: '',
  moo: '',
  subdistrict: '',
  district: '',
  province: 'จ.อุดรธานี',
  base_rate: '',
});

export default function ReportFormClient({
  initial,
  freeRates,
  paidRates,
  directors,
}: {
  initial: ReportFormInitial;
  freeRates: SimpleRate[];
  paidRates: SimpleRate[];
  directors: DirectorSigner[];
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [items, setItems] = useState<FormItemRow[]>(
    initial.report_type === 'free' ? (initial.items.length > 0 ? initial.items : [emptyRow()]) : []
  );
  const [saving, setSaving] = useState(false);

  // Quick paid rate lookup
  const [qlDist, setQlDist] = useState('');
  const [qlRate, setQlRate] = useState('');

  const freeByDist = useMemo(() => {
    const m = new Map<string, SimpleRate[]>();
    freeRates.forEach((r) => {
      const arr = m.get(r.district) || [];
      arr.push(r);
      m.set(r.district, arr);
    });
    return m;
  }, [freeRates]);

  const paidByDist = useMemo(() => {
    const m = new Map<string, SimpleRate[]>();
    paidRates.forEach((r) => {
      const arr = m.get(r.district) || [];
      arr.push(r);
      m.set(r.district, arr);
    });
    return m;
  }, [paidRates]);

  const evalRes = useMemo(() => {
    if (form.report_type !== 'free') return null;
    return evaluateFreeSummonItems(
      items.map((it) => ({ ...it, base_rate: Number(it.base_rate) || 0 }))
    );
  }, [items, form.report_type]);

  const sumBase = useMemo(() => items.reduce((acc, it) => acc + (Number(it.base_rate) || 0), 0), [items]);

  function updateItem(idx: number, patch: Partial<FormItemRow>) {
    setItems((prev) => prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  }

  function onDistrictChange(idx: number, district: string) {
    updateItem(idx, { district, subdistrict: '', base_rate: '' });
  }

  function onSubdistrictChange(idx: number, subdistrict: string, district: string) {
    const list = freeByDist.get(district) || [];
    const found = list.find((r) => r.subdistrict === subdistrict && !r.exception_note) || list.find((r) => r.subdistrict === subdistrict);
    updateItem(idx, { subdistrict, base_rate: found ? found.rate_amount : '' });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.report_type === 'free') {
      if (items.length === 0) return alertError('กรุณาเพิ่มรายการส่งหมายอย่างน้อย 1 แถว');
      if (evalRes?.has_duplicates) {
        return alertError(
          'พบรายการที่มี บ้านเลขที่ หมู่ ตำบล อำเภอ เดียวกันซ้ำอยู่ (แถบสีแดง) ตามระเบียบเบิกได้เพียงหมายเดียว ไม่สามารถบันทึกได้',
          'พบที่อยู่ซ้ำ ห้ามบันทึก!'
        );
      }
    }

    setSaving(true);
    showLoading('กำลังบันทึกรายงานผล...');
    try {
      const payload = {
        ...form,
        items: form.report_type === 'free' ? items.map((it) => ({ ...it, base_rate: Number(it.base_rate) || 0 })) : [],
      };
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        await alertError(data.message || 'ไม่สามารถบันทึกได้');
        return;
      }

      const savedId = data.id;
      let links = `
        <div class="mt-3 flex flex-wrap justify-center gap-2">
          <a href="/api/export?action=memo_docx&id=${savedId}" class="px-3.5 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold">ดาวน์โหลด Word บันทึกฯ</a>
          <a href="/api/export?action=memo_pdf&id=${savedId}&inline=1" target="_blank" class="px-3.5 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold">เปิด PDF บันทึกฯ</a>
      `;
      if (form.report_type === 'free') {
        links += `
          <a href="/api/export?action=receipt_xlsx&id=${savedId}" class="px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold">ดาวน์โหลด Excel ใบรับเงิน</a>
          <a href="/api/export?action=receipt_pdf&id=${savedId}&inline=1" target="_blank" class="px-3.5 py-2 rounded-xl bg-slate-700 text-white text-xs font-semibold">เปิด PDF ใบรับเงิน</a>
        `;
      }
      links += '</div>';

      await Swal.fire({
        icon: 'success',
        title: 'บันทึกรายงานเรียบร้อยแล้ว',
        html: '<p class="text-sm text-slate-600">ท่านสามารถส่งออกไฟล์เอกสารได้ทันทีด้านล่าง</p>' + links,
        confirmButtonText: 'ตกลง',
        confirmButtonColor: '#1c3d70',
      });
      router.push(`/reports/form?id=${savedId}`);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Locked Court Order Banner */}
      <div className={`rounded-2xl p-4 border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${form.id > 0 ? 'bg-slate-100 border-slate-300' : 'bg-brand-50 border-brand-200'}`}>
        <div>
          <div className={`text-xs font-bold uppercase tracking-wider ${form.id > 0 ? 'text-slate-600' : 'text-brand-700'}`}>
            {form.id > 0 ? 'คำสั่งศาลที่ล็อกไว้กับรายงานรอบนี้ (คงข้อมูลเดิมตามรอบที่สร้าง)' : 'คำสั่งศาลฉบับล่าสุดจากระบบ (ดึงมาใช้อัตโนมัติ)'}
          </div>
          <div className="text-sm sm:text-base font-bold text-brand-900 underline underline-offset-4 mt-0.5">{form.order_text}</div>
        </div>
        {form.id > 0 && (
          <div className="flex flex-wrap gap-1.5 shrink-0">
            <a href={`/api/export?action=memo_docx&id=${form.id}`} onClick={() => toastInfo('กำลังสร้างไฟล์ Word บันทึกข้อความ...')} className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold">Word บันทึกฯ</a>
            <a href={`/api/export?action=memo_pdf&id=${form.id}&inline=1`} target="_blank" onClick={() => toastInfo('กำลังสร้างไฟล์ PDF บันทึกข้อความ...')} className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold">PDF บันทึกฯ</a>
            {form.report_type === 'free' && (
              <>
                <a href={`/api/export?action=receipt_xlsx&id=${form.id}`} onClick={() => toastInfo('กำลังสร้างไฟล์ Excel ใบสำคัญรับเงิน...')} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold">Excel ใบรับเงิน</a>
                <a href={`/api/export?action=receipt_pdf&id=${form.id}&inline=1`} target="_blank" onClick={() => toastInfo('กำลังสร้างไฟล์ PDF ใบสำคัญรับเงิน...')} className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-800 text-white text-xs font-semibold">PDF ใบรับเงิน</a>
              </>
            )}
          </div>
        )}
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        {/* Section 1 */}
        <div className="bg-white rounded-2xl shadow-card border border-slate-200/80 p-5">
          <h2 className="font-bold text-brand-900 text-base mb-4 pb-2 border-b border-slate-100">1. ข้อมูลรอบการเบิกจ่ายและหัวบันทึกข้อความ</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">ชื่อรอบการเบิกจ่าย (สำหรับอ้างอิงในระบบ)</label>
              <input type="text" value={form.round_label} onChange={(e) => setForm({ ...form, round_label: e.target.value })} placeholder="เช่น รอบ 19 พ.ศ. 2569" className="w-full rounded-xl border-slate-300 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">ที่ (หัวบันทึกข้อความ — เว้นว่างได้)</label>
              <input type="text" value={form.doc_no} onChange={(e) => setForm({ ...form, doc_no: e.target.value })} placeholder="เช่น ศย 303.005/..." className="w-full rounded-xl border-slate-300 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">วันที่บันทึกข้อความ (เว้นว่างได้)</label>
              <input type="text" value={form.doc_date} onChange={(e) => setForm({ ...form, doc_date: e.target.value })} placeholder="เช่น 20 พฤศจิกายน 2569" className="w-full rounded-xl border-slate-300 text-sm" />
            </div>
            {form.report_type === 'free' ? (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">วันที่ใบสำคัญรับเงิน (เว้นว่างได้)</label>
                <input type="text" value={form.receipt_date} onChange={(e) => setForm({ ...form, receipt_date: e.target.value })} placeholder="เช่น 20 พฤศจิกายน 2569" className="w-full rounded-xl border-slate-300 text-sm" />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">หมายเหตุเพิ่มเติม</label>
                <input type="text" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="หมายเหตุ (ถ้ามี)" className="w-full rounded-xl border-slate-300 text-sm" />
              </div>
            )}
          </div>
        </div>

        {/* Section 2: FREE or PAID */}
        {form.report_type === 'free' ? (
          <div className="bg-white rounded-2xl shadow-card border border-slate-200/80 overflow-hidden">
            <div className="px-5 py-4 bg-gradient-to-r from-emerald-50 to-white border-b border-emerald-200/70 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="font-bold text-brand-900 text-base">2. รายการใบสำคัญรับเงินฟรี (เพิ่มทีละแถว — คำนวณราคาหมาย &amp; ราคาเบิกอัตโนมัติ)</h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  เงื่อนไข: ตำบล/อำเภอเดียวกัน (คนละหมู่) = <b>เบิกเต็ม 100%</b> | หมู่ ตำบล อำเภอเดียวกัน (คนละบ้านเลขที่) = <b>เบิกหมายละครึ่ง (50%)</b> | บ้านเลขที่ หมู่ ตำบล อำเภอเดียวกัน = <b className="text-red-600">ซ้ำ (ขึ้นแดง ห้ามบันทึก)</b>
                </p>
              </div>
              <button type="button" onClick={() => setItems((prev) => [...prev, emptyRow()])} className="shrink-0 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-sm transition">
                + เพิ่มแถว (Add Row)
              </button>
            </div>

            {evalRes?.has_duplicates && (
              <div className="mx-5 mt-4 p-3.5 rounded-xl bg-red-50 border-2 border-red-400 text-red-800 text-sm font-semibold flex items-start gap-2.5">
                <svg className="w-5 h-5 text-red-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                <div>
                  <div>พบข้อมูลที่อยู่ซ้ำกัน (บ้านเลขที่ หมู่ ตำบล อำเภอ เดียวกัน)!</div>
                  <div className="text-xs font-normal text-red-700 mt-0.5">ตามระเบียบสามารถเบิกได้เพียงหมายเดียวเท่านั้น กรุณาแก้ไขหรือลบแถวที่ขึ้นสีแดงก่อนทำการบันทึก</div>
                </div>
              </div>
            )}

            <div className="p-4 overflow-x-auto">
              <table className="w-full text-xs border-collapse min-w-[1180px]">
                <thead>
                  <tr className="bg-brand-800 text-white">
                    <th className="p-2 border border-brand-700 w-10 text-center">#</th>
                    <th className="p-2 border border-brand-700 w-24">ประเภทคดี</th>
                    <th className="p-2 border border-brand-700 w-28">หมายเลขคดี</th>
                    <th className="p-2 border border-brand-700 w-28">วันที่จ่ายหมาย (พ.ศ.)</th>
                    <th className="p-2 border border-brand-700 w-28">วันที่ส่งหมาย (พ.ศ.)</th>
                    <th className="p-2 border border-brand-700 w-36">หมายอะไร</th>
                    <th className="p-2 border border-brand-700 w-24">ส่งให้ใคร</th>
                    <th className="p-2 border border-brand-700 w-20">บ้านเลขที่</th>
                    <th className="p-2 border border-brand-700 w-16">หมู่</th>
                    <th className="p-2 border border-brand-700 w-36">อำเภอ</th>
                    <th className="p-2 border border-brand-700 w-36">ตำบล</th>
                    <th className="p-2 border border-brand-700 w-24 text-right">ราคาหมาย</th>
                    <th className="p-2 border border-brand-700 w-28 text-right">ราคาเบิกจริง</th>
                    <th className="p-2 border border-brand-700 w-12 text-center">ลบ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {items.map((it, idx) => {
                    const ev = evalRes?.items[idx];
                    const rule = ev?.calc_rule || 'full';
                    const subList = freeByDist.get(it.district) || [];
                    const rowCls = rule === 'duplicate' ? 'row-duplicate' : rule === 'half' ? 'row-half-rate' : 'hover:bg-slate-50';
                    return (
                      <tr key={idx} className={rowCls}>
                        <td className="p-1.5 border border-slate-200 text-center font-bold text-slate-600">{idx + 1}</td>
                        <td className="p-1.5 border border-slate-200">
                          <select value={it.case_prefix} onChange={(e) => updateItem(idx, { case_prefix: e.target.value })} className="w-full rounded-lg border-slate-300 text-xs py-1 px-1.5">
                            <option value="คดีดำ">คดีดำ</option>
                            <option value="คดีแดง">คดีแดง</option>
                          </select>
                        </td>
                        <td className="p-1.5 border border-slate-200">
                          <input type="text" value={it.case_no} onChange={(e) => updateItem(idx, { case_no: e.target.value })} placeholder="ต2980/2569" className="w-full rounded-lg border-slate-300 text-xs py-1 px-2 font-semibold" />
                        </td>
                        <td className="p-1.5 border border-slate-200">
                          <input type="text" value={it.issue_date} onChange={(e) => updateItem(idx, { issue_date: e.target.value })} placeholder="2569-11-09" className="w-full rounded-lg border-slate-300 text-xs py-1 px-2" />
                        </td>
                        <td className="p-1.5 border border-slate-200">
                          <input type="text" value={it.serve_date} onChange={(e) => updateItem(idx, { serve_date: e.target.value })} placeholder="2569-11-15" className="w-full rounded-lg border-slate-300 text-xs py-1 px-2" />
                        </td>
                        <td className="p-1.5 border border-slate-200">
                          <input type="text" list="dlSummonType" value={it.summon_type} onChange={(e) => updateItem(idx, { summon_type: e.target.value })} placeholder="หมายนัด" className="w-full rounded-lg border-slate-300 text-xs py-1 px-2" />
                        </td>
                        <td className="p-1.5 border border-slate-200">
                          <input type="text" list="dlRecipient" value={it.recipient_role} onChange={(e) => updateItem(idx, { recipient_role: e.target.value })} placeholder="โจทก์/จำเลย" className="w-full rounded-lg border-slate-300 text-xs py-1 px-2" />
                        </td>
                        <td className="p-1.5 border border-slate-200">
                          <input type="text" value={it.house_no} onChange={(e) => updateItem(idx, { house_no: e.target.value })} placeholder="เลขที่" className="w-full rounded-lg border-slate-300 text-xs py-1 px-2 font-semibold" />
                        </td>
                        <td className="p-1.5 border border-slate-200">
                          <input type="text" value={it.moo} onChange={(e) => updateItem(idx, { moo: e.target.value })} placeholder="หมู่" className="w-full rounded-lg border-slate-300 text-xs py-1 px-2 text-center font-semibold" />
                        </td>
                        <td className="p-1.5 border border-slate-200">
                          <select value={it.district} onChange={(e) => onDistrictChange(idx, e.target.value)} className="w-full rounded-lg border-slate-300 text-xs py-1 px-1.5">
                            <option value="">-- อำเภอ --</option>
                            {Array.from(freeByDist.keys()).map((d) => <option key={d} value={d}>{d}</option>)}
                          </select>
                        </td>
                        <td className="p-1.5 border border-slate-200">
                          <select value={it.subdistrict} onChange={(e) => onSubdistrictChange(idx, e.target.value, it.district)} className="w-full rounded-lg border-slate-300 text-xs py-1 px-1.5">
                            <option value="">-- ตำบล --</option>
                            {subList.filter((r) => !r.exception_note).map((r) => (
                              <option key={r.subdistrict} value={r.subdistrict}>{r.subdistrict}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-1.5 border border-slate-200">
                          <input
                            type="number"
                            step="0.01"
                            value={it.base_rate}
                            onChange={(e) => updateItem(idx, { base_rate: e.target.value === '' ? '' : Number(e.target.value) })}
                            placeholder="0"
                            className="w-full rounded-lg border-slate-300 text-xs py-1 px-2 text-right font-bold"
                          />
                        </td>
                        <td className="p-1.5 border border-slate-200 text-right">
                          {rule === 'duplicate' ? (
                            <>
                              <div className="font-bold text-sm text-red-600">ซ้ำ!</div>
                              <div className="text-[10px] mt-0.5"><span className="px-1.5 py-0.5 rounded bg-red-600 text-white font-semibold">บ้านเลขที่ซ้ำ ห้ามบันทึก</span></div>
                            </>
                          ) : rule === 'half' ? (
                            <>
                              <div className="font-bold text-sm text-amber-800">{formatMoney(ev?.claim_rate || 0)}</div>
                              <div className="text-[10px] mt-0.5"><span className="px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 font-semibold">หมู่เดียวกัน 50%</span></div>
                            </>
                          ) : (
                            <>
                              <div className="font-bold text-sm text-brand-900">{formatMoney(ev?.claim_rate || 0)}</div>
                              <div className="text-[10px] mt-0.5 text-emerald-700">เต็ม 100%</div>
                            </>
                          )}
                        </td>
                        <td className="p-1.5 border border-slate-200 text-center">
                          <button
                            type="button"
                            onClick={async () => {
                              const hasData = Boolean(it.case_no || it.house_no || it.district);
                              if (hasData) {
                                const c = await confirmDelete(`ต้องการลบรายการแถวที่ ${idx + 1} ใช่หรือไม่?`);
                                if (!c.isConfirmed) return;
                              }
                              setItems((prev) => prev.filter((_, i) => i !== idx));
                              toastSuccess('ลบแถวรายการเรียบร้อยแล้ว');
                            }}
                            className="px-2 py-0.5 rounded-lg text-red-600 hover:bg-red-100 font-bold text-sm"
                          >&times;</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-50 font-bold text-sm">
                  <tr>
                    <td colSpan={11} className="p-3 border border-slate-200 text-right text-slate-700">
                      รวมทั้งหมด <span className="text-brand-900">{items.length}</span> เรื่อง &nbsp;|&nbsp; ตัวอักษร:{' '}
                      <span className="text-emerald-800 underline">{bahtText(evalRes?.total_amount || 0)}</span>
                    </td>
                    <td className="p-3 border border-slate-200 text-right text-slate-600">{formatMoney(sumBase)}</td>
                    <td className="p-3 border border-slate-200 text-right text-brand-900 text-base">{formatMoney(evalRes?.total_amount || 0)}</td>
                    <td className="p-3 border border-slate-200" />
                  </tr>
                </tfoot>
              </table>
            </div>

            <datalist id="dlSummonType">
              <option value="หมายนัด" />
              <option value="หมายนัดและสำเนาคำร้อง" />
              <option value="หมายเรียก" />
              <option value="หมายเรียกและสำเนาคำฟ้อง" />
              <option value="หมายบังคับคดี" />
              <option value="คำบังคับ" />
            </datalist>
            <datalist id="dlRecipient">
              <option value="โจทก์" />
              <option value="จำเลย" />
              <option value="ผู้คัดค้าน" />
              <option value="ผู้ร้อง" />
              <option value="พยาน" />
            </datalist>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-card border border-slate-200/80 p-5">
            <h2 className="font-bold text-brand-900 text-base mb-4 pb-2 border-b border-slate-100">2. รายละเอียดการเบิกจ่ายหมายเงิน (ที่คู่ความได้วางเงิน)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">รอบระหว่างวันที่ (เริ่มต้น) *</label>
                <input type="text" required value={form.period_start} onChange={(e) => setForm({ ...form, period_start: e.target.value })} placeholder="เช่น 2 พฤศจิกายน 2569" className="w-full rounded-xl border-slate-300 text-sm font-semibold" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ถึงวันที่ (สิ้นสุด) *</label>
                <input type="text" required value={form.period_end} onChange={(e) => setForm({ ...form, period_end: e.target.value })} placeholder="เช่น 13 พฤศจิกายน 2569" className="w-full rounded-xl border-slate-300 text-sm font-semibold" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">จำนวน (เรื่อง) *</label>
                <input type="number" min={1} required value={form.item_count || ''} onChange={(e) => setForm({ ...form, item_count: Number(e.target.value) })} placeholder="เช่น 8" className="w-full rounded-xl border-slate-300 text-sm font-semibold" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">จำนวนเงิน (บาท) *</label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  required
                  value={form.total_amount || ''}
                  onChange={(e) => {
                    const amt = Number(e.target.value) || 0;
                    setForm({ ...form, total_amount: amt, amount_text: amt > 0 ? bahtText(amt) : '' });
                  }}
                  placeholder="เช่น 7050"
                  className="w-full rounded-xl border-slate-300 text-sm font-bold text-brand-900"
                />
              </div>
              <div className="md:col-span-2 lg:col-span-4">
                <label className="block text-xs font-semibold text-slate-700 mb-1">จำนวนเงิน (ตัวอักษรภาษาไทย — คำนวณอัตโนมัติ แก้ไขได้)</label>
                <input type="text" value={form.amount_text} onChange={(e) => setForm({ ...form, amount_text: e.target.value })} placeholder="เจ็ดพันห้าสิบบาทถ้วน" className="w-full rounded-xl border-slate-300 text-sm font-semibold text-emerald-800 bg-emerald-50/40" />
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100">
              <div className="text-xs font-bold text-slate-600 mb-2">ตัวช่วยตรวจสอบอัตราหมายเงิน (อ้างอิงจากตารางอัตราหมายเงินล่าสุด)</div>
              <div className="flex flex-wrap items-center gap-2">
                <select value={qlDist} onChange={(e) => { setQlDist(e.target.value); setQlRate(''); }} className="rounded-lg border-slate-300 text-xs py-1.5">
                  <option value="">-- เลือกอำเภอ --</option>
                  {Array.from(paidByDist.keys()).map((d) => <option key={d} value={d}>อำเภอ{d}</option>)}
                </select>
                <select value={qlRate} onChange={(e) => setQlRate(e.target.value)} className="rounded-lg border-slate-300 text-xs py-1.5">
                  <option value="">-- เลือกตำบล --</option>
                  {(paidByDist.get(qlDist) || []).map((r, i) => (
                    <option key={i} value={String(r.rate_amount)}>ตำบล{r.subdistrict}{r.exception_note ? ` (${r.exception_note})` : ''}</option>
                  ))}
                </select>
                {qlRate && <span className="text-sm font-bold text-brand-800 px-3 py-1 rounded-lg bg-brand-50">อัตราหมายเงิน: {formatMoney(Number(qlRate))} บาท</span>}
              </div>
            </div>
          </div>
        )}

        {/* Section 3: Signers */}
        <div className="bg-white rounded-2xl shadow-card border border-slate-200/80 p-5">
          <h2 className="font-bold text-brand-900 text-base mb-4 pb-2 border-b border-slate-100">3. ข้อมูลผู้รายงานและผู้ลงนาม (ข้อความตัวหนา-ขีดเส้นใต้ในบันทึกข้อความ)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">ชื่อ-สกุล ผู้รายงาน / ผู้รับเงิน *</label>
              <input type="text" required value={form.reporter_name} onChange={(e) => setForm({ ...form, reporter_name: e.target.value })} className="w-full rounded-xl border-slate-300 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">ตำแหน่ง ผู้รายงาน / ผู้รับเงิน *</label>
              <input type="text" required value={form.reporter_position} onChange={(e) => setForm({ ...form, reporter_position: e.target.value })} className="w-full rounded-xl border-slate-300 text-sm" />
            </div>
            {form.report_type === 'free' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ที่อยู่ผู้รับเงิน (แสดงในใบสำคัญรับเงิน)</label>
                <input type="text" value={form.reporter_address} onChange={(e) => setForm({ ...form, reporter_address: e.target.value })} className="w-full rounded-xl border-slate-300 text-sm" />
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">ชื่อ-สกุล ผู้เสนอ / เจ้าพนักงานศาลยุติธรรม</label>
              <input type="text" value={form.officer_name} onChange={(e) => setForm({ ...form, officer_name: e.target.value })} className="w-full rounded-xl border-slate-300 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">ตำแหน่ง ผู้เสนอ</label>
              <input type="text" value={form.officer_position} onChange={(e) => setForm({ ...form, officer_position: e.target.value })} className="w-full rounded-xl border-slate-300 text-sm" />
            </div>
            <div className="hidden lg:block" />
            <div className="md:col-span-2 lg:col-span-3 p-4 rounded-xl bg-brand-50/60 border border-brand-200/80 space-y-3">
              <div className="text-xs font-bold text-brand-900">ผู้ลงนามอนุมัติ (ตำแหน่ง ผู้อำนวยการสำนักอำนวยการประจำศาลจังหวัดอุดรธานี)</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">เลือกผู้ลงนามจากรายชื่อในระบบ</label>
                  <select
                    value={directors.find((d) => d.full_name === form.director_name && Boolean(form.director_acting) === d.is_acting)?.id || ''}
                    onChange={(e) => {
                      const picked = directors.find((d) => d.id === Number(e.target.value));
                      if (picked) {
                        setForm({
                          ...form,
                          director_name: picked.full_name,
                          director_acting: picked.is_acting ? 'รักษาราชการแทน' : '',
                        });
                      }
                    }}
                    className="w-full rounded-xl border-slate-300 text-sm bg-white"
                  >
                    <option value="">-- เลือกรายชื่อผู้ลงนาม --</option>
                    {directors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.full_name} ({d.is_acting ? 'รักษาราชการแทน' : 'ผู้อำนวยการฯ'})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">ชื่อ-สกุล ผู้อำนวยการฯ / ผู้รักษาราชการแทน</label>
                  <input type="text" value={form.director_name} onChange={(e) => setForm({ ...form, director_name: e.target.value })} className="w-full rounded-xl border-slate-300 text-sm bg-white" />
                </div>
                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(form.director_acting)}
                      onChange={(e) => setForm({ ...form, director_acting: e.target.checked ? 'รักษาราชการแทน' : '' })}
                      className="rounded border-slate-300 text-brand-700"
                    />
                    <span className="text-sm font-semibold text-slate-700">เป็นผู้รักษาราชการแทน</span>
                  </label>
                </div>
              </div>
              <div className="text-xs text-slate-600 bg-white/80 rounded-lg px-3 py-2 border border-slate-200">
                ตัวอย่างบรรทัดลายเซ็นในบันทึกข้อความ:{' '}
                <span className="font-bold text-brand-900">({form.director_name || '...'})</span> —{' '}
                {form.director_acting ? (
                  <span><b className="underline text-amber-800">รักษาราชการแทน</b> ผู้อำนวยการสำนักอำนวยการประจำศาลจังหวัดอุดรธานี</span>
                ) : (
                  <span>ผู้อำนวยการสำนักอำนวยการประจำศาลจังหวัดอุดรธานี</span>
                )}
              </div>
            </div>
            {form.report_type === 'free' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">ชื่อ-สกุล ผู้จ่ายเงิน (ใบสำคัญรับเงิน)</label>
                  <input type="text" value={form.payer_name} onChange={(e) => setForm({ ...form, payer_name: e.target.value })} className="w-full rounded-xl border-slate-300 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">ตำแหน่ง ผู้จ่ายเงิน (ใบสำคัญรับเงิน)</label>
                  <input type="text" value={form.payer_position} onChange={(e) => setForm({ ...form, payer_position: e.target.value })} className="w-full rounded-xl border-slate-300 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">หมายเหตุ</label>
                  <input type="text" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="w-full rounded-xl border-slate-300 text-sm" />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Submit Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-2xl p-4 shadow-card border border-slate-200/80">
          <Link href="/reports" className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition">&larr; กลับหน้ารายการ</Link>
          <button type="submit" disabled={saving} className="px-6 py-2.5 rounded-xl bg-brand-700 hover:bg-brand-800 disabled:opacity-60 text-white text-sm font-bold shadow-md transition">
            {saving ? 'กำลังบันทึก...' : 'บันทึกรายงานผล'}
          </button>
        </div>
      </form>
    </div>
  );
}
