import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { updateSupplier } from "@/services/material.service";
import { requireAuth, getStoreId } from "@/lib/auth-helpers";
import { can } from "@/lib/rbac";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  phone: z.string().trim().max(50).optional().nullable(),
  email: z.string().email().optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  active: z.boolean().optional(),
});

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
    const supplier = await updateSupplier(storeId, id, parsed);
    return NextResponse.json({ data: supplier });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", issues: err.issues },
        { status: 422 }
      );
    }
    if (err instanceof Error) {
      if (err.message === "UNAUTHORIZED")
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (err.message === "Supplier not found")
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.error(err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
