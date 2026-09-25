import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if ((await auth())?.user) redirect("/dashboard");
  const { error } = await searchParams;
  async function login(form: FormData) {
    "use server";
    try { await signIn("credentials", { email: form.get("email"), password: form.get("password"), redirectTo: "/dashboard" }); }
    catch (err) { if (err instanceof AuthError) redirect("/login?error=invalid"); throw err; }
  }
  return (
    <main className="min-h-screen bg-[#f6f3ed] text-[#25251f]" dir="rtl">
      <div className="mx-auto grid min-h-screen max-w-7xl lg:grid-cols-2">
        <section className="flex items-center justify-center px-5 py-12 sm:px-10 lg:px-16">
          <div className="w-full max-w-md">
            <div className="mb-12 flex items-center gap-3">
              <span aria-hidden="true" className="flex size-11 items-center justify-center rounded-xl bg-[#263b35] text-xl font-semibold text-[#e8cf91]">✦</span>
              <div>
                <p className="text-lg font-bold tracking-tight">Perfume ERP</p>
                <p className="text-xs text-[#77786e]">مساحة عملك لإدارة متجر العطور</p>
              </div>
            </div>
            <p className="mb-2 text-sm font-semibold text-[#9a7539]">مرحبًا بعودتك</p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">تسجيل الدخول</h1>
            <p className="mt-3 text-sm leading-7 text-[#6f7168]">أدخل بيانات حسابك للوصول إلى لوحة التحكم وإدارة عمليات متجرك.</p>
            <form action={login} className="mt-9 space-y-5">
              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-semibold">البريد الإلكتروني</label>
                <input id="email" required type="email" name="email" autoComplete="username" placeholder="name@example.com" dir="ltr" className="w-full rounded-xl border border-[#dcded5] bg-white px-4 py-3.5 text-left text-sm outline-none transition placeholder:text-[#a7a9a2] focus:border-[#9a7539] focus:ring-4 focus:ring-[#9a7539]/10" />
              </div>
              <div>
                <label htmlFor="password" className="mb-2 block text-sm font-semibold">كلمة المرور</label>
                <input id="password" required type="password" name="password" autoComplete="current-password" placeholder="أدخل كلمة المرور" className="w-full rounded-xl border border-[#dcded5] bg-white px-4 py-3.5 text-sm outline-none transition placeholder:text-[#a7a9a2] focus:border-[#9a7539] focus:ring-4 focus:ring-[#9a7539]/10" />
              </div>
              {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">البريد الإلكتروني أو كلمة المرور غير صحيحة.</p>}
              <button type="submit" className="w-full rounded-xl bg-[#263b35] px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#345348] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#263b35]">الدخول إلى لوحة التحكم</button>
            </form>
            <p className="mt-9 text-center text-xs text-[#8a8c83]">حسابات الفريق يديرها مالك المتجر</p>
          </div>
        </section>
        <aside className="relative hidden overflow-hidden bg-[#263b35] p-16 text-white lg:flex lg:flex-col lg:justify-between">
          <div aria-hidden="true" className="absolute -left-32 -top-32 size-96 rounded-full border border-white/10" />
          <div aria-hidden="true" className="absolute -left-12 -top-12 size-96 rounded-full border border-white/10" />
          <div className="relative text-sm font-semibold tracking-wide text-[#e8cf91]">PERFUME ERP</div>
          <div className="relative max-w-lg">
            <div aria-hidden="true" className="mb-8 text-6xl text-[#e8cf91]">✦</div>
            <h2 className="text-4xl font-bold leading-snug">كل تفاصيل متجرك،<br />في مكان واحد.</h2>
            <p className="mt-6 max-w-sm text-base leading-8 text-[#ccd7cf]">تابع الطلبات والمخزون والوصفات والتقارير من لوحة تحكم مصممة لعملك اليومي.</p>
          </div>
          <div className="relative h-px bg-white/15" />
        </aside>
      </div>
    </main>
  );
}
