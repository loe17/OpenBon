import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { pushMenuToWebhosting } from '@/lib/webhosting-push';

export async function POST() {
  try {
    const config = await prisma.eventConfig.findFirst();
    if (!config || !config.baseUrl) {
      return NextResponse.json(
        { error: 'Bitte trage zuerst die Öffentliche Basis-URL (z. B. https://bon.mein-verein.de) in den Einstellungen ein.' },
        { status: 400 }
      );
    }

    const syncToken = (config as any).webhostingSyncToken || '';
    const result = await pushMenuToWebhosting(config.baseUrl, syncToken);

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: result.message });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
