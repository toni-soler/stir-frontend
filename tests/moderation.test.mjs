import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

test('ReportButton stays hidden without stir.content.report, matching the backend @PreAuthorize check', () => {
  const source = read('../src/moderation.jsx');
  assert.match(source, /if \(!sdk\.useAuth\(\)\.hasPermission\('stir\.content\.report'\)\) return null;/);
});

test('the moderation queue links to the reported target instead of only showing its type and id', () => {
  const source = read('../src/moderation.jsx');
  assert.match(source, /r\.targetPreview/);
  assert.match(source, /navigate\(targetPath\(r\)\)/);
  assert.match(source, /moderationTargetUnavailable/);
  // extension.jsx must actually pass navigate through, or the queue has nothing to call
  const extension = read('../src/extension.jsx');
  assert.match(extension, /<ModerationQueue sdk=\{sdk\} t=\{t\} navigate=\{navigate\}\/>/);
});
