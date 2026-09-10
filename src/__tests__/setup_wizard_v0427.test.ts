import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import prisma from '../lib/db';
import { GET as getPublicConfig } from '../app/api/config/public/route';
import { POST as postInitialSetup } from '../app/api/auth/initial-setup/route';
import * as authPin from '../lib/auth-pin';
import { verifySessionToken, SESSION_COOKIE_NAME, SESSION_LEGACY_COOKIE_NAME } from '../lib/auth-session';

describe('OpenBon Erststart-Assistent & Setup Workflow (v0.4.27)', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await prisma.eventConfig.upsert({
      where: { id: 'default' },
      update: {
        name: 'Test Event',
        initialPinSet: true,
      },
      create: {
        id: 'default',
        name: 'Test Event',
        initialPinSet: true,
      },
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    // Standard-Zustand für nachfolgende Tests wiederherstellen
    await authPin.setAllStationPins({
      adminPin: '582914',
      posPin: '619274',
      kitchenPin: '338159',
      waiterPin: '772481',
    });
    await prisma.eventConfig.update({
      where: { id: 'default' },
      data: { initialPinSet: true },
    }).catch(() => {});
  });

  it('1. GET /api/config/public meldet needsSetup=false, wenn initialPinSet bereits gesetzt ist', async () => {
    await prisma.eventConfig.update({
      where: { id: 'default' },
      data: { initialPinSet: true },
    });

    const res = await getPublicConfig();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.needsSetup).toBe(false);
    expect(data.initialPinSet).toBe(true);
  });

  it('2. GET /api/config/public meldet needsSetup=false bei aktivem Event (Tische/Produkte vorhanden), selbst wenn initialPinSet=false war', async () => {
    await prisma.eventConfig.update({
      where: { id: 'default' },
      data: { initialPinSet: false },
    });

    // Simuliere vorhandene Daten (Produkte/Tische) auf dem System
    vi.spyOn(authPin, 'hasActiveEventData').mockResolvedValue(true);

    const res = await getPublicConfig();
    expect(res.status).toBe(200);
    const data = await res.json();

    // Setup darf NICHT aufpoppen, wenn schon eine aktive Veranstaltung läuft
    expect(data.needsSetup).toBe(false);
    expect(data.initialPinSet).toBe(true);

    // Selbstheilung in der DB prüfen
    const updatedConfig = await prisma.eventConfig.findUnique({ where: { id: 'default' } });
    expect(updatedConfig?.initialPinSet).toBe(true);
  });

  it('3. GET /api/config/public meldet needsSetup=true, wenn keine Daten existieren und initialPinSet=false ist (z. B. nach Reset)', async () => {
    await prisma.eventConfig.update({
      where: { id: 'default' },
      data: { initialPinSet: false },
    });

    // Keine aktiven Daten vorhanden (frische Installation oder nach Reset)
    vi.spyOn(authPin, 'hasActiveEventData').mockResolvedValue(false);

    const res = await getPublicConfig();
    expect(res.status).toBe(200);
    const data = await res.json();

    // Erst jetzt darf der Setup-Assistent starten!
    expect(data.needsSetup).toBe(true);
    expect(data.initialPinSet).toBe(false);
  });

  it('4. POST /api/auth/initial-setup lehnt Aufrufe ab (403), wenn Einrichtung bereits abgeschlossen ist', async () => {
    await prisma.eventConfig.update({
      where: { id: 'default' },
      data: { initialPinSet: true },
    });

    const req = new Request('http://localhost:3000/api/auth/initial-setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        adminPin: '849201',
        posPin: '528194',
        kitchenPin: '318274',
        waiterPin: '947182',
      }),
    });

    const res = await postInitialSetup(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain('bereits abgeschlossen');
  });

  it('5. POST /api/auth/initial-setup validiert PIN-Länge, Trivialität und Duplikate', async () => {
    await prisma.eventConfig.update({
      where: { id: 'default' },
      data: { initialPinSet: false },
    });
    vi.spyOn(authPin, 'hasActiveEventData').mockResolvedValue(false);

    // Zu kurz (<6 Ziffern)
    let req = new Request('http://localhost:3000/api/auth/initial-setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        adminPin: '1234',
        posPin: '528194',
        kitchenPin: '318274',
        waiterPin: '947182',
      }),
    });
    let res = await postInitialSetup(req);
    expect(res.status).toBe(400);

    // Triviale Folge (123456)
    req = new Request('http://localhost:3000/api/auth/initial-setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        adminPin: '123456',
        posPin: '528194',
        kitchenPin: '318274',
        waiterPin: '947182',
      }),
    });
    res = await postInitialSetup(req);
    expect(res.status).toBe(400);

    // Alle gleich
    req = new Request('http://localhost:3000/api/auth/initial-setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        adminPin: '849201',
        posPin: '849201',
        kitchenPin: '849201',
        waiterPin: '849201',
      }),
    });
    res = await postInitialSetup(req);
    expect(res.status).toBe(400);
  });

  it('6. POST /api/auth/initial-setup speichert PINs, Event-Daten und gibt sofort ein ADMIN-Session-Cookie zurück', async () => {
    await prisma.eventConfig.update({
      where: { id: 'default' },
      data: { initialPinSet: false },
    });
    vi.spyOn(authPin, 'hasActiveEventData').mockResolvedValue(false);

    const req = new Request('http://localhost:3000/api/auth/initial-setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        adminPin: '849201',
        posPin: '528194',
        kitchenPin: '318274',
        waiterPin: '947182',
        eventName: 'Frühlingsfest 2026',
        organizer: 'Sportverein Musterhausen',
        enableTax: true,
        enableVirtualPrinters: true,
      }),
    });

    const res = await postInitialSetup(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);

    // Event-Konfiguration verifizieren
    const updatedConfig = await prisma.eventConfig.findUnique({ where: { id: 'default' } });
    expect(updatedConfig?.name).toBe('Frühlingsfest 2026');
    expect(updatedConfig?.receiptSubHeader).toBe('Sportverein Musterhausen');
    expect(updatedConfig?.enableTax).toBe(true);
    expect(updatedConfig?.enableVirtualPrinters).toBe(true);
    expect(updatedConfig?.initialPinSet).toBe(true);

    // Session-Cookie verifizieren: Der Benutzer wird sofort als ADMIN angemeldet!
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toBeDefined();
    expect(setCookie).toContain(SESSION_LEGACY_COOKIE_NAME);

    // Token überprüfen (aus JSON oder Cookie)
    expect(data.token).toBeDefined();
    const session = await verifySessionToken(data.token);
    expect(session).not.toBeNull();
    expect(session?.role).toBe('ADMIN');
  });
});
