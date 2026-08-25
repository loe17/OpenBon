import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth-session';

export const dynamic = 'force-dynamic';

/**
 * Kryptografischer Admin-Gate: Umschliesst ALLE /admin/*-Seiten im
 * Node-Kontext und prueft die JWT-Signatur mit dem persistenten Secret aus
 * der Datenbank. Die Edge-Middleware kann nur decodieren (kein DB-Zugriff);
 * dieser Layout-Gate stellt die tatsaechliche Zugriffskontrolle sicher.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  let session = null;
  if (token) {
    session = await verifySessionToken(token);
  }

  if (!session || session.role !== 'ADMIN') {
    redirect('/?auth_required=admin');
  }

  return <>{children}</>;
}
