/**
 * `idle` before create / join, `connected` after the server acknowledged it,
 * `failed` once the socket closed, `maintenance` when the health check failed.
 */
export type ConnectionStatus = "idle" | "connected" | "failed" | "maintenance";
