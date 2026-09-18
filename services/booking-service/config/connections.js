const { Kafka } = require('kafkajs');
const Redis = require('ioredis');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const redis = new Redis(process.env.REDIS_URL);
const kafka = new Kafka({
  clientId: 'booking-service',
  brokers: [process.env.KAFKA_BROKER]
});
const producer = kafka.producer();

const initialize = async () => {
  if (!process.env.DATABASE_URL || !process.env.REDIS_URL || !process.env.KAFKA_BROKER) {
    throw new Error('DATABASE_URL, REDIS_URL, and KAFKA_BROKER must be configured');
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS bookings (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      seat_numbers TEXT[] NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'cancelled')),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await redis.ping();
  await producer.connect();
};

const closeConnections = async () => {
  await producer.disconnect();
  await redis.quit();
  await pool.end();
};

module.exports = { closeConnections, initialize, pool, producer, redis };
