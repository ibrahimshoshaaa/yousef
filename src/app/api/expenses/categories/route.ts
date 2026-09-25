import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";
import { can } from "@/lib/rbac";
import { createExpenseCategory } from "@/services/finance.service";
export async function GET() { try { const s = await requireAuth(); if (!can(s.role, "expenses.read")) return NextResponse.json({ error: "Forbidden" }, { status: 403 }); return NextResponse.json({ data: await db.expenseCategory.findMany({ where: { storeId: s.storeId }, orderBy: { name: "asc" } }) }); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); } }
export async function POST(req: NextRequest) { try { const s = await requireAuth(); if (!can(s.role, "expenses.write")) return NextResponse.json({ error: "Forbidden" }, { status: 403 }); const { name } = z.object({ name: z.string().trim().min(1).max(100) }).parse(await req.json()); return NextResponse.json({ data: await createExpenseCategory(s.storeId, name, s.userId) }, { status: 201 }); } catch (e) { if (e instanceof z.ZodError) return NextResponse.json({ error: "Invalid input", issues: e.issues }, { status: 422 }); if (e instanceof Error && e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); console.error(e); return NextResponse.json({ error: "Internal server error" }, { status: 500 }); } }
