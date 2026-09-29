"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { label: "الرئيسية", href: "/dashboard", mark: "⌂" },
  { label: "الطلبات", href: "/dashboard/orders", mark: "▤" },
  { label: "المخزون", href: "/dashboard/inventory", mark: "▣" },
  { label: "المنتجات", href: "/dashboard/products", mark: "◇" },
  { label: "المصروفات", href: "/dashboard/expenses", mark: "▣" },
  { label: "المرتجعات", href: "/dashboard/returns", mark: "↶" },
  { label: "الوصفات", href: "/dashboard/recipes", mark: "♧" },
  { label: "الاستهلاك", href: "/dashboard/consumption", mark: "⌁" },
  { label: "التقارير", href: "/dashboard/reports", mark: "▥" },
  { label: "الإعدادات", href: "/dashboard/settings", mark: "⚙" },
  { label: "Shopify", href: "/dashboard/shopify", mark: "▥" },
];

export function NavLinks({ compact = false, canCreateOrder = false }: { compact?: boolean; canCreateOrder?: boolean }) {
  const pathname = usePathname();
  if (compact) {
    const tabs = [nav[0], nav[1],
      canCreateOrder ? { label: "طلب جديد", href: "/dashboard/orders/new", mark: "+" } : nav[3],
      nav[2]];
    return <>
      {tabs.map(({ label, href, mark }) => <Link key={label} href={href}
        aria-current={pathname === href ? "page" : undefined}
        className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] ${pathname === href ? "bg-[#e9e6f8] font-bold text-[#191735]" : "text-[#555766]"}`}>
        <span aria-hidden="true" className={`text-2xl leading-7 ${label === "طلب جديد" ? "flex size-8 items-center justify-center rounded-full bg-[#191735] text-white" : ""}`}>{mark}</span>{label}
      </Link>)}
      <button type="button" onClick={() => {
        const menu = document.querySelector<HTMLDetailsElement>("header details");
        if (menu) { menu.open = !menu.open; if (menu.open) window.scrollTo({ top: 0, behavior: "smooth" }); }
      }} className="flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] text-[#555766]">
        <span aria-hidden="true" className="text-2xl leading-7">☰</span>المزيد
      </button>
    </>;
  }
  return <nav aria-label="التنقل الرئيسي" className="grid gap-1 p-3">
    {nav.map(({ label, href, mark }) => {
      const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
      return <Link key={href} href={href} aria-current={active ? "page" : undefined}
        onClick={(event) => event.currentTarget.closest("details")?.removeAttribute("open")}
        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffe8a1] ${active ? "bg-white/15 font-bold text-white" : "text-slate-300"}`}>
        <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/5 text-lg text-[#ffe8a1]">{mark}</span>
        <span>{label}</span>
      </Link>;
    })}
  </nav>;
}
