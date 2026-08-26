import { redirect } from 'next/navigation';

/**
 * Die Schichtabrechnung liegt jetzt in der Administration (/admin/settle).
 *
 * Grund: Sie entscheidet ueber Bargeldabgabe und Trinkgeldverteilung - eine
 * Bedienung darf ihre eigene Schicht nicht abrechnen. Dieser Pfad bleibt als
 * Weiterleitung erhalten; die Zugriffsschranke verlangt anschliessend die
 * Administrator-Rolle.
 */
export default function WaiterSettleRedirectPage() {
  redirect('/admin/settle');
}
