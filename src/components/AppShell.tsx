'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import type { SessionUser } from '@/lib/auth';

const navItems = [
  { href: '/dashboard', label: 'ภาพรวมระบบ', match: (p: string) => p === '/dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { href: '/rates', label: 'อัตราค่านำหมาย', match: (p: string) => p === '/rates', icon: 'M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
  { href: '/reports', label: 'รายงานผล / บันทึกข้อความ', match: (p: string) => p === '/reports', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { href: '/reports/form?type=free', label: '+ เบิกหมายฟรี (ใบสำคัญฯ)', match: (p: string, q: string | null) => p === '/reports/form' && q === 'free', icon: 'M12 4v16m8-8H4' },
  { href: '/reports/form?type=paid', label: '+ เบิกหมายเงิน', match: (p: string, q: string | null) => p === '/reports/form' && q === 'paid', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m9-5a9 9 0 11-18 0 9 9 0 0118 0z' },
];

const adminItems = [
  { href: '/orders', label: 'คำสั่งศาล & ผู้ลงนาม', match: (p: string) => p === '/orders', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
  { href: '/users', label: 'จัดการผู้ใช้งาน', match: (p: string) => p === '/users', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
];

function pageTitle(pathname: string, typeParam: string | null): string {
  if (pathname === '/dashboard') return 'ภาพรวมระบบ';
  if (pathname === '/rates') return 'อัตราค่านำหมาย (หมายเงิน และ หมายฟรี)';
  if (pathname === '/reports') return 'รายการแบบรายงานผลและบันทึกข้อความ';
  if (pathname === '/reports/form') return typeParam === 'paid' ? 'แบบรายงานเบิกหมายเงิน (บันทึกข้อความ)' : 'แบบรายงานเบิกหมายฟรี (บันทึกข้อความ + ใบสำคัญรับเงิน)';
  if (pathname === '/orders') return 'จัดการคำสั่งศาล & ผู้ลงนามเริ่มต้น';
  if (pathname === '/users') return 'จัดการผู้ใช้งานระบบ';
  return 'ระบบอัตราค่านำหมาย ศาลจังหวัดอุดรธานี';
}

export default function AppShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const typeParam = searchParams.get('type');

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="flex min-h-screen">
      {open && <div className="fixed inset-0 z-30 bg-slate-900/50 lg:hidden" onClick={() => setOpen(false)} />}

      <aside className={`fixed inset-y-0 left-0 z-40 w-64 transform bg-brand-900 text-slate-100 transition-transform duration-200 lg:static lg:translate-x-0 flex flex-col shrink-0 shadow-xl ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="px-5 py-5 border-b border-brand-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gold-500/20 border border-gold-400/40 flex items-center justify-center shrink-0">
            <svg className="w-6 h-6 text-gold-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold tracking-wide text-white leading-tight">ศาลจังหวัดอุดรธานี</div>
            <div className="text-xs text-brand-200 truncate">ระบบอัตราค่านำหมาย &amp; รายงานผล</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-brand-300">เมนูหลัก</div>
          {navItems.map((item) => {
            const active = item.match(pathname, typeParam);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
                  active ? 'bg-brand-700 text-white font-semibold shadow-sm border-l-4 border-gold-400' : 'text-brand-100 hover:bg-brand-800 hover:text-white'
                }`}
              >
                <svg className="w-5 h-5 shrink-0 opacity-85" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={item.icon} />
                </svg>
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}

          {user.role === 'admin' && (
            <>
              <div className="pt-4 px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-brand-300">ผู้ดูแลระบบ (Admin)</div>
              {adminItems.map((item) => {
                const active = item.match(pathname);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
                      active ? 'bg-brand-700 text-white font-semibold shadow-sm border-l-4 border-gold-400' : 'text-brand-100 hover:bg-brand-800 hover:text-white'
                    }`}
                  >
                    <svg className="w-5 h-5 shrink-0 opacity-85" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={item.icon} />
                    </svg>
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </>
          )}
        </nav>

        <div className="p-4 border-t border-brand-800 bg-brand-900/60">
          <div className="text-sm font-semibold text-white truncate">{user.full_name}</div>
          <div className="text-xs text-brand-200 truncate">{user.position || (user.role === 'admin' ? 'ผู้ดูแลระบบ' : 'เจ้าหน้าที่')}</div>
          <div className="mt-2.5 flex items-center justify-between gap-2">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${user.role === 'admin' ? 'bg-gold-500/20 text-gold-400 border border-gold-400/30' : 'bg-brand-700 text-brand-100'}`}>
              {user.role === 'admin' ? 'ผู้ดูแลระบบ' : 'ผู้ใช้งาน'}
            </span>
            <button type="button" onClick={handleLogout} className="text-xs text-red-300 hover:text-red-200 font-medium">
              ออกจากระบบ &rarr;
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-200 px-4 lg:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button type="button" onClick={() => setOpen(true)} className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="text-lg sm:text-xl font-bold text-brand-900 truncate">{pageTitle(pathname, typeParam)}</h1>
          </div>
          <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-50 text-brand-800 border border-brand-100 text-xs font-medium shrink-0">
            สำนักอำนวยการประจำศาลจังหวัดอุดรธานี
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 max-w-[1600px] w-full mx-auto">{children}</main>

        <footer className="border-t border-slate-200 bg-white px-6 py-3 text-xs text-slate-500 flex flex-wrap justify-between gap-2">
          <span>ระบบอัตราค่านำหมายและแบบรายงานผลการส่งคำคู่ความ — ศาลจังหวัดอุดรธานี</span>
          <span>Next.js + TailwindCSS + Neon PostgreSQL</span>
        </footer>
      </div>
    </div>
  );
}
