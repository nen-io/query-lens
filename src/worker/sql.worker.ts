/// <reference lib="webworker" />
import initSqlJs from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { createDatabase, executeQuery } from "../domain/query-engine";
import type { WorkerReply, WorkerRequest } from "./protocol";
const send = (message: WorkerReply) => self.postMessage(message);
try {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  const { db, schema, sqliteVersion } = createDatabase(SQL);
  send({ type: "ready", schema, sqliteVersion });
  self.onmessage = (event: MessageEvent<WorkerRequest>) => {
    const request = event.data;
    if (
      !request ||
      request.type !== "query" ||
      !Number.isSafeInteger(request.requestId)
    )
      return;
    try {
      send({
        type: "result",
        requestId: request.requestId,
        result: executeQuery(db, request.sql),
      });
    } catch (error) {
      send({
        type: "query-error",
        requestId: request.requestId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };
} catch (error) {
  send({
    type: "init-error",
    error: error instanceof Error ? error.message : String(error),
  });
}
