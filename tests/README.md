# Tests

## Layout

| Dir | Tooling | Purpose |
|---|---|---|
| `tests/smoke/` | Playwright | End-to-end smoke and regression tests against a local server |
| `tests/fixtures/` | Playwright | Reusable fixtures (e.g. authenticated admin page) |
| `tests/.auth/` | (generated) | Saved storage state for authenticated test runs. Gitignored. |
| `js/*.test.js` | Jest | Client-side unit tests (jsdom env) |

`tests/global-setup.js` signs in once before the suite runs and saves admin auth state to `tests/.auth/admin.json`.

## Running

```bash
# All Playwright smoke tests
npm test

# Jest unit tests
npm run test:unit
```

The Playwright config starts `npx serve . -l 8888` automatically. No manual `netlify dev` needed for static-page tests.

## Admin tests

Tests that need an authenticated admin session use the `adminPage` fixture from `tests/fixtures/auth.js`:

```js
const { test, expect } = require('../fixtures/auth');

test('admin can do thing', async ({ adminPage }) => {
  await adminPage.goto('/admin-approvals.html');
  // ...
});
```

### Setting up admin credentials locally

1. Copy the example env file:
   ```bash
   cp .env.test.example .env.test
   ```
2. In the Firebase Console for the `brumoutloud-3dd92` project, create a dedicated test user under Authentication → Users.
3. Put that user's email and password in `.env.test`.
4. Run `npm test`. The global setup signs in once and caches the auth state.

### CI

Set `TEST_ADMIN_EMAIL` and `TEST_ADMIN_PASSWORD` as repo secrets and pass them as env vars to the Playwright workflow (see issue [#130](https://github.com/calsaundrs/website/issues/130)).

### Skipping admin tests

If `.env.test` is missing or the variables are unset, the global setup logs a warning and **does not** create a storage state file. Any test that imports `adminPage` will then throw a clear error pointing back to this README. Public-only tests (e.g. `pages.spec.js`) continue to run normally.

## Coverage status

See [tests/COVERAGE.md](./COVERAGE.md) for the audit of what's covered and what isn't.
