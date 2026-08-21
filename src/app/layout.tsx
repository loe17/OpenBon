import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { SocketProvider } from '@/components/providers/socket-provider';
import { ThemeProvider } from '@/components/providers/theme-provider';
import Navbar from '@/components/navigation/navbar';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'OpenBon - Kassensystem (v0.1.0 Beta)',
  description: 'Offenes Kassen- und Bestellsystem für Vereinsfeste und Gastronomie',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#020617',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className="dark h-full">
      <body className={`${inter.className} min-h-full flex flex-col bg-slate-950 text-slate-100 antialiased`}>
        <ThemeProvider>
          <SocketProvider>
            <Navbar />
            <main className="flex-1 flex flex-col overflow-hidden">{children}</main>
          </SocketProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
