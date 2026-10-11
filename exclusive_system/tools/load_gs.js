// Загружает все .gs файлы в один контекст (как Apps Script) с заглушками сервисов Google.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// opts.now — зафиксировать «сегодня» (строка ISO или число), чтобы тесты не зависели от текущей даты.
function loadGs(overrides, opts) {
  const dir = path.join(__dirname, '..', 'apps_script');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.gs')).sort();
  const src = files.map(f => `// ==== ${f}\n` + fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
  const stub = new Proxy({}, { get: () => { throw new Error('Google service called at load time'); } });
  const ctx = { console, SpreadsheetApp: stub, DriveApp: stub, DocumentApp: stub, HtmlService: stub, ScriptApp: stub,
    LockService: stub, Session: stub, Utilities: stub, MailApp: stub, Charts: stub, MimeType: stub };
  Object.assign(ctx, overrides || {});
  vm.createContext(ctx);
  // top-level const не попадают в глобальный объект — экспортируем их явно
  const exportNames = [...src.replace(/String\.raw`[\s\S]*?`;/g, '').matchAll(/^(?:const|function)\s+([A-Za-z_$][\w$]*)/gm)].map(m => m[1]);
  const clock = opts && opts.now !== undefined
    ? `(() => { const R = Date, T = new R(${JSON.stringify(opts.now)}).getTime();
        globalThis.Date = class extends R { constructor(...a) { super(...(a.length ? a : [T])); } static now() { return T; } }; })();\n`
    : '';
  vm.runInContext(clock + src + '\n;globalThis.__x = {' + [...new Set(exportNames)].join(',') + '};', ctx, { filename: 'apps_script.js' });
  return ctx.__x;
}
module.exports = { loadGs };
