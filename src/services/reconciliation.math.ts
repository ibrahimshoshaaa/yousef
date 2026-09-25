type Movement = { materialId: string; type: string; quantity: { toString(): string } };
export function reconcileBalances(
  balances: { materialId: string; quantity: { toString(): string }; material: { name: string; unit: string } }[],
  transactions: Movement[]
) {
  const totals = new Map<string, number>();
  const unknownTypes = new Set<string>();
  for (const transaction of transactions) {
    const qty = Number(transaction.quantity.toString());
    let direction: number;
    switch (transaction.type) {
      case "PURCHASE": case "RETURN_RESTOCK": case "ADJUSTMENT_IN": case "OPENING": direction = 1; break;
      case "CONSUMPTION": case "WASTE": case "ADJUSTMENT_OUT": direction = -1; break;
      default: unknownTypes.add(transaction.type); continue;
    }
    totals.set(transaction.materialId, (totals.get(transaction.materialId) ?? 0) + direction * qty);
  }
  const differences = balances.map(balance => ({ materialId: balance.materialId, material: balance.material.name, unit: balance.material.unit, ledger: Math.round((totals.get(balance.materialId) ?? 0) * 1e6) / 1e6, balance: Number(balance.quantity.toString()) })).filter(row => Math.abs(row.ledger - row.balance) > 0.000001);
  return { checked: balances.length, differences, unknownTransactionTypes: [...unknownTypes] };
}

