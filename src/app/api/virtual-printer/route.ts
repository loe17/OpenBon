import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const history = global.virtualPrinterHistory || [];
    return NextResponse.json(history);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    global.virtualPrinterHistory = [];
    if (global.io) {
      global.io.emit('virtual_printer:cleared');
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
