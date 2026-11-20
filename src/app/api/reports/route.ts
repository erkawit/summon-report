import { NextResponse } from 'next/server';
import { ensureDb, getLatestOrder } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { bahtText, cleanDistrict, cleanSubdistrict, evaluateFreeSummonItems, type FreeSummonItemInput } from '@/lib/thai';

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type');
  const sql = await ensureDb();

  const rows = type === 'free' || type === 'paid'
    ? await sql`SELECT *, total_amount::float AS total_amount FROM reports WHERE report_type = ${type} ORDER BY id DESC`
    : await sql`SELECT *, total_amount::float AS total_amount FROM reports ORDER BY id DESC`;

  return NextResponse.json({ ok: true, data: rows });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });

  try {
    const p = await req.json();
    const id = Number(p.id) || 0;
    const reportType: 'free' | 'paid' = p.report_type === 'paid' ? 'paid' : 'free';
    const roundLabel = String(p.round_label || '').trim();
    const docNo = String(p.doc_no || '').trim();
    const docDate = String(p.doc_date || '').trim();
    const periodStart = String(p.period_start || '').trim();
    const periodEnd = String(p.period_end || '').trim();
    const reporterName = String(p.reporter_name || '').trim();
    const reporterPosition = String(p.reporter_position || '').trim();
    const reporterAddress = String(p.reporter_address || '').trim();
    const officerName = String(p.officer_name || '').trim();
    const officerPosition = String(p.officer_position || '').trim();
    const directorName = String(p.director_name || '').trim();
    const directorActing = String(p.director_acting || '').trim();
    const payerName = String(p.payer_name || '').trim();
    const payerPosition = String(p.payer_position || '').trim();
    const receiptDate = String(p.receipt_date || '').trim();
    const note = String(p.note || '').trim();
    const rawItems: FreeSummonItemInput[] = Array.isArray(p.items) ? p.items : [];

    if (!reporterName) {
      return NextResponse.json({ ok: false, message: 'กรุณาระบุชื่อผู้รายงาน / ผู้รับเงิน' }, { status: 422 });
    }

    let itemCount = 0;
    let totalAmount = 0;
    let amountText = '';
    let evaluatedItems = evaluateFreeSummonItems([]).items;

    if (reportType === 'free') {
      if (rawItems.length === 0) {
        return NextResponse.json({ ok: false, message: 'กรุณาเพิ่มรายการส่งหมายอย่างน้อย 1 รายการ' }, { status: 422 });
      }
      const evalRes = evaluateFreeSummonItems(rawItems);
      if (evalRes.has_duplicates) {
        return NextResponse.json({
          ok: false,
          message: 'พบรายการที่อยู่ซ้ำ (บ้านเลขที่ หมู่ ตำบล อำเภอ เดียวกัน) เบิกได้เพียงหมายเดียว ไม่สามารถบันทึกได้ กรุณาตรวจสอบแถวที่ขึ้นสีแดง',
          duplicate_indices: evalRes.duplicate_indices,
        }, { status: 422 });
      }
      evaluatedItems = evalRes.items;
      itemCount = evaluatedItems.length;
      totalAmount = evalRes.total_amount;
      amountText = bahtText(totalAmount);
    } else {
      itemCount = Math.max(0, Number(p.item_count) || 0);
      totalAmount = Math.round((Number(p.total_amount) || 0) * 100) / 100;
      amountText = String(p.amount_text || '').trim() || bahtText(totalAmount);
      if (!periodStart || !periodEnd) {
        return NextResponse.json({ ok: false, message: 'กรุณาระบุช่วงรอบระหว่างวันที่เริ่มต้นและวันที่สิ้นสุด' }, { status: 422 });
      }
      if (itemCount <= 0 || totalAmount <= 0) {
        return NextResponse.json({ ok: false, message: 'กรุณาระบุจำนวนเรื่องและจำนวนเงินให้มากกว่า 0' }, { status: 422 });
      }
    }

    const sql = await ensureDb();
    let reportId = id;

    if (id > 0) {
      // Existing report: ALWAYS preserve original order_id & order_text snapshot!
      const oldRows = await sql`SELECT id, created_by FROM reports WHERE id = ${id} LIMIT 1`;
      if (oldRows.length === 0) {
        return NextResponse.json({ ok: false, message: 'ไม่พบรายงานที่ต้องการแก้ไข' }, { status: 404 });
      }
      if (user.role !== 'admin' && Number(oldRows[0].created_by) !== user.id) {
        return NextResponse.json({ ok: false, message: 'คุณไม่มีสิทธิ์แก้ไขรายงานของผู้อื่น' }, { status: 403 });
      }

      await sql`
        UPDATE reports SET
          round_label = ${roundLabel}, doc_no = ${docNo}, doc_date = ${docDate},
          period_start = ${periodStart}, period_end = ${periodEnd},
          item_count = ${itemCount}, total_amount = ${totalAmount}, amount_text = ${amountText},
          reporter_name = ${reporterName}, reporter_position = ${reporterPosition}, reporter_address = ${reporterAddress},
          officer_name = ${officerName}, officer_position = ${officerPosition},
          director_name = ${directorName}, director_acting = ${directorActing},
          payer_name = ${payerName}, payer_position = ${payerPosition},
          receipt_date = ${receiptDate}, note = ${note}, updated_at = NOW()
        WHERE id = ${id}
      `;
    } else {
      // New report: pull LATEST active court order!
      const latestOrder = await getLatestOrder();
      const orderId = latestOrder?.id ?? null;
      const orderText = latestOrder?.order_text || 'คำสั่งศาลจังหวัดอุดรธานี ที่ 28/2569 ลงวันที่  23 มีนาคม 2569';

      const [ins] = await sql`
        INSERT INTO reports (
          report_type, round_label, doc_no, doc_date, order_id, order_text,
          period_start, period_end, item_count, total_amount, amount_text,
          reporter_user_id, reporter_name, reporter_position, reporter_address,
          officer_name, officer_position, director_name, director_acting,
          payer_name, payer_position, receipt_date, note, created_by
        ) VALUES (
          ${reportType}, ${roundLabel}, ${docNo}, ${docDate}, ${orderId}, ${orderText},
          ${periodStart}, ${periodEnd}, ${itemCount}, ${totalAmount}, ${amountText},
          ${user.id}, ${reporterName}, ${reporterPosition}, ${reporterAddress},
          ${officerName}, ${officerPosition}, ${directorName}, ${directorActing},
          ${payerName}, ${payerPosition}, ${receiptDate}, ${note}, ${user.id}
        ) RETURNING id
      `;
      reportId = Number(ins.id);
    }

    if (reportType === 'free') {
      await sql`DELETE FROM report_items WHERE report_id = ${reportId}`;
      for (let i = 0; i < evaluatedItems.length; i++) {
        const it = evaluatedItems[i];
        await sql`
          INSERT INTO report_items (
            report_id, seq, case_prefix, case_no, issue_date, serve_date,
            summon_type, recipient_role, house_no, moo, subdistrict, district, province,
            base_rate, claim_rate, calc_rule
          ) VALUES (
            ${reportId}, ${i + 1},
            ${String(it.case_prefix || 'คดีดำ').trim() || 'คดีดำ'},
            ${String(it.case_no || '').trim()},
            ${String(it.issue_date || '').trim()},
            ${String(it.serve_date || '').trim()},
            ${String(it.summon_type || '').trim()},
            ${String(it.recipient_role || '').trim()},
            ${String(it.house_no || '').trim()},
            ${String(it.moo || '').trim()},
            ${cleanSubdistrict(String(it.subdistrict || ''))},
            ${cleanDistrict(String(it.district || ''))},
            ${String(it.province || 'จ.อุดรธานี').trim() || 'จ.อุดรธานี'},
            ${it.base_rate}, ${it.claim_rate}, ${it.calc_rule}
          )
        `;
      }
    }

    return NextResponse.json({ ok: true, message: 'บันทึกรายงานเรียบร้อยแล้ว', id: reportId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการบันทึก';
    return NextResponse.json({ ok: false, message: msg }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get('id')) || 0;
  const sql = await ensureDb();
  const rows = await sql`SELECT created_by FROM reports WHERE id = ${id} LIMIT 1`;
  if (rows.length === 0) {
    return NextResponse.json({ ok: false, message: 'ไม่พบรายงาน' }, { status: 404 });
  }
  if (user.role !== 'admin' && Number(rows[0].created_by) !== user.id) {
    return NextResponse.json({ ok: false, message: 'คุณไม่มีสิทธิ์ลบรายงานนี้' }, { status: 403 });
  }
  await sql`DELETE FROM reports WHERE id = ${id}`;
  return NextResponse.json({ ok: true, message: 'ลบรายงานเรียบร้อยแล้ว' });
}
