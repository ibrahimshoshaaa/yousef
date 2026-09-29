"use client";

import Image from "next/image";
import { useFormStatus } from "react-dom";
import auraicLogo from "../../../mobile/assets/auraic-logo.jpg";

export function LoginSubmit() {
  const { pending } = useFormStatus();
  return <>
    <button type="submit" disabled={pending} className="mt-2 flex w-full min-h-14 items-center justify-center gap-3 rounded-2xl bg-[#191735] px-5 py-3 text-base font-bold text-white transition duration-200 hover:bg-[#302d58] active:scale-[.98] disabled:cursor-wait disabled:opacity-90">
      {pending && <span aria-hidden="true" className="size-5 animate-spin rounded-full border-2 border-white/30 border-t-[#ffe8a1]" />}
      {pending ? "جاري تسجيل الدخول" : "تسجيل الدخول"}
    </button>
    {pending && <div role="status" aria-live="polite" className="auraic-login-enter fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#191735] px-8 text-center text-[#ffe8a1]">
      <Image src={auraicLogo} alt="Auraic" priority className="auraic-login-logo w-[min(78vw,320px)] object-contain" />
      <p className="mt-8 text-base font-medium">بنفتح مساحة عملك…</p>
      <span aria-hidden="true" className="mt-5 h-1 w-28 overflow-hidden rounded-full bg-[#ffe8a1]/20"><span className="auraic-login-progress block h-full w-1/2 rounded-full bg-[#ffe8a1]" /></span>
    </div>}
  </>;
}
