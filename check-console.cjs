const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => {
        console.log(`[${msg.type().toUpperCase()}] ${msg.text()}`);
  });
  
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
  
  // Click on a few things to trigger renders
  try {
    const buttons = await page.$$('button');
    if (buttons.length > 0) {
      for(let i=0; i<Math.min(3, buttons.length); i++){
         await buttons[i].click();
         await new Promise(r => setTimeout(r, 500));
      }
    }
  } catch(e) {}
  
  await new Promise(r => setTimeout(r, 1000));
  await browser.close();
})();
