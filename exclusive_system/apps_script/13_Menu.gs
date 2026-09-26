/**
 * 13_Menu — меню «МАРКЕТИНГ ОБЪЕКТОВ».
 */

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu(SYS.MENU)
    .addItem('➜ Открыть вкладку объекта', 'openObjectTab')
    .addItem('➜ Разобрать папку «Входящие»', 'processInbox')
    .addItem('➜ Загрузить объекты списком', 'importObjects')
    .addItem('➜ Создать вкладки для новых объектов', 'createObjectTabs')
    .addItem('➜ Обновить документы объектов', 'refreshObjectFiles')
    .addSeparator()
    .addItem('➜ Создать план недели', 'createWeekPlan')
    .addItem('➜ Внести задачи с оперативки', 'importMeetingTasks')
    .addItem('➜ Проверить просрочки', 'checkOverdue')
    .addItem('➜ Синхронизировать задачи с календарём', 'syncCalendar')
    .addSeparator()
    .addItem('➜ Промпт для Claude по объекту', 'promptForObject')
    .addItem('➜ Обновить статистику соцсетей', 'refreshSocialStats')
    .addItem('➜ Отправить отмеченные в CRM', 'crmSendPending')
    .addItem('➜ Отправить отчёт клиенту в CRM', 'crmSendReport')
    .addSeparator()
    .addItem('➜ Создать отчёт клиенту', 'createReport')
    .addItem('➜ Обновить PDF отчёта', 'createPdf')
    .addSeparator()
    .addItem('➜ Дэшборд', 'openDashboard')
    .addItem('➜ Обновить (ID, вкладки, строки)', 'refreshAll')
    .addSeparator()
    .addSubMenu(ui.createMenu('Сервис')
      .addItem('⚙ Установить / обновить систему', 'setupSystem')
      .addItem('Обновить все вкладки объектов', 'rebuildObjectTabs')
      .addItem('Показать все вкладки объектов (в т.ч. закрытых)', 'showAllObjectTabs')
      .addItem('Удалить объект (только руководитель)', 'deleteObject')
      .addItem('Подключить Instagram / Threads', 'connectSocial')
      .addItem('Подключить CRM TopenLab', 'connectCrm')
      .addItem('Тест: комментарий в карточку CRM', 'crmTestNote')
      .addItem('Включить автообновление (входящие, календарь, соцсети)', 'enableDailyJobs')
      .addItem('Выключить автообновление', 'disableDailyJobs')
      .addItem('Включить автоотчёты (пятница 20:00 МСК)', 'enableAutoReports')
      .addItem('Выключить автоотчёты', 'disableAutoReports')
      .addSeparator()
      .addItem('Загрузить пример (ЖК Время · Лермонтовская 1)', 'loadExampleData')
      .addItem('Запустить самопроверку', 'runSelfTest')
      .addItem('О системе', 'aboutSystem'))
    .addToUi();
}

function aboutSystem() {
  SpreadsheetApp.getUi().alert(SYS.TITLE + ' v' + SYS.VERSION,
    'Не CRM: клиенты, показы и сделки — в CRM. Здесь — маркетинговая стратегия и работа команды по каждому эксклюзиву.\n\n' +
    '• 01_ОБЪЕКТЫ — реестр; у каждого объекта своя вкладка «▸ Название (ID)» со стратегией: аналитика и цена → сценарии → аудитории → КП → каналы → решения.\n' +
    '• 02_ЗАДАЧИ — план-факт по неделям; 03_ОБЗВОН_И_КП — работа ассистента с базой; 04_КОНТЕНТ — публикации SMM.\n' +
    '• 00_ДЭШБОРД, 05_ОТЧЁТ_КЛИЕНТУ и разделы 8–9 вкладок считаются сами.\n' +
    '• 06_БИБЛИОТЕКА — чек-листы, промпты, регламенты. 09_ИСТОРИЯ — кто что изменил.\n\n' +
    'Цвет заголовка: тёмный — вводится вручную; серо-голубой — формула; светло-серый — заполняет скрипт.',
    SpreadsheetApp.getUi().ButtonSet.OK);
}
