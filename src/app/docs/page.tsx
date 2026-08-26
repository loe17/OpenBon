import { redirect } from 'next/navigation';

/**
 * Das Handbuch ist nur noch in der Administration einsehbar.
 * Dieser Pfad bleibt als Weiterleitung erhalten, damit gespeicherte
 * Lesezeichen und Verweise aus aelteren Fassungen weiter funktionieren.
 * Die Zugriffsschranke prueft anschliessend die Administrator-Rolle.
 */
export default function DocsRedirectPage() {
  redirect('/admin/docs');
}
