const assert = require('node:assert/strict');
const { uiTest, loginViaApi, openPage, navVisible, tokenOf, apiAs, projectIdByContract } = require('../helpers');

async function visible(page, selector) {
  const locator = page.locator(selector);
  return await locator.count() > 0 && await locator.first().isVisible();
}

module.exports = function () {
  uiTest('GD-16 ma trận giao diện đủ 5 vai trò và quyền theo công trình', async page => {
    const adminToken = await tokenOf('admin');
    const admin = apiAs(adminToken);
    const projectId = await projectIdByContract(adminToken, '001');

    let manager = await admin.post('/users', {
      username: 'gd16.manager', full_name: 'Quản lý GD16', password: 'TamThoi123', role_name: 'MANAGER'
    });
    assert.equal(manager.status, 201, 'phải tạo được tài khoản Quản lý: ' + JSON.stringify(manager.body));
    const temporaryToken = await tokenOf('gd16.manager', 'TamThoi123');
    const changed = await apiAs(temporaryToken).post('/auth/change-password', { old_password: 'TamThoi123', new_password: 'QuanLyGD16!' });
    assert.equal(changed.status, 200, 'Quản lý phải đổi được mật khẩu ban đầu');
    const assignment = await admin.post('/project-members', {
      project_id: projectId, user_id: manager.body.id, assignment_title: 'Quản lý dự án'
    });
    assert.equal(assignment.status, 201, 'phải phân công được Quản lý vào công trình');

    const matrix = [
      { user: 'admin', role: 'Admin', projects: 3, manage: true, review: true, trash: true, create: true, editProject: true },
      { user: 'duong', role: 'Giám đốc', projects: 3, manage: true, review: true, trash: true, create: true, editProject: true },
      { user: 'gd16.manager', password: 'QuanLyGD16!', role: 'Quản lý', projects: 1, manage: false, review: false, trash: false, create: false, editProject: false },
      { user: 'hung', role: 'TVGS trưởng', projects: 2, manage: false, review: true, trash: false, create: true, editProject: true },
      { user: 'son', role: 'TVGS', projects: 2, manage: false, review: false, trash: false, create: true, editProject: false }
    ];

    for (const actor of matrix) {
      await loginViaApi(page, actor.user, actor.password || 'demo');
      assert.equal(await navVisible(page, 'settings'), actor.manage, actor.role + ': quyền thấy Thiết lập sai');
      assert.equal(await navVisible(page, 'inbox'), actor.review, actor.role + ': quyền thấy Cần duyệt sai');
      assert.equal(await navVisible(page, 'trash'), actor.trash, actor.role + ': quyền thấy Thùng rác sai');

      await openPage(page, 'projects');
      await page.waitForFunction(() => !/Đang tải/.test(document.getElementById('projectsTable')?.innerText || ''));
      assert.equal(await page.locator('#projectsTable tbody tr').count(), actor.projects, actor.role + ': số công trình được thấy sai');
      assert.equal(await visible(page, '#newProjectButton'), actor.manage, actor.role + ': quyền thêm công trình sai');
      assert.equal((await page.locator('#projectsTable button', { hasText: 'Sửa' }).count()) > 0, actor.editProject, actor.role + ': quyền sửa công trình sai');

      await openPage(page, 'daily');
      assert.equal(await visible(page, '#newLogButton'), actor.create, actor.role + ': quyền lập nhật ký sai');
      await openPage(page, 'issues');
      assert.equal(await visible(page, '#newIssueButton'), actor.create, actor.role + ': quyền lập nội dung chất lượng sai');
      await openPage(page, 'reports');
      assert.equal(await visible(page, '#newReportButton'), actor.create, actor.role + ': quyền lập báo cáo sai');
      await openPage(page, 'people');
      assert.equal(await visible(page, '#addPersonButton'), actor.manage, actor.role + ': quyền thêm nhân sự sai');
    }
  });

  uiTest('GD-17 mobile chỉ giữ chức năng chính và mục Thêm đúng quyền', async page => {
    await loginViaApi(page, 'admin');
    const visiblePrimary = await page.locator('nav button:visible .nav-label').allTextContents();
    assert.deepEqual(visiblePrimary.map(x => x.trim()), ['Tổng quan', 'Công trình', 'Báo cáo ngày', 'Cần duyệt', 'Thêm']);
    await page.click('#mobileMoreButton');
    const adminMore = await page.locator('#mbody .mobile-more-grid button').allTextContents();
    for (const label of ['Chất lượng', 'Báo cáo', 'Nhân sự', 'Lịch sử', 'Thùng rác', 'Thiết lập']) {
      assert.ok(adminMore.some(x => x.includes(label)), 'Admin thiếu mục ' + label + ' trong Thêm');
    }
    await page.evaluate(() => window.closeModal());

    await loginViaApi(page, 'son');
    await page.click('#mobileMoreButton');
    const engineerMore = await page.locator('#mbody .mobile-more-grid button').allTextContents();
    assert.ok(engineerMore.some(x => x.includes('Chất lượng')) && engineerMore.some(x => x.includes('Báo cáo')));
    assert.ok(!engineerMore.some(x => x.includes('Thiết lập')) && !engineerMore.some(x => x.includes('Thùng rác')),
      'TVGS không được thấy chức năng quản trị trong Thêm');
  }, { viewport: { width: 390, height: 844 } });
};
