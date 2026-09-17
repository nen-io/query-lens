import { assertQueryPolicy, LIMITS } from "../domain/sql-policy";
import type { QueryResult } from "../domain/query-engine";
import type { SchemaTable } from "../domain/dataset";
import type { WorkerReply, WorkerRequest } from "./protocol";
export type WorkerPort = {
  postMessage: (message: WorkerRequest) => void;
  terminate: () => void;
  onmessage: ((event: { data: WorkerReply }) => void) | null;
  onerror: ((event: { message: string }) => void) | null;
};
export type ClientState = {
  status: "initializing" | "ready" | "running" | "init-error";
  schema: SchemaTable[];
  sqliteVersion: string;
  result?: QueryResult;
  error: string;
  notice: string;
  previous: boolean;
};
export class QueryClient {
  private worker?: WorkerPort;
  private epoch = 0;
  private request = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private state: ClientState = {
    status: "initializing",
    schema: [],
    sqliteVersion: "",
    error: "",
    notice: "",
    previous: false,
  };
  constructor(
    private factory: () => WorkerPort,
    private changed: (state: ClientState) => void,
  ) {}
  snapshot(): ClientState {
    return { ...this.state };
  }
  start(): void {
    this.spawn("");
  }
  run(sql: string): void {
    if (this.state.status !== "ready") return;
    try {
      assertQueryPolicy(sql);
    } catch (error) {
      this.state = {
        ...this.state,
        error: error instanceof Error ? error.message : String(error),
        previous: !!this.state.result,
        notice: "",
      };
      this.emit();
      return;
    }
    const epoch = this.epoch;
    const requestId = ++this.request;
    this.state = {
      ...this.state,
      status: "running",
      error: "",
      notice: "",
      previous: !!this.state.result,
    };
    this.emit();
    this.timer = setTimeout(() => {
      if (epoch === this.epoch && requestId === this.request)
        this.spawn(
          "Query exceeded the 2-second limit. Worker replaced; the seed database is reloading.",
        );
    }, LIMITS.timeoutMs);
    this.worker!.postMessage({ type: "query", requestId, sql });
  }
  cancel(): void {
    if (this.state.status === "running")
      this.spawn(
        "Query cancelled. Worker replaced; the seed database is reloading.",
      );
  }
  retry(): void {
    this.spawn("Retrying SQLite initialization.");
  }
  dispose(): void {
    this.epoch++;
    clearTimeout(this.timer);
    this.worker?.terminate();
    this.worker = undefined;
  }
  private spawn(notice: string): void {
    this.dispose();
    const epoch = this.epoch;
    this.state = {
      ...this.state,
      status: "initializing",
      error: "",
      notice,
      previous: !!this.state.result,
    };
    this.emit();
    try {
      const worker = this.factory();
      this.worker = worker;
      worker.onmessage = (event) => {
        if (epoch !== this.epoch) return;
        const message = event.data;
        if (message.type === "ready") {
          clearTimeout(this.timer);
          this.state = {
            ...this.state,
            status: "ready",
            schema: message.schema,
            sqliteVersion: message.sqliteVersion,
            notice: this.state.notice
              ? this.state.notice.replace("is reloading.", "is ready.")
              : "SQLite is ready. Choose a query and run it.",
          };
          this.emit();
          return;
        }
        if (message.type === "init-error") {
          this.failInitialization(message.error);
          return;
        }
        if (
          message.requestId !== this.request ||
          this.state.status !== "running"
        )
          return;
        clearTimeout(this.timer);
        if (message.type === "result")
          this.state = {
            ...this.state,
            status: "ready",
            result: message.result,
            previous: false,
            error: "",
            notice: "",
          };
        else
          this.state = {
            ...this.state,
            status: "ready",
            error: message.error,
            previous: !!this.state.result,
            notice: "",
          };
        this.emit();
      };
      worker.onerror = (event) => {
        if (epoch === this.epoch)
          this.failInitialization(`SQLite worker failed: ${event.message}`);
      };
      this.timer = setTimeout(() => {
        if (epoch === this.epoch)
          this.failInitialization(
            "SQLite initialization exceeded 10 seconds. Retry to load the local engine again.",
          );
      }, LIMITS.initTimeoutMs);
    } catch (error) {
      this.failInitialization(
        error instanceof Error ? error.message : String(error),
      );
    }
  }
  private failInitialization(error: string): void {
    this.dispose();
    this.state = {
      ...this.state,
      status: "init-error",
      error,
      previous: !!this.state.result,
      notice: "",
    };
    this.emit();
  }
  private emit(): void {
    this.changed({ ...this.state });
  }
}
