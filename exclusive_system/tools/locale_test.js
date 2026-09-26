// Перевод формул в запись «;» (русская локаль): сверка с формулами, проверенными в настоящей Google Таблице.
const { loadGs } = require('./load_gs.js');
const X = loadGs();
const cases = [
  ['=IFERROR(ARRAY_CONSTRAIN(ARRAYFORMULA(SORT(FILTER({B2:B6,C2:C6,IF(E2:E6="",D2:D6,E2:E6)},A2:A6="x",(B2:B6="2026-W39")+((E2:E6="OPEN")*(B2:B6<"2026-W39")*(B2:B6<>"")),1,TRUE)),15,3),"none")',
   '=IFERROR(ARRAY_CONSTRAIN(ARRAYFORMULA(SORT(FILTER({B2:B6\\C2:C6\\IF(E2:E6="";D2:D6;E2:E6)};A2:A6="x";(B2:B6="2026-W39")+((E2:E6="OPEN")*(B2:B6<"2026-W39")*(B2:B6<>""));1;TRUE));15;3);"none")'],
  ['=IFERROR(ARRAY_CONSTRAIN(ARRAYFORMULA(LET(t_rows,FILTER({C2:C6&" — "&D2:D6,E2:E6},A2:A6="x"),{SEQUENCE(ROWS(t_rows)),t_rows})),25,3),{"—","none",""})',
   '=IFERROR(ARRAY_CONSTRAIN(ARRAYFORMULA(LET(t_rows;FILTER({C2:C6&" — "&D2:D6\\E2:E6};A2:A6="x");{SEQUENCE(ROWS(t_rows))\\t_rows}));25;3);{"—"\\"none"\\""})'],
  ['={"hdr";ARRAYFORMULA(IF(LEN(B2:B5)=0,"",YEAR(B2:B5-WEEKDAY(B2:B5,2)+4)&"-W"&TEXT(ISOWEEKNUM(B2:B5),"00")))}',
   '={"hdr";ARRAYFORMULA(IF(LEN(B2:B5)=0;"";YEAR(B2:B5-WEEKDAY(B2:B5;2)+4)&"-W"&TEXT(ISOWEEKNUM(B2:B5);"00")))}'],
  ['=IFERROR(\'01_ОБЪЕКТЫ, копия\'!$A$2,"a,b; 0.5")*0.5', '=IFERROR(\'01_ОБЪЕКТЫ, копия\'!$A$2;"a,b; 0.5")*0,5'],
  ['=($D11<>"")*($D11<0.7)', '=($D11<>"")*($D11<0,7)'],
];
let bad = 0;
cases.forEach(([en, ru], i) => { const got = X.enToSemicolonF_(en); if (got !== ru) { bad++; console.log('✗', i, '\n  got ', got, '\n  want', ru); } });
console.log('locale cases:', cases.length, 'bad:', bad);
process.exit(bad ? 1 : 0);
