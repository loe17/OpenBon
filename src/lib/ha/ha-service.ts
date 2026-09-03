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
  private currentRole: 'STANDALONE' | 'PRIMARY' | 'STANDBY' = (process.env.HA_ROLE as any) || 'STANDALONE';
  private partnerUrl: string = process.env.HA_PARTNER_URL || '';
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
        this.currentRole = (config.haRole as any) || 'STANDALONE';
        if (config.haPartnerUrl) this.partnerUrl = config.haPartnerUrl;
      }
    } catch {
      // DB not ready yet, keep env defaults
    }

    // STANDALONE ist der ressourcenschonende Standard: kein Hintergrundpolling
    if (this.currentRole === 'STANDALONE') {
      return;
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

    // Watcher laeuft nur in Cluster-Rollen: STANDBY ueberwacht den Primary,
    // PRIMARY erneuert seine Lease gegen Split-Brain.
    this.startHeartbeatWatcher();
  }

  public getRole(): 'STANDALONE' | 'PRIMARY' | 'STANDBY' {
    return this.currentRole;
  }

  /** N1: Aktuell wirksame Partner-URL (ENV oder DB-Konfiguration). */
  public getPartnerUrl(): string {
    return this.partnerUrl || '';
  }

  /**
   * N1: Maschinenlesbarer Herzschlag-/Lease-Zustand fuer Diagnose & UI -
   * ohne Geheimnisse, ohne Seiteneffekte.
   */
  public getHeartbeatInfo(): {
    role: 'STANDALONE' | 'PRIMARY' | 'STANDBY';
    partnerUrl: string;
    missedHeartbeats: number;
    instanceId: string;
  } {
    return {
      role: this.currentRole,
      partnerUrl: this.partnerUrl,
      missedHeartbeats: this.missedHeartbeats,
      instanceId: this.instanceId,
    };
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
  public async setRole(role: 'STANDALONE' | 'PRIMARY' | 'STANDBY'): Promise<boolean> {
    if (role === 'STANDALONE') {
      this.dispose();
      this.currentRole = 'STANDALONE';
      return true;
    }

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
   *
   * Verwendet statement-atomares updateMany() ohne Exception-Logging bei bestehender Lease.
   */
  private async acquireOrRenewLease(): Promise<boolean> {
    const now = new Date();
    const expiresAt = new Date(Date.now() + LEASE_TTL_MS);

    // 1. Zuerst atomar erneuern, wenn wir bereits Inhaber sind oder die Lease abgelaufen ist
    const claimed = await prisma.haLease.updateMany({
      where: {
        id: 'primary',
        OR: [{ holderId: this.instanceId }, { expiresAt: { lte: now } }],
      },
      data: { holderId: this.instanceId, expiresAt, updatedAt: now },
    });

    if (claimed.count === 1) {
      return true;
    }

    // 2. Falls noch gar kein Eintrag existiert (Erster Kaltstart), sauber anlegen via upsert
    try {
      const existing = await prisma.haLease.findUnique({ where: { id: 'primary' } });
      if (!existing) {
        await prisma.haLease.upsert({
          where: { id: 'primary' },
          create: { id: 'primary', holderId: this.instanceId, expiresAt },
          update: { holderId: this.instanceId, expiresAt, updatedAt: now },
        });
        return true;
      }
    } catch {
      // Falls paralleler Insert stattfindet
    }

    return false;
  }

  /** ISO-Ablauf der lokalen PRIMARY-Lease (für Partner-Check via /api/sync/heartbeat). */
  public async getLeaseExpiryIso(): Promise<string | null> {
    try {
      const lease = await prisma.haLease.findUnique({ where: { id: 'primary' } });
      return lease ? new Date(lease.expiresAt).toISOString() : null;
    } catch {
      return null;
    }
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
    if (this.currentRole === 'STANDALONE') return;
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

        if (this.currentRole !== 'STANDBY' || !this.partnerUrl) return;

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
      // Kalt-Standby als Standard: kein Auto-Promote ohne explizites Opt-in.
      // ENV hat Vorrang vor DB (Compose HA_AUTO_FAILOVER=0 wird nicht mehr von DB=true überstimmt).
      const envSet = process.env.HA_AUTO_FAILOVER;
      let autoFailover = envSet === '1';
      if (envSet === undefined || envSet === '') {
        try {
          const cfg = await prisma.eventConfig.findUnique({ where: { id: 'default' }, select: { haAutoFailover: true } });
          if (cfg) autoFailover = cfg.haAutoFailover === true;
        } catch {}
      }
      if (!autoFailover) {
        console.error('[HA FAILOVER] Auto-Promote deaktiviert (Kalt-Standby). Bitte manuell über Admin → HA übernehmen.');
        if (global.io) {
          global.io.emit('ha:manual_failover_required', { missed: this.missedHeartbeats });
        }
        return;
      }
      console.error(`[HA FAILOVER] Primaerserver ausgefallen! Befoerdere STANDBY zum PRIMARY MASTER!`);
      const promoted = await this.promoteToPrimary();
      if (!promoted) {
        console.error('[HA FAILOVER] Promotion blockiert – versuche es im nächsten Zyklus erneut.');
      }
    }
  }

  /**
   * Prüft beim Partner, ob dort noch ein lebender PRIMARY arbeitet.
   * Verhindert Split-Brain bei bloßer Langsamkeit statt Ausfall.
   */
  private async isPartnerStillPrimary(): Promise<boolean> {
    if (!this.partnerUrl) return false;
    try {
      const res = await fetch(`${this.partnerUrl}/api/sync/heartbeat`, {
        method: 'GET',
        headers: { 'X-HA-Secret': await getHaSyncSecret() },
        signal: AbortSignal.timeout(2000),
      });
      if (!res.ok) return false;
      const j = (await res.json()) as { role?: string; leaseExpiresAt?: string | null };
      if (String(j.role || '').toUpperCase() !== 'PRIMARY') return false;
      if (!j.leaseExpiresAt) return true; // meldet PRIMARY ohne Ablauf → vorsichtig bleiben
      return new Date(j.leaseExpiresAt).getTime() > Date.now();
    } catch {
      return false;
    }
  }

  /**
   * Befoerdert diese Instanz zum PRIMARY – nur mit erfolgreicher Lease-Übernahme
   * UND wenn der Partner nicht mehr als lebender PRIMARY meldet.
   */
  public async promoteToPrimary(): Promise<boolean> {
    try {
      if (await this.isPartnerStillPrimary()) {
        console.error('[HA] Promote verweigert: Partner meldet sich noch als lebender PRIMARY.');
        return false;
      }
    } catch {}
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

  // Pull latest SyncJournal entries from Primary (paginiert bis kein Rückstand)
  private async pullAndApplySyncDelta() {
    try {
      for (let page = 0; page < 20; page++) {
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
        if (newEntries.length === 0) return;

        for (const entry of newEntries) {
          // Apply journal entry to local DB
          await this.applyJournalEntry(entry);
        }
        if (newEntries.length < 100) return; // letzte Seite (Server-take:100)
      }
    } catch (err) {
      // Sync error
    }
  }

  private async applyJournalEntry(entry: SyncJournalEntry) {
    try {
      // M5.2 Sequenz-Fencing: Bereits vorhandene Journal-Einträge werden
      // NICHT erneut angewendet - das schützt vor Replays aelterer Deltas
      // und Doppel-Anwendung bei (seltenem) Pull-Overlap.
      // Divergenz (gleiche ID, anderer Inhalt = beide Seiten schrieben) wird
      // als Konflikt protokolliert statt still verworfen.
      const journalExists = await prisma.syncJournal.findUnique({
        where: { id: entry.id },
      });
      if (journalExists) {
        if (journalExists.payload !== entry.payload || journalExists.entityId !== entry.entityId) {
          console.error(
            `[HA-KONFLIKT] Journal-ID ${entry.id} existiert lokal mit anderem Inhalt (${journalExists.entityType}/${journalExists.entityId} vs. ${entry.entityType}/${entry.entityId}). Eigene Zeile behalten, Partner-Eintrag NICHT angewendet – bitte manuell prüfen.`
          );
          try {
            if (global.io) {
              global.io.emit('ha:conflict', { journalId: entry.id, entityType: entry.entityType, entityId: entry.entityId });
            }
          } catch {}
          try {
            const { logSystemActionSafe } = await import('../action-logger');
            await logSystemActionSafe(() => ({
              action: 'HA_CONFLICT',
              category: 'SYSTEM',
              actor: 'HA-Sync',
              details: `Journal-Konflikt ID ${entry.id}: lokal ${journalExists.entityType}/${journalExists.entityId}, Partner ${entry.entityType}/${entry.entityId}. Manuell prüfen!`,
            }));
          } catch {}
        }
        return;
      }

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

      // Synchronize entity state (inkl. Positionen, sonst leere Bons am Standby)
      if (entry.entityType === 'ORDER' && entry.operation === 'INSERT') {
        const items = Array.isArray(payload.items) ? payload.items : [];
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
            items: items.length
              ? {
                  create: items.map((i: Record<string, unknown>) => ({
                    id: typeof i.id === 'string' ? (i.id as string) : undefined,
                    productId: String(i.productId || ''),
                    productName: String(i.productName || ''),
                    quantity: Number(i.quantity || 1),
                    unitPriceCents: Number((i as { unitPriceCents?: unknown }).unitPriceCents ?? 0),
                    depositCents: Number((i as { depositCents?: unknown }).depositCents ?? 0),
                    taxRate: Number(i.taxRate ?? 19),
                    variantName: (i.variantName as string) ?? null,
                    selectedOptions: typeof i.selectedOptions === 'string' ? (i.selectedOptions as string) : JSON.stringify(i.selectedOptions ?? []),
                    customizationText: (i.customizationText as string) ?? null,
                    courseNumber: Number(i.courseNumber ?? 1),
                  })),
                }
              : undefined,
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
            totalGrossCents: payload.totalGrossCents ?? payload.totalGross ?? 0,
            totalNetCents: payload.totalNetCents ?? payload.totalNet ?? 0,
            totalTaxCents: payload.totalTaxCents ?? payload.totalTax ?? 0,
            totalDepositCents: payload.totalDepositCents ?? payload.totalDeposit ?? 0,
            returnDepositCents: payload.returnDepositCents ?? payload.returnDeposit ?? 0,
            discountAmountCents: payload.discountAmountCents ?? payload.discountAmount ?? 0,
            tipAmountCents: payload.tipAmountCents ?? payload.tipAmount ?? 0,
            givenAmountCents: payload.givenAmountCents ?? payload.givenAmount ?? 0,
            changeAmountCents: payload.changeAmountCents ?? payload.changeAmount ?? 0,
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
