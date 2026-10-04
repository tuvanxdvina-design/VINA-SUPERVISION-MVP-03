const assert = require('node:assert/strict');
const { BASE, uiTest, openPage, newPage } = require('../helpers');

async function setAccount(page, username) {
  const response = await page.request.post(BASE + '/api/auth/login', { data: { username, password: 'demo' } });
  assert.equal(response.status(), 200, 'không đăng nhập được ' + username);
  const data = await response.json();
  await page.evaluate(auth => localStorage.setItem('vina_supervision_auth', JSON.stringify(auth)), {
    token: data.token, user: data.user, loggedAt: new Date().toISOString()
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#sessionIdentity strong', { state: 'visible' });
  return data;
}

module.exports = function register() {
  uiTest('GD-20 hai tab dùng chung hồ sơ: đổi tài khoản buộc tab cũ tải lại', async page => {
    await setAccount(page, 'thanhb');
    assert.match(await page.locator('#sessionIdentity').innerText(), /thanhb/i);
    await openPage(page, 'projects');

    const tab2 = await page.context().newPage();
    await tab2.goto('/', { waitUntil: 'domcontentloaded' });
    await tab2.waitForSelector('#sessionIdentity strong', { state: 'visible' });
    assert.match(await tab2.locator('#sessionIdentity').innerText(), /thanhb/i);

    const hung = await tab2.request.post(BASE + '/api/auth/login', { data: { username: 'hung', password: 'demo' } });
    assert.equal(hung.status(), 200);
    const auth = await hung.json();
    await tab2.evaluate(data => localStorage.setItem('vina_supervision_auth', JSON.stringify({ token: data.token, user: data.user })), auth);

    await page.waitForFunction(() => /hung/i.test(document.getElementById('sessionIdentity')?.innerText || ''), null, { timeout: 15000 });
    assert.match(await page.locator('#sessionIdentity').innerText(), /Trưởng TVGS/i);
    assert.equal(await page.evaluate(() => ACTIVE_USER), auth.user.id, 'tab cũ phải nạp lại đúng vùng dữ liệu của tài khoản mới');
    assert.deepEqual(page.__console, []);
    await tab2.close();
  });

  uiTest('GD-21 hàng đợi ngoại tuyến được cô lập giữa hai tài khoản', async page => {
    const thanhb = await setAccount(page, 'thanhb');
    const queued = await page.evaluate(async () => {
      const file = new File(['noi-dung-rieng-cua-thanhb'], 'anh-rieng.txt', { type: 'text/plain' });
      const [queuedId] = await queueOfflineFiles('project', 'shared-project', [{ file, kind: 'PROJECT_FILE', category: 'TEST' }]);
      return { queuedId, firstCount: await queuedFileCount('project', 'shared-project') };
    });
    assert.equal(queued.firstCount, 1);

    await setAccount(page, 'hung');
    const asSecond = await page.evaluate(async queuedId => {
      const result = { count: await queuedFileCount('project', 'shared-project'), canReadById: !!(await queuedFile(queuedId)) };
      await removeQueuedFile(queuedId);
      return result;
    }, queued.queuedId);
    assert.deepEqual(asSecond, { count: 0, canReadById: false });

    await setAccount(page, 'thanhb');
    const asOwner = await page.evaluate(async queuedId => {
      const before = await queuedFileCount('project', 'shared-project');
      await removeQueuedFile(queuedId);
      return { before, after: await queuedFileCount('project', 'shared-project') };
    }, queued.queuedId);
    assert.deepEqual(asOwner, { before: 1, after: 0 });
    assert.equal(thanhb.user.username, 'thanhb');
    assert.deepEqual(page.__console, []);
  });

  uiTest('GD-22 hai thiết bị độc lập: GS gửi và Trưởng TVGS nhận không cần đăng xuất', async engineer => {
    await setAccount(engineer, 'thanhb');
    const lead = await newPage('GD-22 lead', { viewport: { width: 390, height: 844 } });
    try {
      await setAccount(lead, 'hung');
      await openPage(engineer, 'daily');
      await engineer.click('#newLogButton');
      await engineer.fill('#ldate', '2026-10-16');
      await engineer.selectOption('#lshift', 'CA1');
      await engineer.fill('#lwork', 'GD-22 bao cao dong thoi hai thiet bi');
      await engineer.fill('#workforceRows .lr-type', 'Thợ hoàn thiện');
      await engineer.fill('#workforceRows .lr-count', '3');
      await engineer.locator('#modal button', { hasText: 'Lưu và gửi duyệt' }).click();
      await engineer.waitForFunction(() => (document.getElementById('logsTable')?.innerText || '').includes('GD-22 bao cao dong thoi hai thiet bi') && (document.getElementById('logsTable')?.innerText || '').includes('Chờ duyệt'));

      await openPage(lead, 'inbox');
      await lead.evaluate(() => loadInbox(true));
      await lead.waitForFunction(() => (document.getElementById('inboxBody')?.innerText || '').includes('GD-22 bao cao dong thoi hai thiet bi'));

      await openPage(lead, 'daily');
      await lead.evaluate(() => syncDailyLogsFromApi());
      const row = lead.locator('#logsTable tr', { hasText: 'GD-22 bao cao dong thoi hai thiet bi' });
      await row.locator('text="Duyệt"').first().click();
      await lead.waitForSelector('#modal.show #rvComment', { state: 'visible' });
      await lead.locator('#modal button.primary').first().click();
      await lead.waitForSelector('#modal.show', { state: 'hidden' });

      await engineer.evaluate(() => syncDailyLogsFromApi());
      await engineer.waitForFunction(() => {
        const row = [...document.querySelectorAll('#logsTable tr')].find(r => r.innerText.includes('GD-22 bao cao dong thoi hai thiet bi'));
        return row?.innerText.includes('Đã duyệt');
      });
      assert.equal(await engineer.locator('#logsTable tr', { hasText: 'GD-22 bao cao dong thoi hai thiet bi' }).locator('text="Sửa"').count(), 0);
      assert.deepEqual(engineer.__console, []);
      assert.deepEqual(lead.__console, []);
    } finally {
      await lead.context().close();
    }
  });
};
