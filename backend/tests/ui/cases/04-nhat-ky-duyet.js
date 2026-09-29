// Lập nhật ký → gửi duyệt → Trưởng TVGS duyệt qua "Việc cần duyệt".
// Nhãn trạng thái thật trong app: DRAFT 'Nháp', SUBMITTED 'Chờ duyệt', APPROVED 'Đã duyệt', LOCKED 'Đã khóa'.
const assert = require('node:assert/strict');
const { uiTest, loginViaApi, openPage } = require('../helpers');

// Lập nhật ký bằng giao diện (đúng đường người dùng đi), trả về nội dung công việc để tìm lại dòng.
async function taoNhatKyQuaGiaoDien(page, { ngay, congViec, guiDuyet = false }) {
  await openPage(page, 'daily');
  await page.click('#newLogButton');
  await page.waitForSelector('#modal.show #lwork', { state: 'visible' });
  await page.fill('#ldate', ngay);
  await page.fill('#lwork', congViec);
  await page.fill('#lworkers', '5');
  await page.click(`#modal >> text="${guiDuyet ? 'Lưu và gửi duyệt' : 'Lưu nháp'}"`);
  await page.waitForSelector('#modal.show', { state: 'hidden' });
  await page.waitForFunction(t => (document.getElementById('logsTable')?.innerText || '').includes(t), congViec);
  return congViec;
}

module.exports = function () {
  uiTest('GD-06 lập nhật ký nháp rồi gửi duyệt: người lập hết quyền sửa', async (page) => {
    await loginViaApi(page, 'thanhb');
    const congViec = 'GD-06 dam mong truc A';
    await taoNhatKyQuaGiaoDien(page, { ngay: '2026-09-24', congViec });

    const row = () => page.locator('#logsTable tr', { hasText: congViec });
    assert.ok((await row().innerText()).includes('Nháp'), 'nhật ký mới phải ở trạng thái Nháp: ' + (await row().innerText()));
    assert.ok(await row().locator('text="Gửi duyệt"').isVisible(), 'nháp phải có nút Gửi duyệt');
    assert.equal(await row().locator('text="Duyệt"').count(), 0, 'người lập không được thấy nút Duyệt');

    await row().locator('text="Gửi duyệt"').click(); // confirm() được helper tự chấp nhận
    await page.waitForFunction(t => {
      const tr = [...document.querySelectorAll('#logsTable tr')].find(r => r.innerText.includes(t));
      return tr && tr.innerText.includes('Chờ duyệt');
    }, congViec);

    assert.equal(await row().locator('text="Gửi duyệt"').count(), 0, 'đã gửi thì không còn nút Gửi duyệt');
    assert.equal(await row().locator('text="Sửa"').count(), 0, 'đã gửi thì người lập không sửa được nữa');
  });

  uiTest('GD-07 Trưởng TVGS thấy việc trong hộp duyệt và duyệt được', async (page) => {
    await loginViaApi(page, 'thanhb');
    const congViec = 'GD-07 be tong san ham';
    await taoNhatKyQuaGiaoDien(page, { ngay: '2026-09-25', congViec, guiDuyet: true });

    await loginViaApi(page, 'hung'); // Trưởng TVGS tại công trình 001
    await openPage(page, 'inbox');
    await page.waitForFunction(() => !/Đang tải/.test(document.getElementById('inboxBody')?.innerText || ''));
    assert.ok((await page.locator('#inboxBody').innerText()).includes(congViec),
      'việc đã gửi phải xuất hiện trong "Việc cần duyệt" của Trưởng TVGS');

    await openPage(page, 'daily');
    // Danh sách nhật ký của người khác đến từ đồng bộ máy chủ — chờ dòng hiện ra trước khi bấm.
    await page.waitForFunction(t => (document.getElementById('logsTable')?.innerText || '').includes(t), congViec, { timeout: 25000 });
    const row = () => page.locator('#logsTable tr', { hasText: congViec });
    // Bấm "Duyệt" mở modal "Xem xét và phê duyệt" (ý kiến không bắt buộc khi phê duyệt).
    await row().locator('text="Duyệt"').first().click();
    await page.waitForSelector('#modal.show #rvComment', { state: 'visible' });
    assert.equal(await page.locator('#mtitle').innerText(), 'Xem xét và phê duyệt');
    await page.locator('#modal button.primary').first().click(); // ✔ Phê duyệt
    await page.waitForSelector('#modal.show', { state: 'hidden' });
    await page.waitForFunction(t => {
      const tr = [...document.querySelectorAll('#logsTable tr')].find(r => r.innerText.includes(t));
      return tr && tr.innerText.includes('Đã duyệt');
    }, congViec);
    assert.equal(await row().locator('text="Duyệt"').count(), 0, 'đã duyệt rồi thì không còn nút Duyệt');

    // Việc đã quyết định phải rời hộp "Việc cần duyệt"
    await openPage(page, 'inbox');
    await page.waitForFunction(() => !/Đang tải/.test(document.getElementById('inboxBody')?.innerText || ''));
    await page.waitForFunction(t => !(document.getElementById('inboxBody')?.innerText || '').includes(t), congViec);
  });
};
