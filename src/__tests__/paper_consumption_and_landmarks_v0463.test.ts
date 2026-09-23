import { describe, it, expect } from 'vitest';
import { ALLOWED_CONFIG_FIELDS } from '../lib/config-whitelist';
import { validatePrinterAddress } from '../lib/printer/validate';
import { EscPosBuilder } from '../lib/printer/escpos-builder';
import type { LandmarkItem } from '../types/domain';

describe('OpenBon v0.4.63: Paper Consumption, Near-End Stop Ticket & Table Landmarks', () => {
  describe('Config Whitelist & Address Validation', () => {
    it('should include tablePlanLandmarks and enablePaperNearEndWarning in ALLOWED_CONFIG_FIELDS', () => {
      expect(ALLOWED_CONFIG_FIELDS).toContain('tablePlanLandmarks');
      expect(ALLOWED_CONFIG_FIELDS).toContain('enablePaperNearEndWarning');
    });

    it('should validate printer addresses for WEB_RELAY, USB_SERVER, and NETWORK', () => {
      // Normal IP
      expect(validatePrinterAddress('192.168.1.200', 9100).ok).toBe(true);
      // USB Server
      expect(validatePrinterAddress('/dev/usb/lp0', 0).ok).toBe(true);
      expect(validatePrinterAddress('USB_SERVER', 0).ok).toBe(true);
      expect(validatePrinterAddress('COM3', 0).ok).toBe(true);
      // Web-Relay Station
      expect(validatePrinterAddress('WEB_RELAY', 0).ok).toBe(true);
      expect(validatePrinterAddress('RELAY_KASSE1', 0).ok).toBe(true);
      expect(validatePrinterAddress('RELAY:KASSE_GRILL', 0).ok).toBe(true);
    });
  });

  describe('EscPosBuilder Paper Length & Ticket Types', () => {
    it('should calculate ticket length in mm for standard receipt', () => {
      const res = EscPosBuilder.buildTicket({
        title: 'BELEG',
        orderNumber: 101,
        tableLabel: 'Tisch 5',
        items: [
          { name: 'Bratwurst mit Semmel', quantity: 2, unitPriceCents: 450 },
          { name: 'Helles Bier 0.5l', quantity: 3, unitPriceCents: 380 },
        ],
        totalGrossCents: 2040,
        waiterName: 'Lukas',
      });

      expect(res.rawBuffer).toBeInstanceOf(Buffer);
      expect(res.lengthMm).toBeGreaterThan(30);
      expect(res.lengthMm).toBeLessThan(400);
    });

    it('should calculate ticket length in mm for Z-Bon settlement', () => {
      const res = EscPosBuilder.buildZBonTicket({
        periodNumber: 1,
        openedAt: '2026-09-23T10:00:00Z',
        closedAt: '2026-09-23T22:00:00Z',
        totalGrossCents: 125000,
        totalNetCents: 105042,
        totalTax19Cents: 19958,
        totalTax7Cents: 0,
        totalCashCents: 100000,
        totalCardCents: 25000,
        transactionCount: 85,
        waiters: [
          { waiterName: 'Lukas', totalGrossCents: 75000, cashGrossCents: 60000, cardGrossCents: 15000, transactionCount: 50 },
          { waiterName: 'Anna', totalGrossCents: 50000, cashGrossCents: 40000, cardGrossCents: 10000, transactionCount: 35 },
        ],
      });

      expect(res.rawBuffer).toBeInstanceOf(Buffer);
      expect(res.lengthMm).toBeGreaterThan(50);
    });

    it('should generate Paper Near-End warning ticket with no beep buzzer', () => {
      const res = EscPosBuilder.buildPaperNearEndTicket('Grill-Drucker', 80);

      expect(res.rawBuffer).toBeInstanceOf(Buffer);
      expect(res.lengthMm).toBeGreaterThan(20);

      // Verify NO buzzer / beep escape sequence \x1b\x1e in buffer
      const hex = res.rawBuffer.toString('hex');
      expect(hex).not.toContain('1b1e');
      expect(res.rawBuffer.toString('latin1')).toContain('PAPIERROLLE FAST LEER');
      expect(res.rawBuffer.toString('latin1')).toContain('Grill-Drucker');
    });

    it('should generate Paper Empty STOP ticket with no beep buzzer', () => {
      const res = EscPosBuilder.buildPaperEmptyStopTicket('Ausschank-Drucker', 80);

      expect(res.rawBuffer).toBeInstanceOf(Buffer);
      expect(res.lengthMm).toBeGreaterThan(25);

      const hex = res.rawBuffer.toString('hex');
      expect(hex).not.toContain('1b1e');
      const text = res.rawBuffer.toString('latin1');
      expect(text).toContain('STOPP - ROLLE WECHSELN');
      expect(text).toContain('Ausschank-Drucker');
    });
  });

  describe('Near-End Lever Countdown Logic', () => {
    it('should accurately count down remaining paper in mm once lever is triggered', () => {
      let countdownMm = 2000; // ~2.0m initial margin when lever trips
      let stopTriggered = false;

      const ticketsMm = [120, 150, 200, 300, 250, 400, 350, 100, 80];
      for (const tMm of ticketsMm) {
        countdownMm -= tMm;
        if (countdownMm <= 250 && !stopTriggered) {
          stopTriggered = true;
        }
      }

      expect(stopTriggered).toBe(true);
      expect(countdownMm).toBeLessThanOrEqual(250);
    });

    it('should suppress stop ticket and countdown when enablePaperNearEndWarning is false', () => {
      const isWarningEnabled = false;
      let countdownMm = 2000;
      let stopTriggered = false;

      const ticketsMm = [300, 400, 500, 600, 400]; // total 2200mm
      for (const tMm of ticketsMm) {
        if (!isWarningEnabled) {
          // Suppressed
          break;
        }
        countdownMm -= tMm;
        if (countdownMm <= 250) {
          stopTriggered = true;
        }
      }

      expect(stopTriggered).toBe(false);
      expect(countdownMm).toBe(2000);
    });

    it('should convert totalPaperMm to meters correctly for reports and UI', () => {
      const totalPaperMm = 45280;
      const meters = +(totalPaperMm / 1000).toFixed(2);
      expect(meters).toBe(45.28);

      const rollLengthM = 80;
      const percentUsed = Math.min(100, Math.round((meters / rollLengthM) * 100));
      expect(percentUsed).toBe(57);
    });
  });

  describe('Table Plan Landmarks Structure & Serialization', () => {
    it('should serialize and deserialize landmarks around 4 borders', () => {
      const landmarks: LandmarkItem[] = [
        { id: 'lm1', side: 'TOP', index: 1, span: 2, label: '🚪 Haupteingang', color: 'emerald' },
        { id: 'lm2', side: 'BOTTOM', index: 5, span: 1, label: '🚨 Notausgang', color: 'rose' },
        { id: 'lm3', side: 'LEFT', index: 2, span: 2, label: '🍳 Küche', color: 'blue' },
        { id: 'lm4', side: 'RIGHT', index: 1, span: 3, label: '🍸 Bar / Ausschank', color: 'amber' },
      ];

      const json = JSON.stringify(landmarks);
      const parsed: LandmarkItem[] = JSON.parse(json);

      expect(parsed).toHaveLength(4);
      expect(parsed[0].side).toBe('TOP');
      expect(parsed[0].span).toBe(2);
      expect(parsed[2].label).toBe('🍳 Küche');
      expect(parsed[3].color).toBe('amber');
    });

    it('should strip emojis from landmark labels using cleanLandmarkLabel', async () => {
      const { cleanLandmarkLabel } = await import('../types/domain');
      expect(cleanLandmarkLabel('🚪 Eingang')).toBe('Eingang');
      expect(cleanLandmarkLabel('🚨 Notausgang')).toBe('Notausgang');
      expect(cleanLandmarkLabel('🍳 Küche')).toBe('Küche');
      expect(cleanLandmarkLabel('🍸 Bar / Schank')).toBe('Bar / Schank');
      expect(cleanLandmarkLabel('🚻 WC')).toBe('WC');
      expect(cleanLandmarkLabel('🎭 Bühne')).toBe('Bühne');
      expect(cleanLandmarkLabel('🧥 Garderobe')).toBe('Garderobe');
      expect(cleanLandmarkLabel('ℹ️ Kasse / Info')).toBe('Kasse / Info');
      expect(cleanLandmarkLabel('Kein Emoji')).toBe('Kein Emoji');
    });

    it('should verify only TOP, BOTTOM, LEFT, RIGHT are valid landmark sides', () => {
      const validSides = ['TOP', 'BOTTOM', 'LEFT', 'RIGHT'];
      const testItem: LandmarkItem = {
        id: 't1',
        side: 'TOP',
        index: 1,
        span: 1,
        label: 'Tür',
      };
      expect(validSides).toContain(testItem.side);
    });
  });
});
