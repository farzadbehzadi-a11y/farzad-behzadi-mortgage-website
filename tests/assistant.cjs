const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = process.env.SITE_URL || 'http://127.0.0.1:8765';
// Stands in for the ElevenLabs IIFE build so the panel can be driven without a network or microphone.
const fakeSdk = `window.ElevenLabsClient={Conversation:{async startSession(o){
 window.__session=o;
 if(!o.textOnly&&window.__denyMic){const e=new Error('Permission denied');e.name='NotAllowedError';throw e;}
 const c={muted:null,sent:[],setMicMuted(m){this.muted=m},sendUserMessage(t){this.sent.push(t);setTimeout(()=>o.onMessage({source:'ai',message:'[warmly] Happy to help.'}),50)},sendUserActivity(){},getInputVolume(){return .2},getOutputVolume(){return .4},async endSession(){o.onDisconnect({reason:'user'})}};
 window.__conv=c;setTimeout(()=>{o.onConnect({conversationId:'test'});o.onMessage({source:'ai',message:'[warmly] Hello from the test agent.'})},20);return c;}}};`;
(async()=>{
 const browser = await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE ? {executablePath:process.env.BROWSER_EXECUTABLE} : {})});
 try {
  const page = await browser.newPage({viewport:{width:1440,height:1000}});
  let sdkRequests=0;
  await page.route('https://unpkg.com/@elevenlabs/client@*/dist/lib.iife.js',r=>{sdkRequests++;r.fulfill({contentType:'text/javascript',body:fakeSdk});});
  await page.goto(root,{waitUntil:'networkidle'});
  assert.equal(sdkRequests,0,'SDK is not loaded until the panel opens');
  assert.equal(await page.locator('elevenlabs-convai').count(),0,'Default embed widget removed');

  const launcher=page.getByRole('button',{name:'Ask a question'});
  await launcher.click();
  const panel=page.getByRole('dialog',{name:'Farzad’s assistant'});
  assert.equal(await panel.isVisible(),true);
  assert.equal(await launcher.getAttribute('aria-expanded'),'true');
  await page.waitForFunction(()=>!!window.ElevenLabsClient);
  assert.equal(sdkRequests,1);
  await page.keyboard.press('Escape');
  assert.equal(await panel.isVisible(),false,'Escape closes the panel');
  assert.equal(await page.evaluate(()=>document.activeElement.matches('[data-assistant-launcher]')),true,'Focus returns to launcher');
  console.log('PASS: lazy SDK load, open/close, Escape, focus return');

  await launcher.click();
  await page.getByRole('button',{name:'Send a message'}).click();
  await page.locator('.assistant-message.is-agent').first().waitFor();
  assert.equal(await page.evaluate(()=>window.__session.textOnly),true);
  assert.deepEqual(await page.evaluate(()=>window.__session.overrides),{agent:{language:'en'}});
  assert.equal(await page.locator('.assistant-message.is-agent p').first().textContent(),'Hello from the test agent.','Audio tags stripped');
  await page.getByRole('textbox',{name:'Message'}).fill('Can I renew early?');
  await page.getByRole('button',{name:'Send message'}).click();
  await page.waitForFunction(()=>document.querySelectorAll('.assistant-message.is-agent').length===2);
  assert.equal(await page.locator('.assistant-message.is-user').count(),1);
  await page.evaluate(()=>window.__session.onMessage({source:'user',message:'Can I renew early?'}));
  assert.equal(await page.locator('.assistant-message.is-user').count(),1,'Server echo of a typed message is not duplicated');
  await page.addScriptTag({path:require.resolve(process.env.AXE_MODULE || 'axe-core/axe.min.js')});
  const scan=await page.evaluate(async()=>await axe.run(document.querySelector('[data-assistant]'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}));
  assert.equal(scan.violations.length,0,JSON.stringify(scan.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.failureSummary)}))));
  await page.getByRole('button',{name:'End',exact:true}).click();
  assert.equal(await page.getByText('Conversation ended.').isVisible(),true);
  console.log('PASS: text conversation, echo de-duplication, end session, accessibility scan');

  await page.getByRole('button',{name:'Start a new conversation'}).click();
  await page.locator('input[name="assistant-language"][value="fa"]').check({force:true});
  await page.getByRole('button',{name:'Start a voice call'}).click();
  await page.locator('[data-assistant-voice]:not([hidden])').waitFor();
  assert.equal(await page.evaluate(()=>window.__session.textOnly),false);
  assert.deepEqual(await page.evaluate(()=>window.__session.overrides),{agent:{language:'fa'}});
  const mute=page.getByRole('button',{name:'Mute microphone'});
  await mute.click();
  assert.equal(await page.evaluate(()=>window.__conv.muted),true);
  assert.equal(await page.getByRole('button',{name:'Unmute microphone'}).getAttribute('aria-pressed'),'true');
  await page.evaluate(()=>window.__session.onModeChange({mode:'speaking'}));
  assert.equal(await page.locator('[data-assistant-status]').textContent(),'Speaking');
  await page.getByRole('button',{name:'End',exact:true}).click();
  console.log('PASS: voice call, Persian override, mute toggle, speaking status');

  await page.evaluate(()=>{window.__denyMic=true;});
  await page.getByRole('button',{name:'Start a new conversation'}).click();
  await page.getByRole('button',{name:'Start a voice call'}).click();
  await page.getByText('Microphone access is blocked').waitFor();
  assert.equal(await page.getByRole('button',{name:'Send a message'}).isVisible(),true,'Text fallback offered');
  console.log('PASS: blocked microphone falls back to messaging');

  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'No mobile page overflow');
  console.log('PASS: mobile layout');
 } finally { await browser.close(); }
})().catch(err=>{ console.error(err); process.exit(1); });
