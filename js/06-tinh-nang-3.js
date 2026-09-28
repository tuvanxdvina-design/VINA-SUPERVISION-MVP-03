
// ============================================================================
// Tài khoản nhân sự · Quy trình duyệt có ý kiến · Việc cần duyệt (bản 2026-10-01)
// ============================================================================
const REVIEW_ACTION={SUBMIT:'Gửi duyệt',APPROVE:'Phê duyệt',REJECT:'Yêu cầu chỉnh sửa, bổ sung',ESCALATE:'Trình công ty',LOCK:'Khóa',REOPEN:'Mở khóa'};
function randomPassword(len=10){
 const chars='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
 let s='';for(const n of crypto.getRandomValues(new Uint32Array(len)))s+=chars[n%chars.length];
 return /\d/.test(s)?s:s.slice(0,-1)+'7';
}
function meName(){return qualityAuthUser()?.full_name||qualityAuthUser()?.username||''}
// Mục "Việc cần duyệt" chỉ dành cho người có quyền duyệt: Giám đốc/Admin, hoặc người có quyền "Duyệt"
// ở ít nhất một công trình (Trưởng TVGS tại công trình đó). Người khác không thấy mục này.
function isReviewer(){
 if(canManageAssignments())return true;
 if([...qualityPermissionCache.values()].some(v=>(v.permissions||[]).map(x=>String(x).toUpperCase()).includes('APPROVE')))return true;
 return !!inboxData?.can_review;
}
function applyInboxNavVisibility(){
 const show=isReviewer();const nav=document.querySelector('nav button[data-page="inbox"]');if(nav)nav.style.display=show?'':'none';
 if(!show&&document.getElementById('inbox')?.classList.contains('active'))goPage('projects');
}

// ---- Phiếu tài khoản: hiện 1 lần sau khi tạo / đặt lại mật khẩu ----
let lastSlip=null;
function slipText(s){return 'VINA-SUPERVISION — Tài khoản đăng nhập\nHọ tên: '+s.fullName+'\n'+(s.project?'Công trình: '+s.project+(s.title?' ('+s.title+')':'')+'\n':'')+'Loại tài khoản: '+(s.role||'')+'\nĐịa chỉ: '+location.origin+'/\nTên đăng nhập: '+s.username+'\nMật khẩu '+(s.reset?'mới (tạm)':'ban đầu')+': '+s.password+'\nLần đăng nhập đầu tiên hệ thống yêu cầu đổi mật khẩu.'}
function showAccountSlip(s){
 lastSlip=s;
 openModal(s.reset?'Đã đặt lại mật khẩu':'Đã tạo tài khoản đăng nhập','<div class="cred-slip"><b>VINA-SUPERVISION — Tài khoản đăng nhập</b><br>Họ tên: <b>'+esc(s.fullName)+'</b><br>'+(s.project?'Công trình: '+esc(s.project)+(s.title?' ('+esc(s.title)+')':'')+'<br>':'')+'Loại tài khoản: '+esc(s.role||'')+'<br>Địa chỉ: <code>'+esc(location.origin)+'/</code><br>Tên đăng nhập: <code>'+esc(s.username)+'</code><br>Mật khẩu '+(s.reset?'mới (tạm)':'ban đầu')+': <code>'+esc(s.password)+'</code><br><span class="muted">Lần đăng nhập đầu tiên hệ thống yêu cầu đổi mật khẩu.</span></div>'
  +'<div class="toolbar"><button class="primary" onclick="copyAccountSlip()">Sao chép</button><button onclick="printAccountSlip()">In phiếu</button><button onclick="closeModal()">Đóng</button></div><p id="slipMsg" class="muted">Mật khẩu chỉ hiện một lần (máy chủ không lưu dạng đọc được). Nếu người dùng quên, dùng "Đặt lại mật khẩu" trong cửa sổ nhân sự.</p>');
}
async function copyAccountSlip(){
 if(!lastSlip)return;const t=slipText(lastSlip);const m=document.getElementById('slipMsg');
 try{await navigator.clipboard.writeText(t);if(m)m.textContent='Đã sao chép — dán vào Zalo/email gửi cho người dùng.'}
 catch(_){const ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();try{document.execCommand('copy');if(m)m.textContent='Đã sao chép.'}catch(__){if(m)m.textContent='Trình duyệt chặn sao chép — hãy bôi đen và sao chép thủ công.'}ta.remove()}
}
function printAccountSlip(){
 if(!lastSlip)return;const w=window.open('','_blank');if(!w)return alert('Trình duyệt chặn cửa sổ in.');
 w.document.write('<!doctype html><meta charset="utf-8"><title>Phiếu tài khoản</title><style>body{font-family:Arial,sans-serif;padding:24px}pre{font-size:16px;line-height:1.8;border:2px dashed #999;padding:16px;white-space:pre-wrap}</style><pre>'+esc(slipText(lastSlip))+'</pre>');
 w.document.close();setTimeout(()=>{w.focus();w.print()},300);
}
async function resetTeamPassword(userId,encodedKey,pid){
 const r=(teamRowsByProject[pid]||[]).find(x=>x.key===decodeURIComponent(encodedKey));if(!r||!userId)return;
 if(!confirm('Đặt lại mật khẩu cho tài khoản '+r.username+' ('+r.full_name+')?\nMật khẩu cũ hết hiệu lực ngay; người dùng phải đăng nhập bằng mật khẩu tạm rồi đổi mật khẩu mới.'))return;
 const pw=randomPassword();
 try{await apiRequest('/users/'+encodeURIComponent(userId)+'/password',{method:'POST',body:JSON.stringify({password:pw})});audit('RESET_PASSWORD','users',userId,r.username);save();
  showAccountSlip({fullName:r.full_name,username:r.username,password:pw,role:ROLE_LABELS[r.role_name]||r.role_name,project:(db.projects||[]).find(x=>x.id===pid)?.name||'',title:r.assignment_title,reset:true})}
 catch(error){alert('Không đặt lại được mật khẩu: '+error.message)}
}

// ---- Ý kiến duyệt ----
function returnedChip(x){
 const r=x?.lastReview;if(!x||!r)return '';
 if(x.status==='DRAFT'&&r.action==='REJECT')return '<br><span class="chip danger" title="'+esc(r.comment||'')+'">↩ Bị trả lại — cần sửa</span>';
 if(x.status==='SUBMITTED'&&r.action==='ESCALATE')return '<br><span class="chip warn" title="'+esc(r.comment||'')+'">⇪ Đã trình công ty</span>';
 return '';
}
function reviewBlockHtml(x,{history=true}={}){
 const r=x?.lastReview;let h='';
 if(r&&r.action==='REJECT'&&x.status==='DRAFT')h+='<div class="review-note reject"><b>Yêu cầu chỉnh sửa, bổ sung</b> — '+esc(r.by||'')+' · '+esc(fmt(r.at))+'<br>'+esc(r.comment||'')+'</div>';
 else if(r&&r.action==='ESCALATE'&&x.status==='SUBMITTED')h+='<div class="review-note"><b>Trưởng TVGS đã trình công ty</b> — '+esc(r.by||'')+' · '+esc(fmt(r.at))+'<br>'+esc(r.comment||'')+'</div>';
 else if(r&&r.action==='APPROVE'&&r.comment)h+='<div class="review-note approve"><b>Ý kiến khi phê duyệt</b> — '+esc(r.by||'')+' · '+esc(fmt(r.at))+'<br>'+esc(r.comment)+'</div>';
 if(history&&x?.serverId)h+='<details style="margin:6px 0"><summary>Lịch sử duyệt</summary><ol class="review-history" id="reviewHistory"><li class="muted">Đang tải...</li></ol></details>';
 return h;
}
async function loadReviewHistory(kind,id){
 const el=document.getElementById('reviewHistory');if(!el)return;
 let rows;try{rows=await apiRequest('/reviews/'+kind+'/'+encodeURIComponent(id))}catch(error){el.innerHTML='<li class="muted">Không tải được: '+esc(error.message)+'</li>';return}
 if(!rows.length){el.innerHTML='<li class="muted">Chưa gửi duyệt lần nào.</li>';return}
 el.innerHTML=rows.map(n=>'<li><b>'+esc(REVIEW_ACTION[n.action]||n.action)+'</b> — '+esc(n.actor_name||'')+' · '+esc(fmt(n.created_at))+(n.comment?'<div class="pre" style="white-space:pre-wrap;color:#475467">'+esc(n.comment)+'</div>':'')+'</li>').join('');
}
function reviewItem(kind,id){
 const fromInbox=[...(inboxData?.to_review||[]),...(inboxData?.escalated||[]),...(inboxData?.monitor||[])].find(v=>v.kind===kind&&v.id===id);
 const lastOf=local=>fromInbox?.last_action?{action:fromInbox.last_action,comment:fromInbox.last_comment,by:fromInbox.last_by,at:fromInbox.last_at}:(local?.lastReview||null);
 if(kind==='documents'){const d=(db.docs||[]).find(v=>v.id===id);return {title:d?((d.code||'')+' — '+(d.name||'')):((fromInbox?.code||'')+' — '+(fromInbox?.title||'')),by:d?.createdBy||fromInbox?.created_by_name||'',at:d?.submittedAt||fromInbox?.submitted_at||'',local:d,projectId:d?.projectId||fromInbox?.project_id,last:lastOf(d),extra:''}}
 const l=(db.logs||[]).find(v=>v.serverId===id);const p=(db.projects||[]).find(v=>v.id===(l?.projectId||fromInbox?.project_id))||{};
 const date=l?.date||fromInbox?.log_date||'',shift=l?.shift||fromInbox?.shift||'';
 return {title:'Nhật ký '+progressDate(date)+' — '+shiftLabel(shift)+(p.name?' · '+p.name:''),by:l?.createdBy||fromInbox?.created_by_name||'',at:l?.submittedAt||fromInbox?.submitted_at||'',local:l,projectId:l?.projectId||fromInbox?.project_id,last:lastOf(l),
  extra:l?'<p><b>Công việc:</b> '+esc(l.work||'')+'</p><p class="muted">Thời tiết: '+esc(l.weather||'—')+' · Nhân lực: '+Number(l.workers||0)+' · Máy: '+Number(l.machines||0)+(l.note?' · Ghi chú: '+esc(l.note):'')+'</p>'+((l.fileCount||l.photoCount)?'<button type="button" onclick="showLogFiles(\''+l.id+'\')">Xem tệp/ảnh ('+((l.fileCount||0)+(l.photoCount||0))+')</button>':''):'<p class="muted">'+esc(fromInbox?.title||'')+'</p>'};
}
function openReviewDecision(kind,id,preset){
 if(!apiOnline())return alert('Cần kết nối mạng để duyệt.');
 const it=reviewItem(kind,id);const k=JSON.stringify(kind).replace(/"/g,'&quot;'),i=JSON.stringify(id).replace(/"/g,'&quot;');
 const viewBtn=kind==='documents'&&it.local?'<button type="button" onclick="viewDoc('+i+')">Xem toàn văn</button>':'';
 const company=canManageAssignments();const escalated=it.last?.action==='ESCALATE';
 if(escalated&&!company)return alert('Bản này đã trình công ty — chờ Giám đốc/Admin quyết định.');
 const escNote=escalated?'<div class="review-note"><b>Trưởng TVGS trình công ty</b> — '+esc(it.last.by||'')+' · '+esc(fmt(it.last.at))+'<br>'+esc(it.last.comment||'')+'</div>':'';
 openModal(company?'Quyết định của công ty':'Xem xét và phê duyệt',escNote+'<div class="card"><p><b>'+esc(it.title)+'</b></p><p class="muted">Người lập: '+esc(it.by||'—')+(it.at?' · Gửi duyệt lúc '+esc(fmt(it.at)):'')+'</p>'+it.extra+viewBtn+'</div>'
  +'<label for="rvComment">'+(company?'Ý kiến của Giám đốc/công ty':'Ý kiến của Trưởng TVGS')+'</label><textarea id="rvComment" rows="5" maxlength="4000" placeholder="Phê duyệt: ý kiến không bắt buộc.\nYêu cầu chỉnh sửa, bổ sung: BẮT BUỘC ghi rõ mục cần sửa, số liệu sai, tài liệu cần bổ sung...'+(company?'':'\nTrình công ty (việc vượt thẩm quyền): BẮT BUỘC ghi nội dung cần công ty quyết định.')+'"></textarea>'
  +'<div class="toolbar"><button class="primary" onclick="submitReviewDecision('+k+','+i+',\'approve\')">✔ Phê duyệt</button><button class="danger" onclick="submitReviewDecision('+k+','+i+',\'reject\')">↩ Yêu cầu chỉnh sửa, bổ sung</button>'
  +(company?'':'<button onclick="submitReviewDecision('+k+','+i+',\'escalate\')" title="Việc vượt thẩm quyền của Trưởng TVGS">⇪ Trình công ty</button>')+'</div><div id="rvMsg" class="muted"></div>');
 if(preset==='reject')setTimeout(()=>document.getElementById('rvComment')?.focus(),50);
}
async function submitReviewDecision(kind,id,action){
 const comment=(document.getElementById('rvComment')?.value||'').trim();const msg=document.getElementById('rvMsg');const say=t=>{if(msg)msg.textContent=t};
 if(action==='reject'&&comment.length<3){say('Nhập nội dung yêu cầu chỉnh sửa, bổ sung để người lập biết cần sửa gì.');document.getElementById('rvComment')?.focus();return}
 if(action==='escalate'&&comment.length<3){say('Nhập nội dung cần công ty quyết định (vì sao vượt thẩm quyền).');document.getElementById('rvComment')?.focus();return}
 document.querySelectorAll('#mbody .toolbar button').forEach(b=>b.disabled=true);say('Đang gửi...');
 try{
  const r=await apiRequest('/'+(kind==='documents'?'documents':'daily-logs')+'/'+encodeURIComponent(id)+'/'+action,{method:'POST',body:JSON.stringify({comment})});
  const review={action:action.toUpperCase(),comment,by:meName(),at:new Date().toISOString()};
  if(kind==='documents')upsertLocalDoc(mapDocumentFromApi(r));
  else{const l=(db.logs||[]).find(v=>v.serverId===id);if(l){l.status=r.status;l.version=Number(r.version||l.version||1);l.canEdit=false;l.lastReview=review}}
  audit(action.toUpperCase(),kind,id,comment);save();
  closeModal();renderLogs();renderDocs();if(typeof renderReports==='function')renderReports();
  await loadInbox();
 }catch(error){say('Không thực hiện được: '+error.message);document.querySelectorAll('#mbody .toolbar button').forEach(b=>b.disabled=false)}
}

// ---- Việc cần duyệt ----
let inboxData=null;
function inboxKindLabel(it){if(it.kind==='daily_logs')return 'Nhật ký';return it.doc_group==='REPORT'?((typeof REPORT_TYPES!=='undefined'&&REPORT_TYPES[it.report_type])||'Báo cáo'):'Hồ sơ'}
function inboxContent(it){return it.kind==='daily_logs'?progressDate(it.log_date)+' — '+shiftLabel(it.shift)+(it.title?'<br><span class="muted">'+esc(it.title)+'</span>':''):esc(it.code||'')+' — '+esc(it.title||'')}
async function loadInbox(){
 if(!getAuthToken()||!apiOnline()||window.__forcePw)return;
 try{inboxData=await apiRequest('/reviews/inbox')}
 catch(error){const el=document.getElementById('inboxBody');if(el)el.innerHTML='<p class="muted">Không tải được: '+esc(error.message)+'</p>';return}
 applyInboxNavVisibility();updateInboxBadge();renderInbox();
}
function updateInboxBadge(){
 const c=inboxData?.counts||{};const reviewer=isReviewer();
 const b=document.getElementById('inboxBadge');if(b)b.textContent=reviewer&&(c.to_review||0)+(c.returned||0)?String((c.to_review||0)+(c.returned||0)):'';
 const main=document.querySelector('main');let ban=document.getElementById('inboxBanner');
 const parts=[];
 if(reviewer&&c.to_review)parts.push('<b>'+c.to_review+'</b> '+(inboxData?.is_company?'việc trình công ty / công trình chưa có Trưởng TVGS':'báo cáo/hồ sơ/nhật ký đang chờ bạn phê duyệt'));
 if(c.returned)parts.push('<b>'+c.returned+'</b> bản của bạn bị yêu cầu chỉnh sửa, bổ sung');
 if(!parts.length||document.getElementById('inbox')?.classList.contains('active')){if(ban)ban.remove();return}
 // Người không có quyền duyệt không có mục "Việc cần duyệt" → mở danh sách bản bị trả lại trong cửa sổ
 const html='✉ Có '+parts.join(' · ')+'. <button onclick="'+(reviewer?'openInboxPage()':'openReturnedModal()')+'">Xem ngay</button>';
 if(ban)ban.innerHTML=html;else if(main)main.insertAdjacentHTML('afterbegin','<div id="inboxBanner" class="notice" style="margin-bottom:12px;background:#fffaeb;border-color:#fedf89">'+html+'</div>');
}
function openInboxPage(){if(!isReviewer())return openReturnedModal();currentProjectId=null;goPage('inbox');document.getElementById('inboxBanner')?.remove();renderInbox();void loadInbox()}
function inboxTable(list,{action=true,note=false}={}){
 const k=v=>JSON.stringify(v).replace(/"/g,'&quot;');
 return '<table><thead><tr><th>Loại</th><th>Nội dung</th><th>Công trình</th><th>Người lập</th><th>Gửi lúc</th>'+(note?'<th>Trưởng TVGS trình</th>':'')+'<th></th></tr></thead><tbody>'+list.map(it=>'<tr><td>'+esc(inboxKindLabel(it))+(it.reason==='NO_APPROVER'?'<br><span class="chip warn">Công trình chưa có Trưởng TVGS</span>':'')+'</td><td>'+inboxContent(it)+'</td><td>'+esc(it.project_name||'')+'</td><td>'+esc(it.created_by_name||'')+'</td><td>'+esc(fmt(it.submitted_at))+'</td>'+(note?'<td>'+(it.last_action==='ESCALATE'?'<div class="review-note" style="margin:0">'+esc(it.last_comment||'')+'<br><span class="muted">'+esc(it.last_by||'')+' · '+esc(fmt(it.last_at))+'</span></div>':'')+'</td>':'')+'<td>'+(action?'<button class="primary" onclick="openReviewDecision('+k(it.kind)+','+k(it.id)+')">Xem xét</button>':'')+'</td></tr>').join('')+'</tbody></table>';
}
function returnedHtml(){
 const k=v=>JSON.stringify(v).replace(/"/g,'&quot;');const ret=inboxData?.returned||[];
 return ret.length?'<table><thead><tr><th>Loại</th><th>Nội dung</th><th>Công trình</th><th>Yêu cầu</th><th></th></tr></thead><tbody>'+ret.map(it=>'<tr><td>'+esc(inboxKindLabel(it))+'</td><td>'+inboxContent(it)+'</td><td>'+esc(it.project_name||'')+'</td><td><div class="review-note reject" style="margin:0">'+esc(it.comment||'')+'<br><span class="muted">'+esc(it.reviewer_name||'')+' · '+esc(fmt(it.reviewed_at))+'</span></div></td><td><button class="primary" onclick="closeModal();openReturnedItem('+k(it.kind)+','+k(it.id)+')">Sửa và gửi lại</button></td></tr>').join('')+'</tbody></table>':'<p class="muted">Không có bản nào bị trả lại.</p>';
}
function openReturnedModal(){document.getElementById('inboxBanner')?.remove();openModal('Bản của tôi bị yêu cầu chỉnh sửa, bổ sung',returnedHtml());document.querySelector('#modal .modalbox')?.classList.add('wide')}
function renderInbox(){
 const el=document.getElementById('inboxBody');if(!el)return;if(!inboxData){el.innerHTML='<p class="muted">'+(apiOnline()?'Đang tải...':'Cần kết nối mạng.')+'</p>';return}
 let h='';
 if(inboxData.is_company){
  const list=inboxData.to_review||[],mon=inboxData.monitor||[];
  h+='<div class="card"><h3>Trình công ty / cần công ty quyết định ('+list.length+')</h3><p class="muted">Việc Trưởng TVGS trình vì vượt thẩm quyền, và bản chờ duyệt ở công trình chưa có ai được quyền Duyệt.</p>'+(list.length?inboxTable(list,{note:true}):'<p class="muted">Không có việc cần công ty quyết định.</p>')+'</div>';
  h+='<details class="card" style="margin-top:14px"><summary><b>Theo dõi: đang chờ Trưởng TVGS các công trình duyệt ('+mon.length+')</b></summary><p class="muted">Trưởng TVGS quyết định tại công trình; công ty chỉ theo dõi. Có thể quyết định thay nếu cần.</p>'+(mon.length?inboxTable(mon):'<p class="muted">Không có.</p>')+'</details>';
 }else{
  const list=inboxData.to_review||[],esc2=inboxData.escalated||[];
  h+='<div class="card"><h3>Chờ tôi phê duyệt ('+list.length+')</h3>'+(list.length?inboxTable(list):'<p class="muted">Không có bản nào đang chờ duyệt.</p>')+'</div>';
  if(esc2.length)h+='<div class="card" style="margin-top:14px"><h3>Đã trình công ty — chờ Giám đốc quyết định ('+esc2.length+')</h3>'+inboxTable(esc2,{action:false,note:true})+'</div>';
 }
 const ret=inboxData.returned||[];
 if(ret.length)h+='<div class="card" style="margin-top:14px"><h3>Của tôi — bị yêu cầu chỉnh sửa, bổ sung ('+ret.length+')</h3>'+returnedHtml()+'</div>';
 const ok=inboxData.approved||[];
 if(ok.length)h+='<div class="card" style="margin-top:14px"><h3>Của tôi — đã được phê duyệt (7 ngày gần đây)</h3><ul>'+ok.map(it=>'<li><span class="chip ok">Đã duyệt</span> '+esc(inboxKindLabel(it))+': '+inboxContent(it)+' <span class="muted">— '+esc(it.reviewer_name||'')+' · '+esc(fmt(it.reviewed_at))+(it.comment?' · “'+esc(it.comment)+'”':'')+'</span></li>').join('')+'</ul></div>';
 el.innerHTML=h;
}
async function openReturnedItem(kind,id){
 if(kind==='documents'){
  let d=(db.docs||[]).find(v=>v.id===id);
  if(!d){try{d=mapDocumentFromApi(await apiRequest('/documents/'+encodeURIComponent(id)));upsertLocalDoc(d);save()}catch(error){return alert('Không mở được: '+error.message)}}
  return d.details?.snapshot?openReport(id):openDoc(id);
 }
 const l=(db.logs||[]).find(v=>v.serverId===id);
 if(!l)return alert('Nhật ký chưa tải về thiết bị này. Hãy tải lại trang (Ctrl+F5) rồi thử lại.');
 openLog(l.id);
}

// ---- Bắt đổi mật khẩu ban đầu ----
window.forcePasswordChange=function(){
 if(window.__forcePw)return;
 openChangePassword();
 document.getElementById('mtitle').textContent='Đổi mật khẩu ban đầu';
 document.getElementById('mbody').insertAdjacentHTML('afterbegin','<div class="notice" style="margin-bottom:10px">Tài khoản đang dùng <b>mật khẩu ban đầu/mật khẩu tạm</b> do quản trị cấp. Hãy đặt mật khẩu mới của riêng bạn để tiếp tục. (Mật khẩu hiện tại = mật khẩu trên phiếu tài khoản.)</div>');
 document.getElementById('mbody').insertAdjacentHTML('beforeend','<p style="margin-top:10px"><button type="button" onclick="window.__forcePw=false;vinaLogout()">Đăng xuất</button></p>');
 const x=document.querySelector('#modal .modalbox > div button');if(x)x.style.display='none';
 window.__forcePw=true;
};

document.querySelector('nav button[data-page="inbox"]')?.addEventListener('click',()=>{document.getElementById('inboxBanner')?.remove();renderInbox();void loadInbox()});
// ============================================================================
// TỔNG QUAN TIẾN ĐỘ & CẢNH BÁO (bản 2026-10-04)
// Admin/Giám đốc: toàn bộ công trình · Thành viên: chỉ công trình được phân công (máy chủ lọc)
// ============================================================================
const HEALTH_LABEL={RED:'Nghiêm trọng',AMBER:'Cần chú ý',GREEN:'Bình thường',DONE:'Hoàn thành',PAUSED:'Tạm dừng',UNKNOWN:'Chưa rõ'};
const SEV_LABEL={CRITICAL:'Nghiêm trọng',WARNING:'Cảnh báo',INFO:'Thông tin'};
let portfolioData=null;
function healthChip(h){return '<span class="health '+esc(h||'UNKNOWN')+'">'+esc(HEALTH_LABEL[h]||h||'')+'</span>'}
function pctBar(planned,actual,health){
 if(planned==null&&actual==null)return '<span class="muted">—</span>';
 const color={RED:'#d92d20',AMBER:'#f79009',GREEN:'#12b76a'}[health]||'#2e90fa';
 return '<div class="pbar" title="Kế hoạch '+planned+'% · Thực tế '+actual+'%"><span class="ac" style="width:'+Math.max(0,Math.min(100,Number(actual)||0))+'%;background:'+color+'"></span><span class="pl" style="left:calc('+Math.max(0,Math.min(100,Number(planned)||0))+'% - 1px)"></span></div><div class="muted" style="font-size:12px;margin-top:3px">KH '+(planned??'—')+'% · TT <b>'+(actual??'—')+'%</b></div>';
}
function signed(v){return v==null?'—':(v>0?'+':'')+v}
function alertItemHtml(a,p){
 const k=v=>JSON.stringify(v).replace(/"/g,'&quot;');
 return '<div class="alert-item" onclick="goAlertTarget('+k(p?.id||'')+','+k(a.target||'project')+')"><span class="sev '+esc(a.severity)+'">'+esc(SEV_LABEL[a.severity]||a.severity)+'</span><div>'+(p?'<b>'+esc(p.code||'')+' — '+esc(p.name||'')+':</b> ':'')+'<b>'+esc(a.title)+'</b>'+(a.detail?'<div class="muted" style="font-size:12px">'+esc(a.detail)+'</div>':'')+'</div></div>';
}
function goAlertTarget(pid,target){
 if(target==='inbox'&&typeof isReviewer==='function'&&isReviewer())return openInboxPage();
 if(!pid)return;
 if(target==='daily'||target==='issues'){currentProjectId=pid;return openProjectSection(target)}
 if(target==='reports'){goPage('reports');const sel=document.getElementById('reportProject');if(sel){sel.value=pid;}if(typeof renderReports==='function')renderReports();return}
 openProjectDetail(pid);
 if(target==='progress')setTimeout(()=>document.getElementById('pdProgress')?.scrollIntoView({behavior:'smooth'}),400);
}
async function loadPortfolio(force){
 if(typeof getAuthToken!=='function'||!getAuthToken()||!apiOnline()||window.__forcePw)return;
 const box=document.getElementById('portfolioBox');if(force&&box)box.innerHTML='<p class="muted">Đang tổng hợp...</p>';
 try{portfolioData=await apiRequest('/reports/portfolio')}
 catch(error){if(box)box.innerHTML='<p class="muted">Không tải được tổng quan: '+esc(error.message)+'</p>';return}
 const b=document.getElementById('alertBadge');if(b)b.textContent=portfolioData.summary.critical?String(portfolioData.summary.critical):'';
 renderPortfolio();
}
function renderPortfolio(){
 const box=document.getElementById('portfolioBox');if(!box)return;
 const admin=canManageAssignments();
 const t=document.getElementById('pfTitle');if(t)t.textContent=admin?'Tổng quan tiến độ toàn bộ công trình':'Tiến độ công trình được phân công';
 if(!portfolioData){box.innerHTML='<p class="muted">'+(apiOnline()?'Đang tổng hợp...':'Cần kết nối mạng để xem tổng quan tiến độ.')+'</p>';return}
 const d=portfolioData,sm=d.summary,f=document.getElementById('pfFilter')?.value||'';
 const list=d.projects.filter(p=>!f||p.health===f);
 let h='<div class="grid g4"><div class="card"><div class="muted">'+(admin?'Công trình':'Công trình của tôi')+'</div><div class="kpi">'+sm.projects+'</div></div>'
  +'<div class="card"><div class="muted">● Nghiêm trọng (đỏ)</div><div class="kpi red">'+sm.red+'</div></div>'
  +'<div class="card"><div class="muted">● Cần chú ý (vàng)</div><div class="kpi amber">'+sm.amber+'</div></div>'
  +'<div class="card"><div class="muted">● Bình thường (xanh)</div><div class="kpi green">'+sm.green+'</div></div></div>';
 h+='<div class="card" style="margin-top:14px"><h3>Tình trạng từng công trình <span class="muted" style="font-weight:400;font-size:13px">— tính đến '+progressDate(d.as_of)+'</span></h3>'
  +(list.length?'<div style="overflow:auto"><table><thead><tr><th>Trạng thái</th><th>Công trình</th><th>Kế hoạch / Thực tế</th><th>Lệch</th><th>SPI</th><th>Dự báo xong · Hạn</th><th>Nhật ký gần nhất</th><th>Chờ duyệt</th><th>Cảnh báo</th></tr></thead><tbody>'
  +list.map(p=>{const pl=p.plan||{};const al=(p.alerts||[]).filter(a=>a.severity!=='INFO');
    return '<tr class="clickable" onclick="openProjectDetail(\''+p.id+'\')"><td>'+healthChip(p.health)+'</td><td><b>'+esc(p.code||'')+'</b> — '+esc(p.name||'')+(pl.name?'<br><span class="muted" style="font-size:12px">'+esc(pl.name)+'</span>':'')+'</td>'
     +'<td>'+(p.plan?pctBar(pl.planned,pl.actual,p.health):'<span class="muted">Chưa có bảng tiến độ</span>')+'</td>'
     +'<td style="color:'+((pl.variance||0)<0?'#b42318':'#067647')+'">'+(p.plan?signed(pl.variance):'—')+'</td><td>'+(pl.spi??'—')+'</td>'
     +'<td style="font-size:12px">'+(pl.forecast_end?'<b'+(pl.contract_end&&pl.forecast_end>pl.contract_end?' style="color:#b42318"':'')+'>'+progressDate(pl.forecast_end)+'</b>':'—')+'<br><span class="muted">Hạn '+(pl.contract_end?progressDate(pl.contract_end):'—')+'</span></td>'
     +'<td style="font-size:12px">'+(p.logs?.last_date?progressDate(p.logs.last_date):'—')+(p.logs?.missing_days?.length?'<br><span style="color:#b54708">thiếu '+p.logs.missing_days.length+' ngày</span>':'')+'</td>'
     +'<td>'+(p.approvals?.pending?'<b>'+p.approvals.pending+'</b><br><span class="muted" style="font-size:12px">lâu nhất '+p.approvals.oldest_days+' ngày</span>':'—')+'</td>'
     +'<td style="font-size:12px">'+(al.length?al.slice(0,2).map(a=>'<span class="sev '+a.severity+'" style="display:inline-block;margin:1px 0;padding:1px 6px;border-radius:99px">'+esc(a.title)+'</span>').join('<br>')+(al.length>2?'<br><span class="muted">+'+(al.length-2)+' cảnh báo khác</span>':''):'<span class="muted">—</span>')+'</td></tr>'}).join('')
  +'</tbody></table></div>':'<p class="muted">'+(d.projects.length?'Không có công trình ở trạng thái này.':(admin?'Chưa có công trình.':'Bạn chưa được phân công công trình nào.'))+'</p>')+'</div>';
 const alerts=d.projects.flatMap(p=>(p.alerts||[]).filter(a=>a.severity!=='INFO').map(a=>({a,p}))).filter(x=>!f||x.p.health===f);
 const order={CRITICAL:0,WARNING:1};alerts.sort((x,y)=>order[x.a.severity]-order[y.a.severity]);
 h+='<div class="card" style="margin-top:14px"><h3>Cảnh báo cần xử lý ('+alerts.length+')</h3>'+(alerts.length?alerts.map(x=>alertItemHtml(x.a,x.p)).join(''):'<p class="muted">Không có cảnh báo. 👍</p>')
  +'<details style="margin-top:8px"><summary class="muted">Cách hệ thống đánh giá</summary><ul class="muted" style="font-size:13px">'
  +'<li><b>Tiến độ</b> (chuẩn EVM, như Primavera P6 / MS Project): SPI = % thực tế ÷ % kế hoạch. SPI &lt; '+d.thresholds.spiWarn+' hoặc chậm ≥ '+(-d.thresholds.varianceWarn)+' điểm % → cảnh báo; SPI &lt; '+d.thresholds.spiCrit+' hoặc chậm ≥ '+(-d.thresholds.varianceCrit)+' điểm → nghiêm trọng. Hạng mục quá hạn chưa xong → nghiêm trọng.</li>'
  +'<li><b>Dự báo hoàn thành</b> = thời gian kế hoạch ÷ SPI; trễ hơn hạn hợp đồng → nghiêm trọng.</li>'
  +'<li><b>Cập nhật thực tế</b>: quá '+d.thresholds.staleWarnDays+' ngày chưa cập nhật % thực tế → cảnh báo, quá '+d.thresholds.staleCritDays+' ngày → nghiêm trọng.</li>'
  +'<li><b>Nhật ký hằng ngày</b> (như Procore Daily Log): trong '+d.thresholds.logWindowDays+' ngày qua (trừ Chủ nhật) thiếu ≥ '+d.thresholds.logMissWarn+' ngày → cảnh báo, ≥ '+d.thresholds.logMissCrit+' ngày → nghiêm trọng.</li>'
  +'<li><b>Chờ duyệt quá hạn</b> (như Aconex workflow): quá '+d.thresholds.approvalWarnDays+' ngày → cảnh báo, quá '+d.thresholds.approvalCritDays+' ngày → nghiêm trọng. <b>Vấn đề chất lượng</b> quá hạn xử lý → nghiêm trọng.</li>'
  +'<li><b>Báo cáo định kỳ</b>: từ Thứ Tư chưa có báo cáo tuần trước, sau ngày 5 chưa có báo cáo tháng trước → cảnh báo. <b>Kế hoạch '+d.thresholds.lookaheadDays+' ngày tới</b> (look-ahead): hạng mục sắp bắt đầu → thông tin.</li>'
  +'</ul></details></div>';
 box.innerHTML=h;
}
async function loadProjectHealth(pid){
 const el=document.getElementById('pdHealth');if(!el)return;el.innerHTML='';
 if(!apiOnline())return;
 let d;try{d=await apiRequest('/reports/health/'+encodeURIComponent(pid))}catch(_){return}
 if(currentProjectId!==pid)return;
 const pl=d.plan||{};const al=d.alerts||[];
 el.innerHTML='<div class="card" style="margin-bottom:14px"><div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap"><h3 style="margin:0">Tình trạng công trình</h3>'+healthChip(d.health)
  +(d.plan?'<div style="min-width:200px">'+pctBar(pl.planned,pl.actual,d.health)+'</div><span>Lệch <b>'+signed(pl.variance)+'</b> điểm · SPI <b>'+(pl.spi??'—')+'</b>'+(pl.forecast_end?' · Dự báo xong <b>'+progressDate(pl.forecast_end)+'</b>':'')+(pl.contract_end?' · Hạn '+progressDate(pl.contract_end):'')+'</span>':'')+'</div>'
  +(al.length?al.map(a=>alertItemHtml(a,null).replace('goAlertTarget(&quot;&quot;','goAlertTarget(&quot;'+pid+'&quot;')).join(''):'<p class="muted" style="margin:8px 0 0">Không có cảnh báo.</p>')+'</div>';
}

// ---- Báo cáo tuần/tháng: so sánh hạng mục với bảng tiến độ; nhập hoặc lấy tự động % thực tế ----
function reportItemsTableHtml(s){
 const pr=s?.progress;if(!pr||pr.mode!=='ITEMS'||s.type==='DAILY'||!(pr.items||[]).length)return '';
 const list=pr.items.filter(i=>i.in_period!==undefined?i.in_period:i.status!=='CHUA_DEN_HAN');if(!list.length)return '';
 const td=v=>'<td>'+esc(v??'')+'</td>';
 return '<p><b>So sánh các hạng mục thực hiện trong kỳ với bảng tiến độ (đến ngày '+progressDate(pr.as_of)+'):</b></p><table class="rp"><thead><tr><th>Hạng mục</th><th>Thời gian kế hoạch</th><th>KH</th><th>TT</th><th>Lệch (điểm)</th><th>Đánh giá</th></tr></thead><tbody>'
  +list.map(i=>'<tr>'+td((i.code?i.code+'. ':'')+i.name)+td(i.start_date?progressDate(i.start_date)+' → '+progressDate(i.end_date):'')+td(i.planned+'%')+td(i.actual+'%')+td(i.variance!=null?signed(i.variance):signed(Math.round((i.actual-i.planned)*100)/100))+td((ITEM_STATUS[i.status]||[i.status])[0])+'</tr>').join('')+'</tbody></table>';
}
function reportAlertsHtml(s){
 if(!Array.isArray(s?.alerts))return '';
 const a=s.alerts.filter(x=>x.severity!=='INFO');
 return '<h3>Cảnh báo tự động tại ngày '+progressDate(s.progress?.as_of||s.period?.to)+'</h3>'+(a.length?'<table class="rp"><thead><tr><th style="width:15%">Mức</th><th style="width:30%">Nội dung</th><th>Chi tiết</th></tr></thead><tbody>'+a.map(x=>'<tr><td>'+esc(SEV_LABEL[x.severity]||x.severity)+'</td><td>'+esc(x.title)+'</td><td>'+esc(x.detail||'')+'</td></tr>').join('')+'</tbody></table>':'<p class="muted">Không có cảnh báo.</p>');
}
function reportProgressInputHtml(s){
 const pr=s?.progress;if(!pr||s.type==='DAILY')return '';
 if(pr.mode!=='ITEMS')return '<div class="notice" style="margin:12px 0">Bảng tiến độ hiện hành chưa có danh sách hạng mục nên chưa so sánh chi tiết được. Vào <b>Chi tiết công trình → Tiến độ thi công</b> để nhập hạng mục (Excel).</div>';
 const rows=(pr.items||[]).filter(i=>i.id&&(i.in_period||(i.start_date<=pr.as_of&&i.actual<100)));
 if(!rows.length)return (pr.items||[]).some(i=>!i.id)?'<p class="muted">Bấm "Tổng hợp số liệu" lại để nhập tiến độ thực tế theo hạng mục.</p>':'';
 return '<h4 style="margin:14px 0 6px">Tiến độ thực tế đến ngày '+progressDate(pr.as_of)+' — so với bảng tiến độ "'+esc(pr.plan_name)+'"</h4>'
  +'<label class="inline"><input type="radio" name="rpActMode" value="AUTO" checked onchange="toggleRpActMode()"> Lấy tự động (số liệu thực tế đã cập nhật gần nhất)</label>'
  +'<label class="inline"><input type="radio" name="rpActMode" value="MANUAL" onchange="toggleRpActMode()"> Nhập / điều chỉnh % thực tế trong báo cáo này <span class="muted">(ghi vào bảng tiến độ tại ngày '+progressDate(pr.as_of)+', số liệu báo cáo tự tổng hợp lại khi lưu)</span></label>'
  +'<div style="max-height:42vh;overflow:auto"><table><thead><tr><th>Hạng mục</th><th>Thời gian KH</th><th>Tỷ trọng</th><th>KH đến ngày</th><th>TT gần nhất</th><th>TT đến ngày (%)</th><th>Lệch</th></tr></thead><tbody>'
  +rows.map(i=>'<tr><td>'+esc((i.code?i.code+'. ':'')+i.name)+'</td><td style="font-size:12px">'+progressDate(i.start_date)+' → '+progressDate(i.end_date)+'</td><td>'+(i.weight_share??'')+'%</td><td>'+i.planned+'%</td><td>'+i.actual+'%'+(i.actual_date?'<br><span class="muted" style="font-size:11px">'+progressDate(i.actual_date)+'</span>':'')+'</td>'
   +'<td><input type="number" class="rpAct" data-item="'+esc(i.id)+'" data-planned="'+i.planned+'" data-orig="'+i.actual+'" min="0" max="100" step="0.5" value="'+i.actual+'" disabled style="width:90px" oninput="rpActChanged(this)"></td><td class="rpVar" style="color:'+(i.actual-i.planned<-5?'#b42318':'inherit')+'">'+signed(Math.round((i.actual-i.planned)*100)/100)+'</td></tr>').join('')
  +'</tbody></table></div><p class="muted" style="font-size:12px">Hiện các hạng mục thực hiện trong kỳ hoặc đã bắt đầu mà chưa hoàn thành. Lệch &lt; −5 điểm được tô đỏ (chậm).</p>';
}
function toggleRpActMode(){const manual=document.querySelector('input[name="rpActMode"]:checked')?.value==='MANUAL';document.querySelectorAll('.rpAct').forEach(i=>i.disabled=!manual)}
function rpActChanged(input){const v=Number(input.value),p=Number(input.dataset.planned);const cell=input.closest('tr')?.querySelector('.rpVar');if(cell&&Number.isFinite(v)){const d=Math.round((v-p)*100)/100;cell.textContent=signed(d);cell.style.color=d<-5?'#b42318':'inherit'}input.style.background=String(input.value)!==String(input.dataset.orig)?'#fffaeb':''}
function collectReportActuals(){
 if(document.querySelector('input[name="rpActMode"]:checked')?.value!=='MANUAL')return [];
 const rows=[];
 for(const i of document.querySelectorAll('.rpAct')){
  if(String(i.value)===String(i.dataset.orig))continue;
  const v=Number(i.value);if(!(v>=0&&v<=100))throw new Error('Tỷ lệ thực tế phải trong khoảng 0–100%');
  rows.push({item_id:i.dataset.item,actual_percent:v});
 }
 return rows;
}
document.querySelector('nav button[data-page="dashboard"]')?.addEventListener('click',()=>{renderPortfolio();void loadPortfolio()});

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
