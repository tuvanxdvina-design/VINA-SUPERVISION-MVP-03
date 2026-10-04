
window.syncDailyLogsFromApi = syncDailyLogsFromApi;
window.addEventListener('load',()=>setTimeout(checkServerMigrations,1500));
window.addEventListener('online',()=>{
  if(window.syncPendingIssues) void window.syncPendingIssues();
});

window.addEventListener('load', async ()=>{
  if(typeof migrateLegacyEmbeddedFiles==='function')await migrateLegacyEmbeddedFiles();
  if(window.syncPendingProjects) await window.syncPendingProjects();
  if(typeof syncQueuedProjectFiles==='function')for(const project of serverProjects())await syncQueuedProjectFiles(project.id).catch(error=>console.warn('Chưa đồng bộ được tệp công trình:',error.message));
  await syncDailyLogsFromApi();
  await syncDocumentsFromApi();
  if(window.syncPendingDailyLogs) await window.syncPendingDailyLogs();
  if(window.syncPendingIssues) await window.syncPendingIssues();
  await syncInitialProgressPlans();
  if(window.syncIssuesFromApi) await window.syncIssuesFromApi();
});
