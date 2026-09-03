import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySessionToken, SESSION_COOKIE_NAME, SESSION_LEGACY_COOKIE_NAME } from '@/lib/auth-session';

export const dynamic = 'force-dynamic';

/**
 * Kryptografischer Admin-Gate: Umschliesst ALLE /admin/*-Seiten im
 * Node-Kontext und prueft die JWT-Signatur mit dem persistenten Secret.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = cookies();
  const token =
    cookieStore.get(SESSION_COOKIE_NAME)?.value ||
    cookieStore.get(SESSION_LEGACY_COOKIE_NAME)?.value;

  let session = null;
  if (token) {
    session = await verifySessionToken(token);
  }

  if (!session || session.role !== 'ADMIN') {
    const headerList = headers();
    const currentPath = headerList.get('x-invoke-path') || headerList.get('next-url') || '';
    const returnParam = currentPath && currentPath.startsWith('/admin') ? `&returnTo=${encodeURIComponent(currentPath)}` : '';
    redirect(`/?auth_required=admin${returnParam}`);
  }

  return <>{children}</>;
}
