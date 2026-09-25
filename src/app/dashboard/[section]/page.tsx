type Props = {
  params: Promise<{ section: string }>;
};

const titles: Record<string, string> = {
  orders: "الطلبات",
  products: "المنتجات",
  materials: "المواد الخام",
  inventory: "المخزون",
  consumption: "الاستهلاك",
  recipes: "الوصفات",
  returns: "المرتجعات",
  expenses: "المصروفات",
  reports: "التقارير",
  shopify: "Shopify",
  settings: "الإعدادات",
};

export default async function SectionPage({ params }: Props) {
  const { section } = await params;
  const title = titles[section] ?? "القسم";

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl font-bold">{title}</h1>
      <div className="mt-6 rounded-xl border border-[var(--border)] bg-white p-8 text-center text-gray-500">
        هذا القسم تم تجهيزه ضمن الـFoundation وسيتم بناء وظائفه في الـchunks التالية.
      </div>
    </div>
  );
}
