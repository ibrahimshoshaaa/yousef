import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-helpers";
import { can } from "@/lib/rbac";
import { processReturn, RETURN_CONDITIONS } from "@/services/finance.service";
const schema = z.object({ returnCost: z.number().finite().nonnegative().optional(), items: z.array(z.object({ id: z.string().min(1), condition: z.enum(RETURN_CONDITIONS), restock: z.boolean() })).min(1) });
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { const s = await requireAuth(); if (!can(s.role, "returns.write")) return NextResponse.json({ error: "Forbidden" }, { status: 403 }); const { id } = await params; const data = schema.parse(await req.json()); return NextResponse.json({ data: await processReturn({ ...data, storeId: s.storeId, returnId: id, userId: s.userId }) }); }
  catch (e) { if (e instanceof z.ZodError) return NextResponse.json({ error: "Invalid input", issues: e.issues }, { status: 422 }); const message = e instanceof Error ? e.message : "Unknown error"; if (message === "UNAUTHORIZED") return NextResponse.json({ error: message }, { status: 401 }); if (message === "Return not found") return NextResponse.json({ error: message }, { status: 404 }); if (/processed|Classify|Invalid|restock|Restock|consumption|Only good/.test(message)) return NextResponse.json({ error: message }, { status: 409 }); console.error(e); return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
}
