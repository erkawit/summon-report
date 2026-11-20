import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import path from 'path';
import { bahtText, cleanDistrict, cleanSubdistrict, formatMoney2, formatThaiDate, formatThaiDateShort } from '../thai';

export interface ReceiptReportData {
  id: number;
  receipt_date: string;
  reporter_name: string;
  reporter_position: string;
  reporter_address: string;
  payer_name: string;
  payer_position: string;
}

export interface ReceiptItemData {
  seq: number;
  case_prefix: string;
  case_no: string;
  issue_date: string;
  serve_date: string;
  summon_type: string;
  recipient_role: string;
  house_no: string;
  moo: string;
  subdistrict: string;
  district: string;
  province: string;
  base_rate: number;
  claim_rate: number;
}

export async function buildReceiptExcel(report: ReceiptReportData, items: ReceiptItemData[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('ใบรับเงินหมายฟรี', {
    pageSetup: {
      paperSize: 9,
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
    },
  });

  const widths: [string, number][] = [
    ['A', 4.5], ['B', 4.2], ['C', 5.5], ['D', 11.5], ['E', 9.5], ['F', 9.5],
    ['G', 15.0], ['H', 9.5], ['I', 4.8], ['J', 5.0], ['K', 3.8], ['L', 4.0],
    ['M', 3.5], ['N', 11.0], ['O', 3.5], ['P', 13.0], ['Q', 9.5], ['R', 9.8], ['S', 9.8],
  ];
  widths.forEach(([c, w]) => { ws.getColumn(c).width = w; });

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' },
  };
  const baseFont = { name: 'TH SarabunPSK', size: 15 };
  const boldFont = { name: 'TH SarabunPSK', size: 15, bold: true };

  ws.mergeCells('B1:S1');
  ws.getCell('B1').value = 'ศาลจังหวัดอุดรธานี';
  ws.getCell('B1').font = boldFont;
  ws.getCell('B1').alignment = { horizontal: 'center' };

  ws.mergeCells('B2:S2');
  ws.getCell('B2').value = 'บัญชีขอเบิกจ่ายค่านำส่งคำคู่ความ';
  ws.getCell('B2').font = boldFont;
  ws.getCell('B2').alignment = { horizontal: 'center' };

  ws.mergeCells('J4:S4');
  const recDate = formatThaiDate(report.receipt_date);
  ws.getCell('J4').value = recDate
    ? `                    วันที่  ${recDate}`
    : '                    วันที่.........เดือน...........................พ.ศ..................';
  ws.getCell('J4').font = baseFont;

  const repName = (report.reporter_name || '').trim();
  const repAddr = (report.reporter_address || '2 ถ.อธิบดี ตำบลหมากแข้ง อำเภอเมือง จังหวัดอุดรธานี').trim();
  const repPos = (report.reporter_position || '').trim();
  const payerName = (report.payer_name || 'นางราตรี  ศรีจันทร์').trim();
  const payerPos = (report.payer_position || 'นักวิชาการเงินและบัญชีชำนาญการพิเศษ').trim();

  ws.mergeCells('B6:S6');
  ws.getCell('B6').value = `นามผู้รับเงิน............................${repName}.................................................................................`;
  ws.getCell('B6').font = baseFont;

  ws.mergeCells('B7:S7');
  ws.getCell('B7').value = `ที่อยู่ ..${repAddr}............................................`;
  ws.getCell('B7').font = baseFont;

  ws.mergeCells('B8:S8');
  ws.getCell('B8').value = 'ได้รับเงินจาก  สำนักอำนวยการประจำศาลจังหวัดอุดรธานี  ดังรายการต่อไปนี้';
  ws.getCell('B8').font = baseFont;

  // Table Headers (Rows 10 & 11)
  ws.mergeCells('B10:Q10');
  ws.getCell('B10').value = 'รายละเอียดการเบิกจ่ายเงิน ค่าตอบแทนในการส่งคำคู่ความหรือเอกสาร';
  ws.mergeCells('R10:S10');
  ws.getCell('R10').value = 'จำนวนเงิน';

  ws.getCell('B11').value = 'ลำดับ';
  ws.mergeCells('C11:D11');
  ws.getCell('C11').value = 'หมายเลขคดี';
  ws.getCell('E11').value = 'วันที่จ่ายหมาย';
  ws.getCell('F11').value = 'วันที่ส่งหมาย';
  ws.getCell('G11').value = 'หมายอะไร';
  ws.getCell('H11').value = 'ส่งหมายให้ใคร';
  ws.mergeCells('I11:Q11');
  ws.getCell('I11').value = 'ที่อยู่';
  ws.getCell('R11').value = 'ราคาหมาย';
  ws.getCell('S11').value = 'ราคาเบิก';

  for (let r = 10; r <= 11; r++) {
    ws.getRow(r).height = r === 10 ? 22 : 24;
    for (let c = 2; c <= 19; c++) {
      const cell = ws.getCell(r, c);
      cell.font = { name: 'TH SarabunPSK', size: 14, bold: true };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = thinBorder;
    }
  }

  const startRow = 12;
  let rowIdx = startRow;
  let totalClaim = 0;

  items.forEach((it, idx) => {
    const baseRate = Number(it.base_rate) || 0;
    const claimRate = Number(it.claim_rate) || 0;
    totalClaim += claimRate;

    const vals: [number, string | number][] = [
      [2, idx + 1],
      [3, (it.case_prefix || 'คดีดำ').trim()],
      [4, (it.case_no || '').trim()],
      [5, formatThaiDateShort(it.issue_date)],
      [6, formatThaiDateShort(it.serve_date)],
      [7, (it.summon_type || '').trim()],
      [8, (it.recipient_role || '').trim()],
      [9, 'เลขที่'],
      [10, (it.house_no || '').trim()],
      [11, 'หมู่'],
      [12, (it.moo || '').trim()],
      [13, 'ต.'],
      [14, cleanSubdistrict(it.subdistrict || '')],
      [15, 'อ.'],
      [16, cleanDistrict(it.district || '')],
      [17, (it.province || 'จ.อุดรธานี').trim()],
      [18, baseRate],
      [19, claimRate],
    ];

    ws.getRow(rowIdx).height = 21;
    for (const [col, val] of vals) {
      const cell = ws.getCell(rowIdx, col);
      cell.value = val;
      cell.font = baseFont;
      cell.border = thinBorder;
      cell.alignment = {
        vertical: 'middle',
        shrinkToFit: true,
        horizontal: col === 2 || col === 5 || col === 6 || col === 12 ? 'center' : col >= 18 ? 'right' : 'left',
      };
      if (col >= 18) cell.numFmt = '#,##0.00';
    }
    rowIdx++;
  });

  if (items.length === 0) {
    for (let c = 2; c <= 19; c++) ws.getCell(rowIdx, c).border = thinBorder;
    rowIdx++;
  }

  const lastDataRow = rowIdx - 1;
  const sumRow = rowIdx;
  ws.getRow(sumRow).height = 23;
  ws.mergeCells(`B${sumRow}:Q${sumRow}`);
  ws.getCell(`B${sumRow}`).value = `จำนวนเงิน (ตัวอักษร) ……${bahtText(totalClaim)}.....`;
  ws.getCell(`R${sumRow}`).value = { formula: `SUM(R${startRow}:R${lastDataRow})` };
  ws.getCell(`S${sumRow}`).value = { formula: `SUM(S${startRow}:S${lastDataRow})` };

  for (let c = 2; c <= 19; c++) {
    const cell = ws.getCell(sumRow, c);
    cell.font = boldFont;
    cell.border = thinBorder;
    cell.alignment = { vertical: 'middle', horizontal: c >= 18 ? 'right' : 'left' };
    if (c >= 18) cell.numFmt = '#,##0.00';
  }

  // Signatures
  const sigRow = sumRow + 2;
  ws.mergeCells(`B${sigRow}:S${sigRow}`);
  ws.getCell(`B${sigRow}`).value = '(ลงชื่อ)....................................................... ผู้จ่ายเงิน                                                                                           (ลงชื่อ)....................................................... ผู้รับเงิน';
  ws.getCell(`B${sigRow}`).font = baseFont;
  ws.getCell(`B${sigRow}`).alignment = { horizontal: 'center' };

  const nameRow = sigRow + 1;
  ws.mergeCells(`B${nameRow}:S${nameRow}`);
  ws.getCell(`B${nameRow}`).value = `                ( ${payerName} )                                                                                                                                    ( ${repName} )`;
  ws.getCell(`B${nameRow}`).font = baseFont;
  ws.getCell(`B${nameRow}`).alignment = { horizontal: 'center' };

  const posRow = sigRow + 2;
  ws.mergeCells(`B${posRow}:I${posRow}`);
  ws.getCell(`B${posRow}`).value = payerPos;
  ws.getCell(`B${posRow}`).font = baseFont;
  ws.getCell(`B${posRow}`).alignment = { horizontal: 'center' };

  ws.mergeCells(`N${posRow}:S${posRow}`);
  ws.getCell(`N${posRow}`).value = repPos;
  ws.getCell(`N${posRow}`).font = baseFont;
  ws.getCell(`N${posRow}`).alignment = { horizontal: 'center' };

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}

export async function buildReceiptPdf(report: ReceiptReportData, items: ReceiptItemData[]): Promise<Buffer> {
  const fontDir = path.join(process.cwd(), 'templates', 'fonts');
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 28 });
  doc.registerFont('Sarabun', path.join(fontDir, 'THSarabun.ttf'));
  doc.registerFont('SarabunBold', path.join(fontDir, 'THSarabun-Bold.ttf'));

  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const pageW = 841.89;
  const left = 28;
  const contentW = pageW - left * 2; // 785.89

  doc.font('SarabunBold').fontSize(16).fillColor('#000')
    .text('ศาลจังหวัดอุดรธานี', left, 24, { width: contentW, align: 'center' });
  doc.text('บัญชีขอเบิกจ่ายค่านำส่งคำคู่ความ', left, 43, { width: contentW, align: 'center' });

  const recDate = formatThaiDate(report.receipt_date);
  doc.font('Sarabun').fontSize(14).text(
    recDate ? `วันที่  ${recDate}` : 'วันที่.........เดือน...........................พ.ศ..................',
    left, 64, { width: contentW - 30, align: 'right' }
  );

  const repName = (report.reporter_name || '').trim();
  const repAddr = (report.reporter_address || '2 ถ.อธิบดี ตำบลหมากแข้ง อำเภอเมือง จังหวัดอุดรธานี').trim();
  const repPos = (report.reporter_position || '').trim();
  const payerName = (report.payer_name || 'นางราตรี  ศรีจันทร์').trim();
  const payerPos = (report.payer_position || 'นักวิชาการเงินและบัญชีชำนาญการพิเศษ').trim();

  doc.font('Sarabun').fontSize(14.5).text(`นามผู้รับเงิน   ${repName}`, left, 84);
  doc.font('Sarabun').text(`ที่อยู่   ${repAddr}`, left, 102);
  doc.text('ได้รับเงินจาก   สำนักอำนวยการประจำศาลจังหวัดอุดรธานี   ดังรายการต่อไปนี้', left, 120);

  // Table columns (sum = 786)
  const cols = [
    { key: 'seq', label: 'ลำดับ', w: 30, align: 'center' as const },
    { key: 'case', label: 'หมายเลขคดี', w: 96, align: 'left' as const },
    { key: 'issue', label: 'วันที่จ่ายหมาย', w: 66, align: 'center' as const },
    { key: 'serve', label: 'วันที่ส่งหมาย', w: 66, align: 'center' as const },
    { key: 'stype', label: 'หมายอะไร', w: 112, align: 'left' as const },
    { key: 'role', label: 'ส่งหมายให้ใคร', w: 64, align: 'left' as const },
    { key: 'addr', label: 'ที่อยู่', w: 220, align: 'left' as const },
    { key: 'base', label: 'ราคาหมาย', w: 66, align: 'right' as const },
    { key: 'claim', label: 'ราคาเบิก', w: 66, align: 'right' as const },
  ];

  let y = 144;
  doc.lineWidth(0.6).strokeColor('#000');

  // Header row 1
  const leftSpan = cols.slice(0, 7).reduce((a, b) => a + b.w, 0);
  const rightSpan = cols[7].w + cols[8].w;
  doc.rect(left, y, leftSpan, 20).fillAndStroke('#f4f6fa', '#000');
  doc.rect(left + leftSpan, y, rightSpan, 20).fillAndStroke('#f4f6fa', '#000');
  doc.fillColor('#000').font('SarabunBold').fontSize(13.5);
  doc.text('รายละเอียดการเบิกจ่ายเงิน ค่าตอบแทนในการส่งคำคู่ความหรือเอกสาร', left, y + 2, { width: leftSpan, align: 'center' });
  doc.text('จำนวนเงิน', left + leftSpan, y + 2, { width: rightSpan, align: 'center' });
  y += 20;

  // Header row 2
  let x = left;
  for (const c of cols) {
    doc.rect(x, y, c.w, 20).fillAndStroke('#f4f6fa', '#000');
    doc.fillColor('#000').font('SarabunBold').fontSize(12.5).text(c.label, x + 2, y + 2, { width: c.w - 4, align: 'center' });
    x += c.w;
  }
  y += 20;

  let totalBase = 0;
  let totalClaim = 0;
  const rowH = 21;

  for (let i = 0; i < items.length; i++) {
    if (y > 515) {
      doc.addPage({ size: 'A4', layout: 'landscape', margin: 28 });
      y = 32;
    }
    const it = items[i];
    const base = Number(it.base_rate) || 0;
    const claim = Number(it.claim_rate) || 0;
    totalBase += base;
    totalClaim += claim;

    const vals = [
      String(i + 1),
      `${it.case_prefix || 'คดีดำ'} ${it.case_no || ''}`.trim(),
      formatThaiDateShort(it.issue_date),
      formatThaiDateShort(it.serve_date),
      it.summon_type || '',
      it.recipient_role || '',
      `เลขที่ ${it.house_no || '-'} หมู่ ${it.moo || '-'} ต.${cleanSubdistrict(it.subdistrict || '')} อ.${cleanDistrict(it.district || '')} ${it.province || 'จ.อุดรธานี'}`,
      formatMoney2(base),
      formatMoney2(claim),
    ];

    x = left;
    cols.forEach((c, idx) => {
      doc.rect(x, y, c.w, rowH).stroke();
      doc.fillColor('#000').font('Sarabun').fontSize(12.5);
      doc.text(vals[idx], x + 3, y + 2.5, {
        width: c.w - 6,
        align: c.align,
        lineBreak: false,
      });
      x += c.w;
    });
    y += rowH;
  }

  // Total row
  doc.rect(left, y, leftSpan, 23).stroke();
  doc.rect(left + leftSpan, y, cols[7].w, 23).stroke();
  doc.rect(left + leftSpan + cols[7].w, y, cols[8].w, 23).stroke();

  doc.fillColor('#000').font('SarabunBold').fontSize(13.5);
  doc.text(`จำนวนเงิน (ตัวอักษร) ……${bahtText(totalClaim)}.....`, left + 6, y + 3, { width: leftSpan - 12 });
  doc.text(formatMoney2(totalBase), left + leftSpan + 3, y + 3, { width: cols[7].w - 6, align: 'right' });
  doc.text(formatMoney2(totalClaim), left + leftSpan + cols[7].w + 3, y + 3, { width: cols[8].w - 6, align: 'right' });

  // Signatures
  const sigY = y + 42;
  const half = contentW / 2;
  doc.font('Sarabun').fontSize(14);
  doc.text('(ลงชื่อ)....................................................... ผู้จ่ายเงิน', left, sigY, { width: half, align: 'center' });
  doc.text(`( ${payerName} )`, left, sigY + 19, { width: half, align: 'center' });
  doc.text(payerPos, left, sigY + 38, { width: half, align: 'center' });

  doc.text('(ลงชื่อ)....................................................... ผู้รับเงิน', left + half, sigY, { width: half, align: 'center' });
  doc.text(`( ${repName} )`, left + half, sigY + 19, { width: half, align: 'center' });
  doc.text(repPos, left + half, sigY + 38, { width: half, align: 'center' });

  doc.end();
  return done;
}
