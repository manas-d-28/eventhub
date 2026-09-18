require('dns').setDefaultResultOrder('ipv4first');
require('dotenv').config();

const express = require('express');
const { Kafka } = require('kafkajs');

const app = express();
const port = process.env.PORT || 3005;
const topic = 'booking-events';
const groupId = 'notification-service';
const maxKafkaAttempts = 12;
const retryDelayMs = 5000;
let kafkaConnected = false;
let consumer;

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', kafkaConnected });
});

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const handleBookingEvent = async ({ message }) => {
  let event;
  try {
    event = JSON.parse(message.value.toString());
  } catch (error) {
    console.error('[Kafka] Ignoring invalid booking event:', error.message);
    return;
  }

  const { bookingId, seatNumbers, status, userId } = event;
  if (status === 'confirmed') {
    console.log(`[EMAIL] Sending booking confirmation to user ${userId} for booking ${bookingId}, seats: ${seatNumbers}`);
  } else if (status === 'cancelled') {
    console.log(`[EMAIL] Sending booking cancellation to user ${userId} for booking ${bookingId}, seats: ${seatNumbers}`);
  } else {
    console.log(`[Kafka] Ignoring booking event with unsupported status: ${status}`);
  }
};

const consumeBookingEvents = async () => {
  if (!process.env.KAFKA_BROKER) {
    throw new Error('KAFKA_BROKER is not configured');
  }

  const kafka = new Kafka({
    clientId: 'notification-service',
    brokers: [process.env.KAFKA_BROKER]
  });
  consumer = kafka.consumer({ groupId });
  await consumer.connect();
  await consumer.subscribe({ topic, fromBeginning: false });
  kafkaConnected = true;
  console.log(`[Kafka] Connected and subscribed to ${topic}`);
  await consumer.run({ eachMessage: handleBookingEvent });
};

const startKafkaConsumer = async () => {
  for (let attempt = 1; attempt <= maxKafkaAttempts; attempt += 1) {
    try {
      await consumeBookingEvents();
      return;
    } catch (error) {
      kafkaConnected = false;
      console.error(`[Kafka] Connection attempt ${attempt}/${maxKafkaAttempts} failed: ${error.message}`);
      if (consumer) {
        await consumer.disconnect().catch(() => {});
        consumer = undefined;
      }
      if (attempt < maxKafkaAttempts) {
        console.log(`[Kafka] Retrying in ${retryDelayMs / 1000} seconds...`);
        await wait(retryDelayMs);
      }
    }
  }

  console.error('[Kafka] Unable to connect after maximum retry attempts; health remains degraded.');
};

let server;

if (require.main === module) {
  server = app.listen(port, () => {
    console.log(`Notification service health endpoint running on port ${port}`);
  });
  startKafkaConsumer();
}

const shutdown = async () => {
  kafkaConnected = false;
  if (consumer) await consumer.disconnect().catch(() => {});
  if (server) server.close(() => process.exit(0));
  else process.exit(0);
};

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

module.exports = { app, handleBookingEvent, startKafkaConsumer };
