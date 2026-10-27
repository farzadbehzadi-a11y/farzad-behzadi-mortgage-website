const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = process.env.SITE_URL || 'http://127.0.0.1:8765';
const fixtures = { googleReviewsUrl: 'https://www.google.com/maps', reviews: Array.from({length:5},(_,i)=>({author:`Test reviewer ${i+1}`,quote:`Test fixture ${i+1}. Clear communication throughout the mortgage process.`,rating:5,source:'Google',url:'https://www.google.com/maps'})) };
(async()=>{
 const browser = await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE ? {executablePath:process.env.BROWSER_EXECUTABLE} : {})});
 try {
  const page = await browser.newPage({viewport:{width:1440,height:1000}});
  await page.route('https://unpkg.com/@elevenlabs/**',r=>r.abort());
  await page.route('**/reviews.json',r=>r.fulfill({json:fixtures}));
  await page.goto(root,{waitUntil:'networkidle'});
  const carousel=page.getByRole('region',{name:'In our clients’ words.'});
  assert.equal(await carousel.count(),1,'Testimonial carousel is present');
  assert.equal(await carousel.isVisible(),true);
  const track=page.locator('.testimonials-track');
  assert.equal(await track.locator('.testimonial-card').count(),5);
  const prev=page.getByRole('button',{name:'Previous reviews'}), next=page.getByRole('button',{name:'Next reviews'});
  assert.equal(await prev.isDisabled(),true);
  await next.click();
  await page.waitForFunction(()=>document.querySelector('.testimonials-track').scrollLeft>100);
  assert.equal(await prev.isEnabled(),true);
  await track.focus(); await page.keyboard.press('End');
  await page.waitForFunction(()=>document.querySelector('[data-reviews-next]').disabled);
  assert.equal(await next.isDisabled(),true);
  await page.keyboard.press('Home');
  await page.waitForFunction(()=>document.querySelector('[data-reviews-prev]').disabled);
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'No mobile page overflow');
  assert.equal(await track.evaluate(x=>x.scrollWidth>x.clientWidth),true,'Cards can be swiped');
  await page.emulateMedia({reducedMotion:'reduce'});
  await next.click();
  await page.waitForFunction(()=>document.querySelector('.testimonials-track').scrollLeft>100);
  await page.addScriptTag({path:require.resolve(process.env.AXE_MODULE || 'axe-core/axe.min.js')});
  const scan = await page.evaluate(async()=>await axe.run(document.querySelector('#testimonials'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}));
  assert.equal(scan.violations.length,0,JSON.stringify(scan.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.failureSummary)}))));
  console.log('PASS: carousel accessibility scan');
  console.log('PASS: carousel controls, bounds, Home/End, mobile swipe layout, reduced motion');
  await page.unroute('**/reviews.json');
  await page.route('**/reviews.json',r=>r.fulfill({json:{reviews:[]}}));
  await page.reload({waitUntil:'networkidle'});
  assert.equal(await page.locator('[data-reviews-preview]').isVisible(),true,'Local placeholders labeled');
  assert.equal(await page.locator('.testimonial-rating:visible').count(),0,'No invented ratings');
  const prod=await browser.newPage();
  await prod.route('**/*',async r=>{
   const url=new URL(r.request().url());
   if(url.hostname==='preview.test'){
    if(url.pathname==='/reviews.json') return r.fulfill({json:{reviews:[]}});
    const response=await fetch(root+url.pathname);
    await r.fulfill({status:response.status,body:Buffer.from(await response.arrayBuffer()),contentType:response.headers.get('content-type')||'text/plain'});
   } else await r.abort();
  });
  await prod.goto('http://preview.test/',{waitUntil:'networkidle'});
  assert.equal(await prod.locator('#testimonials').isVisible(),false,'Empty reviews hidden outside localhost');
  console.log('PASS: local-only placeholders; no fake ratings; unconfigured production carousel hidden');
 } finally { await browser.close(); }
})();
