// front end test of CoCalc in puppeteer
// usage: node index.js

// to do:
// - command line options for test creds, non-headless operation
// - run in more environments
// - add test for jupyter widgets
// - wrap in jest
// - write in typescript
// - host on gce
// - deal gracefully with test project that stopped/archived

// what it does:
// - sign into instance with email and password
// - open test project
// - open test .tex file
// - check that word count button in upper left frame works
// - logs each step that passes to js console

// works with:
// - cocalc.com
// - test.cocalc.com
// - docker containers
//   - UW regular cocalc†
//   - UW no-agpl cocalc†
//   - pixelbook cocalc†
//   - pixelbook no-agpl cocalc†
// † - TO DO

const HEADLESS = true;

const puppeteer = require('puppeteer');
const CREDS = require('./creds');
const sprintf = require('sprintf-js').sprintf;

async function run() {
try {
  const browser = await puppeteer.launch({
    headless: HEADLESS,
  });

  //const context = await browser.createIncognitoBrowserContext();
  //const page = await context.newPage();
  const page = (await browser.pages())[0];
  // await page.setViewport({ width: 1024, height: 768});

  // sign in
  await page.goto(CREDS.url);
  console.log('01 got sign-in page')

  // get selectors manually by doing Inspect while viewing page in chrome
  const USERNAME_SELECTOR = '#smc-react-container > div > div:nth-child(4) > div > div > div.hidden-xs.row > div:nth-child(1) > form > div > div:nth-child(1) > div.col-xs-5 > div > input'
  const PASSWORD_SELECTOR = '#smc-react-container > div > div:nth-child(4) > div > div > div.hidden-xs.row > div:nth-child(1) > form > div > div:nth-child(1) > div.col-xs-4 > div > input'
  const BUTTON_SELECTOR = '#smc-react-container > div > div:nth-child(4) > div > div > div.hidden-xs.row > div:nth-child(1) > form > div > div:nth-child(1) > div.col-xs-3 > button'

  await page.click(USERNAME_SELECTOR);
  await page.keyboard.type(CREDS.username);

  await page.click(PASSWORD_SELECTOR);
  await page.keyboard.type(CREDS.password);

  await page.click(BUTTON_SELECTOR);
  await page.waitForNavigation({'waitUntil':'networkidle0'});
  console.log('02 signed in')

  // selector for project search
  // input[placeholder="Search for projects..."]
  sfpPh="Search for projects...";
  sfpSel = sprintf('input[placeholder=\"%s\"]', sfpPh);

  // pass function defi/nition as string to page.waitForFunction
  // x will be this:
  // document.querySelector('input[placeholder="Search for projects..."]').placeholder == "Search for projects..."
  const sfpx = sprintf("document.querySelector(\'%s\').placeholder == \"%s\"", sfpSel, sfpPh);
  await page.waitForFunction(sfpx);
  console.log('03 got search for projects input element')
  
  // type into the project search blank
  await page.type(sfpSel, CREDS.project);
  
  // find the project link and click it
  const lh1 = await page.$x(`//a/span/p[text()='${CREDS.project}']`);

  console.log('04 number of links matching test project name',lh1.length)
  if (lh1.length > 0) {
    await lh1[0].click();
  } else {
    throw new Error("Link not found");
  }
  await page.waitForNavigation({'waitUntil':'networkidle0'});

  // find texfile link and click it
  sfilePh="Search or create file";
  sfileSel = sprintf('input[placeholder=\"%s\"]', sfilePh);

  const sfilex = sprintf("document.querySelector(\'%s\').placeholder == \"%s\"", sfileSel, sfilePh);
  await page.waitForFunction(sfilex);
  console.log('05 got file search input element')

  // type into the file search blank
  await page.type(sfileSel, CREDS.texfile);
  await page.waitForFunction(sfilex);

  // find and click the texfile link
  const lh2 = await page.$x(`//a/span[text()='${CREDS.texfile.slice(0,-4)}']`);
  console.log('06 number of links matching test texfile name',lh2.length)
  if (lh2.length > 0) {
    await Promise.all([
      lh2[0].click(),
      page.waitForNavigation({'waitUntil':'networkidle0'})
    ]);
    await page.waitFor(1 * 1000);
  } else {
    throw new Error("Link not found");
  }
  
  //page.waitForNavigation({'waitUntil':'networkidle0'})
  await page.click("#types");
  console.log('07 clicked types menu');
  //await page.waitForNavigation({'waitUntil':'networkidle0'});
  
    const lh4 = await page.$x('//div[1]/div/ul/li[6]/a');
    console.log('08 number of links matching word count',lh4.length);
    if (lh4.length > 0) {
      await lh4[0].click();
      console.log('09 word count clicked');
    } else {
      throw new Error("Link not found");
    }

  
    //console.log('wait 1')
    //await page.waitFor(1 * 1000);
    fn5 = 'document.evaluate(\'//div[contains(text(), "Words in text")]\', document, null, XPathResult.STRING_TYPE, null).stringValue'
    t = await page.waitForFunction(fn5)
  
    //Object.keys(t).forEach(ok => console.log('ok', ok))
    console.log('10 WORD COUNT FRAME:\n'+ t._remoteObject.value)

  
  //await page.waitFor(3 * 1000);
  const spath = 'screenshots/cocalc.png';
  await page.screenshot({ path: spath});
  console.log(`98 screenshot saved to ${spath}`);
  
  console.log('99 all tests ok - closing browser')
  browser.close()

} catch (e) {
  console.log('98 ERROR',e.message);
  process.exit()
}
}

run();
