import type { Metadata, Viewport } from 'next';
import './globals.css';
import { SocketProvider } from '@/components/providers/socket-provider';
import { ThemeProvider } from '@/components/providers/theme-provider';
import Navbar from '@/components/navigation/navbar';
import TrainingWatermark from '@/components/ui/training-watermark';
import OfflineBanner from '@/components/ui/offline-banner';
import HaBanner from '@/components/ui/ha-banner';
import UpdateNoticeBar from '@/components/ui/update-notice-bar';
import { BroadcastAlertOverlay } from '@/components/notifications/broadcast-alert-overlay';

export const metadata: Metadata = {
  title: 'OpenBon - Kassensystem',
  description: 'Offenes Kassen- und Bestellsystem für Vereinsfeste und Gastronomie',
  manifest: '/manifest.json',
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#020617',
};

import { ToastProvider } from '@/components/ui/toast';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="de"
      className="dark h-full font-sans"
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var theme = localStorage.getItem('openbon_theme');
                if (theme === 'light') {
                  document.documentElement.classList.remove('dark');
                  document.documentElement.classList.add('light');
                } else {
                  document.documentElement.classList.add('dark');
                  document.documentElement.classList.remove('light');
                }
              } catch (e) {}

              if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').catch(function() {});
                });
              }
            `,
          }}
        />
      </head>
      <body className="font-sans min-h-full flex flex-col bg-slate-950 text-slate-100 antialiased transition-colors duration-200">
        <ThemeProvider>
          <ToastProvider>
            <SocketProvider>
              <OfflineBanner />
              <HaBanner />
              <UpdateNoticeBar />
              <BroadcastAlertOverlay />
              <Navbar />
              <TrainingWatermark />
              <main className="flex-1 flex flex-col overflow-hidden">{children}</main>
            </SocketProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
