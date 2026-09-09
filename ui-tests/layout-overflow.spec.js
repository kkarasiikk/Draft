// Сторінка не має їхати вбік. Горизонтальна прокрутка на телефоні — це не
// «дрібниця в оформленні»: вона зсуває шапку, ховає праву кромку карток і
// робить свайп по календарю схожим на промах. Найвужчий екран тут — 320px
// (iPhone SE першого покоління й розділений екран на Android); саме на ньому
// плитки головної колись розпирали сторінку на 31 піксель.
const { test, expect } = require('@playwright/test');
const { openModule } = require('./helpers');
test.describe.configure({ timeout: 180000 });
const PAGES = [['index.html','#homeScreen'],['budget/index.html','#appScreen'],
  ['goals/index.html','#appScreen'],['tasks/index.html','#appScreen'],['workout/index.html','#appScreen']];
const VPS = [['малий телефон',320,568],['телефон',390,844],['планшет',768,1024],
  ['ноутбук',1366,700],['монітор',1920,1080]];
const T = new Date().toISOString().slice(0,10);
const SEED = {
  profile:{currency:'UAH',categoriesExpense:[{id:'food',label:'Продукти дуже довга назва категорії',colorIndex:0}]},
  transactions:[{id:'x',type:'expense',amount:1234567.89,category:'food',currency:'UAH',date:T,note:'Дуже довга нотатка яка може розпирати рядок'}],
  tasks:[{id:'t',title:'Надзвичайно довга назва завдання що не має розсунути сторінку',done:false,dueDate:T,completedAt:null}],
  goals:[{id:'g',title:'Дуже довга назва цілі для перевірки переносу',category:'health',status:'active',horizon:'month',month:T.slice(0,7),createdAt:{__ts:T}}],
  workouts:[{id:'w',date:T,name:'Тренування з дуже довгою назвою',notes:'',exercises:[{id:'b',libId:'benchPress',name:'Жим лежачи',muscle:'chest',sets:[{weight:60,reps:8}]}]}],
};
for (const [path, ready] of PAGES) {
  test(`сторінка не їде вбік: ${path}`, async ({ page }) => {
    await openModule(page, path, { seed: SEED, ready });
    const bad = [];
    for (const [name,w,h] of VPS) {
      await page.setViewportSize({width:w,height:h});
      await page.waitForTimeout(350);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (over > 1) bad.push(`${name} ${w}x${h}: +${over}px`);
    }
    expect(bad, path).toEqual([]);
  });
}
