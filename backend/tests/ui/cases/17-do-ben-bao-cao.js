const assert = require('node:assert/strict');
const { BASE, uiTest, loginViaApi, openPage } = require('../helpers');

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

function unexpectedConsoleErrors(page) {
  return page.__console.filter(message => !message.includes('ERR_INTERNET_DISCONNECTED'));
}

async function openFilledReport(page, date, shift, work) {
  await openPage(page, 'daily');
  await page.click('#newLogButton');
  await page.fill('#ldate', date);
  await page.selectOption('#lshift', shift);
  await page.fill('#lwork', work);
  await page.fill('#workforceRows .lr-type', 'Thợ xây');
  await page.fill('#workforceRows .lr-count', '2');
}

module.exports = function register() {
  uiTest('GD-23 mất mạng giữa lúc tải nhiều ảnh: nối lại không mất hoặc nhân đôi', async page => {
    await loginViaApi(page, 'thanhb');
    const work = 'GD-23 mat mang giua luc tai anh';
    await openFilledReport(page, '2026-10-17', 'CA1', work);
    await page.setInputFiles('#lphotos', [
      { name: 'gd23-1.png', mimeType: 'image/png', buffer: png },
      { name: 'gd23-2.png', mimeType: 'image/png', buffer: Buffer.concat([png, Buffer.from([23])]) }
    ]);

    let interrupted = false;
    await page.route('**/api/daily-logs/*/attachments-binary*', async route => {
      if (!interrupted) { interrupted = true; await route.abort('internetdisconnected'); }
      else await route.continue();
    });
    await page.locator('#modal button', { hasText: 'Lưu nháp' }).click();
    await page.waitForSelector('#modal.show', { state: 'hidden' });
    await page.waitForFunction(t => (document.getElementById('logsTable')?.innerText || '').includes(t), work);

    const pending = await page.evaluate(async t => {
      const log = db.logs.find(x => x.work === t);
      return { files: await queuedFileCount('daily_log', log.id), sync: db.sync.filter(x => x.type === 'daily_log' && x.recordId === log.id && x.status === 'PENDING').length };
    }, work);
    assert.ok(pending.files >= 1, 'ảnh chưa tải phải còn trong hàng đợi');
    assert.equal(pending.sync, 1, 'bản ghi phải còn đúng một việc chờ đồng bộ');

    await page.unroute('**/api/daily-logs/*/attachments-binary*');
    await page.evaluate(() => syncPendingDailyLogs());
    await page.waitForFunction(async t => {
      const log = db.logs.find(x => x.work === t);
      return log && await queuedFileCount('daily_log', log.id) === 0 && !db.sync.some(x => x.type === 'daily_log' && x.recordId === log.id);
    }, work);

    const saved = await page.evaluate(t => db.logs.find(x => x.work === t), work);
    const auth = await page.evaluate(() => JSON.parse(localStorage.getItem('vina_supervision_auth')));
    const files = await page.request.get(BASE + '/api/daily-logs/' + saved.serverId + '/attachments', { headers: { Authorization: 'Bearer ' + auth.token } });
    assert.equal(files.status(), 200);
    assert.equal((await files.json()).length, 2, 'nối lại phải tải đủ đúng hai ảnh');
    assert.deepEqual(unexpectedConsoleErrors(page), []);
  });

  uiTest('GD-24 bấm lưu liên tiếp: chỉ tạo một báo cáo và giao diện không treo', async page => {
    await loginViaApi(page, 'thanhb');
    const work = 'GD-24 bam luu lien tiep';
    await openFilledReport(page, '2026-10-17', 'CA2', work);

    await page.evaluate(() => Promise.all([saveLog('', false), saveLog('', false)]));
    await page.waitForSelector('#modal.show', { state: 'hidden' });
    await page.waitForFunction(t => (document.getElementById('logsTable')?.innerText || '').includes(t), work);
    const localCount = await page.evaluate(t => db.logs.filter(x => x.work === t).length, work);
    assert.equal(localCount, 1, 'thiết bị chỉ được có một bản');

    const saved = await page.evaluate(t => db.logs.find(x => x.work === t), work);
    const auth = await page.evaluate(() => JSON.parse(localStorage.getItem('vina_supervision_auth')));
    const response = await page.request.get(BASE + '/api/daily-logs?project_id=' + saved.projectId, { headers: { Authorization: 'Bearer ' + auth.token } });
    assert.equal(response.status(), 200);
    assert.equal((await response.json()).filter(x => x.work_summary === work).length, 1, 'máy chủ chỉ được có một bản');
    assert.deepEqual(page.__console, []);
  });
};
