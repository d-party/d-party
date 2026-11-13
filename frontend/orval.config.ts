import { defineConfig } from "orval";

/**
 * REST client from the backend's OpenAPI schema (`backend/openapi.json`, written by
 * `manage.py spectacular`). Run `pnpm api:generate`.
 */
export default defineConfig({
  dParty: {
    input: {
      target: "../backend/openapi.json",
    },
    output: {
      mode: "single",
      clean: true,
      target: "src/infrastructure/api/generated/d-party.ts",
      schemas: "src/infrastructure/api/generated/model",
      client: "fetch",
      override: {
        mutator: {
          path: "src/infrastructure/api/fetcher.ts",
          name: "customFetch",
        },
      },
    },
  },
});
