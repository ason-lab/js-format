/**
 * asun-format — syntax highlighter for ASUN (Array-Schema Unified Notation).
 *
 * Zero dependencies. Works in browsers, Node.js, Deno, Bun.
 *
 * API:
 *   highlight(src, options?)  → HTML string with <span class="asun-*"> tags
 *   tokenize(src)             → Token[]
 */

export type TokenKind =
  | "schema-open"
  | "schema-close"
  | "tuple-open"
  | "tuple-close"
  | "array-open"
  | "array-close"
  | "colon" // schema/body separator
  | "at" // type / structural marker
  | "comma"
  | "field"
  | "type"
  | "string"
  | "number"
  | "bool"
  | "value"
  | "comment"
  | "ws"
  | "nl"
  | "error";

export interface Token {
  kind: TokenKind;
  text: string;
}

const TYPE_HINTS = new Set(["int", "float", "str", "bool"]);

const IS_BARE_FIELD = (c: string) => /[a-zA-Z0-9_]/.test(c);
const IS_ALPHA = (c: string) => /[a-zA-Z]/.test(c);
const NUMBER_RE = /^-?(?:\d+\.\d+(?:[eE][+-]?\d+)?|\d+[eE][+-]?\d+|\d+)$/;
const HEX_RE = /^[0-9A-Fa-f]$/;
const IS_VALUE_DELIM = (c: string) =>
  c === "," ||
  c === "(" ||
  c === ")" ||
  c === "[" ||
  c === "]" ||
  c === "{" ||
  c === "}" ||
  c === '"' ||
  c === "@" ||
  c === ":" ||
  c === " " ||
  c === "\t" ||
  c === "\r" ||
  c === "\n";

const IS_SCHEMA_TOKEN_DELIM = (c: string) =>
  c === "," ||
  c === "}" ||
  c === "]" ||
  c === " " ||
  c === "\t" ||
  c === "\r" ||
  c === "\n";

function scanQuoted(src: string, start: number): { end: number; ok: boolean } {
  let j = start + 1;
  let ok = true;
  while (j < src.length) {
    const c = src[j]!;
    if (c === '"') return { end: j + 1, ok };
    if (c === "\n" || c === "\r" || c < " ") ok = false;
    if (c === "\\") {
      const e = src[j + 1];
      if (e === undefined) return { end: src.length, ok: false };
      if (
        e === "\\" ||
        e === '"' ||
        e === "n" ||
        e === "t" ||
        e === "r" ||
        e === "b" ||
        e === "f" ||
        e === "," ||
        e === "(" ||
        e === ")" ||
        e === "[" ||
        e === "]" ||
        e === "{" ||
        e === "}" ||
        e === ":" ||
        e === "@"
      ) {
        j += 2;
        continue;
      }
      if (e === "u") {
        const hex = src.slice(j + 2, j + 6);
        if (hex.length !== 4 || ![...hex].every((h) => HEX_RE.test(h))) {
          ok = false;
        }
        j += Math.min(6, src.length - j);
        continue;
      }
      ok = false;
      j += 2;
      continue;
    }
    j++;
  }
  return { end: src.length, ok: false };
}

function scanBareField(src: string, start: number): { end: number; ok: boolean } {
  let j = start;
  while (j < src.length && !IS_SCHEMA_TOKEN_DELIM(src[j]!) && src[j] !== "@")
    j++;
  const text = src.slice(start, j);
  return { end: j, ok: text.length > 0 && [...text].every(IS_BARE_FIELD) };
}

function scanSchemaType(src: string, start: number): { end: number; text: string } {
  let j = start;
  while (j < src.length && !IS_SCHEMA_TOKEN_DELIM(src[j]!)) j++;
  return { end: j, text: src.slice(start, j) };
}

function scanValueLike(src: string, start: number): { end: number; text: string } {
  let j = start;
  while (j < src.length) {
    if (src[j] === "/" && src[j + 1] === "*") break;
    if (IS_VALUE_DELIM(src[j]!)) break;
    j++;
  }
  return { end: j, text: src.slice(start, j) };
}

export function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  let schemaDepth = 0;
  let tupleDepth = 0;
  let arrayDepth = 0;
  let expectField = false;
  let expectType = false;
  let rootSchemaKind: "single" | "array" | null = null;
  let rootBodyStarted = false;
  let rootTopLevelTupleCount = 0;

  const isRootBodyTopLevel = () =>
    rootBodyStarted &&
    schemaDepth === 0 &&
    tupleDepth === 0 &&
    arrayDepth === 0;

  while (i < src.length) {
    const ch = src[i]!;

    if (ch === "/" && src[i + 1] === "*") {
      const end = src.indexOf("*/", i + 2);
      const text = end < 0 ? src.slice(i) : src.slice(i, end + 2);
      tokens.push({ kind: "comment", text });
      i += text.length;
      continue;
    }

    if (ch === "\n") {
      tokens.push({ kind: "nl", text: "\n" });
      i++;
      continue;
    }
    if (ch === "\r") {
      const text = src[i + 1] === "\n" ? "\r\n" : "\r";
      tokens.push({ kind: "nl", text });
      i += text.length;
      continue;
    }

    if (ch === " " || ch === "\t") {
      let j = i;
      while (j < src.length && (src[j] === " " || src[j] === "\t")) j++;
      tokens.push({ kind: "ws", text: src.slice(i, j) });
      i = j;
      continue;
    }

    if (ch === '"') {
      const quoted = scanQuoted(src, i);
      const text = src.slice(i, quoted.end);
      const kind: TokenKind =
        !quoted.ok ? "error" : schemaDepth > 0 && expectField ? "field" : "string";
      tokens.push({ kind, text });
      if (kind === "field") expectField = false;
      if (expectType) expectType = false;
      i = quoted.end;
      continue;
    }

    if (ch === "{") {
      if (
        !rootBodyStarted &&
        rootSchemaKind === null &&
        schemaDepth === 0 &&
        tupleDepth === 0 &&
        arrayDepth === 0
      ) {
        rootSchemaKind = "single";
      }
      schemaDepth++;
      expectField = true;
      expectType = false;
      tokens.push({ kind: "schema-open", text: "{" });
      i++;
      continue;
    }
    if (ch === "}") {
      schemaDepth = Math.max(0, schemaDepth - 1);
      expectField = false;
      expectType = false;
      tokens.push({ kind: "schema-close", text: "}" });
      i++;
      continue;
    }
    if (ch === "(") {
      const extraTopLevelTuple =
        rootSchemaKind === "single" &&
        isRootBodyTopLevel() &&
        rootTopLevelTupleCount > 0;
      if (rootSchemaKind === "single" && isRootBodyTopLevel())
        rootTopLevelTupleCount++;
      tupleDepth++;
      tokens.push({
        kind: extraTopLevelTuple ? "error" : "tuple-open",
        text: "(",
      });
      i++;
      continue;
    }
    if (ch === ")") {
      tupleDepth = Math.max(0, tupleDepth - 1);
      tokens.push({ kind: "tuple-close", text: ")" });
      i++;
      continue;
    }
    if (ch === "[") {
      if (
        !rootBodyStarted &&
        rootSchemaKind === null &&
        schemaDepth === 0 &&
        tupleDepth === 0 &&
        arrayDepth === 0
      ) {
        rootSchemaKind = "array";
      }
      arrayDepth++;
      tokens.push({ kind: "array-open", text: "[" });
      i++;
      continue;
    }
    if (ch === "]") {
      arrayDepth = Math.max(0, arrayDepth - 1);
      tokens.push({ kind: "array-close", text: "]" });
      i++;
      continue;
    }

    if (ch === "@") {
      expectType = schemaDepth > 0;
      expectField = false;
      tokens.push({ kind: "at", text: "@" });
      i++;
      continue;
    }

    if (ch === ":") {
      if (
        !rootBodyStarted &&
        rootSchemaKind !== null &&
        schemaDepth === 0 &&
        tupleDepth === 0 &&
        arrayDepth === 0
      ) {
        rootBodyStarted = true;
        rootTopLevelTupleCount = 0;
      }
      tokens.push({ kind: "colon", text: ":" });
      i++;
      continue;
    }

    if (ch === ",") {
      const extraTopLevelSeparator =
        rootSchemaKind === "single" &&
        isRootBodyTopLevel() &&
        rootTopLevelTupleCount > 0;
      if (schemaDepth > 0) {
        expectField = true;
        expectType = false;
      }
      tokens.push({
        kind: extraTopLevelSeparator ? "error" : "comma",
        text: ",",
      });
      i++;
      continue;
    }

    if (schemaDepth > 0 && expectField) {
      const field = scanBareField(src, i);
      const text = src.slice(i, field.end);
      tokens.push({ kind: field.ok ? "field" : "error", text });
      expectField = field.ok ? false : expectField;
      i = field.end;
      continue;
    }

    if (schemaDepth > 0 && expectType && (IS_ALPHA(ch) || ch === "?")) {
      const type = scanSchemaType(src, i);
      tokens.push({ kind: TYPE_HINTS.has(type.text) ? "type" : "error", text: type.text });
      expectType = false;
      i = type.end;
      continue;
    }

    if (IS_ALPHA(ch) || ch === "_") {
      const value = scanValueLike(src, i);
      const kind: TokenKind =
        value.text === "true" || value.text === "false" ? "bool" : "value";
      tokens.push({ kind, text: value.text });
      if (expectType) expectType = false;
      i = value.end;
      continue;
    }

    if (
      (ch >= "0" && ch <= "9") ||
      (ch === "-" &&
        i + 1 < src.length &&
        src[i + 1]! >= "0" &&
        src[i + 1]! <= "9")
    ) {
      const value = scanValueLike(src, i);
      tokens.push({
        kind: NUMBER_RE.test(value.text) ? "number" : "value",
        text: value.text,
      });
      if (expectType) expectType = false;
      i = value.end;
      continue;
    }

    const value = scanValueLike(src, i);
    if (value.end > i) {
      tokens.push({ kind: "value", text: value.text });
      i = value.end;
      continue;
    }

    tokens.push({ kind: "error", text: ch });
    i++;
  }

  return tokens;
}

export interface HighlightOptions {
  tag?: string;
  class?: string;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function highlight(src: string, opts: HighlightOptions = {}): string {
  const tag = opts.tag ?? "code";
  const cls = opts.class ?? "asun-highlight";
  const tokens = tokenize(src);

  let html = `<${esc(tag)} class="${esc(cls)}">`;
  for (const tok of tokens) {
    const text = esc(tok.text);
    if (tok.kind === "ws" || tok.kind === "nl") {
      html += text;
    } else {
      html += `<span class="asun-${tok.kind}">${text}</span>`;
    }
  }
  html += `</${esc(tag)}>`;
  return html;
}

const AsunFormat = { tokenize, highlight };
export default AsunFormat;
