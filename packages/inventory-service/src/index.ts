import express from "express";
import { createKafkaClient, createProducer, createLogger } from "@ms/shared";
import { startOrderCreatedConsumer } from "./consumers/orderCreated.js";

const logger = createLogger("inventory-service");
const PORT = Number(process.env.PORT ?? 3001);

async function main() {
  const kafka = createKafkaClient("inventory-service");
  const producer = await createProducer(kafka);

  await startOrderCreatedConsumer(kafka, producer);

  const app = express();
  app.get("/healthz", (_req, res) => res.send("ok"));
  app.listen(PORT, () => logger.info(`inventory-service listening on ${PORT}`));
}

main().catch((err) => {
  logger.error(err, "inventory-service failed to start");
  process.exit(1);
});
