"use client";

import { useState } from "react";

type MaterialType = { id: string; name: string; code: string };

export function MaterialTypeCreator({ onCreated }: { onCreated: (type: MaterialType) => void }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function create() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/material-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "تعذر إضافة النوع");
      onCreated(result.data);
      setName("");
      setMessage("تمت إضافة النوع، ويمكنك اختياره الآن.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر إضافة النوع");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
      <label htmlFor="new-material-type" className="block text-sm font-semibold text-slate-800">إضافة نوع مادة جديد</label>
      <p className="mt-1 text-xs text-slate-600">مثل: زيوت عطرية، زجاجات، عبوات أو مواد تغليف.</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input id="new-material-type" value={name} onChange={(event) => setName(event.target.value)} maxLength={100} placeholder="اسم النوع" className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-[#96723c]" />
        <button type="button" onClick={create} disabled={busy || !name.trim()} className="rounded-xl bg-[#263b35] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? "جارٍ الإضافة..." : "إضافة النوع"}</button>
      </div>
      {message && <p role="status" className="mt-2 text-sm text-slate-700">{message}</p>}
    </div>
  );
}
