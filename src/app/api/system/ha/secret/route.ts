import { NextResponse } from 'next/server';
import { logSystemActionSafe } from '@/lib/action-logger';
import { requireApiAuth } from '@/lib/api-guard';
import { requireAdmin } from '@/lib/admin-guard';
import { verifyAdminPin } from '@/lib/auth-pin';
import { setHaSyncSecret, getHaSecretStatus } from '@/lib/ha/ha-secret';

export const dynamic = 'force-dynamic';

/**
 * N1 Manuelles Setzen eines HA-Sync-Secrets (Fallback neben dem
 * Code-Wizard, z. B. wenn beide Knoten von Hand identisch konfiguriert
 * werden sollen). Erfordert ADMIN-Session UND Admin-PIN.
 */
export async function POST(req: Request) {
  const auth = await requireApiAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;

  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!(await verifyAdminPin(String(body.pin ?? '')))) {
    return NextResponse.json({ error: 'Falscher Admin-PIN.' }, { status: 403 });
  }

  const secret = String(body.secret ?? '').trim();
  const WEAK = new Set(['', 'openbon-ha-sync-secret-2026']);
  if (WEAK.has(secret) || secret.length < 24) {
    return NextResponse.json(
      { error: 'Secret ungueltig (mindestens 24 Zeichen, nicht der bekannte Standardwert).' },
      { status: 400 }
    );
  }

  try {
    await setHaSyncSecret(secret);
    const status = await getHaSecretStatus();

    await logSystemActionSafe(() => ({
      action: 'HA_SECRET_SET_MANUAL',
      category: 'SYSTEM',
      actor: auth.session.waiterName || auth.session.role || 'Admin',
      details: `HA-Sync-Secret manuell gesetzt (${status.source}).`,
    }));

    return NextResponse.json({
      success: true,
      message:
        'Secret auf diesem Knoten aktiv. WICHTIG: Auf dem Partnerknoten denselben Wert setzen' +
        ' (Assistent: gleicher Code, oder gleicher manueller Eintrag), sonst bricht der Sync.',
      state: { isWeak: status.isWeak, source: status.source, partnerConfigured: status.partnerConfigured },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
