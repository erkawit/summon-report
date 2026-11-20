import { NextResponse } from 'next/server';
import { setSetting } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ ok: false, message: 'เฉพาะผู้ดูแลระบบเท่านั้น' }, { status: 403 });
  }
  const body = await req.json();
  const allowed = ['paid_header', 'paid_notes', 'free_header_1', 'free_header_2', 'free_header_3', 'free_notes'];
  for (const k of allowed) {
    if (body[k] !== undefined) {
      await setSetting(k, String(body[k]).trim());
    }
  }
  return NextResponse.json({ ok: true, message: 'บันทึกข้อความหัวตารางและหมายเหตุเรียบร้อยแล้ว' });
}
