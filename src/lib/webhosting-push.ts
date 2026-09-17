import fs from 'fs';
import path from 'path';
import { isExternalBridgeUrl } from './digital-receipt-url';
export { isExternalBridgeUrl };

/**
 * Asynchrone Beleg-Übertragung an die externe Webhosting-Brücke.
 *
 * Sendet E-Bons über eine ausgehende HTTP-Verbindung an das Webhosting,
 * sodass Gäste ihren Beleg auch über Mobilfunk (LTE/5G) aufrufen können.
 * Läuft vollständig im Hintergrund ohne den Kassiervorgang zu blockieren.
 */

export interface PushReceiptPayload {
  code: string;
  payment: any;
  eventName?: string;
}

export function pushReceiptToWebhostingAsync(
  payload: PushReceiptPayload,
  baseUrl: string | null | undefined,
  syncToken: string | null | undefined
): void {
  if (!isExternalBridgeUrl(baseUrl) || !payload.code) {
    return;
  }

  const cleanBase = (baseUrl || '').replace(/\/+$/, '');
  const targetUrl = `${cleanBase}/api.php?action=push_receipt`;
  const token = syncToken || '';

  // Im Hintergrund asynchron ausführen (ohne await im Hauptthread)
  Promise.resolve().then(async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s Timeout

      const res = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Bridge-Token': token,
        },
        body: JSON.stringify({
          code: payload.code,
          payment: payload.payment,
          eventName: payload.eventName || 'Vereinsfest',
          pushedAt: new Date().toISOString(),
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        console.warn(`[WEBHOSTING-PUSH] HTTP ${res.status} von ${targetUrl}`);
      }
    } catch (err: any) {
      // Bewusst nicht abstürzen – Kassenbetrieb im Festzelt hat immer Vorrang vor Internet
      console.warn(`[WEBHOSTING-PUSH] Hinweis: Beleg ${payload.code} konnte nicht an Webhosting gesendet werden (${err.message}).`);
    }
  });
}

/**
 * Überträgt die hinterlegte Speisekarte manuell oder automatisiert an die Webhosting-Brücke.
 */
export async function pushMenuToWebhosting(
  baseUrl: string,
  syncToken: string,
  eventName?: string,
  expiresAt?: number | null
): Promise<{ success: boolean; message: string }> {
  if (!isExternalBridgeUrl(baseUrl)) {
    return { success: false, message: 'Keine gültige externe Webhosting-Adresse (https://...) hinterlegt.' };
  }

  const cleanBase = baseUrl.replace(/\/+$/, '');
  const targetUrl = `${cleanBase}/api.php?action=upload_menu`;

  const menuUploadDir = path.join(process.cwd(), 'public', 'uploads', 'menu');
  if (!fs.existsSync(menuUploadDir)) {
    return { success: false, message: 'Noch keine Speisekarte in OpenBon hochgeladen.' };
  }

  const files = fs.readdirSync(menuUploadDir);
  let menuFile: string | null = null;
  for (const f of files) {
    if (f.startsWith('menu.') || f.startsWith('speisekarte.')) {
      menuFile = f;
      break;
    }
  }

  if (!menuFile) {
    return { success: false, message: 'Keine Speisekarten-Datei (menu.pdf oder Bild) gefunden.' };
  }

  const filePath = path.join(menuUploadDir, menuFile);
  const fileBuf = fs.readFileSync(filePath);
  const blob = new Blob([fileBuf]);

  const formData = new FormData();
  formData.append('menu_file', blob, menuFile);
  if (eventName) {
    formData.append('eventName', eventName);
  }
  if (expiresAt && expiresAt > 0) {
    formData.append('expiresAt', String(Math.floor(expiresAt)));
  }

  try {
    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'X-Bridge-Token': syncToken || '',
      },
      body: formData,
    });

    if (res.ok) {
      return { success: true, message: 'Speisekarte wurde erfolgreich auf das Webhosting übertragen!' };
    } else {
      const errText = await res.text();
      return { success: false, message: `Server meldet Fehler ${res.status}: ${errText}` };
    }
  } catch (err: any) {
    return { success: false, message: `Verbindungsfehler: ${err.message}` };
  }
}
