import type { Kafka } from "kafkajs";
import { Topics, createLogger, type InventoryUpdatedEvent } from "@ms/shared";

const logger = createLogger("notification-service:inventory-updated-consumer");

export async function startInventoryUpdatedConsumer(kafka: Kafka): Promise<void> {
  const consumer = kafka.consumer({ groupId: "notification-service" });
  await consumer.connect();
  await consumer.subscribe({ topic: Topics.INVENTORY_UPDATED, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      const event = JSON.parse(message.value.toString()) as InventoryUpdatedEvent;
      const subject =
        event.status === "RESERVED"
          ? `Your order ${event.orderId} is confirmed`
          : `Your order ${event.orderId} is out of stock`;
      logger.info({ to: "customer@example.com", subject }, "email sent (simulated)");
    },
  });
}
