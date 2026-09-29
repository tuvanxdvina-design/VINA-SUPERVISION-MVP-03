
// ============================================================================
// XÓA NỘI DUNG & THÙNG RÁC (bản 2026-10-06)
// Xóa: chỉ tài khoản quản trị (Admin/Giám đốc) hoặc người được cấp quyền "Xóa" tại công trình.
// Mọi lần xóa phải ghi lý do và vào Thùng rác (khôi phục được); chỉ Admin xóa vĩnh viễn.
// ============================================================================
const DELETE_API={log:id=>'/daily-logs/'+encodeURIComponent(id),doc:id=>'/documents/'+encodeURIComponent(id),issue:id=>'/issues/'+encodeURIComponent(id)};
function deleteContent(kind,id,label,planProjectId){
 const k=v=>JSON.stringify(v).replace(/"/g,'&quot;');
 openModal('Xóa nội dung','<div class="review-note reject"><b>'+esc(label||'')+'</b><br>Nội dung sẽ chuyển vào <b>Thùng rác</b> (kèm ảnh, tệp, số liệu đi kèm) và biến mất khỏi danh sách, báo cáo, tổng quan. Có thể khôi phục lại trong Thùng rác.</div>'
  +'<label for="delReason">Lý do xóa (bắt buộc)</label><textarea id="delReason" rows="3" maxlength="1000" placeholder="Ví dụ: lập trùng nhật ký ca 1 ngày 21/09; nhập nhầm công trình..."></textarea>'
  +'<div class="toolbar"><button class="danger" onclick="confirmDeleteContent('+k(kind)+','+k(id)+','+k(planProjectId||'')+')">🗑 Chuyển vào Thùng rác</button><button onclick="closeModal()">Hủy</button></div><div id="delMsg" class="muted"></div>');
 setTimeout(()=>document.getElementById('delReason')?.focus(),50);
}
async function confirmDeleteContent(kind,id,planProjectId){
 const reason=(document.getElementById('delReason')?.value||'').trim();const msg=document.getElementById('delMsg');
 if(reason.length<3){msg.textContent='Nhập lý do xóa.';return}
 const path=kind==='plan'?'/projects/'+encodeURIComponent(planProjectId)+'/progress-plans/'+encodeURIComponent(id):DELETE_API[kind](id);
 try{
  msg.textContent='Đang xóa...';
  await apiRequest(path,{method:'DELETE',body:JSON.stringify({reason})});
  if(kind==='log'){db.logs=(db.logs||[]).filter(l=>l.serverId!==id&&l.id!==id)}
  if(kind==='doc'){db.docs=(db.docs||[]).filter(d=>d.id!==id&&d.serverId!==id)}
  if(kind==='issue'){db.issues=(db.issues||[]).filter(x=>x.serverId!==id&&x.id!==id)}
  audit('DELETE',kind,id,reason);save();closeModal();
  if(kind==='plan'){progressEditor=null;await loadProjectProgressPlans(planProjectId);await refreshProjectFromServer(planProjectId)}
  renderAll();if(typeof loadInbox==='function')void loadInbox();
  alert('Đã chuyển vào Thùng rác. Khôi phục tại mục "Thùng rác" nếu cần.');
 }catch(error){msg.textContent='Không xóa được: '+error.message}
}
let trashData=null;
function canSeeTrash(){if(canManageAssignments())return true;return [...qualityPermissionCache.values()].some(v=>(v.permissions||[]).map(x=>String(x).toUpperCase()).includes('DELETE'))}
function applyTrashNavVisibility(){const nav=document.querySelector('nav button[data-page="trash"]');const show=canSeeTrash();if(nav)nav.style.display=show?'':'none';if(!show&&document.getElementById('trash')?.classList.contains('active'))goPage('projects')}
async function loadTrash(){
 const el=document.getElementById('trashBody');if(!el)return;
 if(!apiOnline()){el.innerHTML='<p class="muted">Cần kết nối mạng.</p>';return}
 try{trashData=await apiRequest('/recycle-bin')}catch(error){el.innerHTML='<p class="muted">Không tải được: '+esc(error.message)+'</p>';return}
 renderTrash();
}
function renderTrash(){
 const el=document.getElementById('trashBody');if(!el||!trashData)return;
 const f=document.getElementById('trashFilter')?.value||'ACTIVE';const admin=roleToken(qualityAuthUser()?.role_name||'')==='ADMIN';
 const list=trashData.filter(r=>f==='ALL'||(!r.restored_at&&!r.purged_at));
 if(!list.length){el.innerHTML='<p class="muted">Thùng rác trống.</p>';return}
 el.innerHTML='<table><thead><tr><th>Loại</th><th>Nội dung</th><th>Công trình</th><th>Người xóa · lúc</th><th>Lý do</th><th>Trạng thái</th><th></th></tr></thead><tbody>'+list.map(r=>{
  const state=r.restored_at?'<span class="chip ok">Đã khôi phục</span><br><span class="muted" style="font-size:12px">'+esc(r.restored_by_name||'')+' · '+esc(fmt(r.restored_at))+'</span>':r.purged_at?'<span class="chip danger">Đã xóa vĩnh viễn</span><br><span class="muted" style="font-size:12px">'+esc(r.purged_by_name||'')+' · '+esc(fmt(r.purged_at))+'</span>':'<span class="chip warn">Trong thùng rác</span>';
  const act=!r.restored_at&&!r.purged_at?'<button class="primary" onclick="restoreTrash(\''+r.id+'\')">↩ Khôi phục</button>'+(admin?' <button class="danger" onclick="purgeTrash(\''+r.id+'\')">Xóa vĩnh viễn</button>':''):'';
  return '<tr><td>'+esc(r.type_label)+'</td><td>'+esc(r.title||'')+(r.child_count?'<br><span class="muted" style="font-size:12px">kèm '+r.child_count+' mục dữ liệu con (ảnh, tệp, hạng mục, số liệu…)</span>':'')+'</td><td>'+esc((r.project_code||'')+' '+(r.project_name||''))+'</td><td>'+esc(r.deleted_by_name||'')+'<br><span class="muted" style="font-size:12px">'+esc(fmt(r.deleted_at))+'</span></td><td style="white-space:pre-wrap">'+esc(r.reason||'')+'</td><td>'+state+'</td><td style="white-space:nowrap">'+act+'</td></tr>'}).join('')+'</tbody></table>';
}
async function restoreTrash(id){
 if(!confirm('Khôi phục nội dung này về đúng vị trí cũ (kèm ảnh, tệp, số liệu)?'))return;
 try{const r=await apiRequest('/recycle-bin/'+encodeURIComponent(id)+'/restore',{method:'POST',body:'{}'});audit('RESTORE',r.type,r.id,'');save();
  await loadTrash();
  // Tải lại đúng nhóm dữ liệu vừa khôi phục rồi vẽ lại, để người dùng thấy ngay mà không phải Ctrl+F5.
  if(typeof syncDailyLogsFromApi==='function'){try{await syncDailyLogsFromApi()}catch(_){}}
  if(typeof syncDocumentsFromApi==='function'){try{await syncDocumentsFromApi()}catch(_){}}
  renderAll();if(typeof loadPortfolio==='function')void loadPortfolio();
  alert(r.type==='project_progress_plans'?'Đã khôi phục bảng tiến độ. Xem ở Chi tiết công trình → Tiến độ thi công.':'Đã khôi phục.')}
 catch(error){alert('Không khôi phục được: '+error.message)}
}
async function purgeTrash(id){
 const t=prompt('XÓA VĨNH VIỄN — không khôi phục được nữa (dòng vết ai xóa/lý do vẫn giữ).\nGõ XOA để xác nhận:');if(String(t||'').trim().toUpperCase()!=='XOA')return;
 try{await apiRequest('/recycle-bin/'+encodeURIComponent(id),{method:'DELETE'});audit('PURGE','recycle_bin',id,'');save();await loadTrash()}
 catch(error){alert('Không xóa được: '+error.message)}
}
