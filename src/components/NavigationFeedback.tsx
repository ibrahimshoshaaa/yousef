"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function NavigationFeedback() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const route = `${pathname}?${searchParams.toString()}`;
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clear = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; setBusy(false); };
    clear();
    const begin = () => {
      setBusy(true);
      if (timer.current) clearTimeout(timer.current);
      // A failed or canceled navigation must not leave the screen covered.
      timer.current = setTimeout(() => { timer.current = null; setBusy(false); }, 12000);
    };
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element).closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target && anchor.target !== "_self" || anchor.hasAttribute("download")) return;
      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin || !(destination.pathname.startsWith("/dashboard") || destination.pathname === "/login")) return;
      if (`${destination.pathname}${destination.search}` === `${window.location.pathname}${window.location.search}`) return;
      begin();
    };
    const onSubmit = (event: SubmitEvent) => {
      const form = event.target as HTMLFormElement;
      if (form.method.toLowerCase() !== "get") return;
      const destination = new URL(form.action, window.location.href);
      for (const [key, value] of new FormData(form)) if (typeof value === "string") destination.searchParams.append(key, value);
      if (`${destination.pathname}${destination.search}` === `${window.location.pathname}${window.location.search}`) return;
      if (destination.origin === window.location.origin && (destination.pathname.startsWith("/dashboard") || destination.pathname === "/login")) begin();
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    window.addEventListener("popstate", begin);
    window.addEventListener("dashboard-navigation-start", begin);
    return () => { document.removeEventListener("click", onClick, true); document.removeEventListener("submit", onSubmit, true); window.removeEventListener("popstate", begin); window.removeEventListener("dashboard-navigation-start", begin); if (timer.current) clearTimeout(timer.current); };
  }, [route]);

  if (!busy) return null;
  return <div role="status" aria-live="polite" className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-[#f6f7f8]/95 px-6">
    <div className="text-center"><div className="mx-auto size-11 animate-spin rounded-full border-4 border-[#dce8df] border-t-[#263b35]" aria-hidden="true" /><p className="mt-4 font-semibold text-[#263b35]">جارٍ فتح الصفحة…</p><p className="mt-1 text-sm text-slate-500">لحظات ونجهز البيانات</p></div>
  </div>;
}
