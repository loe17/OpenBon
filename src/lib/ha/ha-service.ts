import { randomUUID } from 'crypto';
import prisma from '../db';
import { getHaSyncSecret } from './ha-secret';

/** Ein Eintrag aus dem SyncJournal, wie ihn der Partner-Knoten liefert */
interface SyncJournalEntry {
  id: number;
  entityType: string;
  entityId: string;
  operation: string;
  payload: string;
  createdAt: string;
}

const LEASE_TTL_MS = 10000;

export class HighAvailabilityService {
  private static instance: HighAvailabilityService;
  private currentRole: 'PRIMARY' | 'STANDBY' = (process.env.HA_ROLE as 'PRIMARY' | 'STANDBY' | undefined) || 'PRIMARY';
  private partnerUrl: string = process.env.HA_PARTNER_URL || 'http://127.0.0.1:3001';
  private missedHeartbeats = 0;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  /** Eindeutige Instanz-ID fuer das Split-Brain-Fencing (Leader-Lease) */
  public readonly instanceId: string = randomUUID();
  /** Wird erfüllt, sobald Rollen-Ermittlung & Lease-Check beim Start abgeschlossen sind */
  public readonly ready: Promise<void>;

  constructor() {
    this.ready = this.initRole();
  }

  public static getInstance(): HighAvailabilityService {
    if (!HighAvailabilityService.instance) {
      HighAvailabilityService.instance = new HighAvailabilityService();
    }
    return HighAvailabilityService.instance;
  }

  private async initRole(): Promise<void> {
    try {
      const config = await prisma.eventConfig.findUnique({ where: { id: 'default' } });
      if (config) {
        this.currentRole = config.haRole as 'PRIMARY' | 'STANDBY';
        if (config.haPartnerUrl) this.partnerUrl = config.haPartnerUrl;
      }
    } catch {
      // DB not ready yet, keep env defaults
    }

    // Split-Brain-Schutz beim Start: Wenn ein anderer Knoten noch eine gueltige
    // Lease haelt, starten wir bewusst als STANDBY statt als zweiter PRIMARY.
    if (this.currentRole === 'PRIMARY') {
      const acquired = await this.acquireOrRenewLease().catch(() => false);
      if (!acquired) {
        console.warn(
          `[HA] Eine andere Instanz (${await this.getLeaseHolder()}) hält noch eine gültige PRIMARY-Lease. ` +
            `Diese Instanz startet sicherheitshalber als STANDBY.`
        );
        this.currentRole = 'STANDBY';
      }
    }

    // Watcher laeuft in beiden Rollen: STANDBY ueberwacht den Primary,
    // PRIMARY erneuert seine Lease gegen Split-Brain.
    this.startHeartbeatWatcher();
  }

  public getRole(): 'PRIMARY' | 'STANDBY' {
    return this.currentRole;
  }

  /**
   * Stoppt den Heartbeat-/Lease-Zyklus dieser Instanz (Shutdown / Tests).
   * Ohne Aufruf würde ein abgemeldeter PRIMARY seine Lease weiter erneuern.
   */
  public dispose(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Setzt die Rolle. Ein Wechsel zu PRIMARY erfordert eine gueltige Lease,
   * damit es im Netzwerk-Partitionsfall nie zwei schreibende Knoten gibt.
   */
  public async setRole(role: 'PRIMARY' | 'STANDBY'): Promise<boolean> {
    if (role === 'PRIMARY') {
      const acquired = await this.acquireOrRenewLease().catch(() => false);
      if (!acquired) {
        console.error('[HA] Promote zu PRIMARY abgelehnt: Lease wird von einer anderen Instanz gehalten.');
        return false;
      }
    }
    this.currentRole = role;
    this.startHeartbeatWatcher();
    return true;
  }

  /**
   * Holt oder erneuert die PRIMARY-Lease. Gibt false zurueck, wenn ein anderer,
   * noch lebender Knoten die Lease haelt (Split-Brain-Fencing).
   */
  private async acquireOrRenewLease(): Promise<boolean> {
    const now = new Date();
    const expiresAt = new Date(Date.now() + LEASE_TTL_MS);

    const existing = await prisma.haLease.findUnique({ where: { id: 'primary' } });

    if (existing && existing.holderId !== this.instanceId && existing.expiresAt > now) {
      return false; // fremde, noch gueltige Lease -> Fencing greift
    }

    await prisma.haLease.upsert({
      where: { id: 'primary' },
      update: { holderId: this.instanceId, expiresAt, updatedAt: now },
      create: { id: 'primary', holderId: this.instanceId, expiresAt },
    });
    return true;
  }

  private async getLeaseHolder(): Promise<string> {
    try {
      const lease = await prisma.haLease.findUnique({ where: { id: 'primary' } });
      return lease?.holderUrl || lease?.holderId || 'unbekannt';
    } catch {
      return 'unbekannt';
    }
  }

  // Record a transaction mutation to the Sync Journal
  public async logMutation(entityType: string, entityId: string, operation: 'INSERT' | 'UPDATE' | 'DELETE', payload: unknown) {
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

  // Heartbeat-Loop: STANDBY ueberwacht Primary & zieht Deltas, PRIMARY erneuert Lease
  private startHeartbeatWatcher() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);

    this.heartbeatInterval = setInterval(async () => {
      try {
        if (this.currentRole === 'PRIMARY') {
          // Lease regelmässig erneuern, damit der Partner beim Ausfall übernehmen darf
          await this.acquireOrRenewLease().catch((e) =>
            console.warn('[HA] Lease-Erneuerung fehlgeschlagen:', e instanceof Error ? e.message : e)
          );
          return;
        }

        if (this.currentRole !== 'STANDBY') return;

        const res = await fetch(`${this.partnerUrl}/api/sync/heartbeat`, {
          method: 'GET',
          headers: { 'X-HA-Secret': await getHaSyncSecret() },
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
        if (this.currentRole === 'STANDBY') {
          this.handleHeartbeatFailure();
        }
      }
    }, 2000);
  }

  private async handleHeartbeatFailure() {
    this.missedHeartbeats++;
    console.warn(`[HA STANDBY] Primary (${this.partnerUrl}) nicht erreichbar! Fehlversuche: ${this.missedHeartbeats}/3`);

    if (this.missedHeartbeats >= 3) {
      console.error(`[HA FAILOVER] Primaerserver ausgefallen! Befoerdere STANDBY zum PRIMARY MASTER!`);
      const promoted = await this.promoteToPrimary();
      if (!promoted) {
        console.error('[HA FAILOVER] Promotion blockiert – versuche es im nächsten Zyklus erneut.');
      }
    }
  }

  /**
   * Befoerdert diese Instanz zum PRIMARY – nur mit erfolgreicher Lease-Übernahme.
   */
  public async promoteToPrimary(): Promise<boolean> {
    let acquired = false;
    try {
      acquired = await this.acquireOrRenewLease();
    } catch (err) {
      console.error('[HA] Lease konnte nicht geprüft werden:', err);
      acquired = false;
    }

    if (!acquired) {
      console.error('[HA] Promote verweigert: andere Instanz hält noch eine gültige PRIMARY-Lease.');
      return false;
    }

    this.currentRole = 'PRIMARY';
    this.startHeartbeatWatcher(); // Lease-Renewal-Zweig aktivieren

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
    return true;
  }

  // Pull latest SyncJournal entries from Primary
  private async pullAndApplySyncDelta() {
    try {
      const lastLocalEntry = await prisma.syncJournal.findFirst({
        orderBy: { id: 'desc' },
      });
      const lastSeq = lastLocalEntry ? lastLocalEntry.id : 0;

      const res = await fetch(`${this.partnerUrl}/api/sync/pull?sinceSequence=${lastSeq}`, {
        headers: { 'X-HA-Secret': await getHaSyncSecret() },
      });
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

  private async applyJournalEntry(entry: SyncJournalEntry) {
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

// Lazy Singleton: Erst die erste Eigenschafts-Nutzung erzeugt die Instanz.
// Ein bloßer Import startet dadurch keinen Hintergrund-Watcher und keine
// Lease-Acquisition – wichtig für Tests und Serverless-Umgebungen.
let singletonInstance: HighAvailabilityService | null = null;

function getHaInstance(): HighAvailabilityService {
  if (!singletonInstance) {
    singletonInstance = new HighAvailabilityService();
  }
  return singletonInstance;
}

export const haService: HighAvailabilityService = new Proxy(
  {} as HighAvailabilityService,
  {
    get(_target, prop, receiver) {
      const value = Reflect.get(getHaInstance(), prop);
      return typeof value === 'function' ? value.bind(getHaInstance()) : value;
    },
    set(_target, prop, value) {
      (getHaInstance() as any)[prop] = value;
      return true;
    },
  }
);

export default haService;
