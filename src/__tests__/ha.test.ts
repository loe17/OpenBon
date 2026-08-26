import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import prisma from '../lib/db';
import { HighAvailabilityService } from '../lib/ha/ha-service';

describe('High Availability & Replikation Engine', () => {
  beforeEach(async () => {
    await prisma.haLease.deleteMany().catch(() => {});
    await prisma.eventConfig.upsert({
      where: { id: 'default' },
      update: { haRole: 'PRIMARY' },
      create: { id: 'default', name: 'Test Event', haRole: 'PRIMARY' },
    }).catch(() => {});
  });

  afterEach(async () => {
    await prisma.haLease.deleteMany().catch(() => {});
  });

  it('should initialize with default PRIMARY role', async () => {
    const ha = new HighAvailabilityService();
    await ha.ready;
    expect(ha.getRole()).toBe('PRIMARY');
    ha.dispose();
  });

  it('should allow role switching', async () => {
    const ha = new HighAvailabilityService();
    await ha.ready;
    await ha.setRole('STANDBY');
    expect(ha.getRole()).toBe('STANDBY');

    // Lease freigeben, damit der Promote zum PRIMARY greifen kann
    await prisma.haLease.deleteMany().catch(() => {});
    await ha.setRole('PRIMARY');
    expect(ha.getRole()).toBe('PRIMARY');

    ha.dispose();
  });

  it('should fence a second node while the first holds a valid lease', async () => {
    const primaryNode = new HighAvailabilityService();
    await primaryNode.ready;
    const acquired = await primaryNode.setRole('PRIMARY');
    expect(acquired).toBe(true);
    expect(primaryNode.getRole()).toBe('PRIMARY');

    // Zweite Instanz (simulierter Standby im Split-Brain-Fall) darf nicht promovieren
    const rogueNode = new HighAvailabilityService();
    await rogueNode.ready;
    const promoted = await rogueNode.promoteToPrimary();
    expect(promoted).toBe(false);
    expect(rogueNode.getRole()).not.toBe('PRIMARY');

    // Solange die Lease gültig ist, bleibt der zweite Knoten STANDBY
    expect(rogueNode.getRole()).toBe('STANDBY');

    rogueNode.dispose();
    primaryNode.dispose();
  });
});
