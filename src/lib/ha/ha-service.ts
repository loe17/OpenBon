import prisma from '../db';

export class HighAvailabilityService {
  private static instance: HighAvailabilityService;
  private currentRole: 'PRIMARY' | 'STANDBY' = (process.env.HA_ROLE as any) || 'PRIMARY';
  private partnerUrl: string = process.env.HA_PARTNER_URL || 'http://127.0.0.1:3001';
  private missedHeartbeats = 0;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initRole();
  }

  public static getInstance(): HighAvailabilityService {
    if (!HighAvailabilityService.instance) {
      HighAvailabilityService.instance = new HighAvailabilityService();
    }
    return HighAvailabilityService.instance;
  }

  private async initRole() {
    try {
      const config = await prisma.eventConfig.findUnique({ where: { id: 'default' } });
      if (config) {
        this.currentRole = config.haRole as 'PRIMARY' | 'STANDBY';
        if (config.haPartnerUrl) this.partnerUrl = config.haPartnerUrl;
      }
    } catch {
      // DB not ready yet, keep env defaults
    }

    if (this.currentRole === 'STANDBY') {
      this.startHeartbeatWatcher();
    }
  }

  public getRole(): 'PRIMARY' | 'STANDBY' {
    return this.currentRole;
  }

  public setRole(role: 'PRIMARY' | 'STANDBY') {
    this.currentRole = role;
    if (role === 'STANDBY') {
      this.startHeartbeatWatcher();
    } else {
      if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // Record a transaction mutation to the Sync Journal
  public async logMutation(entityType: string, entityId: string, operation: 'INSERT' | 'UPDATE' | 'DELETE', payload: any) {
    try {
      await prisma.syncJournal.create({
        data: {
          entityType,
          entityId,
          operation,
          payload: JSON.stringify(payload),
        },
      });
    } catch (e) {
      console.error('[HA] Fehler beim Schreiben des SyncJournals:', e);
    }
  }

  // Standby watcher that monitors Primary health
  private startHeartbeatWatcher() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);

    this.heartbeatInterval = setInterval(async () => {
      if (this.currentRole !== 'STANDBY') return;

      try {
        const res = await fetch(`${this.partnerUrl}/api/sync/heartbeat`, {
          method: 'GET',
          signal: AbortSignal.timeout(2000),
        });

        if (res.ok) {
          this.missedHeartbeats = 0;
          // Primary is healthy -> pull new sync delta logs
          await this.pullAndApplySyncDelta();
        } else {
          this.handleHeartbeatFailure();
        }
      } catch (err) {
        this.handleHeartbeatFailure();
      }
    }, 2000);
  }

  private async handleHeartbeatFailure() {
    this.missedHeartbeats++;
    console.warn(`[HA STANDBY] Primary (${this.partnerUrl}) nicht erreichbar! Fehlversuche: ${this.missedHeartbeats}/3`);

    if (this.missedHeartbeats >= 3) {
      console.error(`[HA FAILOVER] Primaerserver ausgefallen! Befoerdere STANDBY zum PRIMARY MASTER!`);
      await this.promoteToPrimary();
    }
  }

  public async promoteToPrimary() {
    this.currentRole = 'PRIMARY';
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    this.heartbeatInterval = null;

    try {
      await prisma.eventConfig.update({
        where: { id: 'default' },
        data: { haRole: 'PRIMARY' },
      });
    } catch (err) {
      console.error('Error saving role in DB:', err);
    }

    if (global.io) {
      global.io.emit('ha:role_changed', { role: 'PRIMARY' });
    }
  }

  // Pull latest SyncJournal entries from Primary
  private async pullAndApplySyncDelta() {
    try {
      const lastLocalEntry = await prisma.syncJournal.findFirst({
        orderBy: { id: 'desc' },
      });
      const lastSeq = lastLocalEntry ? lastLocalEntry.id : 0;

      const res = await fetch(`${this.partnerUrl}/api/sync/pull?sinceSequence=${lastSeq}`);
      if (!res.ok) return;

      const data = await res.json();
      const newEntries = data.entries || [];

      for (const entry of newEntries) {
        // Apply journal entry to local DB
        await this.applyJournalEntry(entry);
      }
    } catch (err) {
      // Sync error
    }
  }

  private async applyJournalEntry(entry: any) {
    try {
      const payload = JSON.parse(entry.payload);
      
      // Store in local SyncJournal so sequence stays matched
      await prisma.syncJournal.upsert({
        where: { id: entry.id },
        update: {},
        create: {
          id: entry.id,
          entityType: entry.entityType,
          entityId: entry.entityId,
          operation: entry.operation,
          payload: entry.payload,
          createdAt: new Date(entry.createdAt),
        },
      });

      // Synchronize entity state
      if (entry.entityType === 'ORDER' && entry.operation === 'INSERT') {
        await prisma.order.upsert({
          where: { id: payload.id },
          update: { status: payload.status },
          create: {
            id: payload.id,
            orderNumber: payload.orderNumber,
            tableId: payload.tableId,
            waiterName: payload.waiterName,
            status: payload.status,
            orderType: payload.orderType,
            tokenNumber: payload.tokenNumber,
            isTraining: payload.isTraining,
            createdAt: new Date(payload.createdAt),
          },
        });
      } else if (entry.entityType === 'PAYMENT' && entry.operation === 'INSERT') {
        await prisma.payment.upsert({
          where: { id: payload.id },
          update: {},
          create: {
            id: payload.id,
            invoiceNumber: payload.invoiceNumber,
            tableId: payload.tableId,
            waiterName: payload.waiterName,
            totalGross: payload.totalGross,
            totalNet: payload.totalNet,
            totalTax: payload.totalTax,
            totalDeposit: payload.totalDeposit,
            returnDeposit: payload.returnDeposit,
            discountAmount: payload.discountAmount,
            tipAmount: payload.tipAmount,
            givenAmount: payload.givenAmount,
            changeAmount: payload.changeAmount,
            paymentMethod: payload.paymentMethod,
            isCancelled: payload.isCancelled,
            isTraining: payload.isTraining,
            createdAt: new Date(payload.createdAt),
          },
        });
      }
    } catch (e) {
      // error applying sync
    }
  }
}

export const haService = HighAvailabilityService.getInstance();
export default haService;
