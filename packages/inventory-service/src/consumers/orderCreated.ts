import type { Kafka, Producer } from "kafkajs";
import {
  Topics,
  publishEvent,
  createLogger,
  retry,
  type OrderCreatedEvent,
  type InventoryUpdatedEvent,
} from "@ms/shared";
import { reserveStock } from "../stock.js";

const logger = createLogger("inventory-service:order-created-consumer");

export async function startOrderCreatedConsumer(kafka: Kafka, producer: Producer): Promise<void> {
  const consumer = kafka.consumer({ groupId: "inventory-service" });
  await consumer.connect();
  await retry(() => consumer.subscribe({ topic: Topics.ORDERS_CREATED, fromBeginning: false }));

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      const event = JSON.parse(message.value.toString()) as OrderCreatedEvent;
      const reserved = reserveStock(event.sku, event.quantity);

      const update: InventoryUpdatedEvent = {
        orderId: event.orderId,
        sku: event.sku,
        status: reserved ? "RESERVED" : "OUT_OF_STOCK",
        updatedAt: new Date().toISOString(),
      };
      await publishEvent(producer, Topics.INVENTORY_UPDATED, event.orderId, update);
      logger.info({ orderId: event.orderId, status: update.status }, "inventory processed");
    },
  });
}
