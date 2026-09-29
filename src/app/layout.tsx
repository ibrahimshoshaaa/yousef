import type { Metadata } from "next";
import "./globals.css";
import { Suspense } from "react";
import { NavigationFeedback } from "@/components/NavigationFeedback";

export const metadata: Metadata = {
  title: "Auraic",
  description: "Auraic لإدارة الطلبات والمنتجات والمخزون",
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
