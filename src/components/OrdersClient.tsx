'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { alertError, alertSuccess, confirmAction, confirmDelete, escHtml, showLoading, Swal } from '@/lib/swal';
import type { DirectorSigner } from '@/lib/db';

interface OrderItem {
  id: number;
  order_text: string;
  order_no: string;
  order_date: string;
  note: string;
  created_at: string;
  used_count: number;
}

interface Signers {
  director_name: string;
  director_acting: string;
  officer_name: string;
  officer_position: string;
  payer_name: string;
  payer_position: string;
}

export default function OrdersClient({
  orders,
  directors,
  signers: initialSigners,
}: {
  orders: OrderItem[];
  directors: DirectorSigner[];
  signers: Signers;
}) {
  const router = useRouter();
  const [signers, setSigners] = useState(initialSigners);
  const [savingSigners, setSavingSigners] = useState(false);

  async function openDirectorModal(d: DirectorSigner | null = null) {
    const { value } = await Swal.fire({
      title: d ? 'แก้ไขผู้ลงนาม (ผู้อำนวยการฯ / รักษาราชการแทน)' : 'เพิ่มรายชื่อผู้ลงนาม (ผู้อำนวยการฯ / รักษาราชการแทน)',
      width: 560,
      html: `
        <div class="text-left space-y-3 mt-2 text-sm">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">ชื่อ-สกุลผู้ลงนาม (พร้อมคำนำหน้า) *</label>
            <input id="dName" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value="${escHtml(d?.full_name || '')}" placeholder="เช่น นางสาวเนตรดาว  เฝ้าทรัพย์">
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">สถานะตำแหน่ง</label>
            <select id="dActing" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="0" ${d && !d.is_acting ? 'selected' : ''}>ผู้อำนวยการสำนักอำนวยการประจำศาลจังหวัดอุดรธานี (ตัวจริง)</option>
              <option value="1" ${!d || d.is_acting ? 'selected' : ''}>รักษาราชการแทน ผู้อำนวยการสำนักอำนวยการประจำศาลจังหวัดอุดรธานี</option>
            </select>
            <div class="text-xs text-slate-500 mt-1">หากเลือก "รักษาราชการแทน" ระบบจะใส่คำว่า <b>รักษาราชการแทน</b> นำหน้าห่าง 1 วรรคอัตโนมัติ</div>
          </div>
          <label class="flex items-center gap-2 pt-1 cursor-pointer">
            <input id="dDefault" type="checkbox" ${d?.is_default ? 'checked' : ''} class="rounded border-slate-300 text-brand-700">
            <span class="text-sm font-medium text-slate-700">ตั้งเป็นค่าเริ่มต้นเมื่อสร้างรายงานใหม่</span>
          </label>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'บันทึก',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#1c3d70',
      preConfirm: () => {
        const full_name = (document.getElementById('dName') as HTMLInputElement).value.trim();
        if (!full_name) {
          Swal.showValidationMessage('กรุณากรอกชื่อ-สกุลผู้ลงนาม');
          return false;
        }
        return {
          id: d?.id || 0,
          full_name,
          is_acting: (document.getElementById('dActing') as HTMLSelectElement).value === '1',
          is_default: (document.getElementById('dDefault') as HTMLInputElement).checked,
        };
      },
    });
    if (!value) return;
    showLoading('กำลังบันทึกรายชื่อผู้ลงนาม...');
    const res = await fetch('/api/directors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(value),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) return alertError(data.message);
    await alertSuccess(data.message);
    router.refresh();
  }

  async function deleteDirector(id: number) {
    const c = await confirmDelete('ต้องการลบรายชื่อผู้ลงนามนี้ใช่หรือไม่?');
    if (!c.isConfirmed) return;
    showLoading('กำลังลบรายชื่อผู้ลงนาม...');
    const res = await fetch(`/api/directors?id=${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok || !data.ok) return alertError(data.message);
    await alertSuccess(data.message);
    router.refresh();
  }

  async function openAddOrder() {
    const { value } = await Swal.fire({
      title: 'เพิ่มคำสั่งศาลจังหวัดอุดรธานีฉบับใหม่',
      width: 600,
      html: `
        <div class="text-left space-y-3 mt-2 text-sm">
          <div class="p-3 rounded-lg bg-brand-50 text-brand-900 text-xs">
            เมื่อบันทึกแล้ว คำสั่งนี้จะถูกใช้เป็นค่าเริ่มต้นสำหรับรายงานรอบใหม่ทันที โดยรายงานรอบก่อนหน้าจะยังคงแสดงคำสั่งเดิมที่เคยบันทึกไว้
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block font-semibold text-slate-700 mb-1">เลขที่คำสั่ง</label>
              <input id="oNo" class="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm" placeholder="เช่น 45/2569">
            </div>
            <div>
              <label class="block font-semibold text-slate-700 mb-1">ลงวันที่</label>
              <input id="oDate" class="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm" placeholder="เช่น 1 ตุลาคม 2569">
            </div>
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">ข้อความคำสั่งเต็ม (ที่จะแสดงในบันทึกข้อความ) *</label>
            <input id="oText" class="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-bold" value="คำสั่งศาลจังหวัดอุดรธานี ที่ " placeholder="คำสั่งศาลจังหวัดอุดรธานี ที่ ... ลงวันที่ ...">
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">หมายเหตุ (ถ้ามี)</label>
            <input id="oNote" class="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm" placeholder="เช่น คำสั่งแต่งตั้งเจ้าพนักงานศาลเพิ่มเติม">
          </div>
        </div>
      `,
      didOpen: () => {
        const noEl = document.getElementById('oNo') as HTMLInputElement;
        const dtEl = document.getElementById('oDate') as HTMLInputElement;
        const txtEl = document.getElementById('oText') as HTMLInputElement;
        const sync = () => {
          const no = noEl.value.trim();
          const dt = dtEl.value.trim();
          if (no || dt) txtEl.value = `คำสั่งศาลจังหวัดอุดรธานี ที่ ${no} ลงวันที่ ${dt}`.trim();
        };
        noEl.addEventListener('input', sync);
        dtEl.addEventListener('input', sync);
      },
      showCancelButton: true,
      confirmButtonText: 'บันทึกคำสั่งใหม่',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#1c3d70',
      preConfirm: () => {
        const order_text = (document.getElementById('oText') as HTMLInputElement).value.trim();
        if (!order_text) {
          Swal.showValidationMessage('กรุณากรอกข้อความคำสั่งศาล');
          return false;
        }
        return {
          order_no: (document.getElementById('oNo') as HTMLInputElement).value.trim(),
          order_date: (document.getElementById('oDate') as HTMLInputElement).value.trim(),
          order_text,
          note: (document.getElementById('oNote') as HTMLInputElement).value.trim(),
        };
      },
    });
    if (!value) return;
    showLoading('กำลังบันทึกคำสั่งศาลฉบับใหม่...');
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(value),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) return alertError(data.message);
    await alertSuccess(data.message);
    router.refresh();
  }

  async function deleteOrder(id: number) {
    const c = await confirmDelete('ต้องการลบคำสั่งศาลนี้ออกจากประวัติใช่หรือไม่? (รายงานเดิมที่บันทึกไปแล้วจะยังเก็บข้อความคำสั่งไว้)');
    if (!c.isConfirmed) return;
    showLoading('กำลังลบคำสั่งศาล...');
    const res = await fetch(`/api/orders?id=${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok || !data.ok) return alertError(data.message);
    await alertSuccess(data.message);
    router.refresh();
  }

  async function saveSigners(e: React.FormEvent) {
    e.preventDefault();
    const c = await confirmAction('ยืนยันการบันทึก', 'ต้องการบันทึกข้อมูลผู้ลงนามเริ่มต้นใหม่ใช่หรือไม่?', 'บันทึก');
    if (!c.isConfirmed) return;
    setSavingSigners(true);
    showLoading('กำลังบันทึกข้อมูลผู้ลงนาม...');
    try {
      const res = await fetch('/api/orders/signers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signers),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) return alertError(data.message);
      await alertSuccess(data.message);
    } finally {
      setSavingSigners(false);
    }
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <div className="xl:col-span-2 space-y-6">
        <div className="bg-white rounded-2xl shadow-card border border-slate-200/80 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="font-bold text-brand-900 text-base">คำสั่งศาลจังหวัดอุดรธานี (ดึงฉบับล่าสุดไปใช้ในบันทึกข้อความเสมอ)</h2>
              <p className="text-xs text-slate-500 mt-0.5">เมื่อเพิ่มคำสั่งฉบับใหม่ รายงานใหม่จะใช้คำสั่งล่าสุดอัตโนมัติ ส่วนรายงานเก่าจะคงคำสั่งเดิมไว้เสมอ</p>
            </div>
            <button type="button" onClick={openAddOrder} className="shrink-0 px-4 py-2 rounded-xl bg-brand-700 hover:bg-brand-800 text-white text-sm font-semibold shadow-sm transition">
              + เพิ่มคำสั่งศาลฉบับใหม่
            </button>
          </div>
          <div className="p-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2.5 text-left">สถานะ</th>
                  <th className="px-3 py-2.5 text-left">ข้อความคำสั่งศาล (แสดงตัวหนา-ขีดเส้นใต้)</th>
                  <th className="px-3 py-2.5 text-center">ใช้แล้ว</th>
                  <th className="px-3 py-2.5 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((o, idx) => (
                  <tr key={o.id} className="hover:bg-slate-50">
                    <td className="px-3 py-3 whitespace-nowrap">
                      {idx === 0 ? (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">ฉบับล่าสุด (ใช้งานอยู่)</span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">ฉบับก่อนหน้า</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-bold text-brand-900 underline underline-offset-2">{o.order_text}</div>
                      {o.note && <div className="text-xs text-slate-500 mt-0.5">{o.note}</div>}
                      <div className="text-[11px] text-slate-400 mt-0.5">บันทึกเมื่อ: {o.created_at}</div>
                    </td>
                    <td className="px-3 py-3 text-center font-semibold text-slate-700">{o.used_count} รอบ</td>
                    <td className="px-3 py-3 text-center">
                      {orders.length > 1 ? (
                        <button type="button" onClick={() => deleteOrder(o.id)} className="px-2.5 py-1 rounded-lg bg-red-100 hover:bg-red-200 text-red-800 text-xs font-semibold">ลบ</button>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Director / Acting Director Signers Management */}
        <div className="bg-white rounded-2xl shadow-card border border-slate-200/80 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="font-bold text-brand-900 text-base">รายชื่อผู้ลงนามตำแหน่ง ผู้อำนวยการฯ / ผู้รักษาราชการแทน</h2>
              <p className="text-xs text-slate-500 mt-0.5">เพิ่มรายชื่อผู้อำนวยการฯ หรือผู้รักษาราชการแทน เพื่อเลือกใช้งานในแบบรายงานผล (กรณีรักษาราชการแทนจะมีคำว่า &ldquo;รักษาราชการแทน &rdquo; นำหน้าห่าง 1 วรรคอัตโนมัติ)</p>
            </div>
            <button type="button" onClick={() => openDirectorModal(null)} className="shrink-0 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-sm transition">
              + เพิ่มผู้ลงนาม
            </button>
          </div>
          <div className="p-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2.5 text-left">ชื่อ-สกุล</th>
                  <th className="px-3 py-2.5 text-left">ข้อความตำแหน่งที่จะแสดงในบันทึกข้อความ</th>
                  <th className="px-3 py-2.5 text-center">ค่าเริ่มต้น</th>
                  <th className="px-3 py-2.5 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {directors.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="px-3 py-3 font-bold text-brand-900 whitespace-nowrap">{d.full_name}</td>
                    <td className="px-3 py-3 text-slate-700">
                      {d.is_acting ? (
                        <span><b className="underline text-amber-800">รักษาราชการแทน</b> ผู้อำนวยการสำนักอำนวยการประจำศาลจังหวัดอุดรธานี</span>
                      ) : (
                        <span>ผู้อำนวยการสำนักอำนวยการประจำศาลจังหวัดอุดรธานี</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {d.is_default ? (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">ค่าเริ่มต้น</span>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center whitespace-nowrap">
                      <button type="button" onClick={() => openDirectorModal(d)} className="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-semibold mr-1">แก้ไข</button>
                      {directors.length > 1 && (
                        <button type="button" onClick={() => deleteDirector(d.id)} className="px-2.5 py-1 rounded-lg bg-red-100 hover:bg-red-200 text-red-800 text-xs font-semibold">ลบ</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-card border border-slate-200/80 p-5 h-fit">
        <h2 className="font-bold text-brand-900 text-base mb-1">ข้อมูลผู้ลงนามเริ่มต้น</h2>
        <p className="text-xs text-slate-500 mb-4 pb-3 border-b border-slate-100">ใช้เติมค่าเริ่มต้นเมื่อสร้างรายงานใหม่ (แก้ไขเฉพาะรอบได้)</p>
        <form onSubmit={saveSigners} className="space-y-3.5 text-sm">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">ชื่อ-สกุล ผู้อำนวยการฯ / ผู้อนุมัติ</label>
            <input type="text" value={signers.director_name} onChange={(e) => setSigners({ ...signers, director_name: e.target.value })} className="w-full rounded-xl border-slate-300 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">ข้อความในวงเล็บ [ ] (เช่น รักษาราชการแทน)</label>
            <input type="text" value={signers.director_acting} onChange={(e) => setSigners({ ...signers, director_acting: e.target.value })} className="w-full rounded-xl border-slate-300 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">ชื่อ-สกุล ผู้เสนอ / เจ้าพนักงานศาลยุติธรรม</label>
            <input type="text" value={signers.officer_name} onChange={(e) => setSigners({ ...signers, officer_name: e.target.value })} className="w-full rounded-xl border-slate-300 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">ตำแหน่ง ผู้เสนอ</label>
            <input type="text" value={signers.officer_position} onChange={(e) => setSigners({ ...signers, officer_position: e.target.value })} className="w-full rounded-xl border-slate-300 text-sm" />
          </div>
          <hr />
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">ชื่อ-สกุล ผู้จ่ายเงิน (ใบสำคัญรับเงิน)</label>
            <input type="text" value={signers.payer_name} onChange={(e) => setSigners({ ...signers, payer_name: e.target.value })} className="w-full rounded-xl border-slate-300 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">ตำแหน่ง ผู้จ่ายเงิน</label>
            <input type="text" value={signers.payer_position} onChange={(e) => setSigners({ ...signers, payer_position: e.target.value })} className="w-full rounded-xl border-slate-300 text-sm" />
          </div>
          <button type="submit" disabled={savingSigners} className="w-full py-2.5 rounded-xl bg-brand-700 hover:bg-brand-800 disabled:opacity-60 text-white font-semibold text-sm shadow-sm transition">
            {savingSigners ? 'กำลังบันทึก...' : 'บันทึกข้อมูลผู้ลงนามเริ่มต้น'}
          </button>
        </form>
      </div>
    </div>
  );
}
