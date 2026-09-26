import type { Metadata } from "next";
import "./globals.css";
import { Suspense } from "react";
import { NavigationFeedback } from "@/components/NavigationFeedback";

export const metadata: Metadata = {
  title: "Perfume ERP",
  description: "Shopify-connected perfume business management dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body><Suspense fallback={null}><NavigationFeedback /></Suspense>{children}</body>
    </html>
  );
}
