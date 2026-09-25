import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { addRecipeVersion } from "@/services/recipe.service";
import { requireAuth, getStoreId } from "@/lib/auth-helpers";
import { can } from "@/lib/rbac";

const recipeItemSchema = z.object({
  materialId: z.string().min(1),
  quantity: z.coerce.number().positive(),
  unit: z.string().trim().min(1).max(30),
});

const createSchema = z.object({
  items: z.array(recipeItemSchema).min(1, "أضف مادة واحدة على الأقل"),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    if (!can(session.role, "recipes.write")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const storeId = getStoreId(session);
    const { id } = await params;

    const body = await req.json();
    const parsed = createSchema.parse(body);

    const version = await addRecipeVersion({
      storeId,
      recipeId: id,
      userId: session.userId,
      ...parsed,
    });
    return NextResponse.json({ data: version }, { status: 201 });
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
      if (err.message === "Recipe not found")
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
