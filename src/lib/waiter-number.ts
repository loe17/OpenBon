import prisma from '@/lib/db';

/**
 * Weist einer Bedienung vollautomatisch eine für die gesamte Veranstaltung
 * unveränderbare, eindeutige 4-stellige Nummer (ab 1001) zu.
 */
export async function getOrAssignWaiterNumber(name: string): Promise<number> {
  const trimmed = (name || '').trim();
  if (!trimmed) return 1001;

  // 1. Prüfe ob bereits ein Profil existiert
  const existing = await prisma.waiterProfile.findUnique({
    where: { name: trimmed },
    select: { id: true, waiterNumber: true },
  });

  if (existing && existing.waiterNumber && existing.waiterNumber >= 1000) {
    return existing.waiterNumber;
  }

  // 2. Höchste vergebene Nummer ermitteln (ab 1000)
  const highest = await prisma.waiterProfile.findFirst({
    where: { waiterNumber: { not: null } },
    orderBy: { waiterNumber: 'desc' },
    select: { waiterNumber: true },
  });

  const nextNumber = Math.max(1001, (highest?.waiterNumber || 1000) + 1);

  // 3. Im Profil speichern bzw. anlegen
  if (existing) {
    await prisma.waiterProfile.update({
      where: { id: existing.id },
      data: { waiterNumber: nextNumber },
    });
  } else {
    await prisma.waiterProfile.create({
      data: {
        name: trimmed,
        waiterNumber: nextNumber,
        pin: '3333',
        isActive: true,
      },
    });
  }

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
