import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFile } from 'node:fs/promises';

for (const file of ['admin-users/index.ts', 'tomtom-proxy/index.ts']) {
  test(`Edge Function ${file} is TypeScript-syntactisch geldig`, async () => {
    const source = await readFile(new URL(`../supabase/functions/${file}`, import.meta.url), 'utf8');
    const result = ts.transpileModule(source, {
      fileName: file,
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
      reportDiagnostics: true
    });
    const errors = (result.diagnostics || []).filter((item) => item.category === ts.DiagnosticCategory.Error);
    assert.deepEqual(errors.map((item) => ts.flattenDiagnosticMessageText(item.messageText, ' ')), []);
  });
}

test('service-role-key komt uitsluitend in servercode/documentatie voor', async () => {
  const frontend = await Promise.all(['index.html','laptop.html','mobile.html','auth.js','app-config.js','v108.js'].map((name) => readFile(new URL(`../${name}`, import.meta.url), 'utf8')));
  assert.doesNotMatch(frontend.join('\n'), /SUPABASE_SERVICE_ROLE_KEY|sb_secret_/);
  const admin = await readFile(new URL('../supabase/functions/admin-users/index.ts', import.meta.url), 'utf8');
  assert.match(admin, /Deno\.env\.get\('SUPABASE_SERVICE_ROLE_KEY'\)/);
});

