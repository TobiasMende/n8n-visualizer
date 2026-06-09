# Webhook Security Indicator — Design

**Date:** 2026-06-09
**Status:** Approved

## Goal

Surface whether each n8n webhook trigger is authenticated ("secured") or open ("unsecured"), so a user auditing an instance can spot webhooks reachable without credentials.

## Definition of "secured"

A webhook/formTrigger node is **secured** when its `parameters.authentication` is set and not `'none'`.

- `n8n-nodes-base.webhook`: secured values are `basicAuth`, `headerAuth`, `jwtAuth`.
- `n8n-nodes-base.formTrigger`: secured value is `basicAuth`.
- Missing, empty, or `'none'` → **unsecured**.

We store the raw auth value (default `'none'`) plus a derived `secured` boolean. Auth-param-only — no heuristics beyond the parameter.

## Architecture

`webhookNodeInfo()` in `server/webhooks/extract.ts` is the single source of truth. Both `buildWebhooks()` (table data) and `extractTriggerNodes()` (map data) already call it, so extending it propagates everywhere.

### 1. Extraction

Extend `WebhookNodeInfo` and `webhookNodeInfo()`:

```ts
export interface WebhookNodeInfo { path: string; method: string; auth: string; secured: boolean }
```

- Read `auth = parameters.authentication` (string; default `'none'`).
- `secured = auth !== 'none' && auth !== ''`.

### 2. Data model (`shared/types/graph.ts`)

- `WebhookEntry` gains `secured: boolean` and `auth: string`.
- `TriggerNode` gains optional `secured?: boolean` — set only for `webhook`/`form` kinds.

`buildWebhooks()` copies `secured`/`auth` onto each entry. `extractTriggerNodes()` sets `secured` on webhook/form trigger nodes (via the `push` helper or by assigning after).

### 3. Webhooks table (`useWebhookView.ts` + `WebhooksView.vue`)

- `WebhookRow` gains `secured: boolean` and `auth: string`.
- New **Security** column between Method and URL:
  - Secured → `🔒 Secured` badge, accent tone, `title` = human auth label (e.g. "Header Auth").
  - Unsecured → `🔓 Open` badge, warn tone, `title` = "No authentication".
- Auth label map: `basicAuth → Basic Auth`, `headerAuth → Header Auth`, `jwtAuth → JWT Auth`, `none → None`, fallback = raw value.
- Search: append `secured ? 'secured' : 'unsecured open'` + auth value to the row's search string in `WebhooksView.vue` so typing "unsecured" filters the table.

### 4. Summary count (`WebhooksView.vue`)

Above the table, a one-line summary derived from the filtered `rows`:

> `N of M webhooks open`

- Warn-toned text.
- Hidden when `N === 0`.
- No new filter control — search already covers filtering.

### 5. Map node badge (`WorkflowNodeCard.vue`)

For `kind === 'trigger'` with `triggerKind` of `webhook` or `form` and `secured === false`:

- Overlay a small `🔓` badge in a corner of the card.
- `title` = "Unsecured webhook — no authentication".
- Secured webhooks get **no** badge (only the risky case is marked).

Requires threading `secured` from `TriggerNode` through to the card's `data` prop (the map layout that builds trigger cards from `triggerNodes`).

## Testing

- `server/webhooks/extract.test.ts`: auth variants (`none`, missing, `basicAuth`, `headerAuth`, `jwtAuth`) → correct `secured`/`auth`.
- `server/webhooks/build.test.ts`: entries carry `secured`/`auth`.
- `app/composables/useWebhookView.test.ts`: rows carry `secured`/`auth`; auth label.
- `WebhooksView` search match for "unsecured" (covered via row search string).
- `app/components/WorkflowNodeCard.spec.ts`: unsecured webhook trigger renders badge; secured does not.

## Out of scope

- No filtering of map nodes by security state.
- No security state for non-webhook triggers.
- No validation of auth correctness (only presence of the parameter).
