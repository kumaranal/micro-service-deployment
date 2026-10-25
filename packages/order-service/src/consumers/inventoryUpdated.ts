import type { Kafka } from "kafkajs";
import { Topics, createLogger, type InventoryUpdatedEvent } from "@ms/shared";
import { updateOrderStatus } from "../store.js";

const logger = createLogger("order-service:inventory-updated-consumer");

export async function startInventoryUpdatedConsumer(kafka: Kafka): Promise<void> {
  const consumer = kafka.consumer({ groupId: "order-service" });
  await consumer.connect();
  await consumer.subscribe({ topic: Topics.INVENTORY_UPDATED, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      const event = JSON.parse(message.value.toString()) as InventoryUpdatedEvent;
      const order = updateOrderStatus(event.orderId, event.status);
      if (!order) {
        logger.warn({ orderId: event.orderId }, "received update for unknown order");
        return;
      }
      logger.info({ orderId: event.orderId, status: event.status }, "order status updated");
    },
  });
}
