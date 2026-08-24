import type { Server as SocketIOServer } from 'socket.io';
import type { VirtualTicketRecord } from '@/lib/printer/types';

/**
 * Spec 2: strikte Typisierung, keine `any`-Typen.
 * Diese Globals werden von `server.js` gesetzt und von den API-Routen genutzt.
 */
export interface ConnectedDeviceInfo {
  id: string;
  socketId: string;
  name: string;
  waiterName?: string;
  role: string;
  ipAddress: string;
  userAgent: string;
  batteryLevel: number;
  isCharging: boolean;
  status: string;
  connectedAt: string;
  lastSeenAt: string;
}

declare global {
  /* eslint-disable no-var */
  /** Socket.IO-Server-Instanz aus server.js */
  var io: SocketIOServer | undefined;
  /** In-Memory-Liste der verbundenen Geräte */
  var connectedDevices: Map<string, ConnectedDeviceInfo> | undefined;
  /** In-Memory-Historie der virtuellen Drucker */
  var virtualPrinterHistory: VirtualTicketRecord[] | undefined;
  /* eslint-enable no-var */

  /** Nicht-standardisierte Browser-APIs, die OpenBon optional nutzt */
  interface Navigator {
    getBattery?: () => Promise<{ level: number; charging: boolean }>;
  }
  interface Window {
    webkitAudioContext?: typeof AudioContext;
    MSStream?: unknown;
  }
}

export {};
