import { Router } from "express";
import { randomUUID } from "node:crypto";
import type { Producer } from "kafkajs";
import { Topics, publishEvent, createLogger, type Order, type OrderCreatedEvent } from "@ms/shared";
import { saveOrder, getOrder } from "../store.js";

const logger = createLogger("order-service:routes");

export function createOrdersRouter(producer: Producer): Router {
  const router = Router();

  router.post("/", async (req, res) => {
    const { sku, quantity } = req.body as { sku?: string; quantity?: number };
    if (!sku || !quantity || quantity <= 0) {
      res.status(400).json({ error: "sku and a positive quantity are required" });
      return;
    }

    const now = new Date().toISOString();
    const order: Order = {
      orderId: randomUUID(),
      sku,
      quantity,
      status: "PENDING",
      createdAt: now,
      updatedAt: now,
    };
    saveOrder(order);

    const event: OrderCreatedEvent = {
      orderId: order.orderId,
      sku: order.sku,
      quantity: order.quantity,
      createdAt: order.createdAt,
    };
    await publishEvent(producer, Topics.ORDERS_CREATED, order.orderId, event);

    logger.info({ orderId: order.orderId }, "order created, event published");
    res.status(201).json(order);
  });

  router.get("/:orderId", (req, res) => {
    const order = getOrder(req.params.orderId);
    if (!order) {
      res.status(404).json({ error: "order not found" });
      return;
    }
    res.json(order);
  });

  return router;
}
