import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  listMaterialTypes,
  createMaterialType,
} from "@/services/material.service";
import { requireAuth, getStoreId } from "@/lib/auth-helpers";
import { can } from "@/lib/rbac";

const createSchema = z.object({
  name: z.string().trim().min(1).max(100),
  code: z
    .string()
    .trim()
    .min(1)
    .max(30)
    .regex(/^[A-Z0-9_]+$/, "Code must be uppercase letters, digits or _"),
});

export async function GET() {
  try {
    const session = await requireAuth();
    if (!can(session.role, "materials.read")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const storeId = getStoreId(session);
    const types = await listMaterialTypes(storeId);
    return NextResponse.json({ data: types });
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
    const { name, code } = createSchema.parse(body);
    const type = await createMaterialType(storeId, name, code);
    return NextResponse.json({ data: type }, { status: 201 });
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
