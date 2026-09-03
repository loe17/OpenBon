import { NextResponse } from 'next/server';

/**
 * Schreib-Schutz für Dual-Betrieb: Ein STANDBY-Knoten lehnt schreibende
 * Kassen-Vorgänge ab, damit bei Netzwerk-Partition keine zwei divergenten
 * Wahrheiten (doppelte Bon-Nummern) entstehen. STANDALONE/PRIMARY schreiben.
 * Kalt-Standby bleibt Standard – dieser Guard macht ihn wasserdicht.
 */
export function isWriteAllowed(): { allowed: boolean; role: string; partnerUrl: string } {
  const role = String(process.env.HA_ROLE || 'STANDALONE').toUpperCase();
  // Lazy: DB-Rolle wird vom haService verwaltet; ENV ist die schnelle Sperre.
  // Ist die Rolle per DB auf STANDBY gesetzt, blockiert der Service-Layer unten.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { haService } = require('./ha-service') as typeof import('./ha-service');
    const live = String(haService.getRole ? haService.getRole() : role).toUpperCase();
    if (live === 'STANDBY') {
      return { allowed: false, role: live, partnerUrl: String(process.env.HA_PARTNER_URL || '') };
    }
    return { allowed: true, role: live, partnerUrl: String(process.env.HA_PARTNER_URL || '') };
  } catch {
    if (role === 'STANDBY') {
      return { allowed: false, role, partnerUrl: String(process.env.HA_PARTNER_URL || '') };
    }
    return { allowed: true, role, partnerUrl: String(process.env.HA_PARTNER_URL || '') };
  }
}

export function denyStandbyWrite() {
  const s = isWriteAllowed();
  if (!s.allowed) {
    return NextResponse.json(
      {
        error: 'Dieser Knoten ist STANDBY (lesend). Bitte an der PRIMARY-Kasse arbeiten.',
        code: 'HA_STANDBY_READONLY',
        role: s.role,
      },
      { status: 409 }
    );
  }
  return null;
}
