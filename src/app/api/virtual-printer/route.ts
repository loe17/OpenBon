import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const history = global.virtualPrinterHistory || [];
    return NextResponse.json(history);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    global.virtualPrinterHistory = [];
    if (global.io) {
      global.io.emit('virtual_printer:cleared');
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
