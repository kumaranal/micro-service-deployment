import express from "express";
import { createKafkaClient, createLogger } from "@ms/shared";
import { startInventoryUpdatedConsumer } from "./consumers/inventoryUpdated.js";

const logger = createLogger("notification-service");
const PORT = Number(process.env.PORT ?? 3002);

async function main() {
  const kafka = createKafkaClient("notification-service");
  await startInventoryUpdatedConsumer(kafka);

  const app = express();
  app.get("/healthz", (_req, res) => res.send("ok"));
  app.listen(PORT, () => logger.info(`notification-service listening on ${PORT}`));
}

main().catch((err) => {
  logger.error(err, "notification-service failed to start");
  process.exit(1);
});
