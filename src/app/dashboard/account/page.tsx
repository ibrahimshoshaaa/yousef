import Link from "next/link";
import { requireAuth } from "@/lib/auth-helpers";
import { AccountManager } from "@/components/account/AccountManager";

export default async function AccountPage() {
  const session = await requireAuth();
  return <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-8 sm:py-9">
    <header><Link href="/dashboard/settings" className="text-sm font-semibold text-[#4f4a8a]">← الإعدادات</Link><h1 className="mt-3 text-3xl font-bold text-[#191735]">الحساب والأمان</h1><p className="mt-2 text-sm text-slate-500">تغيير كلمة المرور وإدارة الأدمن من نفس مكان بيانات المتجر.</p></header>
    <AccountManager owner={session.role === "OWNER"} />
  </main>;
}
