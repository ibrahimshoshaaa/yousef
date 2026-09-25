import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-helpers";
import { can } from "@/lib/rbac";
import { recordMaterialPurchase } from "@/services/finance.service";
const schema = z.object({ materialId: z.string().min(1), quantity: z.number().finite().positive(), amount: z.number().finite().positive(), date: z.coerce.date(), reference: z.string().max(200).optional() });
export async function POST(req: NextRequest) { try { const s = await requireAuth(); if (!can(s.role, "inventory.write") || !can(s.role, "expenses.write")) return NextResponse.json({ error: "Forbidden" }, { status: 403 }); const data = schema.parse(await req.json()); return NextResponse.json({ data: await recordMaterialPurchase({ ...data, storeId: s.storeId, userId: s.userId }) }, { status: 201 }); } catch (e) { if (e instanceof z.ZodError) return NextResponse.json({ error: "Invalid input", issues: e.issues }, { status: 422 }); if (e instanceof Error && e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); if (e instanceof Error && e.message === "Material not found") return NextResponse.json({ error: e.message }, { status: 404 }); console.error(e); return NextResponse.json({ error: "Internal server error" }, { status: 500 }); } }
