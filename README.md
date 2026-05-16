# pix-payment-core

A backend service that simulates a Pix payment provider — focused on the parts that actually break in production: idempotent requests, explicit state transitions, deduplicated webhooks, and logs you can trace under load.

Built as a portable demo of the techniques I apply when working with real payment systems.

![CI](https://github.com/lmoraesdev/pix-payment-core/actions/workflows/ci.yml/badge.svg)
![nodejs](https://img.shields.io/badge/Node.js-20-339933?logo=nodedotjs&logoColor=white)
![typescript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)
![nestjs](https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs&logoColor=white)
![postgres](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![docker](https://img.shields.io/badge/docker-compose-2496ED?logo=docker&logoColor=white)

---

## Why this exists

Most payment tutorials show happy-path CRUD. Production payment code fails in the gaps: the webhook that arrives twice, the timeout that leaves you guessing if the provider charged the client, the race between two retries of the same request.

This project demonstrates the patterns I use to handle those gaps:

- **Idempotency keys** so retried requests are safe
- **A state machine** so transitions can't drift into invalid states
- **Webhook deduplication** so a provider's retry storm doesn't cause double processing
- **Structured logging with correlation IDs** so an incident at 2am has a paper trail

The provider integration is mocked — the goal is to show the patterns, not to wire a real Pix provider.

## Architecture

```
                              ┌─────────────────────┐
                              │   correlation_id    │
                              │   middleware        │
                              └──────────┬──────────┘
                                         ▼
       client                  ┌──────────────────┐
       ──────POST /charges──▶  │ ChargesController│
       Idempotency-Key         └──────────┬───────┘
                                          ▼
                              ┌──────────────────────┐
                              │ Idempotency check    │
                              │ (existing key?)      │
                              └──────────┬───────────┘
                                         ▼
                              ┌──────────────────────┐
                              │ Charge State Machine │
                              │ CREATED → AWAITING…  │
                              └──────────┬───────────┘
                                         ▼
                              ┌──────────────────────┐
                              │ Charge Repository    │
                              │  (PostgreSQL)        │
                              └──────────────────────┘

       provider               ┌──────────────────────┐
       ──POST /webhooks/...▶  │ WebhooksController   │
                              └──────────┬───────────┘
                                         ▼
                              ┌──────────────────────┐
                              │ Event dedup          │
                              │ (event_id unique)    │
                              └──────────┬───────────┘
                                         ▼
                              ┌──────────────────────┐
                              │ Apply state          │
                              │ transition           │
                              └──────────────────────┘
```

## State machine

```
   CREATED ──────▶ AWAITING_PAYMENT ──────▶ PAID
                          │
                          └──────────────▶ EXPIRED
```

| From | To | Trigger |
|------|------|---------|
| CREATED | AWAITING_PAYMENT | After registering with the (mocked) provider |
| AWAITING_PAYMENT | PAID | Provider webhook with `payment.confirmed` |
| AWAITING_PAYMENT | EXPIRED | Provider webhook with `payment.expired` (or TTL job) |

Any other transition is rejected and logged as a state machine violation. There is no `setStatus()` — every change goes through `transitionTo()` which validates the move.

## API

### POST /charges

Creates a new charge. Requires `Idempotency-Key` header.

```http
POST /charges
Content-Type: application/json
Idempotency-Key: 1f2c3d4e-5b6a-7c8d-9e0f-1a2b3c4d5e6f

{
  "amount": 5000,
  "currency": "BRL",
  "payer_document": "12345678900",
  "description": "Order #1234"
}
```

Response (201):

```json
{
  "id": "ch_2N9kP3lQ...",
  "status": "AWAITING_PAYMENT",
  "amount": 5000,
  "currency": "BRL",
  "qr_code": "00020126...",
  "expires_at": "2026-05-13T15:32:00.000Z",
  "created_at": "2026-05-13T14:32:00.000Z"
}
```

Retrying the same `Idempotency-Key` with the **same body** returns the original response. Retrying with a **different body** returns `422 Unprocessable Entity`.

### GET /charges/:id

Returns the current state of a charge.

### GET /health

Returns `{ "status": "ok" }` with 200. Used as a liveness probe by Docker Compose.

### POST /webhooks/provider

Receives an event from the provider.

```http
POST /webhooks/provider
Content-Type: application/json

{
  "event_id": "evt_abc123",
  "type": "payment.confirmed",
  "charge_id": "ch_2N9kP3lQ...",
  "occurred_at": "2026-05-13T14:35:00.000Z"
}
```

Events are deduplicated by `event_id`. Replays return `200` without reprocessing.

## Idempotency

Each successful charge creation is anchored to an idempotency record:

| Column | Purpose |
|--------|---------|
| `key` | The `Idempotency-Key` header value |
| `request_hash` | SHA-256 of the canonicalized request body |
| `charge_id` | FK to the created charge |
| `response_body` | The JSON response we returned originally |
| `created_at` | For TTL cleanup |

On every incoming `POST /charges`:

1. Look up the key
2. If not found → create the charge, persist the key + response, return 201
3. If found and `request_hash` matches → return the saved response, 200
4. If found and `request_hash` differs → return 422 (the client reused the key for something else)

This pattern follows what Stripe and other payment platforms expose publicly.

## Logging (5W1H)

Every log line is a single JSON object with a fixed shape. When an incident hits at 2am, every dimension is already there — no grepping across fields.

```json
{
  "level": "info",
  "where": "CreateChargeService",
  "what": "charge_created",
  "why": "user_request",
  "who": "12345678901",
  "how": "POST /charges",
  "when": "2026-05-13T14:32:00.123Z",
  "correlation_id": "req_8h2k3pX...",
  "charge_id": "ch_2N9kP3lQ...",
  "amount": 5000,
  "currency": "BRL"
}
```

### Events emitted

| Service | `what` | `level` | Extra fields |
|---------|--------|---------|--------------|
| `CreateChargeService` | `charge_created` | info | `charge_id`, `amount`, `currency`, `who` (payer_document) |
| `CreateChargeService` | `idempotency_cache_hit` | info | `charge_id` |
| `CreateChargeService` | `idempotency_conflict` | warn | `key` |
| `ProcessWebhookService` | `webhook_received` | info | `event_id`, `type`, `charge_id` |
| `ProcessWebhookService` | `webhook_already_processed` | info | `event_id` |
| `ProcessWebhookService` | `charge_state_transitioned` | info | `charge_id`, `from`, `to` |

### correlation_id propagation

The `CorrelationIdMiddleware` runs on every request. It reads `X-Correlation-Id` from the incoming headers — if present, it reuses it; if not, it generates `req_<uuid>`. The value is:

1. Written back to the response as `X-Correlation-Id`
2. Stored in an `AsyncLocalStorage` for the duration of the request

Every log emitted anywhere in the async call chain automatically reads the stored value — services never receive `correlation_id` as a parameter.

**Client-side tracing**: pass your own `X-Correlation-Id` on requests to link logs across services in a distributed system.

## Running locally

Requires Docker and Docker Compose.

```bash
git clone https://github.com/lmoraesdev/pix-payment-core.git
cd pix-payment-core
cp .env.example .env
docker compose up --build
```

The API is reachable at `http://localhost:3000`. Interactive Swagger docs at `http://localhost:3000/api/docs`. PostgreSQL runs on `localhost:5432`.

Run tests:

```bash
npm test              # unit tests
npm run test:e2e      # end-to-end
```

## Project layout

```
src/
├── modules/
│   ├── charges/
│   │   ├── domain/              # entity + state machine (no framework deps)
│   │   ├── application/         # use cases, DTOs
│   │   ├── infrastructure/      # TypeORM repositories
│   │   └── presentation/        # controllers
│   └── webhooks/
├── shared/
│   ├── logger/                  # structured logger
│   └── middleware/              # correlation id
└── config/
test/
├── unit/                        # state machine, services
└── e2e/                         # full request flow
```

The domain layer has no NestJS or TypeORM imports. Business rules — including the state machine — can be tested without spinning up a database.

## Decisions

- **State machine as a class, not a flag.** Adds boilerplate, removes a whole category of bugs where code path A and code path B disagree on what `status` is allowed to become.
- **Idempotency-Key in the header, not the body.** Convention used by Stripe, Mercado Pago, and others. Separates request identity from request payload.
- **Webhook dedup in Postgres, not Redis.** A unique constraint with `ON CONFLICT DO NOTHING` is enough at this scale. Adding Redis would be over-engineering for a demo.
- **TypeORM over Prisma.** Chosen to keep the stack close to what I use day-to-day. Prisma would be a natural next-step migration.
- **5W1H logs.** Same format I've used in production. Makes log correlation across services trivial.
- **AsyncLocalStorage for correlation ID propagation.** The `CorrelationIdMiddleware` stores the ID once per request in an `AsyncLocalStorage` context; every service reads it automatically without needing it passed as a parameter. No NestJS request scope required.

## Error handling

Every error response includes a machine-readable `code` field that clients can map programmatically — no string-parsing required. See the full [error codes catalog](docs/error-codes.md).

## API documentation

The API is documented with OpenAPI 3 via `@nestjs/swagger`. Once the service is running, the interactive Swagger UI is available at:

```
http://localhost:3000/api/docs
```

Every endpoint, DTO and response is annotated, so the docs always reflect the current code.

## Roadmap

Shipped in MVP:

- [x] Structured logging (5W1H) with correlation IDs via AsyncLocalStorage
- [x] Machine-readable error codes catalog
- [x] CI pipeline (GitHub Actions — lint, build, test on every push)
- [x] Liveness probe (`GET /health`)

Planned for v2:

- [ ] Cancel and refund flows
- [ ] Retry with exponential backoff (BullMQ + Redis)
- [ ] Expiration job (cron-based, currently triggered by webhook only)
- [ ] Migration to Prisma

## License

MIT
