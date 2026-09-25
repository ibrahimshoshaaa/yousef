import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listRecipes, createRecipe } from "@/services/recipe.service";
import { requireAuth, getStoreId } from "@/lib/auth-helpers";
import { can } from "@/lib/rbac";

const recipeItemSchema = z.object({
  materialId: z.string().min(1),
  quantity: z.coerce.number().positive(),
  unit: z.string().trim().min(1).max(30),
});

const createSchema = z.object({
  variantId: z.string().min(1),
  name: z.string().trim().min(1).max(200),
  items: z.array(recipeItemSchema).min(1, "أضف مادة واحدة على الأقل"),
});

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    if (!can(session.role, "recipes.read")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const storeId = getStoreId(session);
    const { searchParams } = new URL(req.url);

    const recipes = await listRecipes(storeId, {
      search: searchParams.get("search") ?? undefined,
      variantId: searchParams.get("variantId") ?? undefined,
    });

    return NextResponse.json({ data: recipes });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    if (!can(session.role, "recipes.write")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const storeId = getStoreId(session);
    const body = await req.json();
    const parsed = createSchema.parse(body);

    const result = await createRecipe({
      storeId,
      userId: session.userId,
      ...parsed,
    });
    return NextResponse.json({ data: result }, { status: 201 });
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
    if (
      err.message === "Variant not found" ||
      err.message === "Variant already has a recipe"
    ) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
  }
  console.error(err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
