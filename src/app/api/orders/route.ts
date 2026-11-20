import { NextResponse } from 'next/server';
import { ensureDb } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ ok: false, message: 'เฉพาะผู้ดูแลระบบเท่านั้น' }, { status: 403 });
  }
  const body = await req.json();
  const orderText = String(body.order_text || '').trim();
  const orderNo = String(body.order_no || '').trim();
  const orderDate = String(body.order_date || '').trim();
  const note = String(body.note || '').trim();

  if (!orderText) {
    return NextResponse.json({ ok: false, message: 'กรุณากรอกข้อความคำสั่งศาล' }, { status: 422 });
  }

  const sql = await ensureDb();
  await sql`
    INSERT INTO court_orders (order_text, order_no, order_date, note, is_active, created_by)
    VALUES (${orderText}, ${orderNo}, ${orderDate}, ${note}, TRUE, ${user.id})
  `;
  return NextResponse.json({
    ok: true,
    message: 'เพิ่มคำสั่งศาลฉบับใหม่เรียบร้อยแล้ว (รายงานใหม่จะดึงคำสั่งนี้ไปใช้ทันที รายงานเดิมคงใช้คำสั่งเดิม)',
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
  const [{ cnt }] = await sql`SELECT COUNT(*)::int AS cnt FROM court_orders`;
  if (cnt <= 1) {
    return NextResponse.json({ ok: false, message: 'ต้องมีคำสั่งศาลในระบบอย่างน้อย 1 รายการ' }, { status: 422 });
  }
  await sql`DELETE FROM court_orders WHERE id = ${id}`;
  return NextResponse.json({ ok: true, message: 'ลบคำสั่งศาลเรียบร้อยแล้ว' });
}
