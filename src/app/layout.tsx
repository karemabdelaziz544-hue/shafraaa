import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ShopProvider } from '@/lib/store/shop-store';
import { AppShell } from '@/components/layout/app-shell';

export const metadata: Metadata = {
  title: 'محل شفرة | لوحة إدارة المحل',
  description: 'نظام إدارة محل التجزئة المتكامل في مصر - المالك: كريم',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#1e40af',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&family=Tajawal:wght@400;500;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-slate-50 font-cairo antialiased flex flex-col lg:flex-row">
        <ShopProvider>
          <AppShell>{children}</AppShell>
        </ShopProvider>
      </body>
    </html>
  );
}
