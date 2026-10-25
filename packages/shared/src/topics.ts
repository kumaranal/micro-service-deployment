import type { OrderStatus } from "./types.js";

export const Topics = {
  ORDERS_CREATED: "orders.created",
  INVENTORY_UPDATED: "inventory.updated",
} as const;

export interface OrderCreatedEvent {
  orderId: string;
  sku: string;
  quantity: number;
  createdAt: string;
}

export interface InventoryUpdatedEvent {
  orderId: string;
  sku: string;
  status: Exclude<OrderStatus, "PENDING">;
  updatedAt: string;
}
