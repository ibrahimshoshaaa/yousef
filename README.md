# Perfume ERP

Shopify-connected perfume business management dashboard.

## Architecture

- Next.js App Router
- TypeScript
- Tailwind CSS
- Prisma ORM
- PostgreSQL (Railway)
- Modular monolith — no microservices, no Redis, no BullMQ
- Server-side business rules (services layer)
- Store-scoped data
- Ledger-authoritative inventory

---

## Implementation Progress

### ✅ Chunk 1 — Foundation
- Next.js + TypeScript + Tailwind + Prisma
- PostgreSQL schema (full — all models defined)
- Store model (multi-store ready)
- Users / Roles (OWNER / MANAGER / EMPLOYEE)
- RBAC (`src/lib/rbac.ts`) — server-side permission checks
- Settings model + defaults (`src/lib/settings.ts`)
- Audit Log model
- Shopify connection / sync / webhook foundations (schema only)
- Products / Variants (schema)
- Materials / Suppliers / Material Types (schema)
- Recipes / immutable versions (schema)
- Inventory transactions / balances (schema)
- Consumption / Returns / Expenses / Orders (schema)
- Arabic RTL dashboard shell with sidebar navigation
- Environment validation (`src/lib/config.ts`)
- Auth.js session and store-scoped authorization (completed in Chunk 8)

### ✅ Chunk 2 — Materials + Inventory
- `src/services/material.service.ts` — all business logic server-side
- API routes:
  - `GET/POST  /api/materials`
  - `GET/PATCH /api/materials/[id]`
  - `GET/POST  /api/material-types`
  - `GET/POST  /api/suppliers`
  - `PATCH     /api/suppliers/[id]`
  - `POST      /api/inventory/adjustments` — ledger transaction + balance update
  - `GET       /api/inventory/transactions` — paginated history
- Pages:
  - `/dashboard/materials` — list with low-stock status
  - `/dashboard/materials/new` — create form
  - `/dashboard/materials/[id]` — detail, KPIs, movement history, adjustment form
  - `/dashboard/inventory` — stock overview, low-stock alerts, recent transactions
- Components:
  - `NewMaterialForm` (client)
  - `AdjustInventoryForm` (client) — add / subtract / set-to modes

### ✅ Chunk 3 — Products + Recipes
- `src/services/product.service.ts` — products/variants (Shopify-linked, with a manual-entry
  fallback for use before Chunk 4's Shopify sync is wired up), variant cost/margin attachment
- `src/services/recipe.service.ts` — recipe CRUD, recipe versioning (past versions are never
  edited — a new version is always created and marked current), cost calculation, version
  activation/rollback
- Schema change: `RecipeVersion.isCurrent` added — run `npx prisma migrate dev` to apply — so a
  historical version can be reactivated without mutating anything (spec §22/§45)
- `src/lib/settings.ts` — `getSetting()` / `isCostingEnabled()` helpers reading the `Setting`
  table with fallback to `DEFAULT_SETTINGS`
- `src/lib/rbac.ts` — `products.write` added to MANAGER
- API routes:
  - `GET/POST  /api/products`
  - `GET       /api/products/[id]`
  - `GET/POST  /api/products/[id]/variants`
  - `GET/POST  /api/recipes`
  - `GET       /api/recipes/[id]`
  - `POST      /api/recipes/[id]/versions` — new version, becomes current
  - `POST      /api/recipes/[id]/versions/[versionId]/activate` — roll back to a past version
- Pages:
  - `/dashboard/products` — products + variants, recipe mapping, estimated cost/margin
  - `/dashboard/products/new`, `/dashboard/products/[id]` — manual product entry (fallback) +
    variant management
  - `/dashboard/recipes` — recipe list with current version + estimated cost
  - `/dashboard/recipes/new` — create recipe (variant picker limited to variants with no recipe
    yet, to avoid duplicates); supports `?variantId=` preselection from the products page
  - `/dashboard/recipes/[id]` — current version + cost breakdown, full version history,
    new-version form, per-version "activate" action
- Components:
  - `CreateRecipeForm`, `NewVersionForm`, `ActivateVersionButton`, `RecipeItemsFieldset` (client)
  - `NewProductForm`, `AddVariantForm` (client)
- Costing method implemented: **DEFAULT_COST** (`Σ recipe quantity × material.defaultCost`),
  matching `materialCostMethod` in `src/lib/settings.ts`. Weighted-average cost and per-order cost
  snapshots are documented here as a future enhancement, not implemented in this chunk. Costs are
  labeled incomplete in the UI when a component material has no `defaultCost` set, and are hidden
  entirely unless the store's `costingEnabled` setting is `"true"`.
- Manual product/variant creation is a deliberate, clearly-labeled fallback (badge: "يدوي" /
  "منتج يدوي") so recipes can be built and costed before the Shopify connection exists. Once
  Chunk 4 ships, Shopify-synced products/variants use these same tables (`shopifyId` populated)
  and the manual-create UI becomes a rarely-needed escape hatch rather than the primary path.

### ✅ Chunk 4 — Shopify Integration
- `src/lib/shopify/` — the thin integration boundary (spec §8); nothing outside
  `lib/shopify` + `services/shopify` talks to Shopify directly:
  - `client.ts` — GraphQL Admin API client (products, orders w/ nested refunds,
    single-resource refetch, webhook registration). Uses GraphQL rather than
    REST because Shopify marked the REST Admin API legacy as of Oct 1 2024 and
    requires GraphQL for apps built after Apr 1 2025.
  - `oauth.ts` / `state.ts` — authorize URL, callback HMAC check, token
    exchange, and a signed OAuth `state` token that ties the callback back to
    a store without relying on a session (the browser lands on `/callback`
    with none of our cookies)
  - `crypto.ts` — AES-256-GCM encryption for the access token at rest
    (`SHOPIFY_TOKEN_ENCRYPTION_KEY`)
  - `webhookVerify.ts` — HMAC verification against the *raw* request body
  - `topics.ts` — subscribed webhook topics, checked against Shopify's
    current `WebhookSubscriptionTopic` enum at implementation time (2026) —
    re-verify against `shopify.dev` whenever `SHOPIFY_API_VERSION` is bumped
- `src/services/shopify/` — business logic on top of the client:
  - `connection.service.ts` — save/disconnect/status, `getClientForStore()`,
    webhook (re-)registration
  - `product.sync`, `order-sync`, `return-sync` — idempotent upserts into the
    existing `Product` / `ProductVariant` / `Order` / `OrderItem` / `Return` /
    `ReturnItem` tables (all keyed on `shopifyId`, so a re-sync or a
    webhook-driven refetch can never create duplicates)
  - `sync.service.ts` — orchestrates the full sync as resumable `SyncJob`
    stages (products → orders (+ nested refunds) → webhook registration),
    per spec §54/§55
  - `webhook.service.ts` — idempotent via the `(storeId, eventId)` unique
    constraint on `WebhookEvent`; on receipt it refetches the canonical
    GraphQL representation of the changed resource rather than parsing the
    REST-shaped webhook body, so there's exactly one field-mapping to
    maintain (shared with the sync path)
- API routes:
  - `GET  /api/shopify/install` — OWNER-only, redirects to Shopify's OAuth screen
  - `GET  /api/shopify/callback` — verifies HMAC + state, exchanges the code,
    saves the connection, runs the initial sync inline (no queue — see
    "Key Decisions")
  - `POST /api/shopify/sync` — manual resync
  - `POST /api/shopify/disconnect`
  - `GET  /api/shopify/status` — connection + sync state + recent jobs/events,
    used by the dashboard
  - `POST /api/shopify/webhooks/[eventId]/retry` — manual retry for a failed event
  - `POST /api/webhooks/shopify` — the webhook receiver: verify signature →
    identify store by shop domain → idempotency check → persist → process →
    mark processed (spec §53), always acknowledging with 200 once the event
    is durably persisted so Shopify doesn't retry into an idempotency key
    whose only recovery path is now the manual retry button
- Pages:
  - `/dashboard/shopify` — connect-store form, connection status, manual
    sync/disconnect, recent sync jobs, recent webhook events with retry
- Schema: `ShopifyConnection` gained `shopifyShopId`, `apiVersion`, `scope`,
  `webhooksRegisteredAt`; added the unique/index constraints idempotent
  upserts depend on (`OrderItem(orderId, shopifyLineId)`,
  `Return(storeId, shopifyId)`, `ReturnItem(returnId, orderItemId)`,
  `WebhookEvent(storeId, status)`) — run `npx prisma migrate dev` to apply.
- Assumptions documented in code rather than invented silently (spec §5.14):
  `Order.netSales` = `totalPrice − totalRefunded` (Shopify's own totals,
  not re-derived); every synced `Return`/`ReturnItem` starts as
  `returnCost = 0`, `condition = UNKNOWN`, `restocked = false` — the sync
  layer records *that* Shopify refunded something, and Chunk 6 owns the
  restock/condition triage and return-cost expense per spec §32.
- What this chunk deliberately does **not** do yet: trigger material
  consumption from a synced/webhook'd order (wired up in Chunk 5) or decide
  return restocking (Chunk 6).

### ✅ Chunk 5 — Consumption Engine
- `src/services/consumption.service.ts` — the whole engine (spec §24–§28):
  - `processOrderConsumption(storeId, orderId)` — checks the store's
    `orderConsumptionTrigger` setting (`ORDER_CREATED` / `ORDER_PAID` /
    `ORDER_FULFILLED`, default `ORDER_PAID`) against the order's *current*
    `financialStatus`/`fulfillmentStatus`; if satisfied, processes every
    order line not yet in a terminal state
  - `processOrderItemConsumption(...)` — per line item: resolve
    `ProductVariant` → resolve current `RecipeVersion` → compute
    `quantity sold × recipe quantity` per material → apply the
    `negativeStockPolicy` setting (`BLOCK_NEGATIVE_STOCK` default /
    `WARN_ONLY` / `ALLOW_NEGATIVE_STOCK`) → in one DB transaction: atomically
    decrement each `InventoryBalance`, write the `InventoryTransaction`
    ledger rows (`type: "CONSUMPTION"`), create `Consumption` +
    `ConsumptionItem`, and mark the `OrderItem` `CONSUMED`
  - `listConsumption` / `listOrderItemsNeedingAttention` — history and the
    "needs review" queue (missing recipe / insufficient stock / error)
- Called automatically at the end of `upsertShopifyOrder` (Chunk 4) — every
  sync, resync, or order/refund webhook re-checks the trigger and picks up
  any newly-eligible lines. A consumption failure is caught and logged
  there so it can never fail order sync itself; the failing *line* still
  gets a visible status for the operator (spec §23).
- Schema: `OrderItem` gained `consumptionStatus` (`PENDING` / `NO_VARIANT` /
  `NO_RECIPE` / `INSUFFICIENT_STOCK` / `CONSUMED` / `ERROR`) and
  `consumptionError`; `Consumption` gained a unique `orderItemId` (the
  idempotency guard — a line can produce at most one `Consumption` row,
  ever) and a proper `recipeVersion` relation (previously a bare, unlinked
  string column left over from Chunk 1). Run `npx prisma migrate dev` to
  apply.
- API: `POST /api/orders/:id/consume` (manual re-run — retries any line
  stuck on `NO_RECIPE`/`INSUFFICIENT_STOCK`/`ERROR`; `CONSUMED` lines are
  always left untouched), `GET /api/consumption` (history, filterable by
  order/material/variant). RBAC: added `consumption.write` (MANAGER+OWNER).
- Page: `/dashboard/consumption` — a "needs review" panel (only real
  operational errors: missing recipe, insufficient stock, unexpected error
  — a line simply waiting for its trigger is not shown here) with a
  reprocess button per order, plus the full consumption history with a
  per-order filter.
- Idempotency (spec §28): `Consumption.orderItemId` is unique, so the same
  line can never be double-consumed no matter how many times sync/webhooks/
  manual retry run for it — a second attempt after success is a no-op, and
  a rare concurrent-write race is caught as the unique-constraint error and
  treated as "already consumed" rather than surfaced as a failure.
- Assumptions documented in code rather than invented silently (spec
  §5.14/§79.22): `ORDER_PAID` means `financialStatus === "PAID"` exactly
  (a `PARTIALLY_PAID` order does not yet trigger consumption); a
  `RecipeItem`'s quantity/unit is trusted to already be in the target
  material's base unit (no conversion — same assumption Chunk 3's costing
  already makes); consumption is one-directional in this chunk — an order
  that regresses after being consumed (voided, refunded) is not
  auto-reversed here, that is Chunk 6's return-restocking job; and each
  order line is consumed in its own transaction rather than one
  transaction per whole order, so one line's missing recipe can't block
  material consumption for the order's other, correctly-mapped lines.

### ✅ Chunk 6 — Returns + Expenses
- Return restocking (recipe components)
- Return cost expense (configurable default: 95 EGP)
- Expense module + purchase linkage

### ✅ Chunk 7 — Dashboard + Reports
- KPI cards (live data)
- Sales charts
- Product performance, return analytics, expense analytics
- Consumption + inventory reports

### ✅ Chunk 8 — Hardening (code complete; staging verification pending)
- Auth.js credentials login and server-side role/status validation
- Owner-only audit-log and inventory-reconciliation endpoints
- Focused date-boundary and inventory-ledger tests
- Deployment instructions in `DEPLOYMENT.md`

---

## Local Setup

```bash
npm install
cp .env.example .env
# Fill DATABASE_URL, AUTH_SECRET, NEXT_PUBLIC_APP_URL in .env
npm run db:push  # fresh development database only
# Bootstrap owner following DEPLOYMENT.md
npm run dev
```

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Railway) |
| `AUTH_SECRET` | At least 32 random characters for Auth.js and login throttle |
| `NEXT_PUBLIC_APP_URL` | App URL (e.g. http://localhost:3000) |
| `SHOPIFY_API_KEY` | Custom/private app client ID |
| `SHOPIFY_API_SECRET` | Custom/private app client secret; also used to verify webhook HMACs unless `SHOPIFY_WEBHOOK_SECRET` is set |
| `SHOPIFY_APP_URL` | Public URL Shopify redirects back to after OAuth |
| `SHOPIFY_WEBHOOK_SECRET` | Optional distinct webhook signing secret; falls back to `SHOPIFY_API_SECRET` |
| `SHOPIFY_SCOPES` | Comma-separated OAuth scopes requested at install |
| `SHOPIFY_API_VERSION` | Admin API version — verify against shopify.dev before bumping |
| `SHOPIFY_TOKEN_ENCRYPTION_KEY` | `openssl rand -base64 32` — encrypts the stored access token |

## Scripts

```bash
npm run dev          # Development server
npm run build        # Production build
npm run typecheck    # TypeScript check
npm test             # Focused tests
npm run auth:bootstrap-owner  # Initial owner from trusted shell
npm run db:migrate   # Run Prisma migrations
npm run db:studio    # Prisma Studio
```

## Key Decisions

- Inventory changes **always** create a ledger transaction (`InventoryTransaction`) — balances are rebuildable from ledger
- Historical recipe versions are **immutable** once superseded — a recipe edit always creates a new version rather than mutating an existing one; a `RecipeVersion.isCurrent` flag tracks which version is active and can be pointed at any past version without touching its items
- Product costing uses the **DEFAULT_COST** method (`quantity × material.defaultCost`); flagged incomplete when a material has no cost, and hidden entirely unless the store enables costing
- Webhooks are **idempotent** (enforced via `WebhookEvent.eventId` unique constraint)
- Shopify credentials stay **server-side only**
- Business logic lives in `src/services/` — never in React components
- No Redis, BullMQ, microservices, or finished-product inventory in MVP
- Shopify sync and webhook processing run inline within the request (OAuth
  callback, manual resync button, webhook receiver) rather than on a queue,
  consistent with the no-Redis/BullMQ constraint; a failed webhook is
  recorded with status `FAILED` and retried manually from `/dashboard/shopify`
  rather than auto-retried, since Shopify's own retry would otherwise hit
  the same idempotency key and no-op

## Chunk 6 — Returns and expenses

- `/dashboard/returns`: classify each refunded item before processing. Only GOOD items selected for restock add the *originally consumed* recipe components back to inventory. Processing is atomic and cannot be run twice; unconsumed order lines cannot be restocked.
- `/dashboard/expenses`: manual expenses, and a combined material purchase action that writes purchase, stock ledger and expense in one transaction. Categories are managed with `GET/POST /api/expenses/categories` (create one before using the manual expense form).
- API: `GET /api/returns`, `POST /api/returns/:id/process`, `GET/POST /api/expenses`, `GET/POST /api/expenses/categories`, `POST /api/purchases`, `GET/PUT /api/settings/return-cost` (PUT owner only).
- The default return cost is the store setting `defaultReturnCost` (95 EGP until changed). The store currency is recorded with new expenses. An optional `returnCost` on the processing endpoint overrides the default for that return.
- Apply schema changes to the database using `npm run db:migrate` in development or your production migration process before deploying. No live database credentials were supplied, so data mutations were not run here.
- Superseded by Chunk 8: Auth.js now protects production API and all dashboard pages use the authenticated store.

## Chunk 7 — Dashboard and reports

- `/dashboard` now shows live KPI cards, a daily net-sales visualization, top products and low-stock alerts. `/dashboard/reports` shows sales, product performance, returns, expense categories, material consumption, inventory movement and optional estimated profitability. `GET /api/reports?period=7d` returns the same store-scoped data.
- Supported date filters: `today`, `yesterday`, `7d`, `30d`, `month`, `lastMonth`, or `custom` with `from=YYYY-MM-DD&to=YYYY-MM-DD` (up to 366 days). Day boundaries use the store's configured timezone. Order sales and their current refunds are assigned to the order date; return activity uses the return creation date, expenses their expense date, and material movements their ledger date.
- Gross order sales are stored total plus order discounts. Net order sales are the stored total after refunds. Product rows use line-item amounts and therefore exclude order shipping/taxes. Expense totals already include linked return-cost expenses; do not add the return-cost KPI to expenses again. Orders in another currency are excluded from order sales and visibly counted rather than silently added to the store currency.
- Estimated profitability is shown only when costing is enabled. It uses recorded order consumptions and default material costs; missing costs or unconsumed order lines flag the estimate as incomplete. This is not an accounting profit figure and excludes operating expenses.
- All dashboard routes are dynamically rendered. This fixes a pre-existing build failure from attempted database access during prerendering when no `DATABASE_URL` is available at build time. Production requests require a configured database and a bootstrapped owner (see `DEPLOYMENT.md`).
