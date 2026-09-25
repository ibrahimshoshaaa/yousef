# Deployment and verification

1. Use a PostgreSQL database. Back it up before applying schema changes. Provide `DATABASE_URL` at runtime. The project arrived without a migration history, so reconcile the existing database schema before creating an initial migration; do not run a destructive reset on production. On a fresh development database, `npm run db:push` applies the current Prisma schema.
2. Configure `AUTH_SECRET` with at least 32 random characters. Set `NEXT_PUBLIC_APP_URL` to the site's HTTPS URL. Set Shopify variables in `.env.example` if Shopify is used; verify the current Admin API version and webhook subscriptions before connecting the shop. Keep all secrets out of the repository.
3. Create the first owner from a trusted shell after schema setup. For an empty database, provide `OWNER_STORE_NAME`, `OWNER_EMAIL` and `OWNER_PASSWORD` (minimum 12 characters) as temporary shell environment values and run `npm run auth:bootstrap-owner`. If there is one existing store, the script uses it; when there are multiple stores, provide `OWNER_STORE_ID`. Remove the temporary password variable after use. The command refuses to create a second owner in a store or duplicate email. Login at `/login`.
4. Run `npm ci`, `npm run db:generate`, `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`. Deploy the Next.js app with a Node.js runtime and an accessible PostgreSQL database. Build succeeds without database credentials; runtime pages and API need them.
5. Before production traffic, exercise login/logout, disabled-user rejection, access to another store, Shopify OAuth and signed webhooks, order consumption (including duplicate delivery), return restock and expense once, material purchase accounting, and the owner-only reconciliation endpoint using a staging database. Compare report totals to Shopify and ledger samples.
6. `GET /api/reconciliation` reports differences between the inventory ledger and saved balance. `GET /api/audit-logs?page=1` exposes a paginated log to owners. Neither changes inventory.

## Known limitations

No database connection or credentials were supplied for this development run, so database-backed end-to-end tests and real Shopify reconciliation have not been executed. The original project had no committed migrations. Auth.js uses a signed, eight-hour JWT session, while each application request reloads the user and store status/role from the database. The login throttle limits failed attempts by email over 15 minutes; its rows require the updated Prisma schema. Automated recovery for long-running Shopify syncs and detailed endpoint performance work remain operational follow-ups.

## GitHub Actions

`.github/workflows/ci.yml` runs on pushes, pull requests, and manual triggers. It installs dependencies with Node 24, generates Prisma Client, runs tests, TypeScript and lint checks, and builds Next.js. No database or Shopify secrets are passed to CI. The workflow validates code and build only; it does not deploy the site, create database tables, or sync Shopify. `.gitignore` keeps `node_modules`, Next build output, local environment files, and TypeScript cache out of Git.
