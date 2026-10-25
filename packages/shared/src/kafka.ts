import { Kafka, logLevel, type Producer, type Consumer } from "kafkajs";

const brokers = (process.env.KAFKA_BROKERS ?? "localhost:9092").split(",");

export function createKafkaClient(clientId: string): Kafka {
  return new Kafka({ clientId, brokers, logLevel: logLevel.WARN });
}

export async function createProducer(kafka: Kafka): Promise<Producer> {
  const producer = kafka.producer();
  await producer.connect();
  return producer;
}

export async function publishEvent(
  producer: Producer,
  topic: string,
  key: string,
  value: unknown
): Promise<void> {
  await producer.send({
    topic,
    messages: [{ key, value: JSON.stringify(value) }],
  });
}

export async function createConsumer(kafka: Kafka, groupId: string): Promise<Consumer> {
  const consumer = kafka.consumer({ groupId });
  await consumer.connect();
  return consumer;
}
