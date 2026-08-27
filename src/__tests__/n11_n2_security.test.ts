import { describe, it, expect } from 'vitest';
import {
  signCardCallback,
  verifyCardCallback,
} from '../lib/payment/callback-signature';
import {
  initiatePairing,
  checkPairingCode,
  finalizePairing,
  resetPendingPairings,
} from '../lib/ha/ha-pairing';
import { sanitizeConfigForBroadcast } from '../lib/config-sanitize';

describe('N2.1 Karten-Callback-Signatur', () => {
  it('verifiziert eine echte Signatur', async () => {
    const { ts, sig } = await signCardCallback({ orderId: 'ord-42', provider: 'sumup', status: 'success' });
    const result = await verifyCardCallback({ orderId: 'ord-42', status: 'success', ts, sig });
    expect(result.verified).toBe(true);
  });

  it('lehnt manipulierten Status ab', async () => {
    const { ts, sig } = await signCardCallback({ orderId: 'ord-42', provider: 'sumup', status: 'failed' });
    // Angreifer dreht failed -> success
    const result = await verifyCardCallback({ orderId: 'ord-42', status: 'success', ts, sig });
    expect(result.verified).toBe(false);
    expect(result.reason).toBe('BAD_SIGNATURE');
  });

  it('lehnt alte Rueckspruenge (>30 min) ab', async () => {
    const { sig } = await signCardCallback({ orderId: 'ord-7', status: 'success' });
    const oldTs = String(Date.now() - 31 * 60 * 1000);
    const result = await verifyCardCallback({ orderId: 'ord-7', status: 'success', ts: oldTs, sig });
    expect(result.verified).toBe(false);
    expect(result.reason).toBe('EXPIRED');
  });

  it('lehnt fehlende Parameter ab', async () => {
    const result = await verifyCardCallback({});
    expect(result.verified).toBe(false);
    expect(result.reason).toBe('MISSING_PARAMS');
  });
});

describe('N1 HA-Pairing-Bibliothek', () => {
  it('Code-Flow: falscher Code verbraucht Versuche, korrekter Code akzeptiert', () => {
    resetPendingPairings();
    const { pairId, code } = initiatePairing();

    // Falscher Code
    const wrong = checkPairingCode(code === '123456' ? '654321' : '123456');
    expect(wrong.ok).toBe(false);

    // Richtigere Eingabe muss dennoch funktionieren (Solange nicht gesperrt)
    const right = checkPairingCode(code);
    expect(right.ok).toBe(true);

    // Pending ist noch da -> FINALIZE kann das Secret anwenden
    const fin = finalizePairing(pairId);
    expect(fin.ok).toBe(true);
    if (fin.ok) {
      expect(fin.secret.length).toBeGreaterThanOrEqual(32); // hex(24 bytes)
    }
    // Nach Finalize kein Code mehr nutzbar
    const again = checkPairingCode(code);
    expect(again.ok).toBe(false);
    expect(again.error).toBe('NOT_FOUND');
  });

  it('FINALIZE ohne laufendes Pairing schlaegt sauber fehl', () => {
    const fin = finalizePairing('gibts-nicht');
    expect(fin.ok).toBe(false);
  });
});

describe('N1 Config-Broadcast - Rueckwaerkskompatibilitaet',
  () => {
    it('stellt normale Felder bereit und haelt Geheimnisse zurueck (Regression)', () => {
      const cleaned = sanitizeConfigForBroadcast({
        name: 'Fest',
        trainingMode: false,
        adminPin: '$pbkdf2$a$b',
        sessionSecret: 'geheim',
        stripeSecretKey: 'sk_test_1',
      });
      expect(cleaned.name).toBe('Fest');
      expect(cleaned.adminPin).toBeUndefined();
      expect(cleaned.sessionSecret).toBeUndefined();
      expect(cleaned.stripeSecretKey).toBeUndefined();
    });
  }
);
