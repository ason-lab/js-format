/**
 * ason-format — syntax highlighter for ASON (Array-Schema Object Notation).
 *
 * Zero dependencies. Works in browsers, Node.js, Deno, Bun.
 *
 * API:
 *   highlight(src, options?)  → HTML string with <span class="ason-*"> tags
 *   tokenize(src)             → Token[]
 */

export type TokenKind =
  | 'schema-open'
  | 'schema-close'
  | 'tuple-open'
  | 'tuple-close'
  | 'array-open'
  | 'array-close'
  | 'colon'      // schema/body separator
  | 'at'         // type / structural marker
  | 'comma'
  | 'field'
  | 'type'
  | 'string'
  | 'number'
  | 'bool'
  | 'value'
  | 'comment'
  | 'ws'
  | 'nl'
  | 'error';

export interface Token {
  kind: TokenKind;
  text: string;
}

const TYPE_HINTS = new Set([
  'int', 'integer', 'uint',
  'float', 'double',
  'str', 'string',
  'bool', 'boolean',
]);

const IS_IDENT = (c: string) => /[a-zA-Z0-9_+\-]/.test(c);
const IS_IDENT_START = (c: string) => /[a-zA-Z_]/.test(c);
const IS_VALUE_DELIM = (c: string) =>
  c === ',' || c === '(' || c === ')' || c === '[' || c === ']' ||
  c === '{' || c === '}' || c === '"' || c === '/' ||
  c === '@' || c === ':' ||
  c === ' ' || c === '\t' || c === '\r' || c === '\n';

export function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  let schemaDepth = 0;
  let expectField = false;
  let expectType = false;

  while (i < src.length) {
    const ch = src[i]!;

    if (ch === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      const text = end < 0 ? src.slice(i) : src.slice(i, end + 2);
      tokens.push({ kind: 'comment', text });
      i += text.length;
      continue;
    }

    if (ch === '\n') {
      tokens.push({ kind: 'nl', text: '\n' });
      i++;
      continue;
    }
    if (ch === '\r') {
      const text = src[i + 1] === '\n' ? '\r\n' : '\r';
      tokens.push({ kind: 'nl', text });
      i += text.length;
      continue;
    }

    if (ch === ' ' || ch === '\t') {
      let j = i;
      while (j < src.length && (src[j] === ' ' || src[j] === '\t')) j++;
      tokens.push({ kind: 'ws', text: src.slice(i, j) });
      i = j;
      continue;
    }

    if (ch === '"') {
      let j = i + 1;
      while (j < src.length) {
        if (src[j] === '\\') {
          j += 2;
          continue;
        }
        if (src[j] === '"') {
          j++;
          break;
        }
        j++;
      }
      const text = src.slice(i, j);
      const kind: TokenKind = schemaDepth > 0 && expectField ? 'field' : 'string';
      tokens.push({ kind, text });
      if (kind === 'field') expectField = false;
      if (expectType) expectType = false;
      i = j;
      continue;
    }

    if (ch === '{') {
      schemaDepth++;
      expectField = true;
      expectType = false;
      tokens.push({ kind: 'schema-open', text: '{' });
      i++;
      continue;
    }
    if (ch === '}') {
      schemaDepth = Math.max(0, schemaDepth - 1);
      expectField = false;
      expectType = false;
      tokens.push({ kind: 'schema-close', text: '}' });
      i++;
      continue;
    }
    if (ch === '(') { tokens.push({ kind: 'tuple-open', text: '(' }); i++; continue; }
    if (ch === ')') { tokens.push({ kind: 'tuple-close', text: ')' }); i++; continue; }
    if (ch === '[') { tokens.push({ kind: 'array-open', text: '[' }); i++; continue; }
    if (ch === ']') { tokens.push({ kind: 'array-close', text: ']' }); i++; continue; }

    if (ch === '@') {
      expectType = schemaDepth > 0;
      expectField = false;
      tokens.push({ kind: 'at', text: '@' });
      i++;
      continue;
    }

    if (ch === ':') {
      tokens.push({ kind: 'colon', text: ':' });
      i++;
      continue;
    }

    if (ch === ',') {
      if (schemaDepth > 0) {
        expectField = true;
        expectType = false;
      }
      tokens.push({ kind: 'comma', text: ',' });
      i++;
      continue;
    }

    if (IS_IDENT_START(ch)) {
      let j = i;
      while (j < src.length && IS_IDENT(src[j]!)) j++;
      const word = src.slice(i, j);

      let kind: TokenKind;
      if (schemaDepth > 0 && expectType) {
        kind = TYPE_HINTS.has(word) ? 'type' : 'type';
        expectType = false;
      } else if (schemaDepth > 0 && expectField) {
        kind = 'field';
        expectField = false;
      } else if (word === 'true' || word === 'false') {
        kind = 'bool';
      } else {
        kind = schemaDepth > 0 ? 'field' : 'value';
      }

      tokens.push({ kind, text: word });
      i = j;
      continue;
    }

    if ((ch >= '0' && ch <= '9') || (ch === '-' && i + 1 < src.length && src[i + 1]! >= '0' && src[i + 1]! <= '9')) {
      let j = i;
      if (src[j] === '-') j++;
      while (j < src.length && src[j]! >= '0' && src[j]! <= '9') j++;
      if (j < src.length && src[j] === '.' && j + 1 < src.length && src[j + 1]! >= '0' && src[j + 1]! <= '9') {
        j++;
        while (j < src.length && src[j]! >= '0' && src[j]! <= '9') j++;
      }
      while (j < src.length && (src[j] === '-' || (src[j]! >= '0' && src[j]! <= '9'))) j++;
      tokens.push({ kind: 'number', text: src.slice(i, j) });
      if (expectType) expectType = false;
      i = j;
      continue;
    }

    let j = i;
    while (j < src.length && !IS_VALUE_DELIM(src[j]!)) j++;
    if (j > i) {
      tokens.push({ kind: 'value', text: src.slice(i, j) });
      i = j;
      continue;
    }

    tokens.push({ kind: 'error', text: ch });
    i++;
  }

  return tokens;
}

export interface HighlightOptions {
  tag?: string;
  class?: string;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function highlight(src: string, opts: HighlightOptions = {}): string {
  const tag = opts.tag ?? 'code';
  const cls = opts.class ?? 'ason-highlight';
  const tokens = tokenize(src);

  let html = `<${esc(tag)} class="${esc(cls)}">`;
  for (const tok of tokens) {
    const text = esc(tok.text);
    if (tok.kind === 'ws' || tok.kind === 'nl') {
      html += text;
    } else {
      html += `<span class="ason-${tok.kind}">${text}</span>`;
    }
  }
  html += `</${esc(tag)}>`;
  return html;
}

const AsonFormat = { tokenize, highlight };
export default AsonFormat;
