'use client';

import { useEffect, useRef, useState } from 'react';
import { alertError, alertSuccess, confirmDelete, dtThaiLang, escHtml, showLoading, Swal } from '@/lib/swal';

export interface UserItem {
  id: number;
  username: string;
  full_name: string;
  position: string;
  address: string;
  role: 'admin' | 'user';
  is_active: boolean;
}

export default function UsersClient({ curUserId, initialUsers }: { curUserId: number; initialUsers: UserItem[] }) {
  const [users, setUsers] = useState<UserItem[]>(initialUsers);
  const tableRef = useRef<HTMLTableElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dtRef = useRef<any>(null);

  async function reload() {
    const res = await fetch('/api/users');
    const json = await res.json();
    if (json.ok) setUsers(json.data);
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
        data: users,
        destroy: true,
        responsive: true,
        language: dtThaiLang,
        columns: [
          { data: 'id', className: 'text-center text-slate-500' },
          { data: 'username', className: 'font-semibold text-brand-900', render: (d: string) => escHtml(d) },
          { data: 'full_name', className: 'font-medium text-slate-900', render: (d: string) => escHtml(d) },
          { data: 'position', className: 'text-slate-600', render: (d: string) => escHtml(d) },
          {
            data: 'role',
            render: (d: string) =>
              d === 'admin'
                ? '<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-900">ผู้ดูแลระบบ</span>'
                : '<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-100 text-brand-800">ผู้ใช้งาน</span>',
          },
          {
            data: 'is_active',
            render: (d: boolean) =>
              d
                ? '<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">ใช้งานปกติ</span>'
                : '<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">ระงับใช้งาน</span>',
          },
          {
            data: null,
            orderable: false,
            searchable: false,
            className: 'text-center whitespace-nowrap',
            render: (u: UserItem) => {
              let html = `<button data-edit-u="${u.id}" class="btn-edit-u px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-semibold mr-1">แก้ไข</button>`;
              if (u.id !== curUserId) {
                html += `<button data-del-u="${u.id}" class="btn-del-u px-2.5 py-1 rounded-lg bg-red-100 hover:bg-red-200 text-red-800 text-xs font-semibold">ลบ</button>`;
              }
              return html;
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
  }, [users, curUserId]);

  useEffect(() => {
    const handler = (ev: MouseEvent) => {
      const target = ev.target as HTMLElement;
      const editBtn = target.closest('.btn-edit-u') as HTMLElement | null;
      if (editBtn) {
        const u = users.find((x) => x.id === Number(editBtn.dataset.editU)) || null;
        openUserModal(u);
        return;
      }
      const delBtn = target.closest('.btn-del-u') as HTMLElement | null;
      if (delBtn) {
        handleDelete(Number(delBtn.dataset.delU));
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  });

  async function openUserModal(u: UserItem | null = null) {
    const { value } = await Swal.fire({
      title: u ? 'แก้ไขข้อมูลผู้ใช้งาน' : 'เพิ่มผู้ใช้งานใหม่',
      width: 560,
      html: `
        <div class="text-left space-y-3 mt-2 text-sm">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block font-semibold text-slate-700 mb-1">ชื่อผู้ใช้ (Username) *</label>
              <input id="uUser" class="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm" value="${escHtml(u?.username || '')}" placeholder="เช่น somchai">
            </div>
            <div>
              <label class="block font-semibold text-slate-700 mb-1">รหัสผ่าน ${u ? '(เว้นว่างถ้าไม่เปลี่ยน)' : '*'}</label>
              <input id="uPass" type="password" class="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm" placeholder="อย่างน้อย 4 ตัวอักษร">
            </div>
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">ชื่อ-สกุล (พร้อมคำนำหน้า) *</label>
            <input id="uName" class="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm" value="${escHtml(u?.full_name || '')}" placeholder="เช่น นายเอกวิทย์ ลาดล้าย">
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">ตำแหน่ง</label>
            <input id="uPos" class="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm" value="${escHtml(u?.position || '')}" placeholder="เช่น นักวิชาการคอมพิวเตอร์ปฏิบัติการ">
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">ที่อยู่ (สำหรับใบสำคัญรับเงิน)</label>
            <input id="uAddr" class="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm" value="${escHtml(u?.address || '2 ถ.อธิบดี ตำบลหมากแข้ง อำเภอเมือง จังหวัดอุดรธานี')}">
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block font-semibold text-slate-700 mb-1">สิทธิ์การใช้งาน</label>
              <select id="uRole" class="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
                <option value="user" ${(u?.role || 'user') === 'user' ? 'selected' : ''}>ผู้ใช้งานทั่วไป (User)</option>
                <option value="admin" ${u?.role === 'admin' ? 'selected' : ''}>ผู้ดูแลระบบ (Admin)</option>
              </select>
            </div>
            <div>
              <label class="block font-semibold text-slate-700 mb-1">สถานะบัญชี</label>
              <select id="uActive" class="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
                <option value="1" ${(u?.is_active ?? true) ? 'selected' : ''}>ใช้งานปกติ</option>
                <option value="0" ${u && !u.is_active ? 'selected' : ''}>ระงับใช้งาน</option>
              </select>
            </div>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'บันทึก',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#1c3d70',
      preConfirm: () => {
        const username = (document.getElementById('uUser') as HTMLInputElement).value.trim();
        const password = (document.getElementById('uPass') as HTMLInputElement).value;
        const full_name = (document.getElementById('uName') as HTMLInputElement).value.trim();
        if (!username || !full_name) {
          Swal.showValidationMessage('กรุณากรอกชื่อผู้ใช้และชื่อ-สกุล');
          return false;
        }
        if (!u && password.length < 4) {
          Swal.showValidationMessage('กรุณากำหนดรหัสผ่านอย่างน้อย 4 ตัวอักษร');
          return false;
        }
        return {
          id: u?.id || 0,
          username,
          password,
          full_name,
          position: (document.getElementById('uPos') as HTMLInputElement).value.trim(),
          address: (document.getElementById('uAddr') as HTMLInputElement).value.trim(),
          role: (document.getElementById('uRole') as HTMLSelectElement).value,
          is_active: (document.getElementById('uActive') as HTMLSelectElement).value === '1',
        };
      },
    });
    if (!value) return;
    showLoading('กำลังบันทึกข้อมูลผู้ใช้งาน...');
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(value),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) return alertError(data.message);
    await alertSuccess(data.message);
    await reload();
  }

  async function handleDelete(id: number) {
    const c = await confirmDelete('ต้องการลบบัญชีผู้ใช้งานนี้ใช่หรือไม่?');
    if (!c.isConfirmed) return;
    showLoading('กำลังลบผู้ใช้งาน...');
    const res = await fetch(`/api/users?id=${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok || !data.ok) return alertError(data.message);
    await alertSuccess(data.message);
    await reload();
  }

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl p-4 shadow-card border border-slate-200/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="font-bold text-brand-900 text-base">รายชื่อผู้ใช้งานระบบ (เจ้าหน้าที่ / ผู้ดูแลระบบ)</h2>
          <p className="text-xs text-slate-500 mt-0.5">เพิ่ม ลบ แก้ไขบัญชีผู้ใช้งาน กำหนดตำแหน่ง ที่อยู่ และสิทธิ์การใช้งาน</p>
        </div>
        <button type="button" onClick={() => openUserModal(null)} className="shrink-0 px-4 py-2 rounded-xl bg-brand-700 hover:bg-brand-800 text-white text-sm font-semibold shadow-sm transition">
          + เพิ่มผู้ใช้งานใหม่
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-card border border-slate-200/80 p-4 overflow-x-auto">
        <table ref={tableRef} className="display responsive nowrap w-full text-sm">
          <thead>
            <tr>
              <th className="w-14">ID</th>
              <th>ชื่อผู้ใช้</th>
              <th>ชื่อ-สกุล</th>
              <th>ตำแหน่ง</th>
              <th>สิทธิ์</th>
              <th>สถานะ</th>
              <th className="text-center">จัดการ</th>
            </tr>
          </thead>
        </table>
      </div>
    </div>
  );
}
