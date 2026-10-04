const assert = require('node:assert/strict');
const { uiTest } = require('../helpers');

module.exports = function register() {
  uiTest('GD-18 xung dot: tai lai khong ghi de ban dang giu tren thiet bi', async page => {
    const result = await page.evaluate(async () => {
      localStorage.setItem('vina_supervision_auth', JSON.stringify({ token: 'test-token', user: { id: 'u1' } }));
      const projectId = '00000000-0000-4000-8000-000000000101';
      const logId = '00000000-0000-4000-8000-000000000102';
      const issueId = '00000000-0000-4000-8000-000000000103';
      db.projects = [{ id: projectId, name: 'Cong trinh tren thiet bi', code: 'CT-1' }];
      db.logs = [{ id: logId, serverId: logId, projectId, work: 'Bao cao tren thiet bi' }];
      db.issues = [{ id: issueId, serverId: issueId, projectId, title: 'Bien ban tren thiet bi' }];
      db.docs = []; db.people = []; db.hidden = {};
      db.sync = [
        { type: 'project', recordId: projectId, status: 'CONFLICT', lastError: 'Da thay doi' },
        { type: 'daily_log', recordId: logId, status: 'CONFLICT', lastError: 'Da thay doi' },
        { type: 'issue', recordId: issueId, status: 'CONFLICT', lastError: 'Da thay doi' }
      ];

      const remoteProject = { id: projectId, name: 'Cong trinh tren may chu', code: 'CT-1' };
      mergeProjectsFromServer([remoteProject]);
      apiGetProjects = async () => [remoteProject];
      apiGetDailyLogs = async () => [{ id: logId, projectId, work: 'Bao cao tren may chu' }];
      apiGetIssues = async () => [{ id: issueId, project_id: projectId, title: 'Bien ban tren may chu' }];
      await syncDailyLogsFromApi();
      await syncIssuesFromApi();
      return {
        project: db.projects[0].name,
        projectError: db.projects[0]._syncError,
        log: db.logs[0].work,
        issue: db.issues[0].title,
        conflictCount: db.sync.filter(x => x.status === 'CONFLICT').length
      };
    });
    assert.deepEqual(result, {
      project: 'Cong trinh tren thiet bi',
      projectError: 'Da thay doi',
      log: 'Bao cao tren thiet bi',
      issue: 'Bien ban tren thiet bi',
      conflictCount: 3
    });
    assert.deepEqual(page.__console, []);
  });
};
