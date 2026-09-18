import prisma from '@/lib/db';

/**
 * Weist einer Bedienung vollautomatisch eine für die gesamte Veranstaltung
 * unveränderbare, eindeutige 4-stellige Nummer (ab 1001) zu.
 */
export async function getOrAssignWaiterNumber(name: string, forceNew = false): Promise<number> {
  const trimmed = (name || '').trim();
  if (!trimmed) return 1001;

  // 1. Prüfe ob bereits ein Profil existiert (falls keine neue Schicht erzwungen wird)
  if (!forceNew) {
    const existing = await prisma.waiterProfile.findFirst({
      where: { name: trimmed, isActive: true },
      orderBy: { createdAt: 'desc' },
      select: { id: true, waiterNumber: true },
    });

    if (existing && existing.waiterNumber && existing.waiterNumber >= 1000) {
      return existing.waiterNumber;
    }
  }

  // 2. Höchste vergebene Nummer ermitteln (ab 1000)
  const highest = await prisma.waiterProfile.findFirst({
    where: { waiterNumber: { not: null } },
    orderBy: { waiterNumber: 'desc' },
    select: { waiterNumber: true },
  });

  const nextNumber = Math.max(1001, (highest?.waiterNumber || 1000) + 1);

  return nextNumber;
}

/**
 * Formatiert den Bedienungsnamen für Bons und Anzeigen mit 4-stelliger ID.
 * Beispiel: "Lukas - 1042"
 */
export function formatWaiterLabel(name: string, waiterNumber?: number | string | null): string {
  const clean = (name || '').trim();
  if (!clean) return 'Kasse';
  if (clean.includes(' - ') && /\d{4}/.test(clean)) return clean;
  if (!waiterNumber) return clean;
  return `${clean} - ${waiterNumber}`;
}
