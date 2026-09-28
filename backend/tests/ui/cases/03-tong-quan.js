// Phạm vi công trình theo phân công; tổng quan và bấm cảnh báo.
const assert = require('node:assert/strict');
const { uiTest, loginViaApi, openPage, tokenOf, apiAs } = require('../helpers');

module.exports = function () {
  uiTest('GD-04 thành viên chỉ thấy công trình được phân công', async (page) => {
    const all = (await apiAs(await tokenOf('admin')).get('/projects')).body;
    const mine = all.find(p => p.contract_no === '001');
    const others = all.filter(p => p.contract_no !== '001');
    assert.ok(mine && others.length >= 1, 'dữ liệu thử phải có công trình 001 và ít nhất một công trình khác');

    await loginViaApi(page, 'thanhb'); // GS viên tại công trình 001
    await openPage(page, 'projects');
    const projects = await page.locator('#projects').innerText();
    assert.ok(projects.includes(mine.name), 'phải thấy công trình được phân công: ' + mine.name);
    for (const o of others) {
      assert.ok(!projects.includes(o.name), 'không được thấy công trình chưa phân công: ' + o.name);
    }

    const opts = await page.locator('#logProject option').allInnerTexts();
    for (const o of others) {
      assert.ok(!opts.join(' | ').includes(o.name), 'ô chọn công trình ở Nhật ký cũng chỉ được có công trình của mình: ' + opts.join(' | '));
    }
  });

  uiTest('GD-05 tổng quan: thấy mọi công trình và bấm cảnh báo nhảy đúng trang', async (page) => {
    const all = (await apiAs(await tokenOf('admin')).get('/projects')).body;
    await loginViaApi(page, 'admin');
    await openPage(page, 'dashboard');
    // Chờ đến khi portfolio đã vẽ xong: bảng tình trạng có tên công trình đầu tiên.
    // (Không chờ theo chữ "Đang tải" — trang tổng quan không hiện chữ đó nên sẽ qua ngay lập tức.)
    await page.waitForFunction(n => (document.getElementById('dashboard')?.innerText || '').includes(n), all[0].name);

    const text = await page.locator('#dashboard').innerText();
    for (const p of all) {
      assert.ok(text.includes(p.name), 'Admin phải thấy mọi công trình ở tổng quan, thiếu: ' + p.name);
    }

    const alerts = page.locator('#dashboard .alert-item');
    const n = await alerts.count();
    assert.ok(n > 0, 'dữ liệu thử phải sinh ít nhất một cảnh báo (thiếu nhật ký, chậm tiến độ…)');

    await alerts.first().click();
    await page.waitForFunction(() => document.querySelector('.page.active')?.id !== 'dashboard');
    const active = await page.evaluate(() => document.querySelector('.page.active')?.id);
    const pages = ['projects', 'daily', 'docs', 'issues', 'reports', 'people', 'inbox'];
    assert.ok(pages.includes(active), 'bấm cảnh báo phải chuyển sang trang liên quan, đang ở: ' + active);
  });
};
