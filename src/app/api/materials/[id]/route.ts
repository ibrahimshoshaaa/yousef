import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getMaterial,
  updateMaterial,
  getMaterialHistory,
} from "@/services/material.service";
import { requireAuth, getStoreId } from "@/lib/auth-helpers";
import { can } from "@/lib/rbac";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  sku: z.string().trim().max(100).optional().nullable(),
  unit: z.string().trim().min(1).max(30).optional(),
  baseUnit: z.string().trim().min(1).max(30).optional(),
  description: z.string().trim().optional().nullable(),
  capacityMl: z.coerce.number().nonnegative().optional().nullable(),
  defaultCost: z.coerce.number().nonnegative().optional().nullable(),
  reorderLevel: z.coerce.number().nonnegative().optional().nullable(),
  supplierId: z.string().optional().nullable(),
  materialTypeId: z.string().optional(),
  active: z.boolean().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    if (!can(session.role, "materials.read")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const storeId = getStoreId(session);
    const { id } = await params;

    const material = await getMaterial(storeId, id);
    if (!material) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const history = await getMaterialHistory(storeId, id, 30);
    return NextResponse.json({ data: { ...material, history } });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    if (!can(session.role, "materials.write")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const storeId = getStoreId(session);
    const { id } = await params;

    const body = await req.json();
    const parsed = updateSchema.parse(body);

    const updated = await updateMaterial(storeId, id, parsed, session.userId);
    return NextResponse.json({ data: updated });
  } catch (err) {
    return handleError(err);
  }
}

function handleError(err: unknown) {
  if (err instanceof z.ZodError) {
    return NextResponse.json(
      { error: "Validation error", issues: err.issues },
      { status: 422 }
    );
  }
  if (err instanceof Error) {
    if (err.message === "UNAUTHORIZED")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err.message === "Material not found")
      return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  console.error(err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
