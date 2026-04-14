import test from 'node:test';
import assert from 'node:assert/strict';
import { highlight, tokenize } from '../dist/asun-format.js';

test('tokenize typed schema uses @ marker', () => {
  const tokens = tokenize('{name@str,age@int}:(Alice,30)');
  assert.equal(tokens.find(t => t.kind === 'at')?.text, '@');
  assert.equal(tokens.find(t => t.kind === 'type')?.text, 'str');
  assert.equal(tokens.filter(t => t.kind === 'colon').length, 1);
});

test('only current scalar type names are highlighted as types', () => {
  const tokens = tokenize('{name@str,age@integer,score@double,flag@boolean}:(Alice,30,9.5,true)');
  assert.ok(tokens.some(t => t.kind === 'type' && t.text === 'str'));
  assert.ok(tokens.some(t => t.kind === 'error' && t.text === 'integer'));
  assert.ok(tokens.some(t => t.kind === 'error' && t.text === 'double'));
  assert.ok(tokens.some(t => t.kind === 'error' && t.text === 'boolean'));
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

test('entry-list schema is tokenized without any legacy map token path', () => {
  const tokens = tokenize('{attrs@[{key@str,value@str}]}:([(role,admin)])');
  assert.equal(tokens.some(t => t.kind === 'error' && t.text === '<'), false);
  assert.equal(tokens.some(t => t.kind === 'field' && t.text === 'attrs'), true);
});

test('highlight emits asun-at and never emits asun-map', () => {
  const html = highlight('{name@str,tags@[str]}:(Alice,[blue])');
  assert.match(html, /asun-at/);
  assert.doesNotMatch(html, /asun-map/);
});

test('single schema with multiple top-level tuples marks the extra tuple as error', () => {
  const tokens = tokenize('{id@int,name@str}:(101,Alice),(102,Bob)');
  const errorTexts = tokens.filter(t => t.kind === 'error').map(t => t.text);
  assert.deepEqual(errorTexts, [',', '(']);
});

test('array schema keeps multiple top-level tuples valid', () => {
  const tokens = tokenize('[{id@int,name@str}]:(101,Alice),(102,Bob)');
  assert.equal(tokens.some(t => t.kind === 'error' && (t.text === ',' || t.text === '(')), false);
});
