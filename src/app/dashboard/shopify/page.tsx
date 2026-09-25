import { requireAuth } from "@/lib/auth-helpers";
import { can } from "@/lib/rbac";
import { Suspense } from "react";
import { getConnectionStatus } from "@/services/shopify/connection.service";
import { ConnectShopifyForm } from "@/components/shopify/ConnectShopifyForm";
import { SyncActions, RetryWebhookButton } from "@/components/shopify/SyncActions";

async function getDevStoreId() {
  const session = await requireAuth();
  if (!can(session.role, "shopify.write")) throw new Error("Forbidden");
  return session.storeId;
}

const STATUS_LABELS: Record<string, string> = {
  CONNECTED: "متصل",
  DISCONNECTED: "غير متصل",
  ERROR: "خطأ",
};

const STATUS_COLORS: Record<string, string> = {
  CONNECTED: "bg-green-100 text-green-700",
  DISCONNECTED: "bg-gray-100 text-gray-600",
  ERROR: "bg-red-100 text-red-700",
};

const JOB_TYPE_LABELS: Record<string, string> = {
  PRODUCTS: "المنتجات",
  ORDERS: "الطلبات",
  WEBHOOKS: "الـWebhooks",
};

const JOB_STATUS_COLORS: Record<string, string> = {
  SUCCEEDED: "text-green-700",
  FAILED: "text-red-700",
  RUNNING: "text-amber-700",
  PENDING: "text-gray-500",
};

function formatDate(date: Date | null | undefined) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("ar-EG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

async function ShopifyStatus({
  storeId,
  searchParams,
}: {
  storeId: string;
  searchParams: { connected?: string; error?: string };
}) {
  const { connection, syncState, recentJobs, recentWebhooks, failedEventCount } =
    await getConnectionStatus(storeId);

  const isConnected = connection?.status === "CONNECTED";

  return (
    <div className="space-y-6">
      {searchParams.connected && (
        <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
          تم ربط المتجر بنجاح — جارٍ تشغيل المزامنة الأولى.
        </div>
      )}
      {searchParams.error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          فشل الاتصال بـ Shopify ({searchParams.error}). حاول مرة أخرى.
        </div>
      )}

      {/* Connection card */}
      <div className="rounded-xl border border-[var(--border)] bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold">حالة الاتصال</h2>
            {connection ? (
              <>
                <p className="mt-1 text-sm text-gray-500" dir="ltr">
                  {connection.shopDomain}
                </p>
                <span
                  className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs ${
                    STATUS_COLORS[connection.status] ?? "bg-gray-100 text-gray-600"
                  }`}
                >
                  {STATUS_LABELS[connection.status] ?? connection.status}
                </span>
              </>
            ) : (
              <p className="mt-1 text-sm text-gray-400">لم يتم ربط أي متجر بعد</p>
            )}
          </div>

          {!isConnected && (
            <div className="w-full max-w-sm md:w-80">
              <ConnectShopifyForm />
            </div>
          )}
        </div>

        {connection?.lastError && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {connection.lastError}
          </p>
        )}

        {isConnected && (
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div>
              <div className="text-xs text-gray-500">آخر مزامنة ناجحة</div>
              <div className="mt-1 text-sm font-medium">
                {formatDate(syncState?.lastSuccessfulAt)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">حالة المزامنة</div>
              <div className="mt-1 text-sm font-medium">
                {syncState?.status ?? "IDLE"}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">أحداث فاشلة</div>
              <div className="mt-1 text-sm font-medium">
                {failedEventCount > 0 ? (
                  <span className="text-red-600">{failedEventCount}</span>
                ) : (
                  "0"
                )}
              </div>
            </div>
          </div>
        )}

        {isConnected && (
          <div className="mt-6">
            <SyncActions />
          </div>
        )}
      </div>

      {isConnected && (
        <>
          {/* Recent sync jobs */}
          <div className="rounded-xl border border-[var(--border)] bg-white p-6">
            <h2 className="font-semibold">آخر مهام المزامنة</h2>
            {recentJobs.length === 0 ? (
              <p className="mt-4 text-sm text-gray-400">لا توجد مهام بعد</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-right text-xs text-gray-500">
                      <th className="py-2">النوع</th>
                      <th className="py-2">الحالة</th>
                      <th className="py-2">بدأت</th>
                      <th className="py-2">انتهت</th>
                      <th className="py-2">تفاصيل</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentJobs.map((job) => (
                      <tr key={job.id} className="border-b border-[var(--border)] last:border-0">
                        <td className="py-2">{JOB_TYPE_LABELS[job.type] ?? job.type}</td>
                        <td className={`py-2 font-medium ${JOB_STATUS_COLORS[job.status] ?? ""}`}>
                          {job.status}
                        </td>
                        <td className="py-2 text-gray-500">{formatDate(job.startedAt)}</td>
                        <td className="py-2 text-gray-500">{formatDate(job.finishedAt)}</td>
                        <td className="py-2 text-gray-500">
                          {job.status === "SUCCEEDED"
                            ? `${job.cursor ?? 0} سجل`
                            : job.error ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recent webhook events */}
          <div className="rounded-xl border border-[var(--border)] bg-white p-6">
            <h2 className="font-semibold">آخر أحداث الـWebhooks</h2>
            {recentWebhooks.length === 0 ? (
              <p className="mt-4 text-sm text-gray-400">
                لا توجد أحداث بعد — ستظهر هنا فور وصول تحديثات من Shopify
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-right text-xs text-gray-500">
                      <th className="py-2">الموضوع</th>
                      <th className="py-2">الحالة</th>
                      <th className="py-2">وصل في</th>
                      <th className="py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentWebhooks.map((event) => (
                      <tr key={event.id} className="border-b border-[var(--border)] last:border-0">
                        <td className="py-2 font-mono text-xs">{event.topic}</td>
                        <td
                          className={`py-2 font-medium ${
                            event.status === "FAILED"
                              ? "text-red-700"
                              : event.status === "PROCESSED"
                                ? "text-green-700"
                                : "text-gray-500"
                          }`}
                        >
                          {event.status}
                        </td>
                        <td className="py-2 text-gray-500">{formatDate(event.createdAt)}</td>
                        <td className="py-2 text-left">
                          {event.status === "FAILED" && <RetryWebhookButton eventId={event.id} />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default async function ShopifyDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const storeId = await getDevStoreId();
  const resolvedSearchParams = await searchParams;

  return (
    <div className="p-4 md:p-8">
      <header className="mb-6">
        <p className="text-sm text-gray-500">التكامل</p>
        <h1 className="mt-1 text-2xl font-bold">Shopify</h1>
        <p className="mt-2 text-sm text-gray-600">
          ربط المتجر، متابعة حالة المزامنة، ومراجعة أحداث الـWebhooks.
        </p>
      </header>

      {storeId ? (
        <Suspense
          fallback={<div className="h-48 animate-pulse rounded-xl bg-gray-100" />}
        >
          <ShopifyStatus storeId={storeId} searchParams={resolvedSearchParams} />
        </Suspense>
      ) : (
        <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-[var(--border)] text-sm text-gray-400">
          لم يتم إنشاء متجر بعد
        </div>
      )}
    </div>
  );
}
