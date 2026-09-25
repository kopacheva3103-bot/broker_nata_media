/**
 * 13_Menu — меню «УПРАВЛЕНИЕ ЭКСКЛЮЗИВАМИ».
 */

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu(SYS.MENU)
    .addItem('➜ Создать отчёт', 'createReport')
    .addItem('➜ Создать PDF', 'createPdf')
    .addItem('➜ Открыть стратегию', 'openStrategy')
    .addItem('➜ Добавить действие', 'addAction')
    .addItem('➜ Создать план недели', 'createWeekPlan')
    .addItem('➜ Обновить статистику', 'refreshStats')
    .addItem('➜ Проверить просрочки', 'checkOverdue')
    .addItem('➜ Открыть Dashboard', 'openDashboard')
    .addSeparator()
    .addSubMenu(ui.createMenu('Сервис')
      .addItem('⚙ Установить / обновить систему', 'setupSystem')
      .addItem('Создать папки и стратегии для всех объектов', 'createFoldersForAll')
      .addItem('Включить ежедневную сводку на email', 'installDailyCheck')
      .addItem('Выключить ежедневную сводку', 'uninstallDailyCheck')
      .addSeparator()
      .addItem('Загрузить тестовые данные', 'loadTestData')
      .addItem('Запустить самопроверку', 'runSelfTest')
      .addItem('О системе', 'aboutSystem'))
    .addToUi();
}

function aboutSystem() {
  SpreadsheetApp.getUi().alert(SYS.TITLE + ' v' + SYS.VERSION,
    'Логика: ОБЪЕКТ → ДЕЙСТВИЕ → РЕЗУЛЬТАТ → СТАТИСТИКА → ВЫВОД → СЛЕДУЮЩИЙ ШАГ.\n\n' +
    'Вводим данные: 01 (объекты), 02 (стратегия), 03 (действия), 06 (план недели).\n' +
    'Считается само: 04 (воронка), 05, 07, 09, 11. Историю ведёт скрипт: 12, 13.\n\n' +
    'Цвет заголовка: тёмный — вводится вручную; серо-голубой — формула; светло-серый — заполняет скрипт.',
    SpreadsheetApp.getUi().ButtonSet.OK);
}
