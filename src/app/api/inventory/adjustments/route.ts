import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adjustInventory } from "@/services/material.service";
import { requireAuth, getStoreId } from "@/lib/auth-helpers";
import { can } from "@/lib/rbac";

const adjustSchema = z.object({
  materialId: z.string().min(1),
  quantity: z.number().refine((n) => n !== 0, "Quantity cannot be zero"),
  reason: z.string().trim().min(1).max(200),
  note: z.string().trim().max(500).optional().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    if (!can(session.role, "inventory.write")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const storeId = getStoreId(session);
    const body = await req.json();
    const parsed = adjustSchema.parse(body);

    const result = await adjustInventory({
      storeId,
      userId: session.userId,
      ...parsed,
    });

    return NextResponse.json({ data: result }, { status: 201 });
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
      if (err.message === "Material not found")
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.error(err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
