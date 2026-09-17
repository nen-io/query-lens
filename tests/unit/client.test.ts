import { afterEach, describe, expect, it, vi } from "vitest";
import {
  QueryClient,
  type ClientState,
  type WorkerPort,
} from "../../src/worker/client";
import type { WorkerReply, WorkerRequest } from "../../src/worker/protocol";
const result = {
  columns: ["x"],
  rows: [[1]],
  durationMs: 1,
  sql: "SELECT 1",
  truncated: false,
  exactIntegersAsText: false,
};
function setup() {
  const states: ClientState[] = [];
  const workers: (WorkerPort & {
    sent: WorkerRequest[];
    terminated: boolean;
  })[] = [];
  const factory = () => {
    const port: WorkerPort & { sent: WorkerRequest[]; terminated: boolean } = {
      onmessage: null,
      onerror: null,
      sent: [],
      terminated: false,
      postMessage(message) {
        this.sent.push(message);
      },
      terminate() {
        this.terminated = true;
      },
    };
    workers.push(port);
    return port;
  };
  const client = new QueryClient(factory, (state) => states.push(state));
  client.start();
  const send = (message: WorkerReply, index = workers.length - 1) =>
    workers[index].onmessage?.({ data: message });
  const ready = () =>
    send({ type: "ready", schema: [], sqliteVersion: "test" });
  return { client, states, workers, send, ready };
}
afterEach(() => vi.useRealTimers());
describe("worker lifecycle fencing", () => {
  it("initializes then associates results with current request", () => {
    vi.useFakeTimers();
    const { client, ready, workers, send } = setup();
    ready();
    client.run("SELECT 1");
    expect(workers[0].sent[0]).toEqual({
      type: "query",
      requestId: 1,
      sql: "SELECT 1",
    });
    send({ type: "result", requestId: 1, result });
    expect(client.snapshot()).toMatchObject({
      status: "ready",
      result,
      previous: false,
    });
    client.dispose();
  });
  it("cancel terminates and reseeds; late old-epoch result cannot overwrite", () => {
    vi.useFakeTimers();
    const { client, ready, workers, send } = setup();
    ready();
    client.run("SELECT 1");
    client.cancel();
    expect(workers[0].terminated).toBe(true);
    expect(workers).toHaveLength(2);
    send({ type: "result", requestId: 1, result }, 0);
    expect(client.snapshot().result).toBeUndefined();
    ready();
    client.run("SELECT 2");
    send({
      type: "result",
      requestId: 2,
      result: { ...result, sql: "SELECT 2", rows: [[2]] },
    });
    expect(client.snapshot().result?.rows).toEqual([[2]]);
    client.dispose();
  });
  it("two-second deadline replaces worker and next run succeeds", () => {
    vi.useFakeTimers();
    const { client, ready, workers, send } = setup();
    ready();
    client.run("SELECT 1");
    vi.advanceTimersByTime(2000);
    expect(workers[0].terminated).toBe(true);
    expect(client.snapshot().notice).toContain("2-second");
    ready();
    client.run("SELECT 1");
    send({ type: "result", requestId: 2, result });
    expect(client.snapshot().result).toEqual(result);
    client.dispose();
  });
  it("ignores wrong request and duplicate messages", () => {
    vi.useFakeTimers();
    const { client, ready, send } = setup();
    ready();
    client.run("SELECT 1");
    send({ type: "result", requestId: 99, result });
    expect(client.snapshot().status).toBe("running");
    send({ type: "result", requestId: 1, result });
    send({ type: "query-error", requestId: 1, error: "late" });
    expect(client.snapshot().error).toBe("");
    client.dispose();
  });
  it("retains old results with previous label on query errors and policy failures", () => {
    vi.useFakeTimers();
    const { client, ready, send } = setup();
    ready();
    client.run("SELECT 1");
    send({ type: "result", requestId: 1, result });
    client.run("SELECT FROM x");
    send({ type: "query-error", requestId: 2, error: "syntax error" });
    expect(client.snapshot()).toMatchObject({
      previous: true,
      result,
      error: "syntax error",
    });
    client.run("DELETE FROM x");
    expect(client.snapshot()).toMatchObject({ previous: true, result });
    client.dispose();
  });
  it("initialization deadline terminates and retry creates a fresh worker", () => {
    vi.useFakeTimers();
    const { client, workers, ready } = setup();
    vi.advanceTimersByTime(10000);
    expect(client.snapshot().status).toBe("init-error");
    expect(workers[0].terminated).toBe(true);
    client.retry();
    ready();
    expect(client.snapshot().status).toBe("ready");
    client.dispose();
  });
  it("dispose fences every callback and clears timeout", () => {
    vi.useFakeTimers();
    const { client, states, send } = setup();
    const count = states.length;
    client.dispose();
    send({ type: "ready", schema: [], sqliteVersion: "old" });
    vi.runAllTimers();
    expect(states).toHaveLength(count);
  });
});

it("keeps a bounded, deduplicated history of accepted successful SQL without result copies", () => {
  vi.useFakeTimers();
  const { client, ready, send } = setup();
  ready();
  for (let index = 1; index <= 12; index++) {
    client.run(`SELECT ${index}`);
    send({
      type: "result",
      requestId: index,
      result: { ...result, sql: `SELECT ${index}`, rows: [[index]] },
    });
  }
  expect(client.snapshot().history).toHaveLength(10);
  expect(client.snapshot().history[0]).toMatchObject({
    sql: "SELECT 12",
    rowCount: 1,
  });
  expect(client.snapshot().history[0]).not.toHaveProperty("rows");
  client.run("SELECT 3");
  send({
    type: "result",
    requestId: 13,
    result: { ...result, sql: "SELECT 3" },
  });
  expect(client.snapshot().history.map((entry) => entry.sql)).toEqual([
    "SELECT 3",
    "SELECT 12",
    "SELECT 11",
    "SELECT 10",
    "SELECT 9",
    "SELECT 8",
    "SELECT 7",
    "SELECT 6",
    "SELECT 5",
    "SELECT 4",
  ]);
  client.dispose();
});

it("history excludes errors, cancellation and stale replies; clearing keeps the current result", () => {
  vi.useFakeTimers();
  const { client, ready, send } = setup();
  ready();
  client.run("SELECT 1");
  send({ type: "result", requestId: 1, result });
  client.run("SELECT FROM broken");
  send({ type: "query-error", requestId: 2, error: "syntax error" });
  expect(client.snapshot().history).toHaveLength(1);
  client.run("SELECT 2");
  client.cancel();
  send(
    { type: "result", requestId: 3, result: { ...result, sql: "SELECT 2" } },
    0,
  );
  expect(client.snapshot().history.map((entry) => entry.sql)).toEqual([
    "SELECT 1",
  ]);
  client.clearHistory();
  expect(client.snapshot().history).toEqual([]);
  expect(client.snapshot().result).toEqual(result);
  expect(client.snapshot().resultVersion).toBe(1);
  ready();
  client.run("SELECT 3");
  send({
    type: "result",
    requestId: 4,
    result: { ...result, sql: "SELECT 3" },
  });
  expect(client.snapshot().history.map((entry) => entry.sql)).toEqual([
    "SELECT 3",
  ]);
  client.dispose();
});
