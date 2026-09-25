export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/auth";
import { requireAuth } from "@/lib/auth-helpers";

const nav = [
  ["لوحة التحكم", "/dashboard"],
  ["الطلبات", "/dashboard/orders"],
  ["المنتجات", "/dashboard/products"],
  ["المواد الخام", "/dashboard/materials"],
  ["المخزون", "/dashboard/inventory"],
  ["الاستهلاك", "/dashboard/consumption"],
  ["الوصفات", "/dashboard/recipes"],
  ["المرتجعات", "/dashboard/returns"],
  ["المصروفات", "/dashboard/expenses"],
  ["التقارير", "/dashboard/reports"],
  ["Shopify", "/dashboard/shopify"],
  ["الإعدادات", "/dashboard/settings"],
];

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  try { await requireAuth(); } catch { redirect("/login"); }
  return (
    <div className="min-h-screen md:flex">
      <aside className="w-full bg-[var(--sidebar)] text-white md:fixed md:right-0 md:top-0 md:h-screen md:w-64">
        <div className="border-b border-white/10 p-5">
          <div className="text-lg font-bold">Perfume ERP</div>
          <div className="mt-1 text-xs text-[var(--sidebar-muted)]">
            إدارة الأعمال والمخزون
          </div>
        </div>
        <nav className="grid grid-cols-2 gap-1 p-3 md:block">
          {nav.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className="rounded-lg px-3 py-2 text-sm text-gray-300 hover:bg-white/10 hover:text-white"
            >
              {label}
            </Link>
          ))}
        </nav>
        <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }} className="px-3"><button className="rounded px-3 py-2 text-sm text-gray-300 hover:text-white">تسجيل الخروج</button></form>
      </aside>

      <main className="min-h-screen w-full md:mr-64">
        {children}
      </main>
    </div>
  );
}
