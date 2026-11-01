import { defineConfig } from "orval";

/** REST client from the backend's OpenAPI schema (`manage.py spectacular`). Run `pnpm api:generate`. */

export default defineConfig({
  dParty: {
    input: {
      target: "./openapi/openapi.json",
    },
    output: {
      mode: "single",
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
