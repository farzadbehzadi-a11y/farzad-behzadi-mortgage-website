const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = process.env.SITE_URL || 'http://127.0.0.1:8765';
const launch = {headless:true,...(process.env.BROWSER_EXECUTABLE ? {executablePath:process.env.BROWSER_EXECUTABLE} : {})};
const theme = page => page.evaluate(()=>document.documentElement.dataset.theme);
async function scan(page){
 await page.addScriptTag({path:require.resolve(process.env.AXE_MODULE || 'axe-core/axe.min.js')});
 return page.evaluate(async()=>(await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target.join(' '))})));
}
(async()=>{
 const browser = await chromium.launch(launch);
 try {
  const noJs = await browser.newPage({javaScriptEnabled:false});
  await noJs.goto(root,{waitUntil:'load'});
  assert.equal(await noJs.evaluate(()=>document.documentElement.getAttribute('data-theme')),'dark','Dark without JavaScript');
  assert.equal(await noJs.locator('[data-theme-toggle]').isVisible(),false,'Toggle hidden when it cannot work');
  console.log('PASS: dark default and hidden toggle without JavaScript');

  const context = await browser.newContext({viewport:{width:1440,height:1000}});
  const page = await context.newPage();
  await page.route('https://unpkg.com/@elevenlabs/**',r=>r.abort());
  await page.goto(root,{waitUntil:'networkidle'});
  assert.equal(await theme(page),'dark','Dark by default');
  assert.equal(await page.locator('meta[name="theme-color"]').getAttribute('content'),'#101d27');
  const darkScan = await scan(page);
  assert.equal(darkScan.length,0,JSON.stringify(darkScan));

  const toggle = page.getByRole('button',{name:'Switch to light theme'});
  await toggle.click();
  assert.equal(await theme(page),'light');
  assert.equal(await page.locator('meta[name="theme-color"]').getAttribute('content'),'#132c3f');
  assert.equal(await page.locator('.hero .button-primary').evaluate(b=>getComputedStyle(b).backgroundColor),'rgb(19, 44, 63)','Colours change at once, without a lagging fade');
  assert.equal(await page.getByRole('button',{name:'Switch to dark theme'}).count(),1,'Label describes the next action');
  const lightScan = await scan(page);
  assert.equal(lightScan.length,0,JSON.stringify(lightScan));
  console.log('PASS: toggle, theme-color, instant swap, accessibility scan in both themes');

  await page.reload({waitUntil:'networkidle'});
  assert.equal(await theme(page),'light','Choice persists across reloads');
  await page.goto(root+'/privacy.html',{waitUntil:'networkidle'});
  assert.equal(await theme(page),'light','Choice carries to the privacy page');
  await page.getByRole('button',{name:'Switch to dark theme'}).click();
  await page.goto(root,{waitUntil:'networkidle'});
  assert.equal(await theme(page),'dark');
  console.log('PASS: persistence across reloads and pages');

  for (const path of ['/','/privacy.html']) {
   await page.setViewportSize({width:375,height:812});
   await page.goto(root+path,{waitUntil:'networkidle'});
   const bar = await page.locator('.nav-bar').boundingBox();
   assert.ok(bar.height <= 80,`Header stays on one row at 375px on ${path}`);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`No overflow on ${path}`);
  }
  console.log('PASS: mobile header layout');
 } finally { await browser.close(); }
})().catch(err=>{ console.error(err); process.exit(1); });
