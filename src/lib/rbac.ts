import type { Role } from "@prisma/client";

export const rolePermissions = {
  OWNER: ["*"],
  MANAGER: [
    "dashboard.read",
    "orders.read",
    "products.read",
    "products.write",
    "materials.read",
    "materials.write",
    "recipes.read",
    "recipes.write",
    "inventory.read",
    "inventory.write",
    "consumption.read",
    "consumption.write",
    "returns.read",
    "returns.write",
    "expenses.read",
    "expenses.write",
    "reports.read",
  ],
  EMPLOYEE: [
    "dashboard.read",
    "orders.read",
    "materials.read",
    "inventory.read",
    "consumption.read",
  ],
} as const;

export function can(role: Role, permission: string) {
  const permissions: readonly string[] = rolePermissions[role];
  return permissions.includes("*") || permissions.includes(permission);
}
