import { NextRequest, NextResponse } from "next/server";
import { activateRecipeVersion } from "@/services/recipe.service";
import { requireAuth, getStoreId } from "@/lib/auth-helpers";
import { can } from "@/lib/rbac";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const session = await requireAuth();
    if (!can(session.role, "recipes.write")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const storeId = getStoreId(session);
    const { id, versionId } = await params;

    const version = await activateRecipeVersion({
      storeId,
      recipeId: id,
      versionId,
      userId: session.userId,
    });
    return NextResponse.json({ data: version });
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "UNAUTHORIZED")
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (err.message === "Recipe version not found")
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
