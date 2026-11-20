import type { Metadata } from 'next';
import { Sarabun } from 'next/font/google';
import './globals.css';

const sarabun = Sarabun({
  subsets: ['thai', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-sarabun',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ระบบอัตราค่านำหมายและแบบรายงานผล | ศาลจังหวัดอุดรธานี',
  description: 'ระบบจัดการอัตราค่านำหมายและจัดทำบันทึกข้อความ/ใบสำคัญรับเงิน ศาลจังหวัดอุดรธานี',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={sarabun.variable}>
      <body className="font-sans min-h-screen bg-slate-50 text-slate-800">{children}</body>
    </html>
  );
}
