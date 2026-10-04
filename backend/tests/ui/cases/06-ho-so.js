// Luồng hồ sơ: Bản nháp → Chờ duyệt → Đã duyệt → Đã khóa, mã hồ sơ do máy chủ tự cấp.
// Các nút luồng nằm trong modal "Xem hồ sơ pháp lý" (mở bằng nút Xem ở bảng).
const assert = require('node:assert/strict');
const { uiTest, loginViaApi, openPage } = require('../helpers');

module.exports = function () {
  uiTest('GD-10 hồ sơ: mã tự sinh và đi đủ nháp → gửi → duyệt → khóa', async (page) => {
    await loginViaApi(page, 'hung'); // Trưởng TVGS: có quyền Thêm và Duyệt tại công trình 001
    await openPage(page, 'projects');
    await page.locator('#projectsTable button', { hasText: 'Chi tiết' }).first().click();
    await page.click('#pdNewDocBtn');
    await page.waitForSelector('#modal.show #dname', { state: 'visible' });
    const ten = 'GD-10 Bien ban nghiem thu mong';
    await page.fill('#dname', ten);
    await page.click('#docSaveBtn');
    await page.waitForSelector('#modal.show', { state: 'hidden' });
    await page.locator('#projectDetail button', { hasText: 'Xem tất cả' }).click();
    await page.waitForFunction(t => (document.getElementById('docsTable')?.innerText || '').includes(t), ten);

    const row = () => page.locator('#docsTable tr', { hasText: ten });
    const rowText = await row().innerText();
    assert.ok(/[A-Z]{2,3}-\d{3}-\d{3}/.test(rowText), 'hồ sơ phải có mã tự sinh dạng BB-001-002: ' + rowText);
    assert.ok(rowText.includes('Bản nháp'), 'hồ sơ mới phải ở Bản nháp: ' + rowText);

    // Bản nháp → Gửi duyệt (nút nằm trong modal Xem; modal được vẽ lại sau mỗi bước)
    await row().locator('text="Xem"').first().click();
    await page.waitForSelector('#modal.show', { state: 'visible' });
    await page.locator('#modal >> text="Gửi duyệt"').first().click();
    await page.waitForSelector('#modal >> text="Duyệt"', { state: 'visible' });

    // Chờ duyệt → Duyệt (mở modal quyết định, ý kiến không bắt buộc khi phê duyệt)
    await page.locator('#modal >> text="Duyệt"').first().click();
    await page.waitForSelector('#modal.show #rvComment', { state: 'visible' });
    await page.locator('#modal button.primary').first().click(); // ✔ Phê duyệt
    await page.waitForFunction(t => {
      const tr = [...document.querySelectorAll('#docsTable tr')].find(r => r.innerText.includes(t));
      return tr && tr.innerText.includes('Đã duyệt');
    }, ten);

    // Đã duyệt → Khóa hồ sơ
    await page.locator('#modal.show').isVisible().then(async v => { if (v) await page.evaluate(() => window.closeModal && window.closeModal()); });
    await row().locator('text="Xem"').first().click();
    await page.waitForSelector('#modal >> text="Khóa hồ sơ"', { state: 'visible' });
    await page.locator('#modal >> text="Khóa hồ sơ"').first().click();
    await page.waitForFunction(t => {
      const tr = [...document.querySelectorAll('#docsTable tr')].find(r => r.innerText.includes(t));
      return tr && tr.innerText.includes('Đã khóa');
    }, ten);

    // Đã khóa: không còn nút sửa cho Trưởng TVGS (chỉ Admin/Giám đốc mới mở khóa/sửa được)
    assert.equal(await row().locator('text="Sửa"').count(), 0, 'hồ sơ đã khóa không còn nút Sửa ở bảng');
  });
};
