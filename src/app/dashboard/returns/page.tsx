import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";
import { can } from "@/lib/rbac";
import { listReturns } from "@/services/finance.service";
import { ReturnProcessForm } from "@/components/finance/ReturnProcessForm";
export default async function ReturnsPage() {
  const session = await requireAuth();
  if (!can(session.role, "returns.read")) throw new Error("Forbidden");
  const store = await db.store.findUnique({ where: { id: session.storeId } });
  const returns = store ? await listReturns(store.id) : [];
  return <main className="space-y-5 p-4 md:p-8"><h1 className="text-2xl font-bold">المرتجعات</h1><p className="text-sm text-gray-600">حدد حالة كل منتج قبل إعادة مكونات وصفته إلى المخزون. تكلفة المرتجع تُسجل تلقائيًا كمصروف.</p>{returns.map(ret => <section className="rounded-xl border bg-white" key={ret.id}><div className="flex flex-wrap justify-between gap-2 p-4"><strong>طلب #{ret.order.orderNumber ?? ret.orderId}</strong><span>{ret.status} · {new Date(ret.createdAt).toLocaleDateString("ar-EG")}</span><span>المبلغ المرتجع: {Number(ret.totalAmount ?? 0)} {ret.order.currency}</span></div>{ret.processedAt ? <p className="border-t p-4 text-sm">تمت المعالجة · تكلفة {Number(ret.returnCost)} {store?.currency}</p> : ret.items.length ? <ReturnProcessForm returnId={ret.id} items={ret.items.map(item => ({ id: item.id, title: item.orderItem.title, quantity: Number(item.quantity) }))} /> : <p className="border-t p-4 text-sm">لا توجد بنود مرتبطة بعد؛ أعد مزامنة الطلب.</p>}</section>)}{returns.length === 0 && <p>لا توجد مرتجعات بعد.</p>}</main>;
}
