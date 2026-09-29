
window.syncDailyLogsFromApi = syncDailyLogsFromApi;
window.addEventListener('load',()=>setTimeout(checkServerMigrations,1500));
window.addEventListener('online',()=>{
  if(window.syncPendingIssues) void window.syncPendingIssues();
});

window.addEventListener('load', async ()=>{
  if(window.syncPendingProjects) await window.syncPendingProjects();
  await syncDailyLogsFromApi();
  await syncDocumentsFromApi();
  if(window.syncPendingDailyLogs) await window.syncPendingDailyLogs();
  if(window.syncPendingIssues) await window.syncPendingIssues();
  await syncInitialProgressPlans();
  if(window.syncIssuesFromApi) await window.syncIssuesFromApi();
});
