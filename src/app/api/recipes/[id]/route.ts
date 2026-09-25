import { NextRequest, NextResponse } from "next/server";
import { getRecipe, getRecipeVersionCost, currentVersionOf } from "@/services/recipe.service";
import { requireAuth, getStoreId } from "@/lib/auth-helpers";
import { can } from "@/lib/rbac";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    if (!can(session.role, "recipes.read")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const storeId = getStoreId(session);
    const { id } = await params;

    const recipe = await getRecipe(storeId, id);
    if (!recipe) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const current = currentVersionOf(recipe);
    const cost = current ? await getRecipeVersionCost(storeId, current.id) : null;

    return NextResponse.json({
      data: { ...recipe, currentVersionId: current?.id ?? null, cost },
    });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
