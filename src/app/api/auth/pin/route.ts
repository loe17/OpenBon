import { NextResponse } from 'next/server';
import { verifyStationPin, setAdminPin, StationPinType } from '@/lib/auth-pin';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, pin, newPin, stationType } = body;

    if (action === 'VERIFY') {
      const targetStation: StationPinType = stationType || 'ADMIN';
      const isValid = await verifyStationPin(pin || '', targetStation);
      return NextResponse.json({ success: isValid });
    }

    if (action === 'CHANGE') {
      const isCurrentValid = await verifyStationPin(pin || '', 'ADMIN');
      if (!isCurrentValid) {
        return NextResponse.json({ error: 'Aktueller Admin-PIN ist falsch.' }, { status: 403 });
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
