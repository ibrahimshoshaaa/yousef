export const dynamic = "force-dynamic";

import { NavLinks } from "@/components/DashboardNavLinks";
import { redirect } from "next/navigation";
import { signOut } from "@/auth";
import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import Image from "next/image";
import auraicIcon from "../../../mobile/assets/auraic-icon.jpg";
import { MenuBackdrop } from "@/components/MenuBackdrop";

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
    <div className="min-h-screen bg-[#f4f5fa] pb-20 lg:pb-0">
      <aside className="fixed inset-y-0 right-0 z-20 hidden w-64 flex-col overflow-y-auto bg-[#191735] text-white lg:flex">
        <div className="border-b border-white/10 px-6 py-7">
          <p className="flex items-center gap-3 text-lg font-bold tracking-tight"><Image src={auraicIcon} alt="" className="size-10 rounded-xl object-cover" />Auraic</p>
          <p className="mt-2 truncate text-xs text-slate-400">{storeName}</p>
        </div>
        <div className="flex-1"><NavLinks /></div>
        <form action={logout} className="border-t border-white/10 p-3">
          <button type="submit" className="w-full rounded-xl px-4 py-3 text-right text-sm text-slate-300 transition hover:bg-white/10 hover:text-white">تسجيل الخروج ←</button>
        </form>
      </aside>

      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#191735] text-white lg:hidden">
        <details className="group relative">
          <summary className="relative z-20 flex cursor-pointer list-none items-center justify-between px-4 py-3 marker:hidden [&::-webkit-details-marker]:hidden">
            <div className="flex items-center gap-3"><Image src={auraicIcon} alt="" className="size-10 rounded-xl object-cover" /><div><span className="font-bold">Auraic</span><span className="block max-w-40 truncate text-xs text-slate-300">{storeName}</span></div></div>
            <span className="rounded-lg border border-white/20 px-3 py-2 text-sm group-open:bg-white/10">☰ <span className="sr-only">القائمة</span></span>
          </summary>
          <MenuBackdrop />
          <div className="absolute right-0 top-full z-10 max-h-[calc(100dvh-9rem)] w-[min(22rem,88vw)] overflow-y-auto rounded-bl-2xl border-t border-white/10 bg-[#191735] shadow-2xl">
            <NavLinks />
            <form action={logout} className="border-t border-white/10 p-3">
              <button type="submit" className="w-full rounded-xl px-4 py-3 text-right text-sm text-slate-300">تسجيل الخروج ←</button>
            </form>
          </div>
        </details>
      </header>

      <div className="min-w-0 lg:mr-64">{children}</div>
      <nav aria-label="التنقل السريع" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-[#e6e4ef] bg-white/95 px-1 pb-[env(safe-area-inset-bottom)] pt-1 shadow-[0_-8px_24px_#1917350a] backdrop-blur lg:hidden">
        <NavLinks compact canCreateOrder={can(session.role, "orders.write")} />
      </nav>
    </div>
  );
}
