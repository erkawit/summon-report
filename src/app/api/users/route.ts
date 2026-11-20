import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { ensureDb } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export async function GET() {
  const user = await getSessionUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });
  }
  const sql = await ensureDb();
  const rows = await sql`
    SELECT id, username, full_name, position, address, role, is_active, created_at
    FROM users ORDER BY id ASC
  `;
  return NextResponse.json({ ok: true, data: rows });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ ok: false, message: 'เฉพาะผู้ดูแลระบบเท่านั้น' }, { status: 403 });
  }
  const body = await req.json();
  const id = Number(body.id) || 0;
  const username = String(body.username || '').trim();
  const password = String(body.password || '');
  const fullName = String(body.full_name || '').trim();
  const position = String(body.position || '').trim();
  const address = String(body.address || '').trim();
  const role = body.role === 'admin' ? 'admin' : 'user';
  const isActive = body.is_active === false || body.is_active === '0' || body.is_active === 0 ? false : true;

  if (!username || !fullName) {
    return NextResponse.json({ ok: false, message: 'กรุณากรอกชื่อผู้ใช้และชื่อ-สกุล' }, { status: 422 });
  }

  const sql = await ensureDb();
  if (id > 0) {
    const dup = await sql`SELECT id FROM users WHERE username = ${username} AND id != ${id} LIMIT 1`;
    if (dup.length > 0) {
      return NextResponse.json({ ok: false, message: 'ชื่อผู้ใช้นี้มีอยู่ในระบบแล้ว' }, { status: 422 });
    }
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      await sql`
        UPDATE users SET username = ${username}, password_hash = ${hash}, full_name = ${fullName},
          position = ${position}, address = ${address}, role = ${role}, is_active = ${isActive}, updated_at = NOW()
        WHERE id = ${id}
      `;
    } else {
      await sql`
        UPDATE users SET username = ${username}, full_name = ${fullName},
          position = ${position}, address = ${address}, role = ${role}, is_active = ${isActive}, updated_at = NOW()
        WHERE id = ${id}
      `;
    }
    return NextResponse.json({ ok: true, message: 'แก้ไขข้อมูลผู้ใช้งานเรียบร้อยแล้ว' });
  } else {
    if (password.length < 4) {
      return NextResponse.json({ ok: false, message: 'กรุณากำหนดรหัสผ่านอย่างน้อย 4 ตัวอักษร' }, { status: 422 });
    }
    const dup = await sql`SELECT id FROM users WHERE username = ${username} LIMIT 1`;
    if (dup.length > 0) {
      return NextResponse.json({ ok: false, message: 'ชื่อผู้ใช้นี้มีอยู่ในระบบแล้ว' }, { status: 422 });
    }
    const hash = await bcrypt.hash(password, 10);
    await sql`
      INSERT INTO users (username, password_hash, full_name, position, address, role, is_active)
      VALUES (${username}, ${hash}, ${fullName}, ${position}, ${address}, ${role}, ${isActive})
    `;
    return NextResponse.json({ ok: true, message: 'เพิ่มผู้ใช้งานเรียบร้อยแล้ว' });
  }
}

export async function DELETE(req: Request) {
  const user = await getSessionUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ ok: false, message: 'เฉพาะผู้ดูแลระบบเท่านั้น' }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get('id')) || 0;
  if (id === user.id) {
    return NextResponse.json({ ok: false, message: 'ไม่สามารถลบบัญชีที่กำลังใช้งานอยู่ได้' }, { status: 422 });
  }
  const sql = await ensureDb();
  await sql`DELETE FROM users WHERE id = ${id}`;
  return NextResponse.json({ ok: true, message: 'ลบผู้ใช้งานเรียบร้อยแล้ว' });
}
