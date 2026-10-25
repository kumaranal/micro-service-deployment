import express from "express";
import { createKafkaClient, createProducer, createLogger } from "@ms/shared";
import { createOrdersRouter } from "./routes/orders.js";
import { startInventoryUpdatedConsumer } from "./consumers/inventoryUpdated.js";

const logger = createLogger("order-service");
const PORT = Number(process.env.PORT ?? 3000);

async function main() {
  const kafka = createKafkaClient("order-service");
  const producer = await createProducer(kafka);

  const app = express();
  app.use(express.json());
  app.get("/healthz", (_req, res) => res.send("ok"));
  app.use("/orders", createOrdersRouter(producer));

  await startInventoryUpdatedConsumer(kafka);

  app.listen(PORT, () => logger.info(`order-service listening on ${PORT}`));
}

main().catch((err) => {
  logger.error(err, "order-service failed to start");
  process.exit(1);
});
