db.progressPlans=db.progressPlans||{};
db.pendingInitialProgressPlans=db.pendingInitialProgressPlans||{};
window.addEventListener('load',()=>{void loadQualityPermissions(true)});
window.addEventListener('online',async()=>{updateNet();if(db.sync.length){audit('SYNC','system','',db.sync.length+' mục chờ đồng bộ');save();if(window.syncPendingProjects)await window.syncPendingProjects();if(window.syncPendingDailyLogs)await window.syncPendingDailyLogs();}});window.addEventListener('offline',updateNet);
function navigateMain(page){
 if(page==='settings'&&!canManageAssignments())return;
 currentProjectId=null;goPage(page);renderAll();
 if(page==='people')void loadProjectTeamDirectory();
 if(page==='settings')void loadSettingsProjects();
 if(page==='reports')void syncDocumentsFromApi().then(()=>{if(typeof renderReports==='function')renderReports()});
}
function openMobileMenu(){
 const items=[...document.querySelectorAll('nav button.nav-overflow[data-page]')].filter(button=>button.style.display!=='none');
 const body='<div class="mobile-more-grid">'+items.map(button=>'<button type="button" onclick="closeModal();navigateMain(\''+button.dataset.page+'\')"><span class="nav-icon" aria-hidden="true">'+esc(button.querySelector('.nav-icon')?.textContent||'')+'</span><span>'+esc(button.querySelector('.nav-label')?.textContent||button.dataset.page)+'</span></button>').join('')+'</div>';
 openModal('Thêm chức năng',body);
}
document.querySelectorAll('nav button[data-page]').forEach(b=>b.onclick=()=>navigateMain(b.dataset.page));
renderAll();
qualitySelfCheck();
