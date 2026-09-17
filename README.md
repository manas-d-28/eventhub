# EventHub

EventHub is a scalable event booking platform organized as a Node.js microservices monorepo.

## Structure

- `services/auth-service`: Authentication and authorization service.
- `services/event-service`: Event catalog and management service.
- `services/booking-service`: Booking workflow service.
- `services/payment-service`: Payment processing service.
- `services/notification-service`: Notification delivery service.
- `gateway`: API gateway placeholder.
- `frontend`: Frontend application placeholder.

Each service is an independent Express application with its own dependencies and environment example. Business logic is intentionally not included yet.

## Run a service

```powershell
cd services/auth-service
Copy-Item .env.example .env
npm install
npm run dev
```

Replace `auth-service` with another service directory as needed. The default ports are `3001` through `3005` in service order.

## Run with Docker Compose

```powershell
docker compose up
```

The Compose setup mounts each service into a Node.js container and publishes its default port.
