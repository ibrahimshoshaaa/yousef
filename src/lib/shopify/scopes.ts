/** Shopify write scopes grant the matching read access, even if the read scope is absent from the token's scope string. */
export function hasShopifyScope(granted: ReadonlySet<string>, required: string): boolean {
  return granted.has(required) || (required.startsWith("read_") && granted.has(`write_${required.slice(5)}`));
}
