const puppeteer = require('puppeteer');
const path = require('path');
const scriptName = path.basename(__filename);

function usage() {
  console.log('usage: node %s [銀行名] [振込金額]', scriptName)
  process.exit();
}

const argv = process.argv.slice(2);
if (argv.length < 2) {
  console.log('ERROR: 銀行名と振込金額を指定してください')
  usage();
}
const bankName = argv[0];
const transferAmount = argv[1];

if (!/^\d+$/.test(transferAmount)) {
  console.log('ERROR: 振込金額は整数で入力してください')
  usage();
}

let config = require(__dirname + '/../config/config.json');
{
  const configName = path.basename(scriptName, '.js');
  if (!config[configName]) {
    console.log('ERROR: config[' + configName + '] not found');
    usage();
  }
  config = config[configName];
}

let launchOptions = {
  headless: true,
  slowMo : 200,
  args: ['--ignore-certificate-errors'],
};
// For Raspbian
if (process.arch === 'arm') {
  launchOptions.executablePath = '/usr/bin/chromium-browser';
}

(async () => {
  const browser = await puppeteer.launch(launchOptions);
  let page = await browser.newPage();

  //page.on('console', msg => console.log('PAGE LOG:', msg.text()));

  try {
    await page.goto('https://next.bank-daiwa.co.jp/web/loginPage.do');

    //await page.evaluate(() => console.log(`url is ${location.href}`));

    // ログインページ
    const loginUseridSelector = 'input[name="txtKykuID"]';
    const loginPasswordSelector = 'input[name="txtLoginPw"]';
    const loginButtonSelector = 'input[name="BtnLogin"]';

    await page.waitForSelector(loginUseridSelector);
    await page.waitForSelector(loginPasswordSelector),
    await page.waitForSelector(loginButtonSelector)

    await page.type(loginUseridSelector, config['userid']);
    await page.type(loginPasswordSelector, config['password']);

    await Promise.all([
      page.waitForNavigation({waitUntil: "domcontentloaded"}),
      page.click(loginButtonSelector)
    ]);

        // 「パスワード変更のお願い」ページ
    if (await page.$('input[name="throughFlg"]') !== null) {
      await Promise.all([
        page.waitForNavigation({waitUntil: "domcontentloaded"}),
        page.click('input[value="変更しない"]')
      ]);
    }

    let balance;

    // トップページ
    {
      const balanceSelector = '//th[text()="円普通預金残高"]/following-sibling::td[1]';
      const tds = await page.$x(balanceSelector);
      if (tds.length == 0) {
        throw new Error ('"円普通預金残高" not found');
      }
      balance = await page.evaluate(td => td.textContent, tds[0]);
      if (!/^[0-9,]+円$/.test(balance)) {
        throw new Error ('"円普通預金残高" might be illegal format: ' + balance);
      }
      balance = parseInt(balance.replace(/[,円]/, ''), 10);
      //console.log(balance);

      if (balance <= transferAmount) {
        throw new Error('預金残高が不足しています');
      }

      let anchors = await page.$x('//a[contains(., "振込")]')
      if (anchors.length == 0) {
        throw new Error ("Link not found");
      }
      await Promise.all([
        page.waitForNavigation({waitUntil: "domcontentloaded"}),
        anchors[0].click()
      ]);
    }

    // 振込ページ
    {
      const anchors = await page.$x('//a[contains(.,"すべてを表示")]');
      if (anchors.length > 0) {
        anchors[0].click();
      }
      const furikomiButtonSelector = '//tr/td[4][contains(.,"'+bankName+'")]/following-sibling::td[2]//input[@type="button"][@value="振込"]';
      const buttons = await page.$x(furikomiButtonSelector);
      if (buttons.length <= 0) {
        throw new Error('"振込" link not found for "'+bankName+'"');
      }
      await Promise.all([
        page.waitForNavigation({waitUntil: "domcontentloaded"}),
        buttons[0].click()
      ]);
    }

    // 「振込内容の入力」ページ
    {
      const textboxSelector = 'input[name="txtFkomiKin"]';
      const submitButtonSelector = 'input[name="BtnKakunin"]';
      await page.waitForSelector(textboxSelector);
      await page.waitForSelector(submitButtonSelector);
      await page.type(textboxSelector, transferAmount);

      await Promise.all([
        page.waitForNavigation({waitUntil: "domcontentloaded"}),
        page.click(submitButtonSelector)
      ]);
    }

    // 「入力内容の確認」ページ
    {
      const submitButtonSelector = 'input[name="BtnJikko"]';
      await page.waitForSelector(submitButtonSelector);
      for (i = 0; i < 4; i++) {
        const name = 'txtTorihikiPw'+(i+1);
        const textboxSelector = 'input[name="'+name+'"]';
        await page.waitForSelector(textboxSelector);
        await page.type(textboxSelector, config['torihikipw'].substr(i,1));
      }

      await Promise.all([
        page.waitForNavigation({waitUntil: "domcontentloaded"}),
        page.click(submitButtonSelector)
      ]);
    }
    
    // 「お手続き完了」ページ

  } catch (err) {
    console.log(err);
  } finally {
    await page.screenshot({path: 'screenshot.png'});
    await browser.close();
  }
})();
