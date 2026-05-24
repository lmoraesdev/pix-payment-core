# Error codes

Every error response from this API includes a machine-readable `code` field alongside `statusCode` and `message`:

```json
{
  "statusCode": 404,
  "code": "AE01",
  "message": "Charge not found: \"ch_abc123\""
}
```

Use `code` to branch your error handling programmatically. Do not parse `message` — it is for humans and may change between releases.

## Catalog

Codes are prefixed: `AE` = application/domain error, `IE` = internal/infrastructure error.

| Code | Name | HTTP status | When it happens | Resolution hint |
|------|------|-------------|-----------------|-----------------|
| `AE01` | `CHARGE_NOT_FOUND` | 404 | The `charge_id` in the request does not match any stored charge | Verify the id was created via `POST /charges` and not deleted |
| `AE02` | `IDEMPOTENCY_CONFLICT` | 422 | A request with the same `Idempotency-Key` was already registered with a different body | Use a new `Idempotency-Key` for a different request, or resend the exact original body to retrieve the cached response |
| `AE03` | `INVALID_STATE_TRANSITION` | 409 | A webhook or operation attempted a state change that the charge state machine does not allow (e.g. `PAID → EXPIRED`) | Check the current charge status via `GET /charges/:id` before retrying |
| `AE04` | `WEBHOOK_EVENT_ALREADY_PROCESSED` | — | A webhook event with this `event_id` was already processed — the request is silently deduplicated and returns 200 | No action needed; idempotent by design |
| `AE05` | `UNKNOWN_EVENT_TYPE` | 422 | The webhook payload contains an `type` value that is not recognized by the system | Verify the event type against the supported values: `payment.confirmed`, `payment.expired` |
| `AE06` | `MISSING_IDEMPOTENCY_KEY` | 400 | The `POST /charges` request was made without the required `Idempotency-Key` header | Include a unique `Idempotency-Key` header in every charge creation request |
| `IE01` | `INTERNAL_ERROR` | 500 | An unexpected server-side error occurred | Retry after a short delay; if the issue persists, contact support |

## Other error responses

In addition to the domain errors above, the API returns standard responses for:

- **400 Bad Request** — request body fails Zod schema validation, or `:id` param is not a UUID
- **401 Unauthorized** — webhook signature is missing or does not match `WEBHOOK_SECRET`

These responses follow NestJS's default envelope and do not carry a custom `code` — they originate at the framework layer, not the domain.
