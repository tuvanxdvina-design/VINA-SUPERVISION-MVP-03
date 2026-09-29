
document.querySelector('nav button[data-page="inbox"]')?.addEventListener('click',()=>{document.getElementById('inboxBanner')?.remove();renderInbox();void loadInbox()});
document.querySelector('nav button[data-page="dashboard"]')?.addEventListener('click',()=>{renderPortfolio();void loadPortfolio()});
document.querySelector('nav button[data-page="trash"]')?.addEventListener('click',()=>{void loadTrash()});
applyTrashNavVisibility();
window.addEventListener('load',()=>setTimeout(applyTrashNavVisibility,2500));

applyInboxNavVisibility();
window.addEventListener('load',()=>setTimeout(()=>{
 if(getAuthToken()&&!getAuthUser()?.must_change_password){void loadPortfolio();setInterval(()=>{if(document.visibilityState==='visible'&&document.getElementById('dashboard')?.classList.contains('active'))void loadPortfolio()},300000)}
},1200));
window.addEventListener('load',()=>setTimeout(()=>{
 applyInboxNavVisibility();
 if(!getAuthToken())return;
 if(getAuthUser()?.must_change_password){window.forcePasswordChange();return}
 void loadInbox();
 setInterval(()=>{if(document.visibilityState==='visible')void loadInbox()},120000);
},1800));
