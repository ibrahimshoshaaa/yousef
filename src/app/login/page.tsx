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
  return <main className="mx-auto mt-16 max-w-md rounded-xl border bg-white p-6" dir="rtl"><h1 className="mb-6 text-2xl font-bold">تسجيل الدخول</h1><form action={login} className="space-y-4"><label className="block">البريد الإلكتروني<input required type="email" name="email" autoComplete="username" className="mt-1 w-full rounded border p-2" /></label><label className="block">كلمة المرور<input required type="password" name="password" autoComplete="current-password" className="mt-1 w-full rounded border p-2" /></label>{error && <p role="alert" className="text-sm text-red-700">بيانات الدخول غير صحيحة.</p>}<button className="rounded bg-blue-700 px-5 py-2 text-white">دخول</button></form></main>;
}
