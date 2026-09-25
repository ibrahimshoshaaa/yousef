export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/auth";
import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";

const nav = [
  { label: "لوحة التحكم", href: "/dashboard", mark: "▦" },
  { label: "الطلبات", href: "/dashboard/orders", mark: "◫" },
  { label: "المنتجات", href: "/dashboard/products", mark: "◇" },
  { label: "المواد الخام", href: "/dashboard/materials", mark: "◈" },
  { label: "المخزون", href: "/dashboard/inventory", mark: "▤" },
  { label: "الاستهلاك", href: "/dashboard/consumption", mark: "◉" },
  { label: "الوصفات", href: "/dashboard/recipes", mark: "✧" },
  { label: "المرتجعات", href: "/dashboard/returns", mark: "↶" },
  { label: "المصروفات", href: "/dashboard/expenses", mark: "◌" },
  { label: "التقارير", href: "/dashboard/reports", mark: "▥" },
  { label: "الإعدادات", href: "/dashboard/settings", mark: "⚙" },
];

function NavLinks() {
  return (
    <nav aria-label="التنقل الرئيسي" className="grid gap-1 p-3">
      {nav.map(({ label, href, mark }) => (
        <Link key={href} href={href} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white focus-visible:bg-white/10 focus-visible:outline-none">
          <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/5 text-lg text-[#d6b978]">{mark}</span>
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  let session;
  try { session = await requireAuth(); } catch { redirect("/login"); }
  const store = await db.store.findUnique({ where: { id: session.storeId }, select: { name: true } });
  const storeName = store?.name ?? "متجري";

  const logout = async () => {
    "use server";
    await signOut({ redirectTo: "/login" });
  };

  return (
    <div className="min-h-screen bg-[#f6f7f8]">
      <aside className="fixed inset-y-0 right-0 z-20 hidden w-64 flex-col overflow-y-auto bg-[#18251f] text-white lg:flex">
        <div className="border-b border-white/10 px-6 py-7">
          <p className="text-lg font-bold tracking-tight">✦ Perfume ERP</p>
          <p className="mt-2 truncate text-xs text-slate-400">{storeName}</p>
        </div>
        <div className="flex-1"><NavLinks /></div>
        <form action={logout} className="border-t border-white/10 p-3">
          <button type="submit" className="w-full rounded-xl px-4 py-3 text-right text-sm text-slate-300 transition hover:bg-white/10 hover:text-white">تسجيل الخروج ←</button>
        </form>
      </aside>

      <header className="sticky top-0 z-30 border-b border-slate-200 bg-[#18251f] text-white lg:hidden">
        <details open className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4">
            <div><span className="font-bold">✦ Perfume ERP</span><span className="mt-1 block text-xs text-slate-400">{storeName}</span></div>
            <span className="rounded-lg border border-white/20 px-3 py-2 text-sm group-open:bg-white/10">القائمة ☰</span>
          </summary>
          <div className="max-h-[70vh] overflow-y-auto border-t border-white/10">
            <NavLinks />
            <form action={logout} className="border-t border-white/10 p-3">
              <button type="submit" className="w-full rounded-xl px-4 py-3 text-right text-sm text-slate-300">تسجيل الخروج ←</button>
            </form>
          </div>
        </details>
      </header>

      <div className="min-w-0 lg:mr-64">{children}</div>
    </div>
  );
}
