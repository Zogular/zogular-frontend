# Zogular Backend Integration Status

Last updated: 2026-05-17

## Completed frontend work

- Replaced browser-token auth assumptions with cookie-backed session handling.
- Centralized request behavior in `src/services/api.ts` with `credentials: "include"`, CSRF token preparation, 401 refresh retry, timeout handling, and shared error normalization.
- Updated auth service endpoints to the backend contract:
  - `POST /auth/login`
  - `POST /auth/register`
  - `POST /auth/logout`
  - `POST /auth/refresh-token`
  - `GET /user/me`
  - `PATCH /user/update-me`
  - `POST /user/change-password`
- Mapped frontend `phone` fields to backend `telephone`.
- Kept auth UI unchanged while moving integration behavior into the shared service/session layer.
- Wired homepage product sections, category pages, product detail, related products, search/all-products, flash-sales, and trending surfaces to backend product routes where the backend has data.
- Added Cloudinary image host support for backend product images.
- Preserved the shared frontend `Product` shape and normalized backend products at the service boundary.
- Removed dishonest fallback presentation for missing backend fields:
  - no fake product discount when backend only sends one price;
  - no `Save K0` state;
  - no fake review breakdown when backend has zero reviews.
- Added a backend cart bridge in `src/services/cart.ts`.
- Rebuilt `src/hooks/use-cart.ts` to keep Zustand hydration/local UX while syncing authenticated, backend-backed product IDs to the cart API.
- Added `CartSyncBridge` to sync local cart state after a user session becomes available.
- Updated checkout to sync the cart before the existing frontend checkout completion path.

## Completed backend contract work

- Updated CORS to allow credentialed CSRF requests using `X-CSRF-Token`.
- Added support for comma-separated `FRONTEND_URL` values so production and preview origins can be configured without code changes.
- Mounted CSRF error handling before the global error handler so invalid tokens return a proper `403` response.
- Fixed backend TypeScript infrastructure so `npx tsc --noEmit` passes:
  - `tsconfig.json` now includes imported `config/*` files;
  - Zod v4 `z.record(...)` usage was updated in `notificationValidator`.

## Backend gaps still affecting frontend fidelity

- Backend product categories are narrower than the frontend platform taxonomy.
- Product responses do not yet include discount/original price, stock quantity, subcategory, rating aggregate, or per-star review breakdown.
- Cart API does not support variants.
- Cart mutation responses are thinner than `GET /cart`; the frontend currently reconciles by pulling the cart after mutations.
- Checkout/order/payment persistence still needs real backend endpoints before the frontend can replace local checkout completion.
- Account addresses, saved payment methods, notifications, and order history still need real backend endpoints.

## Production follow-up

- Deploy the backend CORS/CSRF patch before testing authenticated cart/profile mutations against the hosted API.
- Set `FRONTEND_URL` to every real browser origin that will call the API, comma-separated if needed.
- Keep `NEXT_PUBLIC_API_URL` pointed at the deployed `/api/v1` base for production frontend builds.
- Run a real login/register/profile/cart test with seeded credentials after backend deployment.
- Address backend dependency audit findings before launch:
  - `sanitize-html` has a critical advisory in the installed tree;
  - `path-to-regexp` and `picomatch` have high severity findings;
  - `csurf` is archived and should be replaced with a maintained CSRF strategy.

## Verification run

- Frontend `npx tsc --noEmit`: passed.
- Frontend `npm run lint`: passed.
- Frontend `npm run build`: passed.
- Backend `npx prisma generate`: passed.
- Backend `npx tsc --noEmit`: passed.
- Local backend preflight with `Origin: http://localhost:3000` and `Access-Control-Request-Headers: content-type,x-csrf-token`: returned `204` with credentials and `X-CSRF-Token` allowed.
