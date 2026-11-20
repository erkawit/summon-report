import { NextResponse } from 'next/server';
import { setSetting } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ ok: false, message: 'เฉพาะผู้ดูแลระบบเท่านั้น' }, { status: 403 });
  }
  const body = await req.json();
  for (const k of ['director_name', 'director_acting', 'officer_name', 'officer_position', 'payer_name', 'payer_position']) {
    if (body[k] !== undefined) {
      await setSetting(k, String(body[k]).trim());
    }
  }
  return NextResponse.json({ ok: true, message: 'บันทึกข้อมูลผู้ลงนามเริ่มต้นเรียบร้อยแล้ว' });
}
