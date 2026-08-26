import { NextResponse } from 'next/server';
import { logSystemActionSafe } from '@/lib/action-logger';
import { requireApiAuth } from '@/lib/api-guard';

export async function GET(req: Request) {
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const history = global.virtualPrinterHistory || [];
    return NextResponse.json(history);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const auth = await requireApiAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;

  try {
    global.virtualPrinterHistory = [];
    if (global.io) {
      global.io.emit('virtual_printer:cleared');
    }
    await logSystemActionSafe(() => ({
      action: 'VIRTUAL_PRINTER_CLEARED',
      category: 'SYSTEM',
      actor: auth.session.waiterName || auth.session.role,
      details: 'Virtuellen Druckverlauf geleert.',
    }));

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
