import { NextResponse } from 'next/server';
import { ensureDb } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { buildRatesExcel, buildRatesPdf } from '@/lib/exporters/rates';
import { buildMemoDocx, buildMemoPdf, type MemoReportData } from '@/lib/exporters/memo';
import { buildReceiptExcel, buildReceiptPdf, type ReceiptItemData, type ReceiptReportData } from '@/lib/exporters/receipt';

function fileResponse(buf: Buffer, filename: string, mime: string, inline: boolean) {
  const disp = inline ? 'inline' : 'attachment';
  const encoded = encodeURIComponent(filename);
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type': mime,
      'Content-Disposition': `${disp}; filename="${encoded}"; filename*=UTF-8''${encoded}`,
      'Cache-Control': 'no-store',
    },
  });
}

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') || '';
  const inline = searchParams.get('inline') === '1';

  try {
    if (action === 'rates_xlsx' || action === 'rates_pdf') {
      const scopeRaw = searchParams.get('scope') || 'all';
      const scope = scopeRaw === 'paid' || scopeRaw === 'free' ? scopeRaw : 'all';
      const label = scope === 'paid' ? 'อัตราหมายเงิน' : scope === 'free' ? 'อัตราหมายฟรี' : 'อัตราหมายเงินและหมายฟรี';
      if (action === 'rates_xlsx') {
        const buf = await buildRatesExcel(scope);
        return fileResponse(buf, `${label}_ศาลจังหวัดอุดรธานี.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', false);
      } else {
        const buf = await buildRatesPdf(scope);
        return fileResponse(buf, `${label}_ศาลจังหวัดอุดรธานี.pdf`, 'application/pdf', inline);
      }
    }

    const id = Number(searchParams.get('id')) || 0;
    const sql = await ensureDb();
    const rows = await sql`SELECT *, total_amount::float AS total_amount FROM reports WHERE id = ${id} LIMIT 1`;
    if (rows.length === 0) {
      return NextResponse.json({ ok: false, message: 'ไม่พบรายงาน' }, { status: 404 });
    }
    const r = rows[0];
    const round = String(r.round_label || '').trim().replace(/[\\/:*?"<>|]/g, '-');

    if (action === 'memo_docx' || action === 'memo_pdf') {
      const memoData: MemoReportData = {
        id: Number(r.id),
        report_type: r.report_type === 'paid' ? 'paid' : 'free',
        doc_no: String(r.doc_no || ''),
        doc_date: String(r.doc_date || ''),
        order_text: String(r.order_text || ''),
        period_start: String(r.period_start || ''),
        period_end: String(r.period_end || ''),
        item_count: Number(r.item_count || 0),
        total_amount: Number(r.total_amount || 0),
        amount_text: String(r.amount_text || ''),
        reporter_name: String(r.reporter_name || ''),
        reporter_position: String(r.reporter_position || ''),
        officer_name: String(r.officer_name || ''),
        officer_position: String(r.officer_position || ''),
        director_name: String(r.director_name || ''),
        director_acting: String(r.director_acting || ''),
      };
      const typeLabel = memoData.report_type === 'paid' ? 'หมายมีเงิน' : 'หมายฟรี';
      const base = `บันทึกข้อความ-${typeLabel}${round ? '-' + round : '-' + id}`;
      if (action === 'memo_docx') {
        const buf = await buildMemoDocx(memoData);
        return fileResponse(buf, `${base}.docx`, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', false);
      } else {
        const buf = await buildMemoPdf(memoData);
        return fileResponse(buf, `${base}.pdf`, 'application/pdf', inline);
      }
    }

    if (action === 'receipt_xlsx' || action === 'receipt_pdf') {
      if (r.report_type !== 'free') {
        return NextResponse.json({ ok: false, message: 'ไม่ใช่รายงานหมายฟรี' }, { status: 400 });
      }
      const itemRows = await sql`
        SELECT *, base_rate::float AS base_rate, claim_rate::float AS claim_rate
        FROM report_items WHERE report_id = ${id} ORDER BY seq ASC, id ASC
      `;
      const recData: ReceiptReportData = {
        id: Number(r.id),
        receipt_date: String(r.receipt_date || ''),
        reporter_name: String(r.reporter_name || ''),
        reporter_position: String(r.reporter_position || ''),
        reporter_address: String(r.reporter_address || ''),
        payer_name: String(r.payer_name || ''),
        payer_position: String(r.payer_position || ''),
      };
      const items: ReceiptItemData[] = itemRows.map((it) => ({
        seq: Number(it.seq),
        case_prefix: String(it.case_prefix || 'คดีดำ'),
        case_no: String(it.case_no || ''),
        issue_date: String(it.issue_date || ''),
        serve_date: String(it.serve_date || ''),
        summon_type: String(it.summon_type || ''),
        recipient_role: String(it.recipient_role || ''),
        house_no: String(it.house_no || ''),
        moo: String(it.moo || ''),
        subdistrict: String(it.subdistrict || ''),
        district: String(it.district || ''),
        province: String(it.province || 'จ.อุดรธานี'),
        base_rate: Number(it.base_rate || 0),
        claim_rate: Number(it.claim_rate || 0),
      }));
      const base = `ใบสำคัญรับเงินฟรี${round ? '-' + round : '-' + id}`;
      if (action === 'receipt_xlsx') {
        const buf = await buildReceiptExcel(recData, items);
        return fileResponse(buf, `${base}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', false);
      } else {
        const buf = await buildReceiptPdf(recData, items);
        return fileResponse(buf, `${base}.pdf`, 'application/pdf', inline);
      }
    }

    return NextResponse.json({ ok: false, message: 'Invalid export action' }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Export error';
    return NextResponse.json({ ok: false, message: msg }, { status: 500 });
  }
}
