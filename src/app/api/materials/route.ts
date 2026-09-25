import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listMaterials, createMaterial } from "@/services/material.service";
import { requireAuth, getStoreId } from "@/lib/auth-helpers";
import { can } from "@/lib/rbac";

const createSchema = z.object({
  materialTypeId: z.string().min(1),
  supplierId: z.string().optional().nullable(),
  name: z.string().trim().min(1).max(200),
  sku: z.string().trim().max(100).optional().nullable(),
  unit: z.string().trim().min(1).max(30),
  baseUnit: z.string().trim().min(1).max(30),
  description: z.string().trim().optional().nullable(),
  capacityMl: z.coerce.number().nonnegative().optional().nullable(),
  defaultCost: z.coerce.number().nonnegative().optional().nullable(),
  reorderLevel: z.coerce.number().nonnegative().optional().nullable(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    if (!can(session.role, "materials.read")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const storeId = getStoreId(session);
    const { searchParams } = new URL(req.url);

    const materials = await listMaterials(storeId, {
      search: searchParams.get("search") ?? undefined,
      typeId: searchParams.get("typeId") ?? undefined,
      active: searchParams.has("active")
        ? searchParams.get("active") === "true"
        : true,
    });

    return NextResponse.json({ data: materials });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    if (!can(session.role, "materials.write")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const storeId = getStoreId(session);
    const body = await req.json();
    const parsed = createSchema.parse(body);

    const material = await createMaterial({ storeId, ...parsed });
    return NextResponse.json({ data: material }, { status: 201 });
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
  if (err instanceof Error && err.message === "UNAUTHORIZED") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  console.error(err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
