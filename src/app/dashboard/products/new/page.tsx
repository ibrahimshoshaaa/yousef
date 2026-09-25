import Link from "next/link";
import { NewProductForm } from "@/components/products/NewProductForm";

export default function NewProductPage() {
  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <Link
          href="/dashboard/products"
          className="text-sm text-gray-400 hover:text-gray-600"
        >
          ← المنتجات
        </Link>
        <h1 className="mt-2 text-2xl font-bold">إضافة منتج جديد</h1>
      </div>

      <div className="mx-auto max-w-xl rounded-xl border border-[var(--border)] bg-white p-6">
        <NewProductForm />
      </div>
    </div>
  );
}
