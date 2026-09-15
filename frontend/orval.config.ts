import { defineConfig } from "orval";

/**
 * Generates a type-safe REST client for the d-party backend from its OpenAPI
 * schema (kept in lock-step with the Chrome extension's schema, plus the lobby
 * room-resolution endpoint consumed by the room-transition page).
 *
 * Regenerate with: `pnpm api:generate`
 */
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
