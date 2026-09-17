export const LIMITS = {
  sqlBytes: 20 * 1024,
  rows: 500,
  columns: 40,
  cellBytes: 16 * 1024,
  resultBytes: 1024 * 1024,
  timeoutMs: 2000,
  initTimeoutMs: 10000,
  sqliteHeapBytes: 32 * 1024 * 1024,
} as const;
export class QueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QueryError";
  }
}
type Token = {
  kind: "word" | "identifier" | "string" | "symbol";
  value: string;
  start: number;
  end: number;
};
/** Lex only the safety envelope. SQLite, not this scanner, parses statement boundaries/SQL grammar. */
export function sqlTokens(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < source.length) {
    const start = i;
    const char = source[i];
    if (/\s/.test(char)) {
      i++;
      continue;
    }
    if (char === "-" && source[i + 1] === "-") {
      i += 2;
      while (i < source.length && !["\n", "\r"].includes(source[i])) i++;
      continue;
    }
    if (char === "/" && source[i + 1] === "*") {
      i += 2;
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/"))
        i++;
      i = Math.min(source.length, i + 2);
      continue;
    }
    if (["'", '"', "`", "["].includes(char)) {
      const end = char === "[" ? "]" : char;
      const kind = char === "'" ? "string" : "identifier";
      let value = "";
      let closed = false;
      i++;
      while (i < source.length) {
        if (source[i] === end) {
          if (end !== "]" && source[i + 1] === end) {
            value += end;
            i += 2;
            continue;
          }
          i++;
          closed = true;
          break;
        }
        value += source[i++];
      }
      if (!closed)
        throw new QueryError("Unterminated SQL string or quoted identifier.");
      tokens.push({ kind, value, start, end: i });
      continue;
    }
    if (/[A-Za-z_]/.test(char)) {
      let value = char;
      i++;
      while (i < source.length && /[A-Za-z0-9_$]/.test(source[i]))
        value += source[i++];
      tokens.push({ kind: "word", value, start, end: i });
      continue;
    }
    i++;
    tokens.push({ kind: "symbol", value: char, start, end: i });
  }
  return tokens;
}
const forbiddenWords = new Set([
  "INSERT",
  "UPDATE",
  "DELETE",
  "CREATE",
  "DROP",
  "ALTER",
  "PRAGMA",
  "ATTACH",
  "DETACH",
  "VACUUM",
  "REINDEX",
  "ANALYZE",
  "BEGIN",
  "COMMIT",
  "ROLLBACK",
  "SAVEPOINT",
  "RELEASE",
]);
const forbiddenFunctions = new Set([
  "LOAD_EXTENSION",
  "READFILE",
  "WRITEFILE",
  "EVAL",
  "FTS3_TOKENIZER",
]);
function isForbiddenFunction(value: string): boolean {
  const word = value.toUpperCase();
  return forbiddenFunctions.has(word) || word.startsWith("PRAGMA_");
}

/**
 * SQLite accepts single quotes as identifiers in table positions. Replace only
 * sensitive single-quoted names with expression-only parameters in a validation
 * copy. Native preparation then distinguishes values from identifiers without
 * duplicating SQLite's FROM/JOIN/CTE/IN grammar. Never execute this copy.
 */
export function literalValidationSql(source: string): string | null {
  const sensitive = sqlTokens(source).filter(
    (token) => token.kind === "string" && isForbiddenFunction(token.value),
  );
  if (!sensitive.length) return null;
  let copy = "";
  let offset = 0;
  for (const token of sensitive) {
    copy += source.slice(offset, token.start) + " ? ";
    offset = token.end;
  }
  return copy + source.slice(offset);
}

export function assertQueryPolicy(source: unknown): asserts source is string {
  if (typeof source !== "string") throw new QueryError("SQL must be text.");
  if (new TextEncoder().encode(source).length > LIMITS.sqlBytes)
    throw new QueryError("SQL exceeds the 20 KiB input limit.");
  if (source.includes("\0"))
    throw new QueryError("SQL cannot contain a NUL character.");
  const tokens = sqlTokens(source);
  const first = tokens.find(
    (token) => !(token.kind === "symbol" && token.value === ";"),
  );
  if (
    !first ||
    first.kind !== "word" ||
    !["SELECT", "WITH"].includes(first.value.toUpperCase())
  )
    throw new QueryError("Only a read-only SELECT or WITH query is allowed.");
  for (const token of tokens) {
    const word = token.value.toUpperCase();
    if (token.kind === "word" && forbiddenWords.has(word))
      throw new QueryError(
        `Statement policy blocks ${word}. Only read-only queries are allowed.`,
      );
    if (
      (token.kind === "word" || token.kind === "identifier") &&
      isForbiddenFunction(word)
    )
      throw new QueryError(
        "Extension, filesystem and PRAGMA functions are not allowed. Use the schema explorer.",
      );
  }
}
