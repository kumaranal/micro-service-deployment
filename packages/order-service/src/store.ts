import type { Order, OrderStatus } from "@ms/shared";

const orders = new Map<string, Order>();

export function saveOrder(order: Order): void {
  orders.set(order.orderId, order);
}

export function getOrder(orderId: string): Order | undefined {
  return orders.get(orderId);
}

export function updateOrderStatus(orderId: string, status: OrderStatus): Order | undefined {
  const order = orders.get(orderId);
  if (!order) return undefined;
  order.status = status;
  order.updatedAt = new Date().toISOString();
  return order;
}
