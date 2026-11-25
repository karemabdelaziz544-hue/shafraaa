const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

test('8. اختبار إعدادات الحركة الموحدة (سقف 300ms واتجاه RTL ووجود loading.tsx)', () => {
  const motionPath = path.join(process.cwd(), 'src/lib/motion.ts');
  const motionSrc = fs.readFileSync(motionPath, 'utf8');

  // التأكد من عدم وجود أي مدة حركة تتجاوز 0.3 ثانية (300ms)
  const durationMatches = [...motionSrc.matchAll(/:\s*(0\.\d+|\d+(?:\.\d+)?)\s*,/g)];
  const durationBlockMatch = motionSrc.match(/MOTION_DURATIONS\s*=\s*\{([\s\S]*?)\}/);
  assert.ok(durationBlockMatch, 'يجب وجود كائن MOTION_DURATIONS');

  const durations = [...durationBlockMatch[1].matchAll(/:\s*([0-9.]+)/g)].map((m) => Number(m[1]));
  assert.ok(durations.length >= 4, 'يجب تعريف عدة مدد حركة قياسية');
  for (const d of durations) {
    assert.ok(d > 0 && d <= 0.3, `مدة الحركة ${d} يجب أن تكون <= 0.3 ثانية (300ms)`);
  }

  // التأكد من اتجاه الانزلاق المتوافق مع القراءة العربية RTL
  assert.match(motionSrc, /routeSlideX:\s*-\d+/);

  // التأكد من وجود ملفات loading.tsx للمسارات الرئيسية
  const expectedLoadings = [
    'src/app/loading.tsx',
    'src/app/sales/new/loading.tsx',
    'src/app/sales/loading.tsx',
    'src/app/products/loading.tsx',
    'src/app/customers/loading.tsx',
    'src/app/suppliers/loading.tsx',
    'src/app/inventory/loading.tsx',
    'src/app/inventory/damaged/loading.tsx',
    'src/app/expenses/loading.tsx',
    'src/app/drawer/loading.tsx',
    'src/app/reports/loading.tsx',
    'src/app/withdrawals/loading.tsx',
    'src/app/import/loading.tsx',
    'src/app/settings/loading.tsx',
    'src/app/login/loading.tsx',
  ];

  for (const rel of expectedLoadings) {
    assert.strictEqual(
      fs.existsSync(path.join(process.cwd(), rel)),
      true,
      `ملف التحميل ${rel} غير موجود`
    );
  }
});
