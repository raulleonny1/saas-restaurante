# SmartServe AI — API interna

> **Solo diseño.** Sin implementación.  
> Base path: `/api/internal/v1/ai`  
> Consumidores: App BFF, Cloud Functions, workers del propio módulo, integraciones firmadas.  
> Arquitectura: [`AI_MODULE_ARCHITECTURE.md`](./AI_MODULE_ARCHITECTURE.md)

**Versión del contrato:** `1.0.0` · **Estado:** diseño

---

## 1. Convenciones

### 1.1 Autenticación y tenant

| Mecanismo | Uso |
|-----------|-----|
| `Authorization: Bearer <Firebase ID token>` | Llamadas desde app / BFF |
| `X-Restaurant-Id: <restaurantId>` | Tenant obligatorio (salvo webhooks de plataforma) |
| `X-Branch-Id: <branchId>` | Opcional; filtra por sucursal |
| `X-Request-Id: <uuid>` | Correlación / idempotencia de lectura |
| `Idempotency-Key: <uuid>` | Obligatorio en POST de mutación costosa (chat, jobs, generate) |
| `X-Internal-Service: <service>` + firma HMAC | Worker → API (service-to-service) |

Claims del token + membership del restaurant validan RBAC (`ai.assistant`, `ai.insights`, `ai.manage`, `ai.proposals.manage`).

### 1.2 Formato

- JSON (`application/json`) salvo SSE (`text/event-stream`).
- Fechas ISO-8601 UTC.
- Paginación cursor: `?cursor=&limit=` (default `limit=20`, max `100`).
- Errores:

```json
{
  "error": {
    "code": "AI_QUOTA_EXCEEDED",
    "message": "Monthly AI query limit reached",
    "details": { "limit": 100, "used": 100 },
    "requestId": "…"
  }
}
```

| HTTP | Códigos de dominio típicos |
|------|----------------------------|
| 400 | `VALIDATION_ERROR` |
| 401 | `UNAUTHENTICATED` |
| 403 | `FORBIDDEN` / `ENTITLEMENT_REQUIRED` |
| 404 | `NOT_FOUND` |
| 409 | `CONFLICT` / `IDEMPOTENCY_REPLAY` |
| 422 | `POLICY_VIOLATION` (guardrail) |
| 429 | `AI_QUOTA_EXCEEDED` / `RATE_LIMITED` |
| 502 | `PROVIDER_ERROR` |
| 503 | `JOB_BACKPRESSURE` |

### 1.3 Versionado

- Prefijo `/v1/`. Breaking changes → `/v2/`.
- Campos nuevos son aditivos. Campos deprecados: header `Sunset` + doc.

### 1.4 Índice rápido

| Grupo | Métodos |
|-------|---------|
| [Health](#2-health--meta) | GET |
| [Settings](#3-settings) | GET, PUT |
| [Usage](#4-usage--metering) | GET |
| [Sessions / Assistant](#5-assistant--sessions) | GET, POST, PUT, DELETE |
| [Messages](#6-messages) | GET, POST |
| [Insights](#7-insights--alertas) | GET, POST, PUT, DELETE |
| [Recommendations](#8-recommendations) | GET, POST, PUT |
| [Forecasts](#9-forecasts) | GET, POST |
| [Customer analytics](#10-customer-analytics) | GET, POST |
| [Proposals](#11-proposals) | GET, POST, PUT |
| [Jobs](#12-jobs) | GET, POST, DELETE |
| [Feature store admin](#13-feature-store-admin) | GET, POST |
| [Webhooks](#14-webhooks) | POST |
| [Realtime](#15-realtime) | SSE / Firestore |

---

## 2. Health & meta

### `GET /api/internal/v1/ai/health`

Estado del bounded context AI (no valida tenant).

| | |
|--|--|
| **Auth** | Interna o pública restringida (no expone secretos) |
| **Permiso** | — |
| **Response 200** | `{ "status": "ok" \| "degraded", "version": "1.0.0", "providers": { "llm": "up", "forecast": "up" } }` |

---

### `GET /api/internal/v1/ai/capabilities`

Lista capacidades habilitadas para el tenant según plan + settings.

| | |
|--|--|
| **Auth** | Bearer + restaurant |
| **Permiso** | `ai.insights` |
| **Response 200** | `{ "capabilities": [{ "id": "forecast.sales", "enabled": true, "entitlement": "ai.forecasting" }], "limits": { "aiQueriesPerMonth": 500 } }` |

---

## 3. Settings

### `GET /api/internal/v1/ai/settings`

Configuración AI del restaurant.

| | |
|--|--|
| **Auth** | Bearer + restaurant |
| **Permiso** | `ai.manage` (lectura también `ai.insights` con campos redactados) |
| **Response 200** | Ver schema `AiSettings` abajo |

```json
{
  "restaurantId": "…",
  "locale": "es-ES",
  "brandVoice": "cercano y profesional",
  "provider": { "llm": "default", "forecast": "default" },
  "autoApply": {
    "promotions": false,
    "campaigns": false,
    "reorders": false
  },
  "thresholds": {
    "stockDaysOfCover": 3,
    "salesAnomalyZ": 2.5,
    "insightDedupHours": 24
  },
  "assistant": {
    "maxToolRounds": 4,
    "enableWebSearch": false
  },
  "updatedAt": "2026-07-19T00:00:00.000Z"
}
```

---

### `PUT /api/internal/v1/ai/settings`

Reemplazo/actualización de settings (merge shallow del body).

| | |
|--|--|
| **Auth** | Bearer + restaurant |
| **Permiso** | `ai.manage` |
| **Body** | Subconjunto de `AiSettings` (sin `restaurantId`) |
| **Response 200** | `AiSettings` actualizado |
| **Errores** | `422 POLICY_VIOLATION` si auto-apply sin entitlement |

---

## 4. Usage & metering

### `GET /api/internal/v1/ai/usage`

Uso del periodo de billing actual (o `?period=2026-07`).

| | |
|--|--|
| **Auth** | Bearer + restaurant |
| **Permiso** | `ai.insights` |
| **Query** | `period?: YYYY-MM` |
| **Response 200** | `{ "periodId", "periodStart", "periodEnd", "queries", "tokensPrompt", "tokensCompletion", "limits": { "aiQueriesPerMonth" } }` |

---

### `GET /api/internal/v1/ai/usage/history`

Histórico de periodos.

| | |
|--|--|
| **Permiso** | `ai.manage` |
| **Query** | `cursor`, `limit` |
| **Response 200** | `{ "items": AiUsage[], "nextCursor": null }` |

---

## 5. Assistant — sessions

### `GET /api/internal/v1/ai/sessions`

Lista sesiones del usuario (o todas si `ai.manage` + `?scope=restaurant`).

| | |
|--|--|
| **Permiso** | `ai.assistant` |
| **Query** | `branchId?`, `cursor`, `limit`, `scope?: mine \| restaurant` |
| **Response 200** | `{ "items": AiSession[], "nextCursor" }` |

`AiSession`: `id`, `restaurantId`, `branchId`, `createdBy`, `title`, `model`, `messageCount`, `lastMessageAt`, `createdAt`, `updatedAt`.

---

### `POST /api/internal/v1/ai/sessions`

Crea sesión de chat.

| | |
|--|--|
| **Permiso** | `ai.assistant` |
| **Idempotency-Key** | Recomendado |
| **Body** | `{ "branchId"?: string \| null, "title"?: string }` |
| **Response 201** | `AiSession` |
| **Errores** | `429 AI_QUOTA_EXCEEDED` |

---

### `GET /api/internal/v1/ai/sessions/{sessionId}`

Detalle de sesión.

| | |
|--|--|
| **Permiso** | `ai.assistant` (solo owner salvo `ai.manage`) |
| **Response 200** | `AiSession` |
| **Errores** | `404` |

---

### `PUT /api/internal/v1/ai/sessions/{sessionId}`

Actualiza metadatos (título, branch).

| | |
|--|--|
| **Permiso** | `ai.assistant` (owner) |
| **Body** | `{ "title"?: string, "branchId"?: string \| null }` |
| **Response 200** | `AiSession` |

---

### `DELETE /api/internal/v1/ai/sessions/{sessionId}`

Soft-delete de sesión (+ mensajes).

| | |
|--|--|
| **Permiso** | `ai.assistant` (owner) o `ai.manage` |
| **Response 204** | — |

---

## 6. Messages

### `GET /api/internal/v1/ai/sessions/{sessionId}/messages`

Historial paginado (orden cronológico ascendente por cursor).

| | |
|--|--|
| **Permiso** | `ai.assistant` |
| **Query** | `cursor`, `limit` |
| **Response 200** | `{ "items": AiMessage[], "nextCursor" }` |

`AiMessage`: `id`, `role`, `content`, `tokenUsage?`, `contextRefs?`, `toolCalls?`, `createdAt`.

---

### `POST /api/internal/v1/ai/sessions/{sessionId}/messages`

Envía mensaje de usuario; orquesta tools + respuesta del asistente.

| | |
|--|--|
| **Permiso** | `ai.assistant` |
| **Idempotency-Key** | **Obligatorio** |
| **Body** | `{ "content": string, "attachments"?: [{ "type": "insight" \| "forecast" \| "proposal", "id": string }] }` |
| **Response 200** | `{ "userMessage": AiMessage, "assistantMessage": AiMessage, "usage": { "queriesDelta": 1, "tokensPrompt", "tokensCompletion" } }` |
| **Errores** | `429`, `502 PROVIDER_ERROR`, `422 POLICY_VIOLATION` |

> Streaming: preferir [Realtime SSE](#151-sse--server-sent-events) `POST …/messages:stream`.

---

### `POST /api/internal/v1/ai/sessions/{sessionId}/messages:stream`

Igual que POST messages, respuesta **SSE** (ver §15.1).

| | |
|--|--|
| **Permiso** | `ai.assistant` |
| **Idempotency-Key** | Obligatorio |
| **Response 200** | `text/event-stream` |

---

### `DELETE /api/internal/v1/ai/sessions/{sessionId}/messages/{messageId}`

Soft-delete de un mensaje (redacción / cumplimiento). No recalcula la conversación automáticamente.

| | |
|--|--|
| **Permiso** | `ai.manage` |
| **Response 204** | — |

---

## 7. Insights / alertas

### `GET /api/internal/v1/ai/insights`

Inbox de insights (alertas, hallazgos, algunos recs).

| | |
|--|--|
| **Permiso** | `ai.insights` |
| **Query** | `status?: new\|seen\|dismissed\|acted`, `type?`, `branchId?`, `from?`, `to?`, `cursor`, `limit` |
| **Response 200** | `{ "items": AiInsight[], "nextCursor" }` |

---

### `GET /api/internal/v1/ai/insights/{insightId}`

| | |
|--|--|
| **Permiso** | `ai.insights` |
| **Response 200** | `AiInsight` |

---

### `POST /api/internal/v1/ai/insights`

Creación **interna** (jobs / service account). La UI no crea insights arbitrarios.

| | |
|--|--|
| **Auth** | Service-to-service |
| **Permiso** | interno `ai.jobs.write` |
| **Body** | `{ "type", "title", "summary", "confidence", "branchId?", "data?", "expiresAt?", "fingerprint?" }` |
| **Response 201** | `AiInsight` |
| **Idempotencia** | `fingerprint` + ventana dedup → 200 existing |

---

### `PUT /api/internal/v1/ai/insights/{insightId}`

Cambia estado / feedback humano.

| | |
|--|--|
| **Permiso** | `ai.insights` |
| **Body** | `{ "status"?: "seen"\|"dismissed"\|"acted", "feedback"?: { "helpful": boolean, "reason"?: string } }` |
| **Response 200** | `AiInsight` |

---

### `POST /api/internal/v1/ai/insights/{insightId}/act`

Atajo: marca `acted` y opcionalmente enlaza entidad creada en otro módulo.

| | |
|--|--|
| **Permiso** | `ai.insights` (+ permiso del módulo destino si aplica) |
| **Body** | `{ "linkedEntityRef"?: { "type": string, "id": string } }` |
| **Response 200** | `AiInsight` |

---

### `DELETE /api/internal/v1/ai/insights/{insightId}`

Soft-delete / dismiss permanente.

| | |
|--|--|
| **Permiso** | `ai.manage` |
| **Response 204** | — |

---

## 8. Recommendations

Subconjunto tipado de recomendaciones operativas (también pueden vivir como insights `type=recommendation`).

### `GET /api/internal/v1/ai/recommendations`

| | |
|--|--|
| **Permiso** | `ai.insights` |
| **Query** | `branchId?`, `status?: open\|done\|dismissed`, `cursor`, `limit` |
| **Response 200** | `{ "items": AiRecommendation[], "nextCursor" }` |

`AiRecommendation`: `id`, `title`, `rationale`, `impactScore`, `effort`, `deepLink`, `proposalId?`, `status`, `createdAt`.

---

### `POST /api/internal/v1/ai/recommendations:refresh`

Encola job `recs.refresh`.

| | |
|--|--|
| **Permiso** | `ai.manage` |
| **Idempotency-Key** | Obligatorio |
| **Body** | `{ "branchId"?: string }` |
| **Response 202** | `{ "jobId": string }` |

---

### `PUT /api/internal/v1/ai/recommendations/{recommendationId}`

| | |
|--|--|
| **Permiso** | `ai.insights` |
| **Body** | `{ "status": "done" \| "dismissed" }` |
| **Response 200** | `AiRecommendation` |

---

## 9. Forecasts

### `GET /api/internal/v1/ai/forecasts`

Lista forecasts materializados.

| | |
|--|--|
| **Permiso** | `ai.insights` + entitlement `ai.forecasting` |
| **Query** | `kind?: sales\|inventory`, `branchId?`, `status?: latest\|all`, `cursor`, `limit` |
| **Response 200** | `{ "items": AiForecastSummary[], "nextCursor" }` |

---

### `GET /api/internal/v1/ai/forecasts/{forecastId}`

Detalle con puntos de serie.

| | |
|--|--|
| **Permiso** | `ai.insights` |
| **Response 200** | `AiForecast` (`kind`, `horizonDays`, `grain`, `points[]`, `confidence`, `modelId`, …) |

---

### `GET /api/internal/v1/ai/forecasts/latest`

Atajo: último forecast por kind.

| | |
|--|--|
| **Permiso** | `ai.insights` |
| **Query** | `kind=sales\|inventory` (**requerido**), `branchId?` |
| **Response 200** | `AiForecast` |
| **Errores** | `404` si aún no hay run |

---

### `POST /api/internal/v1/ai/forecasts:run`

Encola regeneración (`sales-forecast` y/o `inventory-forecast`).

| | |
|--|--|
| **Permiso** | `ai.manage` |
| **Idempotency-Key** | Obligatorio |
| **Body** | `{ "kind": "sales" \| "inventory" \| "both", "branchId"?: string, "horizonDays"?: number }` |
| **Response 202** | `{ "jobIds": string[] }` |
| **Errores** | `403 ENTITLEMENT_REQUIRED`, `503 JOB_BACKPRESSURE` |

---

## 10. Customer analytics

### `GET /api/internal/v1/ai/customers/segments`

Segmentos materializados.

| | |
|--|--|
| **Permiso** | `ai.insights` + entitlement analytics |
| **Response 200** | `{ "segments": [{ "id", "name", "size", "updatedAt" }] }` |

---

### `GET /api/internal/v1/ai/customers/profiles`

Perfiles AI (scores, sin PII innecesaria).

| | |
|--|--|
| **Permiso** | `ai.insights` |
| **Query** | `segmentId?`, `risk?: at_risk\|vip\|…`, `cursor`, `limit` |
| **Response 200** | `{ "items": AiCustomerProfile[], "nextCursor" }` |

`AiCustomerProfile`: `customerId`, `segmentIds`, `scores: { rfm, churnRisk, ltv }`, `updatedAt`.

---

### `GET /api/internal/v1/ai/customers/profiles/{customerId}`

| | |
|--|--|
| **Permiso** | `ai.insights` |
| **Response 200** | `AiCustomerProfile` + `signals[]` |

---

### `POST /api/internal/v1/ai/customers:analyze`

Encola `customer-analytics`.

| | |
|--|--|
| **Permiso** | `ai.manage` |
| **Idempotency-Key** | Obligatorio |
| **Body** | `{ "fullRecompute"?: boolean }` |
| **Response 202** | `{ "jobId": string }` |

---

## 11. Proposals

Propuestas generadas por AI (promo, campaña, reorder, recommendation-linked).

### `GET /api/internal/v1/ai/proposals`

| | |
|--|--|
| **Permiso** | `ai.insights` o `ai.proposals.manage` |
| **Query** | `kind?: promotion\|campaign\|reorder\|recommendation`, `status?: draft\|accepted\|rejected\|expired\|auto_applied`, `branchId?`, `cursor`, `limit` |
| **Response 200** | `{ "items": AiProposal[], "nextCursor" }` |

---

### `GET /api/internal/v1/ai/proposals/{proposalId}`

| | |
|--|--|
| **Permiso** | `ai.insights` |
| **Response 200** | `AiProposal` (incluye `payload` tipado por `kind`) |

---

### `POST /api/internal/v1/ai/proposals:generate`

Genera borradores bajo demanda.

| | |
|--|--|
| **Permiso** | `ai.manage` o `ai.proposals.manage` |
| **Idempotency-Key** | Obligatorio |
| **Body** | ver abajo |
| **Response 202** | `{ "jobId": string }` |

```json
{
  "kind": "promotion" | "campaign",
  "branchId": null,
  "objective": "winback" | "upsell" | "new_product" | "slow_mover",
  "segmentId": "at_risk",
  "constraints": { "maxDiscountPct": 15, "channels": ["email", "push"] }
}
```

---

### `PUT /api/internal/v1/ai/proposals/{proposalId}`

Decisión humana (o sistema de auto-apply).

| | |
|--|--|
| **Permiso** | `ai.proposals.manage` |
| **Body** | `{ "status": "accepted" \| "rejected", "reason"?: string }` |
| **Response 200** | `AiProposal` |
| **Nota** | `accepted` **no** crea la campaña/promo aquí: emite comando al módulo dueño y guarda `linkedEntityRef` cuando responde. |

---

### `POST /api/internal/v1/ai/proposals/{proposalId}/accept`

Atajo semántico = `PUT` con `status=accepted` + handoff.

| | |
|--|--|
| **Permiso** | `ai.proposals.manage` (+ `marketing.*` / inventory según kind) |
| **Body** | `{ "overrides"?: object }` |
| **Response 200** | `{ "proposal": AiProposal, "handoff": { "module": "marketing", "command": "createCampaignFromProposal", "status": "queued" } }` |

---

### `POST /api/internal/v1/ai/proposals/{proposalId}/reject`

| | |
|--|--|
| **Permiso** | `ai.proposals.manage` |
| **Body** | `{ "reason"?: string }` |
| **Response 200** | `AiProposal` |

---

## 12. Jobs

### `GET /api/internal/v1/ai/jobs`

| | |
|--|--|
| **Permiso** | `ai.manage` |
| **Query** | `type?`, `status?: queued\|running\|succeeded\|failed\|canceled`, `cursor`, `limit` |
| **Response 200** | `{ "items": AiJob[], "nextCursor" }` |

---

### `GET /api/internal/v1/ai/jobs/{jobId}`

| | |
|--|--|
| **Permiso** | `ai.manage` |
| **Response 200** | `AiJob` (`type`, `status`, `progress?`, `error?`, `startedAt`, `finishedAt`) |

---

### `POST /api/internal/v1/ai/jobs`

Encola job genérico (admin / interno).

| | |
|--|--|
| **Permiso** | `ai.manage` o service |
| **Idempotency-Key** | Obligatorio (`jobKey` derivado si se omite) |
| **Body** | `{ "type": "sales-forecast.daily" \| "inventory-forecast.daily" \| "customer-analytics.weekly" \| "recs.refresh" \| "promo.suggest" \| "alerts.scan" \| "campaign.generate" \| "project.features", "payload"?: object }` |
| **Response 202** | `{ "jobId", "deduped": boolean }` |

---

### `DELETE /api/internal/v1/ai/jobs/{jobId}`

Cancela si `queued` o cooperative-cancel si `running`.

| | |
|--|--|
| **Permiso** | `ai.manage` |
| **Response 200** | `{ "jobId", "status": "canceled" }` |
| **Errores** | `409` si ya `succeeded` |

---

## 13. Feature store (admin)

Solo interno / `ai.manage`. No es API de producto para meseros.

### `GET /api/internal/v1/ai/features/snapshots`

| | |
|--|--|
| **Permiso** | `ai.manage` |
| **Query** | `name?`, `branchId?`, `cursor`, `limit` |
| **Response 200** | `{ "items": [{ "id", "name", "at", "branchId", "schemaVersion" }] }` |

---

### `GET /api/internal/v1/ai/features/snapshots/{snapshotId}`

| | |
|--|--|
| **Permiso** | `ai.manage` |
| **Response 200** | snapshot + `payload` (features) |

---

### `POST /api/internal/v1/ai/features:project`

Fuerza proyección desde eventos recientes / rebuild.

| | |
|--|--|
| **Auth** | Service o `ai.manage` |
| **Body** | `{ "from"?: ISO, "fullRecompute"?: boolean }` |
| **Response 202** | `{ "jobId" }` |

---

## 14. Webhooks

### 14.1 Entrantes (inbound)

Base: `/api/internal/v1/ai/webhooks/...`  
Auth: firma HMAC (`X-SmartServe-Signature` o firma del vendor) + timestamp anti-replay.

---

#### `POST /api/internal/v1/ai/webhooks/providers/llm`

Callbacks del proveedor LLM (batch jobs, moderation, async completions).

| | |
|--|--|
| **Auth** | Firma vendor |
| **Body** | opaco del provider, normalizado a `{ "provider", "eventType", "externalId", "status", "data" }` |
| **Response 202** | `{ "received": true }` |
| **Efectos** | Actualiza job/mensaje pendiente; nunca escribe POS |

---

#### `POST /api/internal/v1/ai/webhooks/providers/forecast`

Resultados async de motor de forecasting externo.

| | |
|--|--|
| **Auth** | Firma vendor / HMAC interno |
| **Body** | `{ "jobExternalId", "restaurantId", "kind", "result" \| "error" }` |
| **Response 202** | `{ "received": true }` |
| **Efectos** | Materializa `aiForecasts`, emite insights si aplica |

---

#### `POST /api/internal/v1/ai/webhooks/domain/events`

Ingesta de **eventos de dominio** desde el bus interno (alternativa a Pub/Sub push).

| | |
|--|--|
| **Auth** | HMAC service |
| **Body** | ver envelope abajo |
| **Response 202** | `{ "received": true, "projected": boolean }` |

```json
{
  "schemaVersion": 1,
  "eventId": "evt_…",
  "type": "order.paid" | "stock.changed" | "customer.updated" | "promotion.ended" | "campaign.completed" | "reservation.no_show",
  "occurredAt": "…",
  "restaurantId": "…",
  "branchId": null,
  "payload": {}
}
```

Idempotente por `eventId`.

---

#### `POST /api/internal/v1/ai/webhooks/billing/entitlements`

Sync de límites cuando cambia la suscripción.

| | |
|--|--|
| **Auth** | HMAC billing |
| **Body** | `{ "restaurantId", "limits", "entitlements", "period" }` |
| **Response 200** | `{ "ok": true }` |

---

### 14.2 Salientes (outbound)

SmartServe **emite** webhooks a URLs configuradas en integraciones del restaurant (`aiSettings.outboundWebhooks` o módulo Integrations).

| Evento outbound | Cuándo |
|-----------------|--------|
| `ai.insight.created` | Nuevo insight accionable |
| `ai.insight.updated` | Cambio de status |
| `ai.forecast.ready` | Forecast materializado |
| `ai.proposal.created` | Nueva proposal draft |
| `ai.proposal.decided` | accepted / rejected |
| `ai.job.finished` | Job terminal |
| `ai.quota.warning` | ≥ 80% cupo |
| `ai.quota.exceeded` | Cupo agotado |

**Delivery:** POST JSON firmado, retries exponenciales (1m, 5m, 30m), header `X-SmartServe-Event`, `X-SmartServe-Signature`.

Envelope:

```json
{
  "id": "wh_…",
  "type": "ai.proposal.created",
  "createdAt": "…",
  "restaurantId": "…",
  "data": {}
}
```

#### Gestión de endpoints outbound

##### `GET /api/internal/v1/ai/webhooks/endpoints`

| Permiso | `ai.manage` |
| Response | `{ "items": [{ "id", "url", "events[]", "active", "createdAt" }] }` |

##### `POST /api/internal/v1/ai/webhooks/endpoints`

| Body | `{ "url", "events": string[], "secret"?: string }` |
| Response 201 | endpoint creado (secret solo una vez) |

##### `PUT /api/internal/v1/ai/webhooks/endpoints/{endpointId}`

| Body | `{ "url"?, "events"?, "active"? }` |

##### `DELETE /api/internal/v1/ai/webhooks/endpoints/{endpointId}`

| Response | 204 |

##### `POST /api/internal/v1/ai/webhooks/endpoints/{endpointId}/test`

| Response 202 | `{ "deliveryId" }` envía evento `ai.test` |

---

## 15. Realtime

Tres canales complementarios. La UI elige según caso.

### 15.1 SSE — Server-Sent Events

#### `GET /api/internal/v1/ai/realtime/stream`

Stream de eventos del tenant para el usuario autenticado.

| | |
|--|--|
| **Auth** | Bearer + restaurant (query token **prohibido** en prod; usar cookie/header) |
| **Permiso** | `ai.insights` (assistant events requieren `ai.assistant`) |
| **Query** | `types?: comma list`, `branchId?` |
| **Response** | `text/event-stream` |

Eventos SSE:

| `event:` | `data` |
|----------|--------|
| `ready` | `{ "ok": true }` |
| `insight.upsert` | `AiInsight` |
| `proposal.upsert` | `AiProposal` |
| `forecast.ready` | `{ "forecastId", "kind" }` |
| `job.update` | `{ "jobId", "status", "progress?" }` |
| `usage.update` | `{ "queries", "limit" }` |
| `ping` | `{ "ts" }` cada 25s |

---

#### `POST /api/internal/v1/ai/sessions/{sessionId}/messages:stream`

Streaming del turno del asistente.

| `event:` | `data` |
|----------|--------|
| `message.user` | `AiMessage` (ack) |
| `assistant.delta` | `{ "delta": "texto parcial" }` |
| `assistant.tool` | `{ "name", "status", "args?" }` |
| `assistant.message` | `AiMessage` final |
| `usage` | tokens / queries |
| `error` | error object |
| `done` | `{ "ok": true }` |

---

### 15.2 Firestore realtime (cliente SDK)

Suscripciones directas (reglas Firestore = fuente de verdad de authz). Paths:

| Path | Escucha |
|------|---------|
| `restaurants/{rid}/aiInsights` | query `status in [new,seen]` orderBy `createdAt` |
| `restaurants/{rid}/aiProposals` | `status == draft` |
| `restaurants/{rid}/aiSessions/{sid}/messages` | chat live multi-dispositivo |
| `restaurants/{rid}/aiJobs/{jobId}` | progreso de un job |
| `restaurants/{rid}/aiUsage/{periodId}` | cupo en vivo |
| `restaurants/{rid}/aiForecasts` | opcional; docs grandes → preferir REST latest |

**Regla de producto:** lecturas realtime OK; **writes** de insights/forecasts/proposals desde cliente **prohibidas** (solo API/workers). Excepción: status de insight/proposal vía API (o fields whitelisted en rules si se decide).

---

### 15.3 Presence / typing (assistant)

#### `PUT /api/internal/v1/ai/sessions/{sessionId}/presence`

| Body | `{ "state": "typing" \| "idle" }` |
| Permiso | `ai.assistant` |
| TTL | 10s; realtime via Firestore `aiSessions/{id}/presence/{uid}` o fanout SSE `presence` |

#### `GET /api/internal/v1/ai/realtime/stream` (incluye `presence`)

Ya cubierto en §15.1 si `types` incluye `presence`.

---

## 16. Matriz método × recurso

| Recurso | GET | POST | PUT | DELETE |
|---------|-----|------|-----|--------|
| `/health` | ● | | | |
| `/capabilities` | ● | | | |
| `/settings` | ● | | ● | |
| `/usage` | ● | | | |
| `/usage/history` | ● | | | |
| `/sessions` | ● | ● | | |
| `/sessions/{id}` | ● | | ● | ● |
| `/sessions/{id}/messages` | ● | ● | | |
| `/sessions/{id}/messages/{mid}` | | | | ● |
| `/sessions/{id}/messages:stream` | | ● | | |
| `/sessions/{id}/presence` | | | ● | |
| `/insights` | ● | ●¹ | | |
| `/insights/{id}` | ● | | ● | ● |
| `/insights/{id}/act` | | ● | | |
| `/recommendations` | ● | | | |
| `/recommendations:refresh` | | ● | | |
| `/recommendations/{id}` | | | ● | |
| `/forecasts` | ● | | | |
| `/forecasts/latest` | ● | | | |
| `/forecasts/{id}` | ● | | | |
| `/forecasts:run` | | ● | | |
| `/customers/segments` | ● | | | |
| `/customers/profiles` | ● | | | |
| `/customers/profiles/{id}` | ● | | | |
| `/customers:analyze` | | ● | | |
| `/proposals` | ● | | | |
| `/proposals/{id}` | ● | | ● | |
| `/proposals:generate` | | ● | | |
| `/proposals/{id}/accept` | | ● | | |
| `/proposals/{id}/reject` | | ● | | |
| `/jobs` | ● | ● | | |
| `/jobs/{id}` | ● | | | ● |
| `/features/snapshots` | ● | | | |
| `/features/snapshots/{id}` | ● | | | |
| `/features:project` | | ● | | |
| `/webhooks/providers/*` | | ● | | |
| `/webhooks/domain/events` | | ● | | |
| `/webhooks/billing/entitlements` | | ● | | |
| `/webhooks/endpoints` | ● | ● | | |
| `/webhooks/endpoints/{id}` | | | ● | ● |
| `/webhooks/endpoints/{id}/test` | | ● | | |
| `/realtime/stream` | ● | | | |

¹ POST insights: solo service-to-service.

---

## 17. Ejemplos de flujo

### Chat con streaming

```http
POST /api/internal/v1/ai/sessions
Idempotency-Key: 7c9e…
{ "title": "Stock semanal" }

POST /api/internal/v1/ai/sessions/{id}/messages:stream
Idempotency-Key: 1a2b…
{ "content": "¿Qué ingredientes se agotan esta semana?" }
```

### Aceptar campaña generada

```http
POST /api/internal/v1/ai/proposals:generate
{ "kind": "campaign", "objective": "winback", "segmentId": "at_risk" }
→ 202 { "jobId" }

GET /api/internal/v1/ai/proposals?kind=campaign&status=draft

POST /api/internal/v1/ai/proposals/{id}/accept
→ handoff a Marketing
```

### Forecast + alerta en tiempo real

```http
POST /api/internal/v1/ai/forecasts:run
{ "kind": "both" }

GET /api/internal/v1/ai/realtime/stream?types=forecast.ready,insight.upsert
```

---

## 18. Fuera de alcance de esta API

Estas operaciones **no** pertenecen al AI internal API:

- Crear/editar pedidos, stock, clientes, campañas publicadas → APIs de sus módulos.
- Billing Stripe checkout → Billing API.
- Auth login/register → Auth API.

AI solo **propone** y **observa**.

---

## 19. Checklist de implementación (futuro)

1. Route Handlers / CF bajo `/api/internal/v1/ai/*` con middleware auth + tenant + RBAC.
2. Idempotency store (Firestore/Redis) para POST costosos.
3. Firma HMAC webhooks + raw body.
4. SSE con backpressure y límite de conexiones por uid.
5. OpenAPI 3.1 generado desde este contrato cuando se implemente.
