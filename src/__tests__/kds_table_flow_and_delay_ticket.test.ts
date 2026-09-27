import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ALLOWED_CONFIG_FIELDS, CONFIG_BOOLEAN_FIELDS, sanitizeConfigInput } from '../lib/config-whitelist';
import { EscPosBuilder } from '../lib/printer/escpos-builder';

// Mock dependencies for API testing
vi.mock('@/lib/db', () => {
  const mockConfig = {
    id: 'default',
    name: 'Vereinsfest 2026',
    kdsControlsPrinting: false,
    kdsPrintDelayTicket: true,
  };

  const mockOrderItems: any[] = [];
  const mockOrders: any[] = [];

  return {
    default: {
      eventConfig: {
        findUnique: vi.fn().mockImplementation(() => Promise.resolve({ ...mockConfig })),
        update: vi.fn().mockImplementation(({ data }: any) => {
          Object.assign(mockConfig, data);
          return Promise.resolve({ ...mockConfig });
        }),
      },
      orderItem: {
        findMany: vi.fn().mockImplementation(({ where }: any) => {
          if (where?.id?.in) {
            return Promise.resolve(mockOrderItems.filter((i) => where.id.in.includes(i.id)));
          }
          return Promise.resolve(mockOrderItems);
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn().mockImplementation(({ where, data }: any) => {
          const found = mockOrderItems.find((i) => i.id === where.id);
          if (found) Object.assign(found, data);
          return Promise.resolve(found || data);
        }),
        count: vi.fn().mockResolvedValue(0),
      },
      order: {
        findMany: vi.fn().mockResolvedValue(mockOrders),
        update: vi.fn().mockResolvedValue({ id: 'ord_1', status: 'COMPLETED' }),
      },
      product: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      printJob: {
        create: vi.fn().mockResolvedValue({ id: 'job_1' }),
      },
      printer: {
        update: vi.fn().mockResolvedValue({ id: 'prn_1' }),
      },
    },
  };
});

vi.mock('@/lib/api-guard', () => ({
  requireApiAuth: vi.fn().mockResolvedValue({
    ok: true,
    session: { role: 'KITCHEN', waiterName: 'Kueche-1' },
  }),
}));

vi.mock('@/lib/action-logger', () => ({
  logSystemActionSafe: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/printer/ticket-splitter', () => ({
  TicketSplitter: {
    routeAndPrintOrder: vi.fn().mockResolvedValue({
      ticketsGenerated: 1,
      printedItemIds: ['item_1'],
      ticketsQueued: 1,
      jobIds: ['job_1'],
      queuedItemIds: ['item_1'],
    }),
  },
}));

vi.mock('@/lib/printer/network-spooler', () => ({
  default: {
    sendRawBuffer: vi.fn().mockResolvedValue({ success: true, isVirtual: true }),
    printTicket: vi.fn().mockResolvedValue({ success: true, isVirtual: true, jobId: 'job_1' }),
  },
}));

describe('KDS Küchenmonitor: Table-Flow, Print Control & Warte-Bon (v0.4.67)', () => {
  describe('1. Configuration & Whitelist', () => {
    it('should include kdsControlsPrinting and kdsPrintDelayTicket in ALLOWED_CONFIG_FIELDS', () => {
      expect(ALLOWED_CONFIG_FIELDS).toContain('kdsControlsPrinting');
      expect(ALLOWED_CONFIG_FIELDS).toContain('kdsPrintDelayTicket');
    });

    it('should include kdsControlsPrinting and kdsPrintDelayTicket in CONFIG_BOOLEAN_FIELDS', () => {
      expect(CONFIG_BOOLEAN_FIELDS.has('kdsControlsPrinting')).toBe(true);
      expect(CONFIG_BOOLEAN_FIELDS.has('kdsPrintDelayTicket')).toBe(true);
    });

    it('should sanitize boolean inputs correctly', () => {
      const sanitized = sanitizeConfigInput({
        kdsControlsPrinting: 'true',
        kdsPrintDelayTicket: false,
      });
      expect(sanitized.kdsControlsPrinting).toBe(true);
      expect(sanitized.kdsPrintDelayTicket).toBe(false);
    });
  });

  describe('2. Compact Warte-Bon ESC/POS Generator', () => {
    it('should format a compact delay notice ticket correctly', () => {
      const ticket = EscPosBuilder.buildDelayNoticeTicket(
        {
          tableLabel: '4',
          waiterName: 'Anna',
          orderNumber: 42,
          createdAt: new Date('2026-09-27T14:30:00Z'),
          items: [
            {
              name: 'Kaiserschmarrn',
              quantity: 1,
              variantName: 'mit Apfelmus',
              options: ['extra Rosinen'],
              customizationText: 'Bitte heiß servieren',
            },
          ],
        },
        80
      );

      expect(ticket.rawBuffer).toBeInstanceOf(Buffer);
      expect(ticket.textRepresentation).toContain('* HINWEIS: DAUERT LAENGER *');
      expect(ticket.textRepresentation).toContain('Tisch 4');
      expect(ticket.textRepresentation).toContain('Anna');
      expect(ticket.textRepresentation).toContain('1x Kaiserschmarrn (mit Apfelmus)');
      expect(ticket.textRepresentation).toContain('+ extra Rosinen');
      expect(ticket.textRepresentation).toContain('! Bitte heiß servieren');
      expect(ticket.textRepresentation).toContain('Speise folgt in Kuerze nach!');
      // Papiersparend: Bonlänge soll kompakt bleiben
      expect(ticket.lengthMm).toBeGreaterThan(20);
      expect(ticket.lengthMm).toBeLessThan(95);
    });
  });

  describe('3. Table Grouping & FIFO Order (Oldest Table Far Right)', () => {
    it('should group orders by table and place the longest waiting table on the far right', () => {
      const now = Date.now();
      const mockOrders = [
        {
          id: 'ord_1',
          orderNumber: 101,
          table: { label: 'Tisch 1' },
          waiterName: 'Lisa',
          status: 'OPEN',
          createdAt: new Date(now - 30 * 60000).toISOString(), // 30 Min gewartet (ÄLTESTER)
          items: [
            { id: 'i1', productName: 'Schweinebraten', quantity: 2, kdsStatus: 'PENDING', isCancelled: false },
          ],
        },
        {
          id: 'ord_2',
          orderNumber: 102,
          table: { label: 'Tisch 2' },
          waiterName: 'Tom',
          status: 'OPEN',
          createdAt: new Date(now - 15 * 60000).toISOString(), // 15 Min gewartet
          items: [
            { id: 'i2', productName: 'Currywurst', quantity: 1, kdsStatus: 'PENDING', isCancelled: false },
          ],
        },
        {
          id: 'ord_3',
          orderNumber: 103,
          table: { label: 'Tisch 3' },
          waiterName: 'Max',
          status: 'OPEN',
          createdAt: new Date(now - 2 * 60000).toISOString(), // 2 Min gewartet (NEUESTER)
          items: [
            { id: 'i3', productName: 'Pommes', quantity: 1, kdsStatus: 'PENDING', isCancelled: false },
          ],
        },
      ];

      // Nachbildung der KDS-Gruppierung
      const map = new Map<string, any>();
      for (const order of mockOrders) {
        const tableKey = order.table.label;
        if (!map.has(tableKey)) {
          map.set(tableKey, {
            tableLabel: order.table.label,
            oldestTimestamp: new Date(order.createdAt).getTime(),
            items: [...order.items],
          });
        }
      }

      const tableList = Array.from(map.values());
      // Anforderung: "setze den tisch an dem die gäste am längsten warten nach ganz rechts"
      tableList.sort((a, b) => b.oldestTimestamp - a.oldestTimestamp);

      // Index 0 (ganz links) = Tisch 3 (neueste Bestellung, 2 Min)
      expect(tableList[0].tableLabel).toBe('Tisch 3');
      // Index 1 (Mitte) = Tisch 2 (15 Min)
      expect(tableList[1].tableLabel).toBe('Tisch 2');
      // Index 2 (ganz rechts) = Tisch 1 (älteste Bestellung, 30 Min)
      expect(tableList[2].tableLabel).toBe('Tisch 1');
    });

    it('should bundle multiple orders for the same table together', () => {
      const now = Date.now();
      const mockOrders = [
        {
          id: 'ord_a',
          orderNumber: 201,
          table: { label: 'Tisch 4' },
          waiterName: 'Lisa',
          status: 'OPEN',
          createdAt: new Date(now - 20 * 60000).toISOString(),
          items: [{ id: 'i1', productName: 'Bier 0.5l', quantity: 2, kdsStatus: 'PENDING' }],
        },
        {
          id: 'ord_b',
          orderNumber: 205,
          table: { label: 'Tisch 4' }, // Gleicher Tisch, Nachbestellung
          waiterName: 'Lisa',
          status: 'OPEN',
          createdAt: new Date(now - 5 * 60000).toISOString(),
          items: [{ id: 'i2', productName: 'Kaiserschmarrn', quantity: 1, kdsStatus: 'PENDING' }],
        },
      ];

      const map = new Map<string, any>();
      for (const order of mockOrders) {
        const tableKey = order.table.label;
        if (!map.has(tableKey)) {
          map.set(tableKey, {
            tableLabel: order.table.label,
            oldestTimestamp: new Date(order.createdAt).getTime(),
            items: [],
          });
        }
        const grp = map.get(tableKey)!;
        grp.items.push(...order.items);
      }

      const groups = Array.from(map.values());
      expect(groups.length).toBe(1);
      expect(groups[0].tableLabel).toBe('Tisch 4');
      expect(groups[0].items.length).toBe(2);
    });
  });

  describe('4. API /api/kds/mode', () => {
    it('should retrieve and update kds print mode', async () => {
      const { GET, POST } = await import('../app/api/kds/mode/route');

      // GET
      const getReq = new Request('http://localhost:3000/api/kds/mode');
      const getRes = await GET(getReq);
      expect(getRes.status).toBe(200);
      const getData = await getRes.json();
      expect(getData).toHaveProperty('kdsControlsPrinting');
      expect(getData).toHaveProperty('kdsPrintDelayTicket');

      // POST: Toggle kdsControlsPrinting to true
      const postReq = new Request('http://localhost:3000/api/kds/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kdsControlsPrinting: true, kdsPrintDelayTicket: true }),
      });
      const postRes = await POST(postReq);
      expect(postRes.status).toBe(200);
      const postData = await postRes.json();
      expect(postData.success).toBe(true);
      expect(postData.kdsControlsPrinting).toBe(true);
    });
  });

  describe('5. API /api/kds/print', () => {
    it('should validate empty item list', async () => {
      const { POST } = await import('../app/api/kds/print/route');
      const req = new Request('http://localhost:3000/api/kds/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds: [] }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('Keine Artikel');
    });
  });
});
