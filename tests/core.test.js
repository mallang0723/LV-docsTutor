import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildEntries, resolveGlossary} from '../src/core.js';

test('English guide content is preserved, Korean world-book query has triggers and one constant glossary', () => {
  const entries = buildEntries([{path:'world-books/index.md', content:'# World Books\n\n## How World Books Work\n\nExact **English** text.\n\n## More\n\nOther text.'}]);
  assert.equal(entries.filter(e=>e.constant).length,1);
  assert.ok(entries.find(e=>e.content.includes('Exact **English** text.')).key.includes('월드북'));
  assert.match(entries.at(-1).content,/한국어\(English\)/);
  assert.match(entries.at(-1).content,/로어북.*월드북/);
  assert.ok(entries.every(e=>e.content.length<=2400));
});

test('same locale key overrides built-in, unknown and unsafe values fall back', () => {
  const terms=resolveGlossary({chat:{action:'Impersonate',other:'Dry Run'}},{chat:{action:'대리 쓰기',other:'{{unsafe}}'}});
  assert.equal(terms.find(t=>t.en==='Impersonate').ko,'대리 쓰기');
  assert.equal(terms.find(t=>t.en==='Dry Run').ko,'모의 실행');
});

test('long source is bounded without losing source characters', () => {
  const body='# Heading\n'+('a'.repeat(5100));
  const entries=buildEntries([{path:'world-books/index.md',content:body}]).filter(e=>!e.constant);
  assert.equal(entries.map(e=>e.content.replace(/^\[출처: .*?\]\n/,'')).join(''),body);
  assert.ok(entries.every(e=>e.content.length<=1900));
});
