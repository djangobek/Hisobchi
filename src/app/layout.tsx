import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import MaintenanceBanner from "@/components/maintenance-banner";
import { I18nProvider } from "@/lib/i18n-client";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Hisobchi — shaxsiy moliya",
  description: "Daromad, xarajat va qarzlaringizni bir joyda boshqaring.",
  applicationName: "Hisobchi",
  // iOS: "Bosh ekranga qo'shish"dan keyin Safari paneli yo'q, to'liq ekran
  appleWebApp: { capable: true, title: "Hisobchi", statusBarStyle: "black-translucent" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  formatDetection: { telephone: false },
  other: { "mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#050816",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="uz" className={inter.variable}>
      <body>
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
        <I18nProvider>
          <MaintenanceBanner />
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
