import { NextResponse } from 'next/server';
import { verifyAdminPin, setAdminPin } from '@/lib/auth-pin';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, pin, newPin } = body;

    if (action === 'VERIFY') {
      const isValid = await verifyAdminPin(pin || '');
      return NextResponse.json({ success: isValid });
    }

    if (action === 'CHANGE') {
      const isCurrentValid = await verifyAdminPin(pin || '');
      if (!isCurrentValid) {
        return NextResponse.json({ error: 'Aktueller PIN ist falsch.' }, { status: 403 });
      }
      const changed = await setAdminPin(newPin);
      if (changed) {
        return NextResponse.json({ success: true, message: 'Admin-PIN erfolgreich geändert.' });
      }
      return NextResponse.json({ error: 'PIN muss mindestens 4 Stellen haben.' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
