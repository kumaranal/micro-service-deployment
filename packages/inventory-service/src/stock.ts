import type { StockItem } from "@ms/shared";

const stock = new Map<string, StockItem>([
  ["SKU-1", { sku: "SKU-1", available: 10 }],
  ["SKU-2", { sku: "SKU-2", available: 5 }],
  ["SKU-3", { sku: "SKU-3", available: 0 }],
]);

export function reserveStock(sku: string, quantity: number): boolean {
  const item = stock.get(sku);
  if (!item || item.available < quantity) return false;
  item.available -= quantity;
  return true;
}
