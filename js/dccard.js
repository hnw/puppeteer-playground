const puppeteer = require('puppeteer');
const path = require('path');

let config = require(__dirname + '/../config/config.json');
{
  const scriptname = path.basename(__filename, '.js');
  if (!config[scriptname]) {
    console.log('config[' + scriptname + '] not found');
    process.exit();
  }
  config = config[scriptname];
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

  try {
    await page.goto('https://www2.cr.mufg.jp/newsplus/?cardBrand=0012&lid=news_dc');

    // ログインページ
    {
      const loginUseridSelector = 'input[name="webId"]';
      const loginPasswordSelector = 'input[name="webPassword"]';
      const loginButtonSelector = 'input[name="submit1"]';

      await page.waitForSelector(loginUseridSelector, {visible: true});
      await page.waitForSelector(loginPasswordSelector, {visible: true});
      await page.waitForSelector(loginButtonSelector, {visible: true});

      await page.type(loginUseridSelector, config['userid']);
      await page.type(loginPasswordSelector, config['password']);

      await page.click(loginButtonSelector)
    }

    // 「追加確認項目」サブウインドウ
    {
      const loginBirthDaySelector = 'input[name="webBirthDay"]';
      const loginPhoneNumSelector = 'input[name="webPhoneNum"]';
      const subWindowLoginButtonSelector = 'input[name="submit"]';
      let subWindowInputSelector, subWindowInputText;

      if (config['birthday']) {
        subWindowInputSelector = loginBirthDaySelector;
        subWindowInputText = config['birthday'];
      } else if (config['phonenum']) {
        subWindowInputSelector = loginPhoneNumSelector;
        subWindowInputText = config['phonenum'];
      } else {
        throw new Error("Neithor birthday nor phonenum is specified.")
      }

      // サブウインドウ出現待ち
      await page.waitForSelector(subWindowInputSelector, {visible: true});

      await page.type(subWindowInputSelector, subWindowInputText);
      await Promise.all([
        // ページ遷移待ち
        page.waitForNavigation({waitUntil: "domcontentloaded"}),
        page.click(subWindowLoginButtonSelector)
      ]);
    }

    // newsplusトップ
    {
      const anchors = await page.$x('//a[@href != "" and contains(., "利用明細照会")]');

      [page] = await Promise.all([
        // 新ウインドウ遷移（target=_blank）待ち
        new Promise(resolve => browser.once('targetcreated', target => resolve(target.page()))),
        anchors[0].click()
      ]);
      // frame出現待ち
      await page.waitForSelector('frame', {visible: true});
    }

    // DC Web サービスメニュートップ
    {
      const frame = await page.frames().find(f => f.name() === 'MenuFrame');
      const anchors = await frame.$x('//a/img[@alt = "リボお支払方法変更"]/parent::*');
      await Promise.all([
        // ページ遷移待ち
        page.waitForNavigation({waitUntil: "domcontentloaded"}),
        anchors[0].click()
      ]);
    }

    {
      // リボお支払方法変更ページ（カード選択）
      const frame = await page.frames().find(f => f.name() === 'MainFrame');

      {
        const radioButtonSelector = 'input[name="Sel_Card"]';
        const submitImageSelector = 'input[type="image"][alt="カード選択"]';

        await frame.waitForSelector(radioButtonSelector, {visible: true});
        await frame.click(radioButtonSelector);
        await frame.click(submitImageSelector);
      }

      {
        // リボお支払方法変更ページ（変更内容入力）
        const selectBoxSelector = 'select[name="Sel_Pay"]';
        const radioButtonSelector = 'input[name="Sel_TmpIktu"][value="2"]';
        const submitImageSelector = 'input[type="image"][alt="確認"]';

        await frame.waitForSelector(selectBoxSelector, {visible: true});
        await frame.click(radioButtonSelector);
        await frame.click(submitImageSelector);
      }

      {
        // リボお支払方法変更ページ（内容確認）
        const submitImageSelector = 'input[type="image"][alt="確定"]';

        await frame.waitForSelector(submitImageSelector, {visible: true});
        await page.screenshot({path: 'confirm.png'});
        await frame.click(submitImageSelector);
      }
    }
    // 完了
  } catch (err) {
    console.log(err);
  } finally {
    await page.screenshot({path: 'error.png'});
    await browser.close();
  }
})();
