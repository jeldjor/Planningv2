import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

const source = await readFile(new URL('../v1082.js', import.meta.url), 'utf8');

test('centrale vertaling wisselt bestaande en dynamische interface zonder navigatie', async () => {
  const dom = new JSDOM('<!doctype html><body><button>Instellingen</button><div id="dynamic"></div></body>', {
    url: 'https://development.example.test/mobile.html',
    runScripts: 'outside-only'
  });
  dom.window.eval(source);
  await dom.window.GJ_I18N.setLanguage('en', false);
  assert.equal(dom.window.document.querySelector('button').textContent, 'Settings');
  dom.window.document.getElementById('dynamic').innerHTML = '<span>Wordt verstuurd…</span>';
  await new Promise((resolve) => dom.window.setTimeout(resolve, 0));
  assert.equal(dom.window.document.querySelector('#dynamic span').textContent, 'Sending…');
  await dom.window.GJ_I18N.setLanguage('de', false);
  assert.equal(dom.window.document.querySelector('button').textContent, 'Einstellungen');
  assert.equal(dom.window.document.querySelector('#dynamic span').textContent, 'Wird gesendet…');
  dom.window.close();
});
