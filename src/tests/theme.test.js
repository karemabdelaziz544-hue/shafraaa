const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

function collectFiles(dir, exts = ['.ts', '.tsx']) {
  const out = [];
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) {
      out.push(...collectFiles(full, exts));
    } else if (exts.some((ext) => entry.endsWith(ext))) {
      out.push(full);
    }
  }
  return out;
}

test('9. اختبار نظام الألوان الموحد MP072 وعدم وجود ألوان زرقاء قديمة أو أيقونات مختلطة', () => {
  const tokensSrc = fs.readFileSync(path.join(process.cwd(), 'src/lib/design-tokens.ts'), 'utf8');
  for (const hex of ['#EEE9DF', '#C9C1B1', '#2C3B4D', '#1B2632', '#FFB162', '#A35139']) {
    assert.ok(tokensSrc.includes(hex), `يجب وجود اللون ${hex} في design-tokens.ts`);
  }

  const globalsSrc = fs.readFileSync(path.join(process.cwd(), 'src/app/globals.css'), 'utf8');
  assert.ok(globalsSrc.includes(':root'), 'يجب تعريف متغيرات الوضع الفاتح :root');
  assert.ok(globalsSrc.includes('.dark'), 'يجب تعريف متغيرات الوضع الداكن .dark');
  assert.ok(globalsSrc.includes('stroke-width: 1.75'), 'يجب توحيد سُمك خط Lucide إلى 1.75');

  const manifest = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public/manifest.json'), 'utf8'));
  assert.strictEqual(manifest.background_color, '#EEE9DF');
  assert.strictEqual(manifest.theme_color, '#2C3B4D');
  assert.strictEqual(fs.existsSync(path.join(process.cwd(), 'public/icon.svg')), true);
  assert.strictEqual(fs.existsSync(path.join(process.cwd(), 'public/icon-192.png')), true);
  assert.strictEqual(fs.existsSync(path.join(process.cwd(), 'public/icon-512.png')), true);
  assert.strictEqual(fs.existsSync(path.join(process.cwd(), 'src/app/icon.svg')), true);

  const legacyClassPattern =
    /\b(?:bg|text|border|ring|from|to|via|fill|stroke|shadow)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|brand|white|black)(?:-\d+)?(?:\/\d+)?\b/;

  const uiFiles = [
    ...collectFiles(path.join(process.cwd(), 'src/app')),
    ...collectFiles(path.join(process.cwd(), 'src/components')),
  ];

  for (const file of uiFiles) {
    const src = fs.readFileSync(file, 'utf8');
    const rel = path.relative(process.cwd(), file);
    const match = src.match(legacyClassPattern);
    assert.strictEqual(
      match,
      null,
      `يوجد لون Tailwind قديم غير موحد في ${rel}: ${match ? match[0] : ''}`
    );

    const emojiMatch = src.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
    assert.strictEqual(
      emojiMatch,
      null,
      `توجد أيقونة إيموجي مختلطة في ${rel}: ${emojiMatch ? emojiMatch[0] : ''}`
    );
  }
});
