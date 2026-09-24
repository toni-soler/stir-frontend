import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

test('ReportButton stays hidden without stir.content.report, matching the backend @PreAuthorize check', () => {
  const source = read('../src/moderation.jsx');
  assert.match(source, /if \(!sdk\.useAuth\(\)\.hasPermission\('stir\.content\.report'\)\) return null;/);
});
