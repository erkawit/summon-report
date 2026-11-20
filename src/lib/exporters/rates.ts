import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import path from 'path';
import { ensureDb, getSettingsMap } from '../db';
import { formatMoney } from '../thai';

interface RateRow {
  district: string;
  subdistrict: string;
  exception_note: string;
  rate_amount: number;
}

type BlockCell =
  | { kind: 'header'; district: string }
  | { kind: 'item'; seq: string; label: string; rate: number };

function buildFourBlocks(rates: RateRow[]): BlockCell[][] {
  const byDist = new Map<string, RateRow[]>();
  for (const r of rates) {
    const arr = byDist.get(r.district) || [];
    arr.push(r);
    byDist.set(r.district, arr);
  }

  const groups: { district: string; rows: RateRow[]; weight: number }[] = [];
  let totalRows = 0;
  byDist.forEach((rows, district) => {
    const weight = 1 + rows.length;
    groups.push({ district, rows, weight });
    totalRows += weight;
  });

  const target = Math.ceil(totalRows / 4);
  const blocks: BlockCell[][] = [[], [], [], []];
  let curB = 0;
  let curH = 0;

  for (const g of groups) {
    if (curB < 3 && curH > 0 && curH + g.weight > target + 4) {
      curB++;
      curH = 0;
    }
    blocks[curB].push({ kind: 'header', district: g.district });
    let seq = 1;
    for (const row of g.rows) {
      const isExc = row.exception_note.trim() !== '';
      blocks[curB].push({
        kind: 'item',
        seq: isExc ? '' : String(seq++),
        label: isExc ? row.exception_note : `ตำบล${row.subdistrict}`,
        rate: Number(row.rate_amount),
      });
    }
    curH += g.weight;
  }
  return blocks;
}

export async function buildRatesExcel(scope: 'all' | 'paid' | 'free' = 'all'): Promise<Buffer> {
  const sql = await ensureDb();
  const settings = await getSettingsMap();
  const wb = new ExcelJS.Workbook();
  const types: ('paid' | 'free')[] = scope === 'paid' ? ['paid'] : scope === 'free' ? ['free'] : ['paid', 'free'];

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' },
  };

  for (const type of types) {
    const ws = wb.addWorksheet(type === 'paid' ? 'อัตราหมายเงิน' : 'อัตราหมายฟรี', {
      pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 1 },
    });

    const rowsRaw = await sql`
      SELECT district, subdistrict, exception_note, rate_amount::float AS rate_amount
      FROM summon_rates WHERE rate_type = ${type} ORDER BY sort_order ASC, id ASC
    `;
    const rates: RateRow[] = rowsRaw.map((r) => ({
      district: String(r.district),
      subdistrict: String(r.subdistrict),
      exception_note: String(r.exception_note || ''),
      rate_amount: Number(r.rate_amount),
    }));

    const widths = [4.5, 16, 9, 4.5, 16, 9, 4.5, 16, 9, 4.5, 16, 9];
    widths.forEach((w, idx) => { ws.getColumn(idx + 1).width = w; });

    let rowNum = 1;
    if (type === 'paid') {
      ws.mergeCells('A1:L1');
      const c = ws.getCell('A1');
      c.value = settings.paid_header || 'อัตราค่านำส่งคำคู่ความและเอกสารทางคดีของศาลจังหวัดอุดรธานี';
      c.font = { name: 'TH SarabunPSK', size: 16, bold: true };
      c.alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getRow(1).height = 24;
      rowNum = 2;
    } else {
      for (const k of ['free_header_1', 'free_header_2', 'free_header_3']) {
        const txt = (settings[k] || '').trim();
        if (!txt) continue;
        ws.mergeCells(`A${rowNum}:L${rowNum}`);
        const c = ws.getCell(`A${rowNum}`);
        c.value = txt;
        c.font = { name: 'TH SarabunPSK', size: 16, bold: true };
        c.alignment = { horizontal: 'center', vertical: 'middle' };
        ws.getRow(rowNum).height = 22;
        rowNum++;
      }
    }

    const blocks = buildFourBlocks(rates);
    const maxRows = Math.max(...blocks.map((b) => b.length), 0);
    const startRow = rowNum;
    const colSets = [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10, 11, 12]];

    for (let r = 0; r < maxRows; r++) {
      const excelRow = startRow + r;
      ws.getRow(excelRow).height = 19;
      for (let b = 0; b < 4; b++) {
        const [c1, c2, c3] = colSets[b];
        const cell = blocks[b][r];
        const cell1 = ws.getCell(excelRow, c1);
        const cell2 = ws.getCell(excelRow, c2);
        const cell3 = ws.getCell(excelRow, c3);
        cell1.border = thinBorder;
        cell2.border = thinBorder;
        cell3.border = thinBorder;

        if (!cell) continue;
        if (cell.kind === 'header') {
          ws.mergeCells(excelRow, c1, excelRow, c2);
          cell1.value = `อำเภอ${cell.district}`;
          cell3.value = 'ค่าหมาย';
          [cell1, cell3].forEach((cc) => {
            cc.font = { name: 'TH SarabunPSK', size: 14, bold: true };
            cc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF7' } };
            cc.alignment = { horizontal: 'center', vertical: 'middle' };
          });
        } else {
          cell1.value = cell.seq;
          cell2.value = cell.label;
          cell3.value = cell.rate;
          cell1.font = { name: 'TH SarabunPSK', size: 14, bold: true };
          cell2.font = { name: 'TH SarabunPSK', size: 14, bold: true };
          cell3.font = { name: 'TH SarabunPSK', size: 14, bold: true };
          cell1.alignment = { horizontal: 'center', vertical: 'middle' };
          cell2.alignment = { horizontal: 'left', vertical: 'middle' };
          cell3.alignment = { horizontal: 'right', vertical: 'middle' };
          cell3.numFmt = '#,##0';
        }
      }
    }

    let noteRow = startRow + maxRows + 1;
    const notes = (settings[`${type}_notes`] || '').trim();
    if (notes) {
      for (const line of notes.split(/\r?\n/)) {
        ws.mergeCells(`A${noteRow}:L${noteRow}`);
        const nc = ws.getCell(`A${noteRow}`);
        nc.value = line;
        nc.font = { name: 'TH SarabunPSK', size: 14, bold: true };
        noteRow++;
      }
    }
  }

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}

export async function buildRatesPdf(scope: 'all' | 'paid' | 'free' = 'all'): Promise<Buffer> {
  const sql = await ensureDb();
  const settings = await getSettingsMap();
  const types: ('paid' | 'free')[] = scope === 'paid' ? ['paid'] : scope === 'free' ? ['free'] : ['paid', 'free'];

  const fontDir = path.join(process.cwd(), 'templates', 'fonts');
  const doc = new PDFDocument({ size: 'A4', margin: 20, autoFirstPage: false });
  doc.registerFont('Sarabun', path.join(fontDir, 'THSarabun.ttf'));
  doc.registerFont('SarabunBold', path.join(fontDir, 'THSarabun-Bold.ttf'));

  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  for (const type of types) {
    doc.addPage({ size: 'A4', margin: 20 });
    const rowsRaw = await sql`
      SELECT district, subdistrict, exception_note, rate_amount::float AS rate_amount
      FROM summon_rates WHERE rate_type = ${type} ORDER BY sort_order ASC, id ASC
    `;
    const rates: RateRow[] = rowsRaw.map((r) => ({
      district: String(r.district),
      subdistrict: String(r.subdistrict),
      exception_note: String(r.exception_note || ''),
      rate_amount: Number(r.rate_amount),
    }));

    let y = 20;
    doc.font('SarabunBold').fontSize(13).fillColor('#111');
    if (type === 'paid') {
      const h = settings.paid_header || 'อัตราค่านำส่งคำคู่ความและเอกสารทางคดีของศาลจังหวัดอุดรธานี';
      doc.text(h, 20, y, { width: 555, align: 'center' });
      y += 18;
    } else {
      for (const k of ['free_header_1', 'free_header_2', 'free_header_3']) {
        const txt = (settings[k] || '').trim();
        if (txt) {
          doc.text(txt, 20, y, { width: 555, align: 'center' });
          y += 15;
        }
      }
    }

    y += 3;
    const blocks = buildFourBlocks(rates);
    const maxRows = Math.max(...blocks.map((b) => b.length), 0);
    const totalW = 555;
    const blockW = totalW / 4;
    const wSeq = 18;
    const wAmt = 34;
    const wSub = blockW - wSeq - wAmt;
    const rowH = Math.min(13.5, Math.max(10.5, (725 - y) / Math.max(maxRows, 1)));

    doc.lineWidth(0.4).strokeColor('#444');

    for (let r = 0; r < maxRows; r++) {
      const rowY = y + r * rowH;
      for (let b = 0; b < 4; b++) {
        const bx = 20 + b * blockW;
        const cell = blocks[b][r];

        if (cell?.kind === 'header') {
          doc.rect(bx, rowY, wSeq + wSub, rowH).fillAndStroke('#e8eef7', '#444');
          doc.rect(bx + wSeq + wSub, rowY, wAmt, rowH).fillAndStroke('#e8eef7', '#444');
          doc.fillColor('#111').font('SarabunBold').fontSize(9.5);
          doc.text(`อำเภอ${cell.district}`, bx + 2, rowY + 1, { width: wSeq + wSub - 4, align: 'center', lineBreak: false });
          doc.text('ค่าหมาย', bx + wSeq + wSub + 1, rowY + 1, { width: wAmt - 2, align: 'center', lineBreak: false });
        } else {
          doc.rect(bx, rowY, wSeq, rowH).stroke();
          doc.rect(bx + wSeq, rowY, wSub, rowH).stroke();
          doc.rect(bx + wSeq + wSub, rowY, wAmt, rowH).stroke();
          if (cell) {
            doc.fillColor('#111').font('SarabunBold').fontSize(9.2);
            doc.text(cell.seq, bx + 1, rowY + 1, { width: wSeq - 2, align: 'center', lineBreak: false });
            doc.text(cell.label, bx + wSeq + 2, rowY + 1, { width: wSub - 4, align: 'left', lineBreak: false });
            doc.text(formatMoney(cell.rate), bx + wSeq + wSub + 1, rowY + 1, { width: wAmt - 3, align: 'right', lineBreak: false });
          }
        }
      }
    }

    const notes = (settings[`${type}_notes`] || '').trim();
    if (notes) {
      const noteY = y + maxRows * rowH + 6;
      doc.fillColor('#111').font('SarabunBold').fontSize(10.5);
      doc.text(notes, 20, noteY, { width: 555, lineGap: 1 });
    }
  }

  doc.end();
  return done;
}
