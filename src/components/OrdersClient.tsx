'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { alertError, alertSuccess, confirmDelete, Swal, toastSuccess } from '@/lib/swal';

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

export default function OrdersClient({ orders, signers: initialSigners }: { orders: OrderItem[]; signers: Signers }) {
  const router = useRouter();
  const [signers, setSigners] = useState(initialSigners);
  const [savingSigners, setSavingSigners] = useState(false);

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
    const res = await fetch(`/api/orders?id=${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok || !data.ok) return alertError(data.message);
    await alertSuccess(data.message);
    router.refresh();
  }

  async function saveSigners(e: React.FormEvent) {
    e.preventDefault();
    setSavingSigners(true);
    try {
      const res = await fetch('/api/orders/signers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signers),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) return alertError(data.message);
      toastSuccess(data.message);
    } finally {
      setSavingSigners(false);
    }
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <div className="xl:col-span-2">
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
