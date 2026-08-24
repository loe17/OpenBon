import net from 'net';

/**
 * Spec 4.3.2: Ansteuerung stationaerer und mobiler Kartenterminals ueber das
 * ZVT-Protokoll (ZVT 700-Serie) via TCP/IP, Standardports 20007 / 20002 / 40007.
 *
 * Aufbau einer ZVT-APDU:
 *   [CCRC] [APRC] [LEN] [DATA...]
 * Beispiele:
 *   06 00  Registrierung (Kasse meldet sich am Terminal an)
 *   06 01  Autorisierung (Zahlung mit Betrag)
 *   06 0F  Abschluss / Zahlung erfolgt
 *   80 00  Positive Quittung (ACK)
 *   84 xx  Negative Quittung / Abbruch
 *   04 0F  Zwischenstatus des Terminals
 *
 * Die Builder- und Parser-Funktionen sind bewusst frei von Netzwerkcode,
 * damit sie in `src/__tests__/zvt.test.ts` ohne Hardware pruefbar sind.
 */

export const ZVT_CONTROL = {
  REGISTRATION: [0x06, 0x00],
  AUTHORISATION: [0x06, 0x01],
  END_OF_DAY: [0x06, 0x50],
  STATUS_ENQUIRY: [0x05, 0x01],
  COMPLETION: [0x06, 0x0f],
  ACK: [0x80, 0x00],
  NACK: [0x84, 0x00],
  INTERMEDIATE_STATUS: [0x04, 0x0f],
} as const;

/** Wandelt eine Zahl in eine BCD-Bytefolge fester Laenge (ZVT nutzt gepacktes BCD). */
export function toBcd(value: number, byteLength: number): Buffer {
  const digits = String(Math.round(value)).padStart(byteLength * 2, '0');
  if (digits.length > byteLength * 2) {
    throw new Error(`Wert ${value} passt nicht in ${byteLength} BCD-Bytes`);
  }
  const out = Buffer.alloc(byteLength);
  for (let i = 0; i < byteLength; i++) {
    const hi = Number(digits[i * 2]);
    const lo = Number(digits[i * 2 + 1]);
    out[i] = (hi << 4) | lo;
  }
  return out;
}

export function fromBcd(buf: Buffer): number {
  let s = '';
  for (const byte of buf) {
    s += ((byte >> 4) & 0x0f).toString();
    s += (byte & 0x0f).toString();
  }
  return Number(s);
}

/** Setzt eine vollstaendige APDU inkl. Laengenfeld zusammen. */
export function buildApdu(control: readonly number[], data: Buffer = Buffer.alloc(0)): Buffer {
  if (data.length > 254) {
    // Erweiterte Laenge: FF LL LL (little endian)
    const header = Buffer.from([control[0], control[1], 0xff, data.length & 0xff, (data.length >> 8) & 0xff]);
    return Buffer.concat([header, data]);
  }
  const header = Buffer.from([control[0], control[1], data.length]);
  return Buffer.concat([header, data]);
}

/**
 * 06 00 Registrierung: Passwort (3 Byte BCD), Konfigurationsbyte,
 * Waehrung (CC, 2 Byte BCD, 0978 = EUR).
 */
export function buildRegistration(password = '000000', configByte = 0xde): Buffer {
  const data = Buffer.concat([
    toBcd(Number(password), 3),
    Buffer.from([configByte]),
    Buffer.from([0x09, 0x78]),
  ]);
  return buildApdu(ZVT_CONTROL.REGISTRATION, data);
}

/**
 * 06 01 Autorisierung: Betrag als BCD in Cent (6 Byte, Tag 0x04)
 * plus optionale Belegnummer als TLV-freies ZVT-Bitmap-Feld (Tag 0x87).
 */
export function buildAuthorisation(amountCents: number, receiptNumber?: number): Buffer {
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    throw new Error('ZVT-Autorisierung benötigt einen positiven Betrag in Cent');
  }
  const parts: Buffer[] = [Buffer.from([0x04]), toBcd(amountCents, 6)];
  parts.push(Buffer.from([0x49]), Buffer.from([0x09, 0x78])); // Waehrung EUR
  if (receiptNumber !== undefined) {
    parts.push(Buffer.from([0x87]), toBcd(receiptNumber % 10000, 2));
  }
  return buildApdu(ZVT_CONTROL.AUTHORISATION, Buffer.concat(parts));
}

export function buildAck(): Buffer {
  return buildApdu(ZVT_CONTROL.ACK);
}

export interface ZvtFrame {
  control: [number, number];
  data: Buffer;
  /** Gesamtlaenge des Frames inkl. Header */
  totalLength: number;
}

/** Zerlegt einen Empfangspuffer in einzelne APDUs. Unvollstaendige Frames werden ignoriert. */
export function parseFrames(buffer: Buffer): ZvtFrame[] {
  const frames: ZvtFrame[] = [];
  let offset = 0;
  while (offset + 3 <= buffer.length) {
    const control: [number, number] = [buffer[offset], buffer[offset + 1]];
    let len = buffer[offset + 2];
    let headerLen = 3;
    if (len === 0xff) {
      if (offset + 5 > buffer.length) break;
      len = buffer[offset + 3] | (buffer[offset + 4] << 8);
      headerLen = 5;
    }
    if (offset + headerLen + len > buffer.length) break;
    frames.push({
      control,
      data: buffer.subarray(offset + headerLen, offset + headerLen + len),
      totalLength: headerLen + len,
    });
    offset += headerLen + len;
  }
  return frames;
}

export function isControl(frame: ZvtFrame, control: readonly number[]): boolean {
  return frame.control[0] === control[0] && frame.control[1] === control[1];
}

/** Liest den Autorisierungscode (Tag 0x60, 3 Byte BCD) aus einer Abschluss-APDU. */
export function extractAuthCode(data: Buffer): string | null {
  const idx = data.indexOf(0x60);
  if (idx === -1 || idx + 4 > data.length) return null;
  return String(fromBcd(data.subarray(idx + 1, idx + 4))).padStart(6, '0');
}

export interface ZvtTerminalConfig {
  host: string;
  port: number;
  password?: string;
  timeoutMs?: number;
}

export interface ZvtPaymentResult {
  success: boolean;
  authCode?: string;
  amountCents?: number;
  error?: string;
  /** Zwischenstatus-Meldungen des Terminals, hilfreich fuer die Diagnose */
  trace: string[];
}

/**
 * Fuehrt eine vollstaendige ZVT-Zahlung durch:
 * Registrierung -> Autorisierung -> Warten auf 06 0F (Zahlung erfolgt).
 */
export async function runZvtPayment(
  config: ZvtTerminalConfig,
  amountCents: number,
  receiptNumber?: number
): Promise<ZvtPaymentResult> {
  const trace: string[] = [];
  const timeoutMs = config.timeoutMs ?? 120000;

  return new Promise<ZvtPaymentResult>((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    let rx = Buffer.alloc(0);
    let authorisationSent = false;

    const finish = (result: ZvtPaymentResult) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve({ ...result, trace });
    };

    const overallTimer = setTimeout(() => {
      finish({ success: false, error: 'Zeitüberschreitung am Kartenterminal', trace });
    }, timeoutMs);
    overallTimer.unref?.();

    socket.setTimeout(timeoutMs);

    socket.connect(config.port, config.host, () => {
      trace.push(`Verbunden mit ${config.host}:${config.port}`);
      socket.write(buildRegistration(config.password ?? '000000'));
      trace.push('06 00 Registrierung gesendet');
    });

    socket.on('data', (chunk) => {
      rx = Buffer.concat([rx, chunk]);
      const frames = parseFrames(rx);
      let consumed = 0;
      for (const frame of frames) {
        consumed += frame.totalLength;
        const hex = `${frame.control[0].toString(16).padStart(2, '0')} ${frame.control[1]
          .toString(16)
          .padStart(2, '0')}`;

        if (isControl(frame, ZVT_CONTROL.ACK)) {
          trace.push(`${hex} ACK`);
          if (!authorisationSent) {
            authorisationSent = true;
            socket.write(buildAuthorisation(amountCents, receiptNumber));
            trace.push(`06 01 Autorisierung über ${(amountCents / 100).toFixed(2)} EUR gesendet`);
          }
          continue;
        }

        if (isControl(frame, ZVT_CONTROL.INTERMEDIATE_STATUS)) {
          trace.push(`${hex} Zwischenstatus`);
          socket.write(buildAck());
          continue;
        }

        if (isControl(frame, ZVT_CONTROL.COMPLETION)) {
          trace.push(`${hex} Zahlung erfolgt`);
          socket.write(buildAck());
          clearTimeout(overallTimer);
          finish({
            success: true,
            authCode: extractAuthCode(frame.data) ?? undefined,
            amountCents,
            trace,
          });
          return;
        }

        if (frame.control[0] === 0x84) {
          trace.push(`${hex} Negative Quittung / Abbruch`);
          clearTimeout(overallTimer);
          finish({ success: false, error: 'Zahlung am Terminal abgebrochen', trace });
          return;
        }

        trace.push(`${hex} (unbehandelt)`);
        socket.write(buildAck());
      }
      rx = rx.subarray(consumed);
    });

    socket.on('timeout', () => {
      clearTimeout(overallTimer);
      finish({ success: false, error: 'Terminal antwortet nicht (Timeout)', trace });
    });

    socket.on('error', (err: Error) => {
      clearTimeout(overallTimer);
      finish({ success: false, error: err instanceof Error ? err.message : String(err), trace });
    });
  });
}

/** Prueft, ob das Terminal erreichbar ist (fuer die Selbstdiagnose). */
export async function probeZvtTerminal(config: ZvtTerminalConfig): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(config.timeoutMs ?? 2500);
    const done = (ok: boolean) => {
      socket.destroy();
      resolve(ok);
    };
    socket.connect(config.port, config.host, () => done(true));
    socket.on('error', () => done(false));
    socket.on('timeout', () => done(false));
  });
}
