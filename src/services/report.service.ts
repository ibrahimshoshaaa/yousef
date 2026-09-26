import { db } from "@/lib/db";
import { isCostingEnabled } from "@/lib/settings";
import { Prisma } from "@prisma/client";

import { getReportRange, localDate } from "./report-range";
const n = (value: Prisma.Decimal | number | null | undefined) => Number(value ?? 0);
const money = (value: number) => Math.round(value * 100) / 100;

export async function getBusinessReport(storeId: string, options: { period?: string; from?: string; to?: string } = {}) {
  const store = await db.store.findUniqueOrThrow({ where: { id: storeId } });
  const range = getReportRange(store.timezone, options.period, options.from, options.to);
  const between = { gte: range.start, lt: range.endExclusive };
  const [orders, returns, expenses, consumptions, balances, transactions, costingEnabled, unmatchedCurrencyOrders, orderConsumptions] = await Promise.all([
    db.order.findMany({ where: { storeId, currency: store.currency, occurredAt: between, OR: [{ manualStatus: null }, { manualStatus: "DELIVERED" }] }, include: { items: { include: { variant: { include: { product: true } } } } }, orderBy: { occurredAt: "asc" } }),
    db.return.findMany({ where: { storeId, createdAt: between, order: { currency: store.currency } }, include: { items: { include: { orderItem: { include: { variant: { include: { product: true } } } } } } } }),
    db.expense.findMany({ where: { storeId, date: between }, include: { category: true }, orderBy: { date: "desc" } }),
    db.consumption.findMany({ where: { storeId, createdAt: between }, include: { items: { include: { material: true } }, recipeVersion: { include: { items: { include: { material: true } } } } } }),
    db.inventoryBalance.findMany({ where: { storeId }, include: { material: { include: { materialType: true } } } }),
    db.inventoryTransaction.findMany({ where: { storeId, createdAt: between }, include: { material: true } }),
    isCostingEnabled(storeId),
    db.order.count({ where: { storeId, currency: { not: store.currency }, occurredAt: between, OR: [{ manualStatus: null }, { manualStatus: "DELIVERED" }] } }),
    db.consumption.findMany({ where: { storeId, order: { currency: store.currency, occurredAt: between, OR: [{ manualStatus: null }, { manualStatus: "DELIVERED" }] } }, include: { recipeVersion: { include: { items: { include: { material: true } } } } } }),
  ]);

  const sales = { gross: 0, discounts: 0, refunded: 0, net: 0, units: 0, orders: orders.length, averageOrderValue: 0 };
  const salesByDay = new Map<string, { date: string; gross: number; net: number; orders: number }>();
  const products = new Map<string, { key: string; product: string; variant: string; units: number; gross: number; discounts: number; refunds: number; net: number; returnedUnits: number; estimatedCost: number }>();
  for (const order of orders) {
    const gross = n(order.total) + n(order.discount); const net = n(order.netSales); const date = localDate(order.occurredAt, store.timezone);
    sales.gross += gross; sales.discounts += n(order.discount); sales.refunded += n(order.refunded); sales.net += net;
    const daily = salesByDay.get(date) ?? { date, gross: 0, net: 0, orders: 0 };
    daily.gross += gross; daily.net += net; daily.orders++; salesByDay.set(date, daily);
    for (const item of order.items) {
      const key = item.variantId ?? `line:${item.title}:${item.sku ?? ""}`;
      const row = products.get(key) ?? { key, product: item.variant?.product.title ?? item.title, variant: item.variant?.title ?? item.sku ?? "—", units: 0, gross: 0, discounts: 0, refunds: 0, net: 0, returnedUnits: 0, estimatedCost: 0 };
      const itemGross = n(item.originalPrice) * n(item.quantity);
      row.units += n(item.quantity); row.gross += itemGross; row.discounts += n(item.discount); row.refunds += n(item.refunded);
      row.net = row.gross - row.discounts - row.refunds;
      products.set(key, row); sales.units += n(item.quantity);
    }
  }
  sales.averageOrderValue = sales.orders ? sales.net / sales.orders : 0;
  const returnTotals = { count: returns.length, units: 0, value: 0, costs: 0, restocked: 0, notRestocked: 0 };
  const returnsByDay = new Map<string, { date: string; count: number; value: number }>();
  const returnedProducts = new Map<string, { product: string; variant: string; units: number }>();
  for (const ret of returns) {
    returnTotals.value += n(ret.totalAmount); returnTotals.costs += n(ret.returnCost);
    const date = localDate(ret.createdAt, store.timezone);
    const daily = returnsByDay.get(date) ?? { date, count: 0, value: 0 }; daily.count++; daily.value += n(ret.totalAmount); returnsByDay.set(date, daily);
    for (const item of ret.items) {
      returnTotals.units += n(item.quantity);
      if (item.restocked) returnTotals.restocked += n(item.quantity); else returnTotals.notRestocked += n(item.quantity);
      const key = item.orderItem.variantId ?? `line:${item.orderItem.title}:${item.orderItem.sku ?? ""}`;
      const prior = returnedProducts.get(key) ?? { product: item.orderItem.variant?.product.title ?? item.orderItem.title, variant: item.orderItem.variant?.title ?? item.orderItem.sku ?? "—", units: 0 };
      prior.units += n(item.quantity); returnedProducts.set(key, prior);
      const product = products.get(key); if (product) product.returnedUnits += n(item.quantity);
    }
  }
  const expenseCategories = new Map<string, { category: string; amount: number }>();
  let expenseTotal = 0; let returnExpenses = 0; let purchaseExpenses = 0;
  for (const expense of expenses) {
    const amount = n(expense.amount); expenseTotal += amount;
    if (expense.returnId) returnExpenses += amount;
    if (expense.purchaseId) purchaseExpenses += amount;
    const prior = expenseCategories.get(expense.categoryId) ?? { category: expense.category.name, amount: 0 };
    prior.amount += amount; expenseCategories.set(expense.categoryId, prior);
  }
  const materials = new Map<string, { id: string; name: string; unit: string; consumed: number; orders: Set<string>; products: Set<string> }>();
  let estimatedProductCost = 0; let missingCosts = 0;
  for (const consumption of orderConsumptions) {
    const unitCost = consumption.recipeVersion.items.reduce((sum, item) => sum + n(item.quantity) * n(item.material.defaultCost), 0);
    if (costingEnabled) {
      const cost = unitCost * n(consumption.quantity); estimatedProductCost += cost;
      const product = products.get(consumption.variantId); if (product) product.estimatedCost += cost;
      missingCosts += consumption.recipeVersion.items.filter(item => item.material.defaultCost === null).length;
    }
  }
  for (const consumption of consumptions) {
    for (const item of consumption.items) {
      const row = materials.get(item.materialId) ?? { id: item.materialId, name: item.material.name, unit: item.unit, consumed: 0, orders: new Set<string>(), products: new Set<string>() };
      row.consumed += n(item.quantity); row.orders.add(consumption.orderId); row.products.add(consumption.variantId); materials.set(item.materialId, row);
    }
  }
  const byMaterial = new Map<string, { purchased: number; consumed: number; wasted: number; returned: number; adjusted: number }>();
  for (const transaction of transactions) {
    const row = byMaterial.get(transaction.materialId) ?? { purchased: 0, consumed: 0, wasted: 0, returned: 0, adjusted: 0 };
    const qty = n(transaction.quantity);
    if (transaction.type === "PURCHASE") row.purchased += qty;
    else if (transaction.type === "CONSUMPTION") row.consumed += qty;
    else if (transaction.type === "WASTE") row.wasted += qty;
    else if (transaction.type === "RETURN_RESTOCK") row.returned += qty;
    else if (transaction.type.startsWith("ADJUSTMENT")) row.adjusted += transaction.type.endsWith("OUT") ? -qty : qty;
    byMaterial.set(transaction.materialId, row);
  }
  const inventory = balances.map(balance => ({ id: balance.materialId, name: balance.material.name, type: balance.material.materialType.name, unit: balance.material.unit, stock: n(balance.quantity), reorderLevel: balance.material.reorderLevel === null ? null : n(balance.material.reorderLevel), ...byMaterial.get(balance.materialId) ?? { purchased: 0, consumed: 0, wasted: 0, returned: 0, adjusted: 0 }, estimatedValue: costingEnabled && balance.material.defaultCost !== null ? money(n(balance.quantity) * n(balance.material.defaultCost)) : null }));
  return {
    range: { period: range.period, from: range.from, to: range.to, timeZone: store.timezone }, currency: store.currency,
    notes: { excludedDifferentCurrencyOrders: unmatchedCurrencyOrders, salesRefundsAttributedToOriginalOrderDate: true, returnActivityAttributedToReturnDate: true, expenseTotalIncludesReturnCosts: true, costEstimateIncomplete: missingCosts > 0 || orderConsumptions.length < orders.reduce((sum, order) => sum + order.items.length, 0) },
    sales: { ...sales, gross: money(sales.gross), discounts: money(sales.discounts), refunded: money(sales.refunded), net: money(sales.net), averageOrderValue: money(sales.averageOrderValue) },
    salesByDay: [...salesByDay.values()].map(row => ({ ...row, gross: money(row.gross), net: money(row.net) })),
    returns: { ...returnTotals, value: money(returnTotals.value), costs: money(returnTotals.costs) }, returnsByDay: [...returnsByDay.values()].map(row => ({ ...row, value: money(row.value) })),
    returnedProducts: [...returnedProducts.values()].sort((a, b) => b.units - a.units),
    products: [...products.values()].map(p => ({ ...p, gross: money(p.gross), discounts: money(p.discounts), refunds: money(p.refunds), net: money(p.net) })).sort((a, b) => b.net - a.net),
    expenses: { total: money(expenseTotal), returnCosts: money(returnExpenses), materialPurchases: money(purchaseExpenses), byCategory: [...expenseCategories.values()].map(c => ({ ...c, amount: money(c.amount) })).sort((a, b) => b.amount - a.amount), rows: expenses.map(e => ({ id: e.id, category: e.category.name, amount: n(e.amount), date: e.date, description: e.description, reference: e.reference })) },
    consumption: [...materials.values()].map(m => ({ id: m.id, name: m.name, unit: m.unit, consumed: m.consumed, orders: m.orders.size, products: m.products.size })).sort((a, b) => b.consumed - a.consumed),
    inventory, lowStock: inventory.filter(m => m.reorderLevel !== null && m.stock < m.reorderLevel),
    profitability: costingEnabled ? { estimatedProductCost: money(estimatedProductCost), estimatedGrossProfit: money(sales.net - estimatedProductCost), estimatedGrossMargin: sales.net ? money((sales.net - estimatedProductCost) / sales.net * 100) : null, incomplete: missingCosts > 0 || orderConsumptions.length < orders.reduce((sum, order) => sum + order.items.length, 0) } : null,
  };
}
