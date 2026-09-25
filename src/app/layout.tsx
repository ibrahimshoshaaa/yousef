import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Perfume ERP",
  description: "Shopify-connected perfume business management dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
