import type { Metadata, Viewport } from 'next';
import { Inter, Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { SocketProvider } from '@/components/providers/socket-provider';
import { ThemeProvider } from '@/components/providers/theme-provider';
import Navbar from '@/components/navigation/navbar';
import TrainingWatermark from '@/components/ui/training-watermark';

// Spec 3.3: Fliesstext & Labels = Inter (500/600)
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

// Spec 3.3: Ueberschriften & Buttons = Plus Jakarta Sans (700-900)
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
});

// Spec 3.3: Betraege, Zaehler & Bestellnummern = JetBrains Mono (800)
const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700', '800'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'OpenBon - Kassensystem (v0.2.1)',
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
    <html
      lang="de"
      className={`dark h-full ${inter.variable} ${jakarta.variable} ${jetbrains.variable}`}
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
            `,
          }}
        />
      </head>
      <body className="font-sans min-h-full flex flex-col bg-slate-950 text-slate-100 antialiased transition-colors duration-200">
        <ThemeProvider>
          <SocketProvider>
            <Navbar />
            <TrainingWatermark />
            <main className="flex-1 flex flex-col overflow-hidden">{children}</main>
          </SocketProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
