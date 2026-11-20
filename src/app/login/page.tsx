'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { alertError, showLoading, Swal } from '@/lib/swal';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    showLoading('กำลังตรวจสอบข้อมูลเข้าสู่ระบบ...');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        await alertError(data.message || 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง', 'เข้าสู่ระบบไม่สำเร็จ');
        return;
      }
      await Swal.fire({
        icon: 'success',
        title: 'เข้าสู่ระบบสำเร็จ',
        text: `ยินดีต้อนรับ ${data.user?.full_name || username}`,
        timer: 1300,
        showConfirmButton: false,
      });
      router.push('/dashboard');
      router.refresh();
    } catch {
      await alertError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-900 via-brand-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-white/10">
        <div className="bg-brand-900 px-6 py-7 text-center border-b-4 border-gold-500">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-gold-500/20 border border-gold-400/50 flex items-center justify-center mb-3">
            <svg className="w-8 h-8 text-gold-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white">ศาลจังหวัดอุดรธานี</h1>
          <p className="text-sm text-brand-200 mt-1">ระบบอัตราค่านำหมายและแบบรายงานผลการส่งคำคู่ความ</p>
        </div>

        <form onSubmit={onSubmit} className="p-6 sm:p-8 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">ชื่อผู้ใช้งาน (Username)</label>
            <input
              type="text"
              required
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-xl border-slate-300 focus:border-brand-600 focus:ring-brand-600 text-sm py-2.5 px-3.5"
              placeholder="กรอกชื่อผู้ใช้งาน"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">รหัสผ่าน (Password)</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border-slate-300 focus:border-brand-600 focus:ring-brand-600 text-sm py-2.5 px-3.5"
              placeholder="กรอกรหัสผ่าน"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl bg-brand-700 hover:bg-brand-800 disabled:opacity-60 text-white font-semibold text-sm shadow-md transition"
          >
            {loading ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบ'}
          </button>

          <div className="pt-3 border-t border-slate-100 text-xs text-slate-500 space-y-1">
            <div className="font-semibold text-slate-600">บัญชีเริ่มต้นสำหรับทดสอบ:</div>
            <div>ผู้ดูแลระบบ (Admin): <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">admin</code> / <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">admin1234</code></div>
            <div>ผู้ใช้งานทั่วไป (User): <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">staff</code> / <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">staff1234</code></div>
          </div>
        </form>
      </div>
    </div>
  );
}
