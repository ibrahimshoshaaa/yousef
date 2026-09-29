import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import Image from "next/image";
import { auth, signIn } from "@/auth";
import auraicLogo from "../../../mobile/assets/auraic-logo.jpg";
import { LoginSubmit } from "@/components/auth/LoginSubmit";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if ((await auth())?.user) redirect("/dashboard");
  const { error } = await searchParams;
  async function login(form: FormData) {
    "use server";
    try { await signIn("credentials", { email: form.get("email"), password: form.get("password"), redirectTo: "/dashboard" }); }
    catch (err) { if (err instanceof AuthError) redirect("/login?error=invalid"); throw err; }
  }

  return <main className="min-h-dvh bg-[#f4f5fa] text-[#191735]" dir="rtl">
    <section className="flex min-h-[285px] flex-col items-center justify-center rounded-b-[36px] bg-[#191735] px-6 py-9 text-center text-[#ffe8a1] sm:min-h-[320px]">
      <Image src={auraicLogo} alt="Auraic" priority className="h-auto w-[min(80vw,320px)] object-contain" />
      <p className="mt-3 text-sm font-medium sm:text-base">إدارة Auraic في مكان واحد</p>
    </section>

    <section className="mx-auto w-full max-w-[460px] px-5 pb-10 pt-7 sm:pt-9">
      <div className="rounded-[26px] border border-[#e1e5e1] bg-white p-5 shadow-[0_2px_7px_#19173514] sm:p-7">
        <h1 className="text-2xl font-extrabold text-[#142720]">أهلًا بعودتك</h1>
        <p className="mt-2 text-sm text-[#718079]">سجّل دخولك لمتابعة الطلبات والمخزون</p>

        <form action={login} className="mt-7 space-y-4">
          <label className="relative block">
            <span className="sr-only">البريد الإلكتروني</span>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="pointer-events-none absolute right-4 top-1/2 size-5 -translate-y-1/2 text-[#50535d]"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>
            <input required type="email" name="email" autoComplete="username" placeholder="البريد الإلكتروني" dir="ltr"
              className="w-full rounded-2xl border border-[#dce4de] bg-white py-4 pl-4 pr-12 text-left text-base outline-none transition placeholder:text-right placeholder:text-[#555965] focus:border-[#191735] focus:ring-2 focus:ring-[#191735]/10" />
          </label>
          <label className="relative block">
            <span className="sr-only">كلمة المرور</span>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="pointer-events-none absolute right-4 top-1/2 size-5 -translate-y-1/2 text-[#50535d]"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
            <input required type="password" name="password" autoComplete="current-password" placeholder="كلمة المرور"
              className="w-full rounded-2xl border border-[#dce4de] bg-white py-4 pl-4 pr-12 text-base outline-none transition placeholder:text-[#555965] focus:border-[#191735] focus:ring-2 focus:ring-[#191735]/10" />
          </label>
          {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">البريد الإلكتروني أو كلمة المرور غير صحيحة.</p>}
          <LoginSubmit />
        </form>
      </div>
    </section>
  </main>;
}
