const assert = require('node:assert/strict');
const { BASE, uiTest, loginViaApi, openPage } = require('../helpers');

module.exports = function register() {
  uiTest('GD-19 mobile: thời tiết, nhiều ảnh và báo cáo vẫn hiện khi chờ duyệt', async page => {
    await loginViaApi(page, 'thanhb');

    const identity = await page.locator('#sessionIdentity').innerText();
    assert.match(identity, /thanhb/i, 'thanh đầu trang phải hiện tài khoản đang đăng nhập');
    assert.match(identity, /Giám sát viên/i, 'thanh đầu trang phải hiện quyền toàn hệ thống');

    await openPage(page, 'daily');
    await page.click('#newLogButton');
    await page.waitForSelector('#modal.show #lweather', { state: 'visible' });
    assert.equal(await page.locator('#lweather').evaluate(el => el.tagName), 'SELECT');
    await page.selectOption('#lweather', { label: 'Mưa nhỏ' });
    await page.fill('#ldate', '2026-10-15');
    await page.selectOption('#lshift', 'CA3');
    await page.fill('#lwork', 'GD-19 kiem tra bao cao tren dien thoai');
    await page.fill('#workforceRows .lr-type', 'Thợ xây');
    await page.fill('#workforceRows .lr-count', '4');

    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
    await page.setInputFiles('#lphotos', [
      { name: 'hien-truong-1.png', mimeType: 'image/png', buffer: png },
      { name: 'hien-truong-2.png', mimeType: 'image/png', buffer: Buffer.concat([png, Buffer.from([1])]) }
    ]);
    await page.waitForFunction(() => (document.getElementById('logPhotoQueue')?.innerText || '').includes('Ảnh sẽ lưu: 2'));
    await page.locator('#modal button', { hasText: 'Lưu và gửi duyệt' }).click();
    await page.waitForSelector('#modal.show', { state: 'hidden' });

    const work = 'GD-19 kiem tra bao cao tren dien thoai';
    await page.waitForFunction(t => {
      const row = [...document.querySelectorAll('#logsTable tr')].find(r => r.innerText.includes(t));
      return row && row.innerText.includes('Chờ duyệt');
    }, work);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('nav button[data-page="daily"]', { state: 'visible' });
    await openPage(page, 'daily');
    await page.waitForFunction(t => {
      const row = [...document.querySelectorAll('#logsTable tr')].find(r => r.innerText.includes(t));
      return row && row.innerText.includes('Chờ duyệt') && row.innerText.includes('Mưa nhỏ');
    }, work, { timeout: 25000 });

    const saved = await page.evaluate(t => db.logs.find(x => x.work === t), work);
    assert.ok(saved?.serverId, 'báo cáo phải có mã máy chủ sau khi gửi');
    assert.equal(saved.status, 'SUBMITTED');
    assert.equal(saved.photoCount, 2, 'danh sách phải phản ánh đủ hai ảnh đã lưu');

    const auth = await page.evaluate(() => JSON.parse(localStorage.getItem('vina_supervision_auth')));
    const photos = await page.request.get(BASE + '/api/daily-logs/' + saved.serverId + '/attachments', {
      headers: { Authorization: 'Bearer ' + auth.token }
    });
    assert.equal(photos.status(), 200);
    assert.equal((await photos.json()).length, 2, 'máy chủ phải lưu đủ hai ảnh trước khi gửi duyệt');
    assert.deepEqual(page.__console, []);
  }, { viewport: { width: 390, height: 844 } });
};
