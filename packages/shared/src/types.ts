export type OrderStatus = "PENDING" | "RESERVED" | "OUT_OF_STOCK";

export interface Order {
  orderId: string;
  sku: string;
  quantity: number;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
}

export interface StockItem {
  sku: string;
  available: number;
}
