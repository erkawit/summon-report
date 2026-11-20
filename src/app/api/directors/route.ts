import { NextResponse } from 'next/server';
import { ensureDb, getDirectorSigners, setSetting } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
  const data = await getDirectorSigners();
  return NextResponse.json({ ok: true, data });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ ok: false, message: 'เฉพาะผู้ดูแลระบบเท่านั้น' }, { status: 403 });
  }
  const body = await req.json();
  const id = Number(body.id) || 0;
  const fullName = String(body.full_name || '').trim();
  const isActing = Boolean(body.is_acting);
  const isDefault = Boolean(body.is_default);

  if (!fullName) {
    return NextResponse.json({ ok: false, message: 'กรุณากรอกชื่อ-สกุลผู้ลงนาม' }, { status: 422 });
  }

  const sql = await ensureDb();
  if (isDefault) {
    await sql`UPDATE director_signers SET is_default = FALSE`;
  }

  if (id > 0) {
    await sql`
      UPDATE director_signers
      SET full_name = ${fullName}, is_acting = ${isActing}, is_default = ${isDefault}
      WHERE id = ${id}
    `;
  } else {
    await sql`
      INSERT INTO director_signers (full_name, is_acting, is_default)
      VALUES (${fullName}, ${isActing}, ${isDefault})
    `;
  }

  if (isDefault) {
    await Promise.all([
      setSetting('director_name', fullName),
      setSetting('director_acting', isActing ? 'รักษาราชการแทน' : ''),
    ]);
  }

  return NextResponse.json({
    ok: true,
    message: id > 0 ? 'แก้ไขรายชื่อผู้ลงนามเรียบร้อยแล้ว' : 'เพิ่มรายชื่อผู้ลงนามเรียบร้อยแล้ว',
  });
}

export async function DELETE(req: Request) {
  const user = await getSessionUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ ok: false, message: 'เฉพาะผู้ดูแลระบบเท่านั้น' }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get('id')) || 0;
  const sql = await ensureDb();
  const [{ cnt }] = await sql`SELECT COUNT(*)::int AS cnt FROM director_signers`;
  if (cnt <= 1) {
    return NextResponse.json({ ok: false, message: 'ต้องมีรายชื่อผู้ลงนามอย่างน้อย 1 รายการ' }, { status: 422 });
  }
  await sql`DELETE FROM director_signers WHERE id = ${id}`;
  return NextResponse.json({ ok: true, message: 'ลบรายชื่อผู้ลงนามเรียบร้อยแล้ว' });
}
