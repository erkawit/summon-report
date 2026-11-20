import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import PDFDocument from 'pdfkit';
import { bahtText, formatMoney, formatThaiDate } from '../thai';

export interface MemoReportData {
  id: number;
  report_type: 'free' | 'paid';
  doc_no: string;
  doc_date: string;
  order_text: string;
  period_start: string;
  period_end: string;
  item_count: number;
  total_amount: number;
  amount_text: string;
  reporter_name: string;
  reporter_position: string;
  officer_name: string;
  officer_position: string;
  director_name: string;
  director_acting: string;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generate Word (.docx) directly from exact original template (templates/memo_free.docx or memo_paid.docx)
 * Preserves 100% of original fonts (TH SarabunPSK & TH SarabunIT๙), Garuda emblem, VML dotted lines,
 * margins, text boxes, and bold+underline runs.
 */
export async function buildMemoDocx(report: MemoReportData): Promise<Buffer> {
  const type = report.report_type === 'paid' ? 'paid' : 'free';
  const tplPath = path.join(process.cwd(), 'templates', `memo_${type}.docx`);
  const tplBuf = fs.readFileSync(tplPath);
  const zip = await JSZip.loadAsync(tplBuf);
  const docFile = zip.file('word/document.xml');
  if (!docFile) throw new Error('Invalid Word template structure');

  let xml = await docFile.async('string');
  const acting = (report.director_acting || '').trim();
  const amount = Number(report.total_amount) || 0;
  const amountText = (report.amount_text || '').trim() || bahtText(amount);

  const vars: Record<string, string> = {
    doc_no: (report.doc_no || '').trim(),
    doc_date: formatThaiDate(report.doc_date),
    order_text: (report.order_text || '').trim(),
    period_start: formatThaiDate(report.period_start),
    period_end: formatThaiDate(report.period_end),
    item_count: String(Number(report.item_count) || 0),
    amount: formatMoney(amount),
    amount_text: amountText,
    reporter_name: (report.reporter_name || '').trim(),
    reporter_position: (report.reporter_position || '').trim(),
    officer_name: (report.officer_name || '').trim(),
    officer_position: (report.officer_position || '').trim(),
    director_name: (report.director_name || '').trim(),
    director_acting: acting ? 'รักษาราชการแทน ' : '',
  };

  for (const [key, val] of Object.entries(vars)) {
    xml = xml.replaceAll(`{{${key}}}`, escapeXml(val));
  }

  zip.file('word/document.xml', xml);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

/**
 * Generate genuine PDF directly using PDFKit with embedded official TH SarabunPSK & TH SarabunIT๙ fonts
 * and Garuda emblem (runs natively on Vercel serverless Linux without PDF Printer).
 */
export async function buildMemoPdf(report: MemoReportData): Promise<Buffer> {
  const isPaid = report.report_type === 'paid';
  const fontDir = path.join(process.cwd(), 'templates', 'fonts');
  const garudaPath = path.join(process.cwd(), 'templates', 'garuda.png');

  const marginLeft = isPaid ? 85 : 81;
  const marginRight = isPaid ? 57 : 64;
  const contentW = 595.28 - marginLeft - marginRight;

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: isPaid ? 56 : 45, bottom: 40, left: marginLeft, right: marginRight },
  });

  doc.registerFont('PSK', path.join(fontDir, 'THSarabun.ttf'));
  doc.registerFont('PSKBold', path.join(fontDir, 'THSarabun-Bold.ttf'));
  doc.registerFont('IT9', path.join(fontDir, 'THSarabunIT9.ttf'));
  doc.registerFont('IT9Bold', path.join(fontDir, 'THSarabunIT9-Bold.ttf'));

  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const topY = isPaid ? 52 : 42;
  if (fs.existsSync(garudaPath)) {
    doc.image(garudaPath, marginLeft, topY, { width: 52, height: 54 });
  }
  doc.font('PSKBold').fontSize(29).fillColor('#000')
    .text('บันทึกข้อความ', marginLeft, topY + 14, { width: contentW, align: 'center' });

  const dotted = (x1: number, y: number, x2: number) => {
    doc.save().lineWidth(0.6).dash(1.2, { space: 1.8 }).moveTo(x1, y).lineTo(x2, y).stroke('#000').undash().restore();
  };

  let y = topY + 66;
  // ส่วนราชการ
  doc.font('PSKBold').fontSize(17).text('ส่วนราชการ', marginLeft, y, { continued: true });
  doc.font('PSK').text('     ศาลจังหวัดอุดรธานี');
  dotted(marginLeft + 62, y + 20, marginLeft + contentW);

  y += 24;
  // ที่ / วันที่
  const docNo = (report.doc_no || '').trim();
  const docDate = formatThaiDate(report.doc_date);
  doc.font('IT9Bold').fontSize(17).text('ที่', marginLeft, y, { continued: true });
  doc.font('IT9').text(`  ${docNo}`);
  dotted(marginLeft + 14, y + 20, marginLeft + contentW * 0.49);

  const dateX = marginLeft + contentW * 0.52;
  doc.font('IT9Bold').fontSize(17).text('วันที่', dateX, y, { continued: true });
  doc.font('IT9').text(`  ${docDate}`);
  dotted(dateX + 26, y + 20, marginLeft + contentW);

  y += 24;
  // เรื่อง
  const subject = isPaid
    ? 'รายงานผลการส่งคำคู่ความและขออนุมัติเบิกจ่ายค่าส่งคำคู่ความ'
    : 'รายงานผลการส่งคำคู่ความและขออนุมัติเบิกจ่ายค่าส่งคำคู่ความตามระเบียบ';
  doc.font('IT9Bold').fontSize(17).text('เรื่อง', marginLeft, y, { continued: true });
  doc.font('IT9').text(`    ${subject}`);
  dotted(marginLeft + 28, y + 20, marginLeft + contentW);

  y += 30;
  // เรียน
  doc.font('PSK').fontSize(17).text('เรียน     ผู้อำนวยการสำนักอำนวยการประจำศาลจังหวัดอุดรธานี', marginLeft, y);

  y += 28;
  doc.x = marginLeft;
  doc.y = y;

  const amount = Number(report.total_amount) || 0;
  const amountFmt = formatMoney(amount);
  const amountText = (report.amount_text || '').trim() || bahtText(amount);
  const countStr = String(Number(report.item_count) || 0);
  const orderText = (report.order_text || '').trim();
  const indent = 68;

  // Paragraph 1
  doc.font('IT9').fontSize(16.5).text(
    `ตาม${orderText} ได้แต่งตั้งข้าพเจ้าเป็นเจ้าพนักงานศาลในการส่งคำคู่ความหรือเอกสารประจำศาลจังหวัดอุดรธานี นั้น`,
    marginLeft, doc.y, { indent, width: contentW, lineGap: 2 }
  );

  doc.moveDown(0.35);

  // Paragraph 2
  if (isPaid) {
    const pStart = formatThaiDate(report.period_start);
    const pEnd = formatThaiDate(report.period_end);
    doc.font('IT9').text(
      `บัดนี้ ข้าพเจ้าได้ส่งคำคู่ความสำหรับรอบระหว่างวันที่ ${pStart} ถึงวันที่ ${pEnd} จำนวน ${countStr} เรื่อง ทั้งนี้ จะดำเนินการสแกนรายงานผลการส่งคำคู่ความเข้าสู่ระบบเทคโนโลยีสารสนเทศตามระเบียบของสำนักงานศาลยุติธรรม ได้แก่ ระบบรายงานผลการส่งหมาย (Summons) การส่งหมายในระบบคดีที่มีการยื่นฟ้องอิเล็กทรอนิกส์ (e-filling) ระบบการจัดทำสารบบและสำนวนความอิเล็กทรอนิกส์ (E-CMS) ภายใน 3 วันทำการ นับถัดจากวันเบิกจ่ายค่าส่งคำคู่ความแล้วเสร็จ`,
      marginLeft, doc.y, { indent, width: contentW, lineGap: 2 }
    );
  } else {
    doc.font('IT9').text(
      `บัดนี้ ข้าพเจ้า ได้ส่งคำคู่ความตามคำสั่งศาล จำนวน ${countStr} เรื่อง ทั้งนี้จะดำเนินการสแกนรายงานผลการส่งคำคู่ความเข้าสู่ระบบเทคโนโลยีสารสนเทศตามระเบียบของสำนักงานศาลยุติธรรม ได้แก่ ระบบรายงานผลการส่งหมาย (Summons) การส่งหมายในระบบคดีที่มีการยื่นฟ้องอิเล็กทรอนิกส์ (e-filling), ระบบการจัดทำสารบบและสำนวนความอิเล็กทรอนิกส์ (E-CMS) ภายใน 3 วันทำการ นับถัดจากวันเบิกจ่ายค่าส่งคำคู่ความแล้วเสร็จ`,
      marginLeft, doc.y, { indent, width: contentW, lineGap: 2 }
    );
  }

  doc.moveDown(0.35);

  // Paragraph 3
  if (isPaid) {
    doc.font('IT9').text(
      `ข้าพเจ้าจึงขออนุมัติเบิกจ่ายค่าส่งคำคู่ความที่คู่ความได้วางเงิน จำนวน ${amountFmt} บาท (${amountText}) รายละเอียดปรากฏตามเอกสารที่แนบมาพร้อมนี้ ข้าพเจ้า ขอรับรองว่าได้เบิกจ่ายค่าคำคู่ความถูกต้องตามระเบียบและประกาศของศาลจังหวัดอุดรธานีแล้ว`,
      marginLeft, doc.y, { indent, width: contentW, lineGap: 2 }
    );
  } else {
    doc.font('IT9').text(
      `ข้าพเจ้าจึงขออนุมัติเบิกจ่ายค่าส่งคำคู่ความตามระเบียบคณะกรรมการบริหารศาลยุติธรรมว่าด้วยค่าตอบแทนในการส่งคำคู่ความหรือเอกสารโดยเจ้าพนักงานศาล พ.ศ.2562 จำนวน ${amountFmt} บาท (${amountText}) ข้าพเจ้าขอรับรองว่าได้เบิกจ่ายค่าคำคู่ความถูกต้องตามระเบียบและประกาศของศาลจังหวัดอุดรธานีแล้ว และผลหมายดังกล่าวยังไม่เคยมีการเบิก ค่าส่งคำคู่ความ รายละเอียดปรากฏตามเอกสารที่แนบมาพร้อมนี้`,
      marginLeft, doc.y, { indent, width: contentW, lineGap: 2 }
    );
  }

  doc.moveDown(0.35);
  doc.font('IT9').text('จึงเรียนมาเพื่อโปรดพิจารณา', marginLeft, doc.y, { indent, width: contentW });

  // Reporter Signature (right half)
  const sigY = Math.max(doc.y + 38, 495);
  const rightColX = marginLeft + contentW * 0.45;
  const rightColW = contentW * 0.55;

  doc.font('IT9').fontSize(16.5).text(`(${(report.reporter_name || '').trim()})`, rightColX, sigY, { width: rightColW, align: 'center' });
  doc.font('IT9').text((report.reporter_position || '').trim(), rightColX, sigY + 21, { width: rightColW, align: 'center' });

  // Bottom 2-column approval blocks
  const botY = Math.max(sigY + 68, 590);
  const halfW = contentW / 2 - 8;
  const col2X = marginLeft + contentW / 2 + 8;

  // Left: Officer
  doc.font('IT9Bold').fontSize(16).text('เรียน  ผู้อำนวยการฯ', marginLeft, botY, { width: halfW });
  doc.font('IT9').text('- เพื่อโปรดทราบและพิจารณา', marginLeft, botY + 20, { width: halfW });
  doc.text('- เห็นควรให้ส่วนคลังตรวจสอบและเบิกจ่ายต่อไป', marginLeft, botY + 40, { width: halfW });

  const offSigY = botY + 100;
  doc.font('IT9').text(`(${(report.officer_name || '').trim()})`, marginLeft, offSigY, { width: halfW, align: 'center' });
  doc.font('IT9').text((report.officer_position || '').trim(), marginLeft, offSigY + 20, { width: halfW, align: 'center' });

  // Right: Director
  doc.font('IT9Bold').fontSize(16).text('- ทราบ          - เบิกจ่ายตามระเบียบ', col2X, botY, { width: halfW });

  doc.font('IT9').text(`(${(report.director_name || '').trim()})`, col2X, offSigY, { width: halfW, align: 'center' });

  const acting = (report.director_acting || '').trim();
  const dirTitle = acting
    ? 'รักษาราชการแทน ผู้อำนวยการสำนักอำนวยการประจำศาลจังหวัดอุดรธานี'
    : 'ผู้อำนวยการสำนักอำนวยการประจำศาลจังหวัดอุดรธานี';
  doc.font('IT9').text(dirTitle, col2X, offSigY + 20, { width: halfW, align: 'center' });

  doc.end();
  return done;
}
