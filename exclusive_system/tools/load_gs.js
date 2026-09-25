// Загружает все .gs файлы в один контекст (как Apps Script) с заглушками сервисов Google.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadGs(overrides) {
  const dir = path.join(__dirname, '..', 'apps_script');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.gs')).sort();
  const src = files.map(f => `// ==== ${f}\n` + fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
  const stub = new Proxy({}, { get: () => { throw new Error('Google service called at load time'); } });
  const ctx = { console, SpreadsheetApp: stub, DriveApp: stub, DocumentApp: stub, HtmlService: stub, ScriptApp: stub,
    LockService: stub, Session: stub, Utilities: stub, MailApp: stub, Charts: stub, MimeType: stub };
  Object.assign(ctx, overrides || {});
  vm.createContext(ctx);
  // top-level const не попадают в глобальный объект — экспортируем их явно
  const exportNames = [...src.matchAll(/^(?:const|function)\s+([A-Za-z_$][\w$]*)/gm)].map(m => m[1]);
  vm.runInContext(src + '\n;globalThis.__x = {' + [...new Set(exportNames)].join(',') + '};', ctx, { filename: 'apps_script.js' });
  return ctx.__x;
}
module.exports = { loadGs };
