import test from 'node:test';
import assert from 'node:assert/strict';
import { highlight, tokenize } from '../dist/ason-format.js';

test('tokenize typed schema uses @ marker', () => {
  const tokens = tokenize('{name@str,age@int}:(Alice,30)');
  assert.equal(tokens.find(t => t.kind === 'at')?.text, '@');
  assert.equal(tokens.find(t => t.kind === 'type')?.text, 'str');
  assert.equal(tokens.filter(t => t.kind === 'colon').length, 1);
});

test('tokenize nested structural markers in untyped schema', () => {
  const tokens = tokenize('{profile@{host,port},tags@[],members@[{id,role}]}:((api,8080),[blue],[ (1,owner) ])');
  assert.ok(tokens.some(t => t.kind === 'at'));
  assert.ok(tokens.some(t => t.kind === 'field' && t.text === 'profile'));
  assert.ok(tokens.some(t => t.kind === 'field' && t.text === 'members'));
});

test('quoted field names are highlighted as fields in schema', () => {
  const tokens = tokenize('{"a.b"@str,name@str}:(hello,world)');
  assert.equal(tokens[1].kind, 'field');
  assert.equal(tokens[1].text, '"a.b"');
});

test('legacy map syntax is not tokenized as map keyword', () => {
  const tokens = tokenize('{attrs@[{key@str,value@str}]}:([(role,admin)])');
  assert.equal(tokens.some(t => t.kind === 'error' && t.text === '<'), false);
  assert.equal(tokens.some(t => t.kind === 'field' && t.text === 'attrs'), true);
});

test('highlight emits ason-at and never emits ason-map', () => {
  const html = highlight('{name@str,tags@[str]}:(Alice,[blue])');
  assert.match(html, /ason-at/);
  assert.doesNotMatch(html, /ason-map/);
});
