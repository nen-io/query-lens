import type { SchemaTable } from "../domain/dataset";
import type { QueryResult } from "../domain/query-engine";
export type WorkerRequest = { type: "query"; requestId: number; sql: string };
export type WorkerReply =
  | { type: "ready"; schema: SchemaTable[]; sqliteVersion: string }
  | { type: "init-error"; error: string }
  | { type: "result"; requestId: number; result: QueryResult }
  | { type: "query-error"; requestId: number; error: string };
