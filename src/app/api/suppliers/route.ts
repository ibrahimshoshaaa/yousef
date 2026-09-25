import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  listSuppliers,
  createSupplier,
} from "@/services/material.service";
import { requireAuth, getStoreId } from "@/lib/auth-helpers";
import { can } from "@/lib/rbac";

const createSchema = z.object({
  name: z.string().trim().min(1).max(150),
  phone: z.string().trim().max(50).optional().nullable(),
  email: z.string().email().optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});

export async function GET() {
  try {
    const session = await requireAuth();
    if (!can(session.role, "materials.read")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const storeId = getStoreId(session);
    const suppliers = await listSuppliers(storeId);
    return NextResponse.json({ data: suppliers });
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
    const supplier = await createSupplier(storeId, parsed);
    return NextResponse.json({ data: supplier }, { status: 201 });
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
