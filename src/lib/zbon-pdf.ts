import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

/** 1-seitiges Z-Bon-/Beleg-PDF (Text-Layout) für DATEV-ZIP. */
export async function buildZBonPdf(args: {
  title: string;
  lines: Array<{ label: string; value: string }>;
  footer?: string;
}): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let y = 800;
  page.drawText(args.title, { x: 50, y, size: 16, font: bold, color: rgb(0, 0, 0) });
  y -= 28;
  for (const l of args.lines) {
    page.drawText(`${l.label}: ${l.value}`, { x: 50, y, size: 10, font, color: rgb(0, 0, 0) });
    y -= 16;
    if (y < 60) break;
  }
  if (args.footer) {
    page.drawText(args.footer.slice(0, 200), { x: 50, y: 40, size: 8, font, color: rgb(0.3, 0.3, 0.3) });
  }
  return Buffer.from(await doc.save());
}
