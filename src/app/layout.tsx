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
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#050816",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" className={inter.variable}>
      <head>
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
      </head>
      <body>
        <I18nProvider>
          <MaintenanceBanner />
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}