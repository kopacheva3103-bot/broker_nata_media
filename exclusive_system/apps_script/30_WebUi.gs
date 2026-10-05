/**
 * 30_WebUi — страница личного кабинета (HTML + CSS + JS одним текстом, чтобы код оставался одним файлом Code.gs).
 * Внутри нельзя использовать обратные кавычки и «доллар+фигурная скобка» — это строка String.raw.
 */
const WEB_HTML = String.raw`<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><base target="_top">
<style>
:root{--bg:#f4f6f9;--card:#fff;--ink:#1f2933;--mut:#6b7785;--line:#e3e8ef;--acc:#1f5f99;--acc2:#e8f1fa;--red:#c0392b;--redbg:#fdecea;--grn:#1e7d4f;--grnbg:#e6f4ec;--amb:#9a6b00;--ambbg:#fff4d6}
*{box-sizing:border-box}body{margin:0;font:14px/1.45 -apple-system,Segoe UI,Roboto,Arial,sans-serif;background:var(--bg);color:var(--ink)}
header{background:#14324f;color:#fff;padding:10px 16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;position:sticky;top:0;z-index:5}
header .t{font-weight:600;font-size:15px}header .me{margin-left:auto;font-size:13px;opacity:.9}
nav{display:flex;gap:4px;padding:8px 12px;background:#fff;border-bottom:1px solid var(--line);overflow-x:auto;position:sticky;top:44px;z-index:4}
nav button{border:0;background:none;padding:8px 12px;border-radius:8px;font:inherit;color:var(--mut);cursor:pointer;white-space:nowrap}
nav button.on{background:var(--acc2);color:var(--acc);font-weight:600}
main{max-width:1320px;margin:0 auto;padding:14px 12px 60px}
h2{font-size:17px;margin:18px 0 8px}h3{font-size:15px;margin:14px 0 6px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin-bottom:10px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px}
.obj{cursor:pointer}.obj:hover{border-color:var(--acc)}.obj .n{font-weight:600;margin-bottom:2px}
.mut{color:var(--mut);font-size:12.5px}.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.item{display:flex;gap:10px;align-items:flex-start;padding:9px 0;border-top:1px solid var(--line);cursor:pointer}.item:first-child{border-top:0}
.item .main{flex:1;min-width:0}.item .ttl{font-weight:500}
.pill{display:inline-block;padding:1px 8px;border-radius:999px;font-size:12px;background:#eef1f5;color:var(--mut);white-space:nowrap}
.pill.red{background:var(--redbg);color:var(--red)}.pill.grn{background:var(--grnbg);color:var(--grn)}.pill.amb{background:var(--ambbg);color:var(--amb)}.pill.acc{background:var(--acc2);color:var(--acc)}
button.b{border:1px solid var(--acc);background:var(--acc);color:#fff;border-radius:8px;padding:7px 12px;font:inherit;cursor:pointer}
button.b2{border:1px solid var(--line);background:#fff;color:var(--ink);border-radius:8px;padding:7px 12px;font:inherit;cursor:pointer}
a.lnk{color:var(--acc);text-decoration:none}a.lnk:hover{text-decoration:underline}
input,select,textarea{font:inherit;padding:7px 9px;border:1px solid var(--line);border-radius:8px;width:100%;background:#fff}
textarea{min-height:64px}label.f{display:block;margin:8px 0 3px;font-size:12.5px;color:var(--mut)}
.kpis{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}.kpi .v{font-size:22px;font-weight:600}
table{width:100%;border-collapse:collapse;font-size:13px}td,th{padding:7px 6px;border-top:1px solid var(--line);text-align:left;vertical-align:top}th{color:var(--mut);font-weight:500;border-top:0}
.tabs{display:flex;gap:4px;margin:10px 0;flex-wrap:wrap}.tabs button{border:1px solid var(--line);background:#fff;border-radius:8px;padding:6px 10px;font:inherit;cursor:pointer}.tabs button.on{border-color:var(--acc);color:var(--acc);font-weight:600}
#modal{position:fixed;inset:0;background:rgba(15,25,40,.45);display:none;align-items:flex-start;justify-content:center;padding:30px 10px;z-index:20;overflow:auto}
#modal .box{background:#fff;border-radius:14px;max-width:560px;width:100%;padding:16px 18px}
#toast{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);background:#1f2933;color:#fff;padding:9px 14px;border-radius:10px;display:none;z-index:30;max-width:90%}
#load{position:fixed;top:0;left:0;height:3px;width:100%;background:linear-gradient(90deg,var(--acc),#7fb3e6);display:none;z-index:40}
.empty{color:var(--mut);padding:8px 0}.chk{width:auto}
.wk{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px;margin-bottom:12px}
.day{background:#fff;border:1px solid var(--line);border-radius:10px;padding:6px;min-height:90px}.day.today{border-color:var(--acc)}.day.past{background:#fafbfc}.day.over{background:var(--acc2);border-color:var(--acc)}
.day .dh{font-size:12px;color:var(--mut);display:flex;justify-content:space-between;margin-bottom:4px}
.pc{border:1px solid var(--line);border-left:3px solid var(--acc);border-radius:8px;padding:5px 6px;margin-bottom:5px;font-size:12.5px;background:#fff;cursor:grab}
.pc.idea{border-left-color:#b9c3cf;background:#fbfcfd}.pc.done{border-left-color:var(--grn)}.pc .t{font-weight:500;margin:2px 0;word-break:break-word}
.pc .pl{font-size:11px;color:var(--acc);cursor:pointer;margin-right:4px;white-space:nowrap}.pc .ac{display:flex;gap:2px;margin-top:3px;flex-wrap:wrap}
.pc .ac button{border:1px solid var(--line);background:#fff;border-radius:6px;font-size:11px;padding:1px 6px;cursor:pointer}
.bar{display:inline-block;height:8px;border-radius:4px;background:var(--acc);vertical-align:middle}
@media(max-width:760px){.wk{grid-template-columns:1fr}.day{min-height:0}}
</style></head><body>
<div id="load"></div>
<header><div class="t">Маркетинг эксклюзивов</div><div class="me" id="me">Загрузка…</div></header>
<nav id="nav"></nav>
<main id="main"><div class="empty">Загружаю кабинет…</div></main>
<div id="modal"><div class="box" id="mbox"></div></div>
<div id="toast"></div>
<script>
var B=null, S={nm:null,nmOpen:false,drag:null,ct:'plan',cf:{platform:'',rubric:'',obj:'',status:''},pf:'',pt:'',af:'',at:'',an:null,soc:null,view:'today',tasks:null,base:null,cont:null,obj:null,objTab:'tasks',taskScope:'mine',baseObj:'',baseToday:false,q:''};
function h(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function el(id){return document.getElementById(id);}
function load(on){el('load').style.display=on?'block':'none';}
function toast(t){var x=el('toast');x.textContent=t;x.style.display='block';clearTimeout(toast._t);toast._t=setTimeout(function(){x.style.display='none';},3500);}
function api(fn,args,cb){load(true);var r=google.script.run.withSuccessHandler(function(v){load(false);cb&&cb(v);}).withFailureHandler(function(e){load(false);toast('Ошибка: '+(e&&e.message||e));});r[fn].apply(r,args||[]);}
function d(s){if(!s)return '';var p=String(s).split('-');return p.length===3?p[2]+'.'+p[1]+'.'+p[0].slice(2):s;}
function iso(dt){var z=function(n){return (n<10?'0':'')+n;};return dt.getFullYear()+'-'+z(dt.getMonth()+1)+'-'+z(dt.getDate());}
function addD(s,n){var p=s.split('-');var dt=new Date(+p[0],+p[1]-1,+p[2]);dt.setDate(dt.getDate()+n);return iso(dt);}
function num(v){return v===''||v==null?'':Number(v).toLocaleString('ru-RU');}
function money(v){return v===''||v==null?'':Number(v).toLocaleString('ru-RU')+' ₽';}
function obj(id){for(var i=0;i<B.objects.length;i++)if(String(B.objects[i].id)===String(id))return B.objects[i];return null;}
function oname(id){var o=obj(id);return o?(o.service?'Общий контент агентства':o.name):id;}
function can(code){return B.me.role!=='smm'||code==='CONT';}
function role(r){return B.me.role===r;}
function opts(list,val,empty){var s=empty?'<option value="">'+h(empty)+'</option>':'';(list||[]).forEach(function(v){v=Array.isArray(v)?v[0]:v;s+='<option'+(String(v)===String(val)?' selected':'')+'>'+h(v)+'</option>';});return s;}
function objOpts(val,filterCode){var s='';B.objects.forEach(function(o){if(filterCode&&!can(filterCode))return;s+='<option value="'+h(o.id)+'"'+(String(o.id)===String(val)?' selected':'')+'>'+h(oname(o.id))+'</option>';});return s;}
function clsOf(dict,v){var r=(B.dicts[dict]||[]).filter(function(x){return x[0]===v;})[0];return r?r[1]:(v?'':'OPEN');}

/* ───────── навигация ───────── */
function views(){var v=[['today','Сегодня'],['objects','Объекты'],['tasks','Задачи']];if(!role('smm'))v.push(['base','База']);v.push(['content','Контент']);if(role('director'))v.push(['team','Команда']);return v;}
function nav(){var s='';views().forEach(function(v){s+='<button class="'+(S.view===v[0]?'on':'')+'" onclick="go(\''+v[0]+'\')">'+v[1]+'</button>';});if(B.sheetUrl)s+='<button onclick="window.open(\''+B.sheetUrl+'\')">Таблица ↗</button>';el('nav').innerHTML=s;}
function go(v){S.view=v;S.obj=null;nav();render();window.scrollTo(0,0);}
function render(){
  if(S.obj)return renderObj();
  if(S.view==='today')return renderToday();
  if(S.view==='objects')return renderObjects();
  if(S.view==='tasks')return need('tasks',renderTasks);
  if(S.view==='base')return need('base',renderBase);
  if(S.view==='content')return need('cont',renderContent);
  if(S.view==='team')return api('webTeam',[],renderTeam);
}
function need(k,fn){if(S[k])return fn();var m={tasks:'webTasks',base:'webBase',cont:'webContent'}[k];api(m,k==='tasks'?[]:[''],function(v){S[k]=v;fn();});}
function reload(keys,cb){var left=keys.length;if(!left)return cb&&cb();keys.forEach(function(k){var m={tasks:'webTasks',base:'webBase',cont:'webContent'}[k];api(m,k==='tasks'?[]:[''],function(v){S[k]=v;if(--left===0)cb&&cb();});});}

/* ───────── Сегодня ───────── */
function renderToday(){
  var need2=['tasks'];if(!role('smm'))need2.push('base');if(role('smm')||role('director'))need2.push('cont');
  var miss=need2.filter(function(k){return !S[k];});
  if(miss.length)return reload(miss,renderToday);
  var t=B.today, my=S.tasks.filter(function(x){return x.mine&&x.cls==='OPEN';});
  var over=my.filter(function(x){return x.deadline&&x.deadline<t;}), td=my.filter(function(x){return x.deadline===t;}), wk=my.filter(function(x){return !x.deadline||x.deadline>t;});
  var h2='<h2>Добрый день, '+h(B.me.name)+'</h2><div class="mut">'+h(B.me.roleTitle)+' · сегодня '+d(t)+'</div>';
  var k='<div class="kpis" style="margin-top:12px">'+kpi('Просрочено',over.length,over.length?'red':'')+kpi('На сегодня',td.length)+kpi('Остальные мои',wk.length);
  var calls=[];
  if(S.base){calls=S.base.filter(function(r){return r.next_date&&r.next_date<=t;});k+=kpi('Звонки / контакты',calls.length,calls.length?'amb':'');}
  k+='</div>';
  var s=h2+k;
  s+=block('Просроченные задачи',over.map(taskItem).join(''),'Нет — отлично');
  s+=block('Задачи на сегодня',td.map(taskItem).join(''),'Нет задач со сроком сегодня');
  s+=block('Мои задачи дальше',wk.slice(0,30).map(taskItem).join(''),'Нет');
  if(S.base)s+=block('Звонки и повторные контакты на сегодня',calls.sort(function(a,b){return a.next_date<b.next_date?-1:1;}).map(baseItem).join(''),'Сегодня звонков нет');
  if(S.cont){var c=S.cont.filter(function(x){return x.cls!=='DONE'&&(role('director')||x.owner===B.me.name);});s+=block('Контент в работе',c.map(contItem).join(''),'Нет');}
  el('main').innerHTML=s;
}
function kpi(l,v,c){return '<div class="card kpi"><div class="mut">'+l+'</div><div class="v" style="color:'+(c==='red'?'var(--red)':c==='amb'?'var(--amb)':'inherit')+'">'+v+'</div></div>';}
function block(title,inner,empty){return '<h3>'+title+'</h3><div class="card">'+(inner||'<div class="empty">'+empty+'</div>')+'</div>';}

/* ───────── элементы списков ───────── */
function taskPill(x){if(x.cls==='DONE')return '<span class="pill grn">'+h(x.status)+'</span>';if(x.cls==='CANCEL'||x.cls==='MOVED'||x.cls==='FAIL')return '<span class="pill">'+h(x.status)+'</span>';if(x.deadline&&x.deadline<B.today)return '<span class="pill red">просрочено '+d(x.deadline)+'</span>';return '<span class="pill acc">'+(x.deadline?'до '+d(x.deadline):h(x.status||'открыта'))+'</span>';}
function taskItem(x){var done=x.cls==='DONE';return '<div class="item" onclick="editTask(\''+h(x.id)+'\')"><input type="checkbox" class="chk" '+(done?'checked ':'')+(x.can&&x.cls==='OPEN'?'':'disabled ')+'onclick="event.stopPropagation();quickDone(\''+h(x.id)+'\',this)"><div class="main"><div class="ttl">'+h(x.task)+'</div><div class="mut">'+h(oname(x.obj_id))+(x.owner?' · '+h(x.owner):'')+(x.plan?' · план '+h(x.plan)+(x.fact!==''?' / факт '+h(x.fact):x.fact_auto!==''?' / факт '+h(x.fact_auto):''):'')+(x.result?' · '+h(x.result):'')+'</div></div>'+taskPill(x)+'</div>';}
function baseItem(r){var last=r.response?('ответ: '+r.response):r.kp_date?('КП '+d(r.kp_date)):r.call_date?('звонок '+d(r.call_date)):'новая';var nx=r.next_date?('<span class="pill '+(r.next_date<=B.today?'amb':'')+'">'+d(r.next_date)+'</span>'):'';return '<div class="item" onclick="editBase(\''+h(r.id)+'\')"><div class="main"><div class="ttl">'+h(r.company)+'</div><div class="mut">'+h(oname(r.obj_id))+(r.audience?' · '+h(r.audience):'')+' · '+h(last)+(r.next_step?' · дальше: '+h(r.next_step):'')+'</div>'+(r.contact?'<div class="mut">'+h(r.contact)+'</div>':'')+'</div>'+nx+'</div>';}
function contItem(x){var p=x.cls==='DONE'?'grn':'acc';return '<div class="item" onclick="editCont(\''+h(x.id)+'\')"><div class="main"><div class="ttl">'+h(x.topic)+'</div><div class="mut">'+(x.rubric?'<span class="pill acc">'+h(x.rubric)+'</span> ':'')+(obj(x.obj_id)&&obj(x.obj_id).service?'<span class="pill">общий</span> ':'<span class="pill grn">в отчёт: '+h(oname(x.obj_id))+'</span> ')+' · '+h(x.platform)+' · '+h(x.format)+(x.owner?' · '+h(x.owner):'')+(x.views!==''?' · просмотры '+num(x.views):'')+(x.reach!==''?' · охват '+num(x.reach):'')+'</div></div><span class="pill '+p+'">'+h(x.status)+(x.pub_date?' '+d(x.pub_date):'')+'</span></div>';}

/* ───────── Объекты ───────── */
function renderObjects(){
  var q=S.q.toLowerCase();
  var list=B.objects.filter(function(o){return !q||(o.name+' '+o.address+' '+o.id).toLowerCase().indexOf(q)>=0;});
  var s='<div class="row"><h2 style="flex:1">Объекты ('+list.length+')</h2><input style="max-width:260px" placeholder="Поиск" value="'+h(S.q)+'" oninput="S.q=this.value;renderObjects();this.focus();this.setSelectionRange(this.value.length,this.value.length)"></div><div class="grid">';
  list.forEach(function(o){s+='<div class="card obj" onclick="openObj(\''+h(o.id)+'\')"><div class="n">'+h(o.name)+'</div><div class="mut">'+h([o.kind,o.deal].filter(Boolean).join(' · '))+(o.price?' · '+money(o.price):'')+'</div><div class="mut">'+h(o.address)+'</div><div class="row" style="margin-top:6px">'+(o.manager?'<span class="pill">'+h(o.manager)+'</span>':'')+(o.status?'<span class="pill '+(o.in_work==='НЕТ'?'':'acc')+'">'+h(o.status)+'</span>':'')+(o.idle_aud?'<span class="pill amb">нет базы ★★★</span>':'')+'</div></div>';});
  s+='</div>';if(!list.length)s+='<div class="empty">'+(role('agent')?'За вами пока нет объектов. Руководитель назначает вас «Ответственным» в 01_ОБЪЕКТЫ.':'Ничего не найдено')+'</div>';
  el('main').innerHTML=s;
}
function openObj(id){S.obj={id:id,data:null,ad:undefined};S.objTab='tasks';var miss=['tasks','cont'];if(!role('smm'))miss.push('base');reload(miss.filter(function(k){return !S[k];}),function(){api('webObject',[id],function(v){S.obj.data=v;renderObj();});});renderObj();}
function renderObj(){
  var o=obj(S.obj.id);if(!o){S.obj=null;return render();}
  var s='<button class="b2" onclick="S.obj=null;render()">← Назад</button><h2>'+h(o.name)+'</h2><div class="mut">'+h(o.address)+'</div>';
  s+='<div class="row" style="margin:8px 0">'+[o.kind,o.deal,o.area?o.area+' м²':'',o.price?money(o.price):''].filter(Boolean).map(function(x){return '<span class="pill">'+h(x)+'</span>';}).join('')+'</div>';
  s+='<div class="mut">Ответственный: '+h(o.manager||'—')+' · Ассистент: '+h(o.assistant||'—')+' · SMM: '+h(o.smm||'—')+'</div>';
  s+='<div class="row" style="margin:10px 0">'+(o.folder_link?'<a class="lnk" target="_blank" href="'+h(o.folder_link)+'">Папка объекта ↗</a>':'')+(o.last_report_link?' · <a class="lnk" target="_blank" href="'+h(o.last_report_link)+'">Последний отчёт ↗</a>':'')+(role('director')&&o.tab_url&&B.sheetUrl?' · <a class="lnk" target="_blank" href="'+h(B.sheetUrl+o.tab_url)+'">Вкладка в таблице ↗</a>':'')+(o.crm_link?' · <a class="lnk" target="_blank" href="'+h(o.crm_link)+'">CRM ↗</a>':'')+'</div>';
  var tabs=[['tasks','Задачи']];if(!role('smm'))tabs.push(['base','База']);tabs.push(['cont','Контент'],['strat','Стратегия'],['ad','Реклама'],['rep','Отчёты']);
  s+='<div class="tabs">'+tabs.map(function(t){return '<button class="'+(S.objTab===t[0]?'on':'')+'" onclick="S.objTab=\''+t[0]+'\';renderObj()">'+t[1]+'</button>';}).join('')+'</div>';
  var id=String(o.id), T=S.objTab;
  if(T==='tasks'){var ts=(S.tasks||[]).filter(function(x){return String(x.obj_id)===id;});s+=(can('TASK')?'<button class="b" onclick="newTask(\''+h(id)+'\')">+ Задача</button>':'')+'<div class="card" style="margin-top:8px">'+(ts.map(taskItem).join('')||'<div class="empty">Задач нет</div>')+'</div>';}
  if(T==='base'){var bs=(S.base||[]).filter(function(x){return String(x.obj_id)===id;});s+='<button class="b" onclick="newBase(\''+h(id)+'\')">+ Компания / контакт</button><div class="mut" style="margin-top:6px">Всего: '+bs.length+' · КП: '+bs.filter(function(r){return r.kp_date;}).length+' · интерес: '+bs.filter(function(r){return r.resp_cls==='YES';}).length+'</div><div class="card" style="margin-top:8px">'+(bs.map(baseItem).join('')||'<div class="empty">База пуста</div>')+'</div>';}
  if(T==='cont'){var cs=(S.cont||[]).filter(function(x){return String(x.obj_id)===id;});s+='<button class="b" onclick="newCont(\''+h(id)+'\')">+ Публикация</button><div class="card" style="margin-top:8px">'+(cs.map(contItem).join('')||'<div class="empty">Контента нет</div>')+'</div>';}
  if(T==='strat'){var D=S.obj.data;if(!D)s+='<div class="empty">Загружаю…</div>';else{var st=D.strategy,kv=st.kv;s+='<div class="card"><h3 style="margin-top:0">Цена и позиционирование</h3>'+line('Рекомендуемая цена',money(kv.rec_price))+line('Минимальная для торга',money(kv.min_price))+line('Медиана по аналогам, ₽/м²',money(kv.median))+line('Наша цена за м²',money(kv.our_m2))+line('Позиционирование',kv.positioning)+line('Вывод по цене',kv.price_note)+(kv.analysis_link?line('Анализ','<a class="lnk" target="_blank" href="'+h(kv.analysis_link)+'">открыть ↗</a>',1):'')+'</div>';
    s+=tbl('Целевые аудитории',['Аудитория','Кто','Портрет','Где искать','Приоритет'],st.aud)+tbl('Сценарии',['Сценарий','Чек-лист','Что проверить','Консультанты','Вывод','Статус'],st.scen)+tbl('КП и материалы',['Материал','Какое','Для кого','Ссылка','Готовность','Комментарий'],st.kp)+tbl('Каналы и партнёры',['Канал','Что делаем','Ответственный','Статус','Результат'],st.chan)+tbl('Выводы и решения',['Дата','Вывод / решение','Кто','Что дальше'],st.dec);}}
  if(T==='ad'){if(S.obj.ad===undefined){S.obj.ad=null;api('webAd',[id],function(v){S.obj.ad=v||false;renderObj();});s+='<div class="empty">Загружаю отчёт по рекламе…</div>';}else if(!S.obj.ad)s+='<div class="empty">'+(S.obj.ad===null?'Загружаю…':'Нет ссылки на отчёт по рекламе CRM (01_ОБЪЕКТЫ).')+'</div>';else{var a=S.obj.ad;s+='<div class="kpis">'+kpi('Просмотры',a.views)+kpi('В избранном',a.fav)+kpi('Обращения',a.appeals)+kpi('Показы',a.shows)+(a.spend!=null?kpi('Расходы, ₽',Number(a.spend).toLocaleString('ru-RU')):'')+'</div><div class="card"><div class="mut">В рекламе с '+d(a.since)+' · площадок: '+a.sites.length+'</div><div style="margin-top:6px">'+h(a.sites.join(', '))+'</div>'+(a.cian?'<div style="margin-top:8px"><a class="lnk" target="_blank" href="'+h(a.cian)+'">Объявление на ЦИАН ↗</a></div>':'')+'</div>';}}
  if(T==='rep'){var D2=S.obj.data;s+='<div class="card">'+(!D2?'<div class="empty">Загружаю…</div>':(D2.reports.map(function(r){return '<div class="item" onclick="window.open(\''+h(r.link)+'\')"><div class="main"><div class="ttl">Отчёт № '+h(r.no)+' · '+h(r.period||r.week)+'</div><div class="mut">'+h(r.status)+'</div></div><span class="pill acc">открыть ↗</span></div>';}).join('')||'<div class="empty">Отчётов пока нет</div>'))+'</div>';}
  el('main').innerHTML=s;
}
function line(l,v,raw){return v===''||v==null?'':'<div class="row" style="padding:4px 0;border-top:1px solid var(--line)"><div class="mut" style="width:190px">'+h(l)+'</div><div style="flex:1">'+(raw?v:h(v))+'</div></div>';}
function tbl(t,cols,rows){if(!rows||!rows.length)return '';var s='<div class="card"><h3 style="margin-top:0">'+h(t)+'</h3><div style="overflow-x:auto"><table><tr>'+cols.map(function(c){return '<th>'+h(c)+'</th>';}).join('')+'</tr>';rows.forEach(function(r){s+='<tr>'+cols.map(function(c,i){var v=r[i];v=/^\d{4}-\d\d-\d\d$/.test(v)?d(v):v;return '<td>'+(/^https?:\/\//.test(v)?'<a class="lnk" target="_blank" href="'+h(v)+'">ссылка ↗</a>':h(v))+'</td>';}).join('')+'</tr>';});return s+'</table></div></div>';}

/* ───────── Задачи ───────── */
function renderTasks(){
  var list=S.tasks.filter(function(x){return S.taskScope==='mine'?x.mine:true;});
  var open=list.filter(function(x){return x.cls==='OPEN';}), closed=list.filter(function(x){return x.cls!=='OPEN';});
  var s='<div class="row"><h2 style="flex:1">Задачи</h2>'+(role('smm')?'':'<select style="max-width:200px" onchange="S.taskScope=this.value;renderTasks()"><option value="mine"'+(S.taskScope==='mine'?' selected':'')+'>Мои</option><option value="all"'+(S.taskScope==='all'?' selected':'')+'>Все по моим объектам</option></select>')+(can('TASK')?'<button class="b" onclick="newTask(\'\')">+ Задача</button>':'')+'</div>';
  var groups={};open.forEach(function(x){(groups[x.obj_id]=groups[x.obj_id]||[]).push(x);});
  Object.keys(groups).forEach(function(k){s+='<h3>'+h(oname(k))+'</h3><div class="card">'+groups[k].sort(function(a,b){return (a.deadline||'9')<(b.deadline||'9')?-1:1;}).map(taskItem).join('')+'</div>';});
  if(!open.length)s+='<div class="card empty">Открытых задач нет</div>';
  if(closed.length)s+=block('Закрытые за эту и прошлую неделю',closed.map(taskItem).join(''),'');
  el('main').innerHTML=s;
}
function findIn(k,id){return (S[k]||[]).filter(function(x){return String(x.id)===String(id);})[0];}
function quickDone(id,cb){var done=(B.dicts.task_status.filter(function(r){return r[1]==='DONE';})[0]||['Выполнено'])[0];api('webUpdate',['TASK',id,{status:done}],function(){toast('Готово: задача выполнена');reload(['tasks'],render);});}
function editTask(id){var x=findIn('tasks',id);if(!x)return;var ro=!x.can;
  form('Задача · '+oname(x.obj_id),[
    {k:'task',l:'Задача',t:role('director')?'textarea':'ro',v:x.task},
    {k:'status',l:'Статус',t:'select',o:B.dicts.task_status,v:x.status},
    {k:'deadline',l:'Срок',t:'date',v:x.deadline},
    {k:'result',l:'Результат / комментарий (видит собственник в отчёте)',t:'textarea',v:x.result},
    {k:'fact',l:'Факт (если план в штуках; звонки и КП считаются сами)',t:'number',v:x.fact},
    role('director')?{k:'owner',l:'Исполнитель',t:'select',o:B.dicts.people,v:x.owner}:null
  ],ro?null:function(v){api('webUpdate',['TASK',id,v],function(){toast('Сохранено'+(clsOf('task_status',v.status)==='MOVED'?' · задача перенесена на следующую неделю':''));closeM();reload(['tasks'],render);});},x);}
function newTask(objId){form('Новая задача',[
    {k:'obj_id',l:'Объект',t:'obj',v:objId||(S.obj&&S.obj.id)||''},
    {k:'task',l:'Задача',t:'textarea'},{k:'block',l:'Блок',t:'select',o:B.dicts.task_blocks},
    {k:'owner',l:'Исполнитель',t:'select',o:B.dicts.people,v:B.me.name},{k:'deadline',l:'Срок',t:'date'},
    {k:'plan',l:'План (число, необязательно)',t:'number'},{k:'unit',l:'Единица',t:'select',o:B.dicts.units,e:'—'}
  ],function(v){api('webCreate',['TASK',v],function(r){toast('Задача создана '+(r.id||''));closeM();reload(['tasks'],render);});});}

/* ───────── База ───────── */
function renderBase(){
  var q=S.q.toLowerCase(), list=S.base.filter(function(r){return (!S.baseObj||String(r.obj_id)===S.baseObj)&&(!S.baseToday||(r.next_date&&r.next_date<=B.today))&&(!q||(r.company+' '+r.contact+' '+r.audience).toLowerCase().indexOf(q)>=0);});
  var s='<div class="row"><h2 style="flex:1">База обзвона и КП ('+list.length+')</h2><button class="b" onclick="newBase(S.baseObj)">+ Компания</button></div><div class="row" style="margin-bottom:8px"><select style="max-width:260px" onchange="S.baseObj=this.value;renderBase()"><option value="">Все мои объекты</option>'+objOpts(S.baseObj,'BASE')+'</select><label class="row mut"><input type="checkbox" class="chk" '+(S.baseToday?'checked':'')+' onchange="S.baseToday=this.checked;renderBase()"> только на сегодня</label><input style="max-width:220px" placeholder="Поиск" value="'+h(S.q)+'" oninput="S.q=this.value;renderBase();this.focus();this.setSelectionRange(this.value.length,this.value.length)"></div>';
  s+='<div class="card">'+(list.sort(function(a,b){return (a.next_date||'9')<(b.next_date||'9')?-1:1;}).map(baseItem).join('')||'<div class="empty">Нет записей</div>')+'</div>';
  el('main').innerHTML=s;
}
function editBase(id){var r=findIn('base',id);if(!r)return;
  form(r.company+' · '+oname(r.obj_id),[
    {t:'info',v:[r.audience,r.contact,r.site,r.fit_note].filter(Boolean).join(' · ')+(r.call_date?'<br>Звонок '+d(r.call_date)+(r.call_result?': '+h(r.call_result):''):'')+(r.kp_date?'<br>КП '+d(r.kp_date)+' ('+h(r.kp_type)+')':'')+(r.response?'<br>Ответ: '+h(r.response)+' '+d(r.response_date):'')},
    {k:'_call',l:'Позвонил(а) сегодня',t:'check'},{k:'call_result',l:'Итог звонка',t:'textarea',v:''},
    {k:'_kp',l:'Отправил(а) КП сегодня',t:'check'},{k:'kp_type',l:'Какое КП',t:'select',o:B.dicts.kp_types,v:r.kp_type||''},
    {k:'response',l:'Ответ',t:'select',o:B.dicts.responses,v:r.response,e:'—'},
    {k:'next_step',l:'Следующий шаг',t:'text',v:r.next_step},{k:'next_date',l:'Когда',t:'date',v:r.next_date},
    {k:'contact',l:'Контакт (ЛПР, телефон, email)',t:'text',v:r.contact},{k:'to_crm',l:'Передан в CRM (интерес — заведён в CRM)',t:'check',v:r.to_crm===true}
  ],function(v){var c={};if(v._call){c.call_date=B.today;c.call_result=v.call_result;}else if(v.call_result)c.call_result=v.call_result;if(v._kp){c.kp_date=B.today;c.kp_type=v.kp_type;}
    ['response','next_step','next_date','contact','to_crm'].forEach(function(k){c[k]=v[k];});
    api('webUpdate',['BASE',id,c],function(){toast('Сохранено');closeM();reload(['base'],render);});});}
function newBase(objId){form('Новая компания / контакт',[
    {k:'obj_id',l:'Объект',t:'obj',v:objId||(S.obj&&S.obj.id)||'',code:'BASE'},{k:'audience',l:'Аудитория (как во вкладке объекта)',t:'text'},
    {k:'company',l:'Компания',t:'text'},{k:'site',l:'Сайт',t:'text'},{k:'contact',l:'Контакт (ЛПР, должность, телефон, email)',t:'text'},
    {k:'fit_note',l:'Почему подходит',t:'textarea'},{k:'next_step',l:'Следующий шаг',t:'text',v:'Позвонить ЛПР'},{k:'next_date',l:'Когда',t:'date',v:B.today}
  ],function(v){api('webCreate',['BASE',v],function(){toast('Компания добавлена');closeM();reload(['base'],render);});});}

/* ───────── Контент (SMM) ───────── */
function smm(){return role('smm')||role('director');}
function renderContent(){
  var tabs=[['plan','Контент-план'],['pub','Опубликовано']];if(smm())tabs.push(['an','Аналитика'],['soc','Соцсети']);
  var s='<div class="row"><h2 style="flex:1">Контент</h2><button class="b" onclick="newCont(\'\')">+ Публикация</button></div><div class="tabs">'+tabs.map(function(t){return '<button class="'+(S.ct===t[0]?'on':'')+'" onclick="S.ct=\''+t[0]+'\';renderContent()">'+t[1]+'</button>';}).join('')+'</div>';
  if(S.ct==='plan')s+=contPlan();
  if(S.ct==='pub')s+=contPub();
  if(S.ct==='an')s+=contAn();
  if(S.ct==='soc')s+=contSoc();
  el('main').innerHTML=s;
}
function contFilter(list){var f=S.cf;return list.filter(function(x){return (!f.platform||x.platform===f.platform)&&(!f.rubric||x.rubric===f.rubric)&&(!f.obj||String(x.obj_id)===f.obj)&&(!f.status||x.status===f.status);});}
function filtersBar(){var f=S.cf;function sel(k,list,label){return '<select style="max-width:190px" onchange="S.cf.'+k+'=this.value;renderContent()">'+opts(list,f[k],label)+'</select>';}
  return '<div class="row" style="margin-bottom:8px">'+sel('platform',B.dicts.platforms,'Все площадки')+sel('rubric',B.dicts.content_rubrics,'Все рубрики')+'<select style="max-width:220px" onchange="S.cf.obj=this.value;renderContent()"><option value="">Все объекты и общий</option>'+B.objects.map(function(o){return '<option value="'+h(o.id)+'"'+(String(o.id)===f.obj?' selected':'')+'>'+h(oname(o.id))+'</option>';}).join('')+'</select>'+sel('status',B.dicts.content_status,'Все статусы')+'</div>';}
function periodBar(a,b,def1,def2,extra){if(!S[a]){S[a]=addD(B.today,def1);S[b]=addD(B.today,def2);}return '<div class="row" style="margin-bottom:8px"><input type="date" style="max-width:160px" value="'+S[a]+'" onchange="S.'+a+'=this.value"> — <input type="date" style="max-width:160px" value="'+S[b]+'" onchange="S.'+b+'=this.value">'+(extra||'')+'</div>';}
function monOf(ds){var p=ds.split('-');var dt=new Date(+p[0],+p[1]-1,+p[2]);dt.setDate(dt.getDate()-((dt.getDay()+6)%7));return iso(dt);}
function planDefault(){S.pf=monOf(B.today);S.pt=addD(S.pf,20);S.nm=null;}
function planShift(n){S.pf=addD(monOf(S.pf),7*n);S.pt=addD(S.pf,20);S.nm=null;renderContent();}
function funShort(f){if(!f)return '';var x=String(f).toLowerCase();return x.indexOf('охват')>=0?'охват':x.indexOf('прогрев')>=0?'прогрев':x.indexOf('продаж')>=0?'продажа':f;}
function planGroups(list){var g={},order=[];list.forEach(function(x){var k=[String(x.topic).toLowerCase(),x.obj_id,x.pub_date||''].join('|');if(!g[k]){g[k]={k:k,items:[],date:x.pub_date||''};order.push(k);}g[k].items.push(x);});return order.map(function(k){return g[k];});}
function planCard(gr){var x=gr.items[0],ids=gr.items.map(function(i){return i.id;}).join(',');
  var done=gr.items.every(function(i){return i.cls==='DONE';}),idea=x.status==='Идея';
  var s='<div class="pc'+(done?' done':idea?' idea':'')+'" draggable="true" ondragstart="S.drag=\''+h(ids)+'\'" title="Перетащите на другой день">';
  s+='<div>'+(x.rubric?'<span class="pill acc">'+h(x.rubric)+'</span> ':'')+(x.funnel?'<span class="pill">'+h(funShort(x.funnel))+'</span> ':'')+(obj(x.obj_id)&&!obj(x.obj_id).service?'<span class="pill grn">'+h(oname(x.obj_id))+'</span>':'')+'</div>';
  s+='<div class="t" onclick="editCont(\''+h(x.id)+'\')" style="cursor:pointer">'+h(x.topic)+'</div>';
  if(x.hook)s+='<div class="mut">Крючок: '+h(x.hook)+'</div>';
  s+='<div>'+gr.items.map(function(i){return '<span class="pl" onclick="editCont(\''+h(i.id)+'\')">'+h(i.platform||'—')+(i.cls==='DONE'?' ✓':'')+'</span>';}).join('')+'</div><div class="mut">'+h(x.status)+(x.format?' · '+h(x.format):'')+'</div>';
  s+='<div class="ac">'+(gr.date?'<button title="На день раньше" onclick="mv(\''+h(ids)+'\',\''+addD(gr.date,-1)+'\')">‹</button><button title="На день позже" onclick="mv(\''+h(ids)+'\',\''+addD(gr.date,1)+'\')">›</button><button title="На неделю позже" onclick="mv(\''+h(ids)+'\',\''+addD(gr.date,7)+'\')">+7 дн</button>':'')+'<button title="Дублировать на другие площадки" onclick="xpost(\''+h(x.id)+'\')">⧉</button></div>';
  return s+'</div>';}
function mv(ids,date){api('webMoveContent',[ids.split(','),date],function(){toast('Перенесено на '+d(date));S.nm=null;S.an=null;reload(['cont'],render);});}
function dropOn(e,date){e.preventDefault();e.currentTarget.classList.remove('over');if(S.drag){var ids=S.drag;S.drag=null;mv(ids,date);}}
function xpost(id){var x=findIn('cont',id);if(!x)return;var have=S.cont.filter(function(i){return i.topic===x.topic&&String(i.obj_id)===String(x.obj_id)&&i.pub_date===x.pub_date;}).map(function(i){return i.platform;});
  var rest=B.dicts.platforms.filter(function(p){return have.indexOf(p)<0;});
  form('Дублировать «'+x.topic+'»',[{t:'info',v:'Уже есть: '+h(have.join(', '))+'. Копия получит ту же тему, рубрику, дату, сценарий и тексты — статистика по каждой площадке считается отдельно.'},{k:'platforms',l:'На какие площадки',t:'multi',o:rest,v:crossDef().filter(function(p){return rest.indexOf(p)>=0;})}],
    function(v){if(!v.platforms.length)return toast('Отметьте площадки');api('webCrosspost',[id,v.platforms],function(r){toast('Добавлено: '+r.ids.length);closeM();S.nm=null;reload(['cont'],render);});});}
function crossDef(){return ['Telegram','Instagram','ВКонтакте','YouTube'].filter(function(p){return B.dicts.platforms.indexOf(p)>=0;});}
function planFill(){if(!confirm('Поставить заготовки тем по рубрикам, которых не хватает до нормы, на '+d(S.pf)+' – '+d(S.pt)+'? Прошедшие дни не трогаются, заготовки потом можно двигать и править.'))return;
  api('webPlanFill',[S.pf,S.pt],function(r){toast(r.made?'Добавлено заготовок: '+r.made:'Все нормы рубрик уже закрыты');S.nm=null;reload(['cont'],render);});}
function normsCard(){var N=S.nm;if(!N||N.from!==S.pf||N.to!==S.pt){api('webSmmNorms',[S.pf,S.pt],function(v){S.nm=v;renderContent();});return '<div class="card mut">Считаю нормы рубрик…</div>';}
  var open=S.nmOpen;var miss=N.rubrics.filter(function(x){return x.gap>0;});
  var s='<div class="card"><div class="row" style="cursor:pointer" onclick="S.nmOpen=!S.nmOpen;renderContent()"><b style="flex:1">Нормы рубрик и воронка · '+N.topics+' тем</b>'+(miss.length?'<span class="pill red">ниже нормы: '+miss.length+'</span>':'<span class="pill grn">нормы выполнены</span>')+' <span class="mut">'+(open?'свернуть ▲':'подробнее ▼')+'</span></div>';
  s+='<div class="row" style="margin-top:6px">'+N.funnel.map(function(f){var c=!N.staged?'':Math.abs(f.diff)>=10?'amb':'grn';return '<span class="pill '+c+'">'+h(f.name)+': '+(N.staged?f.pct+'%':'—')+' / цель '+f.target+'%</span>';}).join(' ')+'</div>';
  if(open){s+='<table style="margin-top:8px"><tr><th>Рубрика</th><th>Частота</th><th>План</th><th>Норма</th><th></th></tr>';
    N.rubrics.filter(function(x){return x.need||x.fact;}).forEach(function(x){s+='<tr style="cursor:pointer" onclick="S.cf.rubric=\''+h(x.name)+'\';renderContent()"><td>'+h(x.name)+'<div class="mut">'+h(x.about)+'</div></td><td class="mut">'+h(x.freq)+'</td><td>'+x.fact+'</td><td>'+(x.need||'—')+'</td><td>'+(x.gap?'<span class="pill red">−'+x.gap+'</span>':'<span class="pill grn">✓</span>')+'</td></tr>';});
    s+='</table>';N.tips.forEach(function(t){s+='<div class="mut">• '+h(t)+'</div>';});}
  return s+'</div>';}
function contPlan(){
  if(!S.pf||S.pf.length!==10)planDefault();
  var s='<div class="row" style="margin-bottom:8px"><button class="b2" onclick="planShift(-1)">◀ неделя</button><input type="date" style="max-width:150px" value="'+S.pf+'" onchange="S.pf=this.value;S.nm=null;renderContent()"> — <input type="date" style="max-width:150px" value="'+S.pt+'" onchange="S.pt=this.value;S.nm=null;renderContent()"><button class="b2" onclick="planShift(1)">неделя ▶</button><button class="b2" onclick="planDefault();renderContent()">Сейчас + 2 недели</button>'+(smm()?'<button class="b" onclick="planFill()">Заполнить по нормам</button><button class="b2" onclick="planDoc()">Выгрузить план</button>':'')+'</div>'+filtersBar();
  if(smm())s+=normsCard();
  var list=contFilter(S.cont).filter(function(x){return x.cls!=='CANCEL';});
  var inP=list.filter(function(x){return x.pub_date&&x.pub_date>=S.pf&&x.pub_date<=S.pt;});
  var groups=planGroups(inP),byDay={};groups.forEach(function(g){(byDay[g.date]=byDay[g.date]||[]).push(g);});
  var DN=['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
  for(var w=monOf(S.pf);w<=S.pt;w=addD(w,7)){
    var cnt=0;for(var i=0;i<7;i++)cnt+=(byDay[addD(w,i)]||[]).length;
    s+='<h3>'+h(weekOf(w))+(w===monOf(B.today)?' · текущая':'')+' <span class="mut">('+cnt+' тем)</span></h3><div class="wk">';
    for(var j=0;j<7;j++){var ds=addD(w,j);var gs=byDay[ds]||[];
      s+='<div class="day'+(ds===B.today?' today':ds<B.today?' past':'')+'" ondragover="event.preventDefault();this.classList.add(\'over\')" ondragleave="this.classList.remove(\'over\')" ondrop="dropOn(event,\''+ds+'\')"><div class="dh"><span>'+DN[j]+' '+d(ds).slice(0,5)+'</span><a class="lnk" style="cursor:pointer" title="Добавить на этот день" onclick="newCont(\'\',\''+ds+'\')">+</a></div>'+gs.map(planCard).join('')+'</div>';}
    s+='</div>';}
  var bank=planGroups(list.filter(function(x){return !x.pub_date&&x.cls!=='DONE';}));
  s+='<h3>Банк идей без даты <span class="mut">('+bank.length+') — перетащите на день или укажите дату</span></h3><div class="card">'+(bank.length?'<div class="grid">'+bank.map(planCard).join('')+'</div>':'<div class="empty">Пусто. Идеи без даты попадают сюда.</div>')+'</div>';
  return s;
}
function weekOf(ds){var p=ds.split('-');var dt=new Date(+p[0],+p[1]-1,+p[2]);var wd=(dt.getDay()+6)%7;dt.setDate(dt.getDate()-wd);var e=new Date(dt);e.setDate(e.getDate()+6);return 'Неделя '+d(iso(dt))+' – '+d(iso(e));}
function contPub(){
  var list=contFilter(S.cont).filter(function(x){return x.cls==='DONE';}).sort(function(a,b){return (b.pub_date||'')<(a.pub_date||'')?-1:1;});
  var s=filtersBar()+'<div class="card" style="overflow-x:auto"><table><tr><th>Дата</th><th>Площадка</th><th>Рубрика</th><th>Тема</th><th>Просмотры</th><th>Охват</th><th>Лайки</th><th>Сохр.</th><th>Заявки</th></tr>';
  list.slice(0,200).forEach(function(x){s+='<tr style="cursor:pointer" onclick="editCont(\''+h(x.id)+'\')"><td>'+d(x.pub_date)+'</td><td>'+h(x.platform)+'</td><td>'+h(x.rubric)+'</td><td>'+h(x.topic)+(x.link?' <a class="lnk" target="_blank" onclick="event.stopPropagation()" href="'+h(x.link)+'">↗</a>':'')+'</td><td>'+num(x.views)+'</td><td>'+num(x.reach)+'</td><td>'+num(x.likes)+'</td><td>'+num(x.saves)+'</td><td>'+num(x.leads)+'</td></tr>';});
  return s+'</table>'+(list.length?'':'<div class="empty">Опубликованного пока нет</div>')+'</div>';
}
function contAn(){
  var s=periodBar('af','at',-29,0,' <button class="b2" onclick="S.af=addD(B.today,-6);S.at=B.today;loadAn()">7 дней</button> <button class="b2" onclick="S.af=addD(B.today,-29);S.at=B.today;loadAn()">30 дней</button> <button class="b2" onclick="S.af=addD(B.today,-89);S.at=B.today;loadAn()">Квартал</button> <button class="b" onclick="loadAn()">Показать</button> <button class="b2" onclick="smmDoc()">Выгрузить отчёт</button>');
  var A=S.an;if(!A){setTimeout(loadAn,0);return s+'<div class="empty">Считаю аналитику…</div>';}
  var t=A.totals;
  s+='<div class="mut">Период '+d(A.from)+' – '+d(A.to)+'</div><div class="kpis" style="margin-top:8px">'+kpi('Публикаций',t.posts)+kpi('Просмотры',num(t.views))+kpi('Охват',num(t.reach))+kpi('Вовлечённость',t.er===null?'—':t.er+'%')+kpi('Заявки',num(t.leads))+kpi('Подписки с публ.',num(t.followers_gained))+'</div>';
  if(A.insights.length)s+='<div class="card"><h3 style="margin-top:0">Выводы</h3>'+A.insights.map(function(x){return '<div style="padding:3px 0">• '+h(x)+'</div>';}).join('')+'</div>';
  s+=tbl('Подписчики и аккаунты',['Площадка','Аккаунт','Было','Стало','Рост','Отписки','Охват','Просмотры','Переходы','Заявки'],A.followers.map(function(x){return [x.platform,x.account,num(x.start),num(x.end),x.growth===null?'—':(x.growth>=0?'+':'')+num(x.growth),num(x.unfollows),num(x.reach),num(x.views),num(x.visits),num(x.leads)];}));
  var g=function(title,list){return tbl(title,['','Публ.','Охват ср.','Просм. ср.','Охват','Просмотры','ER, %','Заявки'],list.map(function(x){return [x.name,x.posts,num(x.avgReach),num(x.avgViews),num(x.reach),num(x.views),x.er===null?'—':x.er,num(x.leads)];}));};
  s+=g('Рубрики — что приносит охваты',A.byRubric)+g('Площадки',A.byPlatform)+g('Форматы',A.byFormat)+g('Этапы воронки — что даёт охват',A.byFunnel||[])+g('Объекты и общий контент',A.byObject);
  s+=tbl('Топ-10 публикаций',['Дата','Тема','Площадка','Рубрика','Просмотры','Охват','Ссылка'],A.top.map(function(x){return [x.date,x.topic,x.platform,x.rubric,num(x.views),num(x.reach),x.link];}));
  return s;
}
function loadAn(){api('webSmmAnalytics',[S.af,S.at],function(v){S.an=v;renderContent();});}
function smmDoc(){api('webSmmReport',[S.af,S.at],function(r){links('Отчёт SMM готов',r);});}
function planDoc(){api('webContentPlanDoc',[S.pf,S.pt],function(r){links('Контент-план выгружен',r);});}
function links(t,r){form(t,[{t:'info',v:'<a class="lnk" target="_blank" href="'+h(r.url)+'">Открыть Google Документ ↗</a><br><br><a class="lnk" target="_blank" href="'+h(r.word)+'">Скачать в Word ↗</a><br><br><span class="mut">Файл сохранён в папке «05_СММ» системы (или в вашем Google Диске).</span>'}],null);}
function contSoc(){
  if(!S.soc){api('webSocial',[],function(v){S.soc=v;renderContent();});return '<div class="empty">Загружаю…</div>';}
  var s='<div class="row"><div class="mut" style="flex:1">Раз в неделю внесите цифры по каждой площадке (из статистики аккаунта) — по ним считаются рост подписчиков и охваты.</div><button class="b" onclick="socForm()">+ Внести неделю</button></div>';
  var rows=S.soc.slice().sort(function(a,b){return a.week<b.week?1:a.week>b.week?-1:(a.platform<b.platform?-1:1);});
  s+='<div class="card" style="overflow-x:auto;margin-top:8px"><table><tr><th>Неделя</th><th>Площадка</th><th>Аккаунт</th><th>Подписчики</th><th>Отписки</th><th>Охват</th><th>Просмотры</th><th>Пересылки</th><th>Переходы</th><th>Заявки</th><th>Комментарий</th></tr>';
  rows.forEach(function(r){var pv=rows.filter(function(x){return x.platform===r.platform&&x.week<r.week&&x.followers!=='';})[0];var dl=pv&&r.followers!==''?Number(r.followers)-Number(pv.followers):null;
    s+='<tr style="cursor:pointer" onclick="socForm(\''+h(r.week)+'\',\''+h(r.platform)+'\')"><td>'+h(r.week)+'</td><td>'+h(r.platform)+'</td><td>'+h(r.account)+'</td><td>'+num(r.followers)+(dl===null?'':' <span class="pill '+(dl>=0?'grn':'red')+'">'+(dl>=0?'+':'')+num(dl)+'</span>')+'</td><td>'+num(r.unfollows)+'</td><td>'+num(r.reach)+'</td><td>'+num(r.views)+'</td><td>'+num(r.shares)+'</td><td>'+num(r.profile_visits)+'</td><td>'+num(r.leads)+'</td><td class="mut">'+h(r.note)+'</td></tr>';});
  return s+'</table>'+(rows.length?'':'<div class="empty">Пока нет данных</div>')+'</div>';
}
function socForm(wk,pl){var r=(S.soc||[]).filter(function(x){return x.week===wk&&x.platform===pl;})[0]||{week:wk||B.week,platform:pl||''};
  var prev=(S.soc||[]).filter(function(x){return x.platform===r.platform&&x.account;}).pop();
  form('Статистика аккаунта за неделю',[{k:'week',l:'Неделя (ГГГГ-Wнн)',t:'text',v:r.week},{k:'platform',l:'Площадка',t:'select',o:B.dicts.platforms,v:r.platform},{k:'account',l:'Аккаунт / канал',t:'text',v:r.account||(prev?prev.account:'')},
    {k:'followers',l:'Подписчики (на конец недели) — прирост к прошлой неделе посчитается сам',t:'number',v:r.followers},{k:'unfollows',l:'Отписки за неделю',t:'number',v:r.unfollows},{k:'shares',l:'Пересылки / репосты за неделю',t:'number',v:r.shares},{k:'reach',l:'Охват за неделю',t:'number',v:r.reach},{k:'views',l:'Просмотры за неделю',t:'number',v:r.views},
    {k:'profile_visits',l:'Переходы в профиль',t:'number',v:r.profile_visits},{k:'leads',l:'Заявки из соцсети',t:'number',v:r.leads},{k:'note',l:'Комментарий',t:'textarea',v:r.note}],
    function(v){api('webSocialSave',[v],function(){toast('Сохранено');closeM();S.soc=null;S.an=null;renderContent();});});}
function rubInfo(n){return (B.rubrics||[]).filter(function(r){return r.name===n;})[0];}
function contFields(x){x=x||{};var nw=!x.id;var ri=rubInfo(x.rubric);return [
  {k:'obj_id',l:'Объект — привязка: публикация попадёт в отчёт собственнику и в карточку объекта. «Общий контент агентства» — только в отчёт SMM и руководителю',t:'obj',v:x.obj_id||agencyId(),code:'CONT'},
  {k:'rubric',l:'Рубрика'+(ri?' · '+ri.freq+' — '+ri.about:''),t:'select',o:B.dicts.content_rubrics,v:x.rubric,e:'—'},
  {k:'funnel',l:'Этап воронки (пусто — возьмётся из рубрики)',t:'select',o:B.dicts.content_funnel,v:x.funnel,e:'—'},
  {k:'topic',l:'Тема',t:'text',v:x.topic},{k:'hook',l:'Крючок / заголовок (первая фраза, первые 3 секунды видео)',t:'text',v:x.hook},
  nw?{k:'platforms',l:'Площадки (одна тема — несколько площадок)',t:'multi',o:B.dicts.platforms,v:crossDef()}:{k:'platform',l:'Площадка',t:'select',o:B.dicts.platforms,v:x.platform},
  {k:'format',l:'Формат',t:'select',o:B.dicts.content_formats,v:x.format},{k:'goal',l:'Цель',t:'select',o:B.dicts.content_goals,v:x.goal,e:'—'},
  {k:'status',l:'Статус',t:'select',o:B.dicts.content_status,v:x.status||''},{k:'pub_date',l:'Дата публикации (пусто — в банк идей)',t:'date',v:x.pub_date},
  {k:'owner',l:'Кто делает',t:'select',o:B.dicts.people,v:x.owner||B.me.name},{k:'script',l:'Сценарий / текст (или ссылка)',t:'textarea',v:x.script},
  {k:'cta',l:'Призыв к действию (CTA)',t:'text',v:x.cta},{k:'brief',l:'ТЗ на съёмку (фон, локация, ракурс)',t:'textarea',v:x.brief},
  nw?null:{k:'link',l:'Ссылка на публикацию',t:'text',v:x.link},
  nw?null:{k:'views',l:'Просмотры',t:'number',v:x.views},nw?null:{k:'reach',l:'Охват',t:'number',v:x.reach},nw?null:{k:'likes',l:'Лайки',t:'number',v:x.likes},
  nw?null:{k:'comments',l:'Комментарии',t:'number',v:x.comments},nw?null:{k:'saves',l:'Сохранения',t:'number',v:x.saves},nw?null:{k:'shares',l:'Репосты',t:'number',v:x.shares},
  nw?null:{k:'followers_gained',l:'Подписки с публикации',t:'number',v:x.followers_gained},nw?null:{k:'leads',l:'Заявки',t:'number',v:x.leads}];}
function agencyId(){var a=B.objects.filter(function(o){return o.service;})[0];return a?a.id:'';}
function funDef(v){if(!v.funnel&&v.rubric){var r=rubInfo(v.rubric);if(r&&r.funnel)v.funnel=r.funnel;}return v;}
function editCont(id){var x=findIn('cont',id);if(!x)return;form('Публикация · '+oname(x.obj_id),contFields(x),function(v){if(String(v.obj_id)===String(x.obj_id))delete v.obj_id;funDef(v);api('webUpdate',['CONT',id,v],function(){toast('Сохранено');closeM();S.an=null;S.nm=null;reload(['cont'],render);});});}
function newCont(objId,date){form('Новая публикация',contFields({obj_id:objId||(S.obj&&S.obj.id)||'',pub_date:date||''}),function(v){funDef(v);if(!v.platforms||!v.platforms.length)return toast('Отметьте хотя бы одну площадку');api('webCreateContent',[v],function(r){toast('Добавлено публикаций: '+r.ids.length);closeM();S.an=null;S.nm=null;reload(['cont'],render);});});}

/* ───────── Команда (директор) ───────── */
function renderTeam(T){
  var s='<h2>Команда · неделя '+h(T.week)+'</h2><div class="card" style="overflow-x:auto"><table><tr><th>Сотрудник</th><th>Роль</th><th>Неделя: сделано / всего</th><th>Открыто</th><th>Просрочено</th></tr>';
  T.team.forEach(function(p){s+='<tr><td>'+h(p.name)+'</td><td class="mut">'+h(p.role)+'</td><td>'+p.doneWeek+' / '+p.week+'</td><td>'+p.open+'</td><td style="color:'+(p.overdue?'var(--red)':'inherit')+'">'+p.overdue+'</td></tr>';});
  s+='</table></div><h2>Объекты · неделя</h2><div class="card" style="overflow-x:auto"><table><tr><th>Объект</th><th>Ответственный</th><th>Задачи</th><th>Звонки</th><th>КП</th><th>База</th><th>Интерес</th><th>Отчёт</th></tr>';
  T.objects.forEach(function(o){s+='<tr style="cursor:pointer" onclick="openObj(\''+h(o.id)+'\')"><td>'+h(o.name)+'</td><td class="mut">'+h(o.manager)+'</td><td>'+o.doneWeek+' / '+o.tasksWeek+'</td><td>'+o.callsWeek+'</td><td>'+o.kpWeek+'</td><td>'+o.baseTotal+'</td><td>'+o.interested+'</td><td class="mut">'+d(o.lastReport)+'</td></tr>';});
  s+='</table></div>';
  if(T.smm){var m=T.smm;s+='<h2>SMM · неделя</h2><div class="kpis">'+kpi('Публикаций',m.posts)+kpi('По объектам',m.linked)+kpi('Общий контент',m.general)+kpi('Просмотры',num(m.views))+kpi('Охват',num(m.reach))+kpi('Заявки',num(m.leads))+'</div>'+(m.followers||m.insights.length?'<div class="card">'+(m.followers?'<div>Рост подписчиков: '+h(m.followers)+'</div>':'')+m.insights.map(function(x){return '<div class="mut">• '+h(x)+'</div>';}).join('')+'</div>':'');}
  el('main').innerHTML=s;
}

/* ───────── формы ───────── */
var M=null;
function form(title,fields,onSave,rec){
  fields=fields.filter(Boolean);M={fields:fields,onSave:onSave};
  var s='<div class="row"><h3 style="flex:1;margin:0">'+h(title)+'</h3><button class="b2" onclick="closeM()">✕</button></div>';
  fields.forEach(function(f,i){var id='f'+i,v=f.v==null?'':f.v;
    if(f.t==='hide')return;
    if(f.t==='info'){s+='<div class="mut" style="margin-top:8px">'+v+'</div>';return;}
    if(f.t==='multi'){s+='<label class="f">'+h(f.l)+'</label><div class="row">'+(f.o||[]).map(function(o,j){return '<label class="row" style="gap:4px;margin-right:8px"><input type="checkbox" class="chk" id="'+id+'_'+j+'" value="'+h(o)+'"'+((f.v||[]).indexOf(o)>=0?' checked':'')+'> '+h(o)+'</label>';}).join('')+'</div>';return;}
    if(f.t==='check'){s+='<label class="row" style="margin-top:10px"><input type="checkbox" class="chk" id="'+id+'" '+(v?'checked':'')+(onSave?'':' disabled')+'> '+h(f.l)+'</label>';return;}
    s+='<label class="f">'+h(f.l)+'</label>';
    if(f.t==='ro'){s+='<div>'+h(v)+'</div>';return;}
    var dis=onSave?'':' disabled';
    if(f.t==='select')s+='<select id="'+id+'"'+dis+'>'+opts(f.o,v,f.e||(v?'':'—'))+'</select>';
    else if(f.t==='obj')s+='<select id="'+id+'"'+dis+'>'+objOpts(v,f.code)+'</select>';
    else if(f.t==='textarea')s+='<textarea id="'+id+'"'+dis+'>'+h(v)+'</textarea>';
    else s+='<input id="'+id+'" type="'+(f.t==='number'?'number':f.t==='date'?'date':'text')+'" value="'+h(v)+'"'+dis+'>';
  });
  s+='<div class="row" style="margin-top:14px">'+(onSave?'<button class="b" onclick="saveM()">Сохранить</button>':'<span class="mut">Только просмотр</span>')+'<button class="b2" onclick="closeM()">Отмена</button></div>';
  el('mbox').innerHTML=s;el('modal').style.display='flex';
}
function saveM(){var v={};M.fields.forEach(function(f,i){if(!f.k||f.t==='ro'||f.t==='info')return;if(f.t==='multi'){v[f.k]=(f.o||[]).filter(function(o,j){var c=el('f'+i+'_'+j);return c&&c.checked;});return;}var x=el('f'+i);if(!x)return;v[f.k]=f.t==='check'?x.checked:x.value;});M.onSave(v);}
function closeM(){el('modal').style.display='none';M=null;}
el('modal').addEventListener('click',function(e){if(e.target===el('modal'))closeM();});

/* ───────── старт ───────── */
api('webBootstrap',[],function(b){B=b;el('me').textContent=b.me.name+' · '+b.me.roleTitle;nav();render();});
</script></body></html>`;
