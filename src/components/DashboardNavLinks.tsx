"use client";

import Link from "next/link";

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

export function NavLinks() {
  return (
    <nav aria-label="التنقل الرئيسي" className="grid gap-1 p-3">
      {nav.map(({ label, href, mark }) => (
        <Link key={href} href={href} onClick={(event) => event.currentTarget.closest("details")?.removeAttribute("open")} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white focus-visible:bg-white/10 focus-visible:outline-none">
          <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/5 text-lg text-[#d6b978]">{mark}</span>
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
