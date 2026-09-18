import { describe, it, expect, beforeEach } from 'vitest';
import prisma from '../lib/db';
import { EscPosBuilder } from '../lib/printer/escpos-builder';
import fs from 'fs';
import path from 'path';

describe('OpenBon v0.4.58: Schicht-Pausen, KDS-Layout, PIN-Overlay & Android Root-CA Tests', () => {
  beforeEach(async () => {
    await prisma.waiterProfile.deleteMany({
      where: { name: { in: ['Test-Schicht-Kellner', 'Test-Lisa-Schicht'] } },
    });
  });

  it('Schicht-Abrechnungsticket druckt Kellnernummer, Anmelde- und Abmeldezeit korrekt', () => {
    const loginTime = new Date('2026-09-18T10:00:00Z');
    const logoutTime = new Date('2026-09-18T16:30:00Z');

    const result = EscPosBuilder.buildSettlementTicket(
      {
        waiterName: 'Lisa Müller',
        waiterNumber: 1042,
        loggedInAt: loginTime,
        loggedOutAt: logoutTime,
        eventName: 'Sommerfest 2026',
        totalGrossCents: 15450,
        transactionCount: 12,
        byMethod: [{ label: 'Barzahlung', amountCents: 15450 }],
        tipsTotalCents: 1200,
        tipWaiterShareCents: 1200,
        tipPoolShareCents: 0,
        cashExpectedCents: 15450,
        cashCountedCents: 15450,
        cashDifferenceCents: 0,
      },
      80
    );

    expect(result.textRepresentation).toContain('Bedienung: Lisa Müller');
    expect(result.textRepresentation).toContain('Kellner-Nr.: #1042');
    expect(result.textRepresentation).toContain('Angemeldet:');
    expect(result.textRepresentation).toContain('Abgemeldet:');
  });

  it('Bediener-Schichten: Pause behält selbe Schicht, Schichtende vergibt neue ID bei Wiederanmeldung', async () => {
    // 1. Erste Schicht anlegen
    const shift1 = await prisma.waiterProfile.create({
      data: {
        name: 'Test-Lisa-Schicht',
        waiterNumber: 9901,
        isActive: true,
        isPaused: false,
        loggedInAt: new Date(),
      },
    });

    expect(shift1.id).toBeDefined();
    expect(shift1.waiterNumber).toBe(9901);
    expect(shift1.isActive).toBe(true);
    expect(shift1.isPaused).toBe(false);

    // 2. Pause simulieren (isPaused: true, isActive: true, loggedOutAt: null)
    await prisma.waiterProfile.update({
      where: { id: shift1.id },
      data: { isPaused: true },
    });

    // Bei Reaktivierung nach Pause wird die selbe Schicht fortgeführt
    const activeShift = await prisma.waiterProfile.findFirst({
      where: { name: 'Test-Lisa-Schicht', isActive: true, loggedOutAt: null },
      orderBy: { createdAt: 'desc' },
    });
    expect(activeShift).toBeDefined();
    expect(activeShift?.id).toBe(shift1.id);
    expect(activeShift?.isPaused).toBe(true);

    // Pause aufheben
    const resumed = await prisma.waiterProfile.update({
      where: { id: activeShift!.id },
      data: { isPaused: false },
    });
    expect(resumed.id).toBe(shift1.id);
    expect(resumed.isPaused).toBe(false);

    // 3. Schicht voll beenden (isActive: false, loggedOutAt: now)
    const logoutDate = new Date();
    await prisma.waiterProfile.update({
      where: { id: shift1.id },
      data: { isActive: false, loggedOutAt: logoutDate },
    });

    // 4. Erneute Anmeldung nach Schichtende -> keine aktive Schicht gefunden -> NEUE Schicht-ID!
    const openShiftAfterLogout = await prisma.waiterProfile.findFirst({
      where: { name: 'Test-Lisa-Schicht', isActive: true, loggedOutAt: null },
      orderBy: { createdAt: 'desc' },
    });
    expect(openShiftAfterLogout).toBeNull();

    // Neue Schicht erstellen
    const shift2 = await prisma.waiterProfile.create({
      data: {
        name: 'Test-Lisa-Schicht',
        waiterNumber: 9902,
        isActive: true,
        isPaused: false,
        loggedInAt: new Date(),
      },
    });

    expect(shift2.id).not.toBe(shift1.id);
    expect(shift2.waiterNumber).toBe(9902);

    // Beide Schichten existieren in der Datenbank
    const allShifts = await prisma.waiterProfile.findMany({
      where: { name: 'Test-Lisa-Schicht' },
    });
    expect(allShifts.length).toBe(2);
  });

  it('Küchenmonitor (KDS) ist auf vertikales Scrollen und Kachel-Raster umgestellt', () => {
    const kitchenSource = fs.readFileSync(
      path.join(process.cwd(), 'src/app/kitchen/page.tsx'),
      'utf8'
    );
    expect(kitchenSource).toContain('overflow-y-auto');
    expect(kitchenSource).toContain('grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3');
    expect(kitchenSource).toContain('shrink-0');
  });

  it('Hauptmenü schließt beim Stationswechsel und PIN-Modal liegt auf z-[100]', () => {
    const navbarSource = fs.readFileSync(
      path.join(process.cwd(), 'src/components/navigation/navbar.tsx'),
      'utf8'
    );
    expect(navbarSource).toContain('const handleRoleSelection = (targetRole: string) => {');
    expect(navbarSource).toContain('setIsOpen(false);');

    const pinModalSource = fs.readFileSync(
      path.join(process.cwd(), 'src/components/auth/pin-modal.tsx'),
      'utf8'
    );
    expect(pinModalSource).toContain('z-[100]');
  });

  it('Bedieneransicht Schnellauswahl speichert nicht automatisch und bietet Pausen-Dialog', () => {
    const waiterSource = fs.readFileSync(
      path.join(process.cwd(), 'src/app/waiter/page.tsx'),
      'utf8'
    );
    // Schnellauswahl ruft nur setInputWaiterName auf
    expect(waiterSource).toContain('setInputWaiterName(name);');
    // Abmelde-Modal mit Pause vs. Schicht beenden
    expect(waiterSource).toContain('showLogoutConfirmModal');
    expect(waiterSource).toContain('Kurze Pause (Nur sperren)');
    expect(waiterSource).toContain('Schicht beenden (Ganz abmelden)');
  });
});
