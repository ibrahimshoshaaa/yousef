"use client";

import { useState } from "react";
import { MaterialTypeCreator } from "./MaterialTypeCreator";

type MaterialType = { id: string; name: string; code: string };

export function MaterialTypesSettings({ initialTypes }: { initialTypes: MaterialType[] }) {
  const [types, setTypes] = useState(initialTypes);
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <h2 className="text-lg font-semibold">إعدادات المخزون · أنواع المواد الخام</h2>
      <p className="mt-1 text-sm text-slate-500">أضف النوع قبل تسجيل المادة الخام، مثل الزيوت والعبوات والتغليف.</p>
      {types.length > 0 && <ul className="mt-4 flex flex-wrap gap-2">{types.map((type) => <li key={type.id} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm">{type.name}</li>)}</ul>}
      <MaterialTypeCreator onCreated={(type) => setTypes((current) => [...current, type].sort((a, b) => a.name.localeCompare(b.name, "ar")))} />
    </section>
  );
}
