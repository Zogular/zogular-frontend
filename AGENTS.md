# ZOGULAR Frontend Agent Instructions

This repo is the Next.js frontend for ZOGULAR. Product, UX, flow, API, business, and engineering source-of-truth docs live in the sibling docs repo:

`../zogular-docs`

## Required Docs Gate

Before non-trivial frontend work, inspect:

- `../zogular-docs/DOCS_INDEX.md`

Then read the task-relevant actual docs from:

- `../zogular-docs/product/`
- `../zogular-docs/business/`
- `../zogular-docs/design/`
- `../zogular-docs/engineering/`
- `../zogular-docs/foundation/`

Do not use remembered, guessed, flat, or renamed docs paths. Verify file existence before claiming a doc was read.

## Reporting Requirement

Every non-trivial implementation report must include:

- exact docs read;
- whether each doc was complete/useful, draft but useful, placeholder/near-empty, or empty;
- short summary of what was used;
- any missing or placeholder docs that blocked the task.

If a referenced doc is missing or placeholder-only, report it and stop before coding unless the task explicitly allows proceeding.

## Buyer / Checkout Tasks

Required docs:

- `../zogular-docs/DOCS_INDEX.md`
- `../zogular-docs/product/buyer-flow.md`
- `../zogular-docs/product/order-checkout-flow.md`
- `../zogular-docs/business/payments-wallet-escrow.md`
- `../zogular-docs/business/delivery-strategy.md`
- `../zogular-docs/design/consumer-ui-patterns.md`
- `../zogular-docs/engineering/api-standards.md`

## Seller Tasks

Required docs:

- `../zogular-docs/DOCS_INDEX.md`
- `../zogular-docs/product/seller-flow.md`
- `../zogular-docs/product/product-moderation-flow.md`
- `../zogular-docs/business/seller-acquisition-strategy.md`
- `../zogular-docs/design/seller-ui-patterns.md`
- `../zogular-docs/engineering/auth-and-rbac.md`
- `../zogular-docs/engineering/api-standards.md`

## Admin Tasks

Required docs:

- `../zogular-docs/DOCS_INDEX.md`
- `../zogular-docs/product/admin-flow.md`
- `../zogular-docs/product/product-moderation-flow.md`
- `../zogular-docs/design/admin-ui-patterns.md`
- `../zogular-docs/engineering/auth-and-rbac.md`
- `../zogular-docs/engineering/api-standards.md`

## UI / Design Tasks

Required docs:

- `../zogular-docs/DOCS_INDEX.md`
- `../zogular-docs/foundation/04-ui-ux-design-brief.md`
- `../zogular-docs/design/brand-direction.md`
- `../zogular-docs/design/mobile-first-ui-rules.md`
- the relevant consumer, seller, or admin UI-pattern doc.

## Database / Payment / Ledger Tasks

Frontend must not own backend finance truth. Required docs:

- `../zogular-docs/DOCS_INDEX.md`
- `../zogular-docs/business/payments-wallet-escrow.md`
- `../zogular-docs/business/commission-and-unit-economics.md`
- `../zogular-docs/engineering/database-rules.md`
- `../zogular-docs/engineering/api-standards.md`
- `../zogular-docs/engineering/auth-and-rbac.md`

## Hard Rules

- Do not fake payment success.
- Do not calculate seller payout, escrow release, final delivery pricing, provider success, or wallet balance in frontend.
- Do not let frontend role/status checks replace backend authorization.
- Do not dump complex logic into `page.tsx`.
- Use feature folders and split UI, hooks, services, types, utils, and config by responsibility.
- Do not run migrations, database reset, `prisma db push`, production setting changes, or `npm audit fix`.
