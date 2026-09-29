const ITEM_STATUS={CHUA_DEN_HAN:['Chưa đến hạn','#667085','#f2f4f7'],DUNG_TIEN_DO:['Đúng tiến độ','#027a48','#ecfdf3'],VUOT:['Vượt tiến độ','#175cd3','#eff8ff'],CHAM:['Chậm','#b54708','#fffaeb'],QUA_HAN:['Quá hạn','#b42318','#fef3f2'],HOAN_THANH:['Hoàn thành','#027a48','#ecfdf3']};
let progressEditor=null; // trạng thái cửa sổ sửa bảng tiến độ
function progressDate(value){if(!value)return '—';const s=String(value).slice(0,10);const m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?m[3]+'/'+m[2]+'/'+m[1]:s}
function statusChip(s){const x=ITEM_STATUS[s]||[s,'#344054','#f2f4f7'];return '<span class="chip" style="color:'+x[1]+';background:'+x[2]+'">'+esc(x[0])+'</span>'}

async function loadProjectProgressPlans(projectId,asOf){
 if(!projectId||!apiOnline())return;
 try{
  const plans=await apiRequest('/projects/'+encodeURIComponent(projectId)+'/progress-plans');
  db.progressPlans=db.progressPlans||{};db.progressPlans[projectId]=Array.isArray(plans)?plans:[];
  const current=db.progressPlans[projectId].find(x=>x.is_current)||db.progressPlans[projectId][0];
  db.progressDetail=db.progressDetail||{};
  if(current){db.progressDetail[projectId]=await apiRequest('/projects/'+encodeURIComponent(projectId)+'/progress-plans/'+encodeURIComponent(current.id)+(asOf?'?as_of='+asOf:''))}
  else delete db.progressDetail[projectId];
  persistLocal();
  if(currentProjectId===projectId){const p=db.projects.find(x=>x.id===projectId);if(p)renderProjectProgress(p)}
 }catch(error){console.warn('Không tải được bảng tiến độ:',error.message)}
}
async function syncInitialProgressPlans(){
 if(!apiOnline())return;const pending=db.pendingInitialProgressPlans||{};
 for(const [projectId,plan] of Object.entries(pending)){
  try{await apiRequest('/projects/'+encodeURIComponent(projectId)+'/progress-plans',{method:'POST',body:JSON.stringify(plan)});delete db.pendingInitialProgressPlans[projectId];save()}
  catch(error){console.warn('Chưa đồng bộ được bảng tiến độ cơ sở:',error.message)}
 }
}
function sCurveSvg(curve,asOf){
 if(!curve||curve.length<2)return '';
 const W=640,H=200,P={l:34,r:10,t:10,b:24};const n=curve.length;
 const x=i=>P.l+(W-P.l-P.r)*i/(n-1),y=v=>P.t+(H-P.t-P.b)*(1-v/100);
 const line=(key,color,dash)=>{const pts=curve.map((c,i)=>c[key]===undefined?null:[x(i),y(c[key])]).filter(Boolean);if(pts.length<2)return '';return '<polyline fill="none" stroke="'+color+'" stroke-width="2.5"'+(dash?' stroke-dasharray="6 4"':'')+' points="'+pts.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ')+'"/>'};
 let grid='';for(const v of [0,25,50,75,100])grid+='<line x1="'+P.l+'" x2="'+(W-P.r)+'" y1="'+y(v)+'" y2="'+y(v)+'" stroke="#eaecf0"/><text x="'+(P.l-6)+'" y="'+(y(v)+4)+'" font-size="10" text-anchor="end" fill="#667085">'+v+'%</text>';
 const labels=[0,Math.floor((n-1)/2),n-1].map(i=>'<text x="'+x(i)+'" y="'+(H-6)+'" font-size="10" text-anchor="'+(i===0?'start':i===n-1?'end':'middle')+'" fill="#667085">'+progressDate(curve[i].date)+'</text>').join('');
 let marker='';const idx=curve.findIndex(c=>c.date>=asOf);if(idx>=0)marker='<line x1="'+x(idx)+'" x2="'+x(idx)+'" y1="'+P.t+'" y2="'+(H-P.b)+'" stroke="#98a2b3" stroke-dasharray="2 3"/>';
 return '<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;max-width:720px;height:auto" role="img" aria-label="Đường cong tiến độ kế hoạch và thực tế">'+grid+marker+line('planned','#98a2b3',true)+line('actual','#155eef')+labels+'</svg><div class="muted"><span style="color:#667085">- - - Kế hoạch</span> &nbsp; <span style="color:#155eef">━ Thực tế</span></div>';
}
function renderProjectProgress(p){
 const box=document.getElementById('pdProgress');if(!box)return;
 const plans=db.progressPlans?.[p.id]||[];const detail=db.progressDetail?.[p.id];const current=plans.find(x=>x.is_current)||plans[0]||null;
 const edit=canEditProject();
 let html='<div class="toolbar" style="margin:0 0 10px"><h3 style="margin:0">Tiến độ thi công</h3>'
  +(current&&detail?.summary?.mode==='ITEMS'&&canUpdateActual(p.id)?'<button class="primary" onclick="openProgressActuals(&quot;'+p.id+'&quot;)">Cập nhật thực tế</button>':'')
  +(current&&edit?'<button onclick="openProgressPlan(&quot;'+p.id+'&quot;,&quot;'+current.id+'&quot;)">Sửa bảng tiến độ</button>':'')
  +(edit?'<button onclick="openProgressPlan(&quot;'+p.id+'&quot;)">+ Bảng tiến độ mới / gia hạn</button>':'')+'</div>';
 if(!current){box.innerHTML=html+'<p class="muted">Chưa có bảng tiến độ. '+(edit?'Bấm "+ Bảng tiến độ mới" và nhập hạng mục từ Excel để hệ thống tính tiến độ kế hoạch và so sánh với thực tế.':'')+'</p>';return}
 const s=detail?.summary||{};
 if(s.mode==='ITEMS'){
  const v=Number(s.variance||0);
  html+='<div class="toolbar" style="margin:0 0 8px"><label style="margin:0">So sánh tại ngày</label><input type="date" style="max-width:170px" value="'+esc(s.as_of||todayIso())+'" onchange="loadProjectProgressPlans(&quot;'+p.id+'&quot;,this.value)"><span class="muted">Bảng hiện hành: <b>'+esc(current.plan_name)+'</b> · '+esc(WEIGHT_BASIS_LABELS[s.weight_basis_used]||'')+'</span></div>'
   +'<div class="detail-meta"><div class="item"><b>Kế hoạch lũy kế</b>'+s.planned_percent+'%</div><div class="item"><b>Thực tế lũy kế</b>'+s.actual_percent+'%</div><div class="item"><b>Chênh lệch</b><span style="color:'+(v<0?'#b42318':'#027a48')+'">'+(v>0?'+':'')+v.toFixed(2)+' điểm %</span></div><div class="item"><b>Chỉ số tiến độ (SPI)</b>'+(s.spi??'—')+'</div><div class="item"><b>Thời gian</b>'+progressDate(s.start_date)+' → '+progressDate(s.end_date)+'</div><div class="item"><b>Hạng mục chậm/quá hạn</b>'+s.late_items+' / '+s.item_count+'</div></div>'
   +(s.warning?'<div class="notice">'+esc(s.warning)+'</div>':'')
   +(v<-5?'<div class="notice" style="margin:8px 0"><b>Cảnh báo:</b> Nhà thầu chậm '+Math.abs(v).toFixed(2)+' điểm % so với kế hoạch tại ngày '+progressDate(s.as_of)+'.</div>':'')
   +sCurveSvg(detail.curve,s.as_of)
   +'<table style="margin-top:10px"><thead><tr><th>STT</th><th>Hạng mục</th><th>Tỷ trọng</th><th>Thời gian</th><th>KH</th><th>TT</th><th>Chênh lệch</th><th>Trạng thái</th></tr></thead><tbody>'
   +detail.items.map(r=>'<tr><td>'+esc(r.code||r.seq)+'</td><td>'+esc(r.name)+(r.actual_date?'<br><span class="muted">TT cập nhật '+progressDate(r.actual_date)+'</span>':'')+'</td><td>'+r.weight_share+'%</td><td>'+progressDate(r.start_date)+' → '+progressDate(r.end_date)+'</td><td>'+r.planned_percent+'%</td><td>'+r.actual_percent+'%</td><td style="color:'+(r.variance<0?'#b42318':'#027a48')+'">'+(r.variance>0?'+':'')+r.variance+'</td><td>'+statusChip(r.status)+'</td></tr>').join('')+'</tbody></table>';
 }else{
  html+='<div class="detail-meta"><div class="item"><b>Kế hoạch (nhập tay)</b>'+(s.planned_percent??current.planned_percent??0)+'%</div><div class="item"><b>Thực tế (nhập tay)</b>'+(s.actual_percent??current.actual_percent??0)+'%</div></div><div class="notice">'+esc(s.note||'Bảng tiến độ chưa có danh sách hạng mục.')+(edit?' Bấm "Sửa bảng tiến độ" → "Đọc từ Excel" hoặc "Dán từ Excel".':'')+'</div>';
 }
 html+='<h4 style="margin:16px 0 6px">Các bảng tiến độ</h4><table><thead><tr><th>Bảng tiến độ</th><th>Ngày lập</th><th>Hạng mục</th><th>Thời hạn</th><th>Tệp gốc</th><th></th></tr></thead><tbody>'
  +plans.map(x=>'<tr><td>'+esc(x.plan_name)+(x.is_current?' <span class="chip">Hiện hành</span>':'')+'</td><td>'+progressDate(x.report_date)+'</td><td>'+(x.item_count||0)+'</td><td>'+(x.is_extension?'Gia hạn đến '+progressDate(x.revised_end_date):(x.original_end_date?'Hạn '+progressDate(x.original_end_date):'Theo hợp đồng'))+'</td><td>'+(x.has_attachment?'<a href="#" onclick="viewProgressFile(&quot;'+p.id+'&quot;,&quot;'+x.id+'&quot;,false);return false">Xem</a> · <a href="#" onclick="viewProgressFile(&quot;'+p.id+'&quot;,&quot;'+x.id+'&quot;,true);return false">Tải</a><br><span class="muted">'+esc(x.attachment_name||'')+'</span>':'<span class="muted">Chưa có</span>')+'</td><td>'+(edit?'<button onclick="openProgressPlan(&quot;'+p.id+'&quot;,&quot;'+x.id+'&quot;)">Sửa</button>':'')+(edit&&!x.is_current?' <button onclick="setCurrentProgressPlan(&quot;'+p.id+'&quot;,&quot;'+x.id+'&quot;)">Đặt hiện hành</button>':'')+'</td></tr>').join('')+'</tbody></table>';
 box.innerHTML=html;
}
async function viewProgressFile(projectId,planId,download){
 if(!apiOnline())return alert('Cần kết nối mạng để mở tệp gốc.');
 const meta=(db.progressPlans?.[projectId]||[]).find(x=>x.id===planId)||{};
 const viewable=/^(application\/pdf|image\/)/i.test(meta.attachment_type||'')||/\.(pdf|png|jpe?g|webp|gif)$/i.test(meta.attachment_name||'');
 if(!viewable)download=true; // Excel/Word: trình duyệt không hiển thị được → tải về
 const win=download?null:window.open('','_blank'); // mở ngay trong thao tác bấm để không bị chặn cửa sổ bật lên
 try{
  const res=await fetch(API_BASE+'/projects/'+encodeURIComponent(projectId)+'/progress-plans/'+encodeURIComponent(planId)+'/file',{headers:{Authorization:'Bearer '+getAuthToken()}});
  if(!res.ok){let m='HTTP '+res.status;try{m=(await res.json()).error||m}catch(_){}throw new Error(m)}
  const cd=res.headers.get('Content-Disposition')||'';const name=meta.attachment_name||decodeURIComponent((cd.match(/filename\*=UTF-8''([^;]+)/)||[])[1]||'bang-tien-do');
  const f=await safeFileBlob(res);if(!f.inline){download=true;if(win)win.close()}
  const url=URL.createObjectURL(f.blob);
  if(download||!win){const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove()}
  else win.location.href=url;
  setTimeout(()=>URL.revokeObjectURL(url),60000);
 }catch(error){if(win)win.close();alert('Không mở được tệp: '+error.message)}
}
async function setCurrentProgressPlan(projectId,planId){
 try{await apiRequest('/projects/'+encodeURIComponent(projectId)+'/progress-plans/'+encodeURIComponent(planId),{method:'PATCH',body:JSON.stringify({is_current:true})});await loadProjectProgressPlans(projectId);await refreshProjectFromServer(projectId)}
 catch(error){alert('Không đặt được bảng hiện hành: '+error.message)}
}
// ---- Cửa sổ tạo/sửa bảng tiến độ ---------------------------------------------
async function openProgressPlan(projectId,planId=''){
 if(!canEditProject())return alert('Tài khoản hiện tại không có quyền sửa bảng tiến độ.');
 if(!apiOnline())return alert('Cần kết nối mạng để tạo/sửa bảng tiến độ.');
 const p=db.projects.find(x=>x.id===projectId);if(!p)return;
 let plan={plan_name:'Bảng tiến độ thi công',report_date:todayIso(),weight_basis:'VALUE',original_end_date:p.endDate||''},items=[];
 if(planId){try{const d=await apiRequest('/projects/'+encodeURIComponent(projectId)+'/progress-plans/'+encodeURIComponent(planId));plan=d.plan;items=(d.items||[]).map(i=>({id:i.id,hasActual:!!i.actual_date,code:i.code||'',name:i.name,unit:i.unit||'',quantity:i.quantity,weight:i.weight,start_date:i.start_date,end_date:i.end_date,include:true}))}catch(error){return alert('Không tải được bảng tiến độ: '+error.message)}}
 progressEditor={projectId,planId,items,warnings:[],removeAttachment:false,originalWithActual:items.filter(i=>i.hasActual).map(i=>i.id)};
 const bases=Object.entries(WEIGHT_BASIS_LABELS).map(([k,t])=>'<option value="'+k+'"'+((plan.weight_basis||'VALUE')===k?' selected':'')+'>'+t+'</option>').join('');
 openModal((planId?'Sửa bảng tiến độ':'Bảng tiến độ mới')+' — '+(p.name||''),
  '<div class="row"><div class="full"><label>Tên bảng tiến độ</label><input id="ppName" value="'+esc(plan.plan_name||'')+'"></div>'
  +'<div><label>Ngày lập / phê duyệt</label><input id="ppDate" type="date" value="'+esc(String(plan.report_date||todayIso()).slice(0,10))+'"></div>'
  +'<div><label>Cách tính tỷ trọng hạng mục</label><select id="ppBasis">'+bases+'</select></div>'
  +'<div><label>Hạn hoàn thành theo hợp đồng</label><input id="ppOriginalEnd" type="date" value="'+esc(String(plan.original_end_date||'').slice(0,10))+'"></div>'
  +'<div><label class="inline"><input id="ppExtension" type="checkbox"'+(plan.is_extension?' checked':'')+' onchange="document.getElementById(&quot;ppExtensionFields&quot;).style.display=this.checked?&quot;&quot;:&quot;none&quot;"> Bảng tiến độ gia hạn</label></div>'
  +'<div id="ppExtensionFields" class="full" style="display:'+(plan.is_extension?'':'none')+'"><div class="row"><div><label>Hạn hoàn thành mới</label><input id="ppRevisedEnd" type="date" value="'+esc(String(plan.revised_end_date||'').slice(0,10))+'"></div><div><label>Căn cứ gia hạn</label><input id="ppReason" value="'+esc(plan.extension_reason||'')+'" placeholder="Quyết định gia hạn số..."></div></div></div>'
  +'<div class="full"><label>Tệp gốc (PDF, ảnh hoặc Excel — tối đa 10 MB)</label>'+(plan.has_attachment?'<p class="muted" id="ppCurrentFile">Đang lưu: <b>'+esc(plan.attachment_name||'')+'</b> · <a href="#" onclick="viewProgressFile(&quot;'+projectId+'&quot;,&quot;'+planId+'&quot;,false);return false">Xem</a> · <a href="#" onclick="progressEditor.removeAttachment=true;document.getElementById(&quot;ppCurrentFile&quot;).innerHTML=&quot;Tệp sẽ bị gỡ khi lưu&quot;;return false">Gỡ tệp</a></p>':'')+'<input id="ppFile" type="file" accept="application/pdf,image/*,.xlsx" onchange="onProgressFileChosen(this)"><div class="muted">Hệ thống không đọc số liệu từ PDF/ảnh quét (dễ sai). Số liệu so sánh lấy từ bảng hạng mục bên dưới; tệp Excel (.xlsx) sẽ được đọc tự động.</div></div>'
  +'<div class="full"><label>Ghi chú</label><input id="ppNote" value="'+esc(plan.note||'')+'"></div></div>'
  +'<fieldset class="perm-box"><legend>Hạng mục tiến độ (dùng để tính và so sánh)</legend>'
  +'<div class="toolbar" style="margin:4px 0"><a class="btn" href="/assets/mau-bang-tien-do.xlsx" download>Tải tệp mẫu Excel</a><label class="btn" style="margin:0;font-weight:400;color:inherit">Đọc từ Excel (.xlsx)<input type="file" accept=".xlsx" style="display:none" onchange="importProgressXlsx(this.files[0]);this.value=&quot;&quot;"></label><button type="button" onclick="toggleProgressPaste()">Dán từ Excel</button><button type="button" onclick="addProgressItem()">+ Thêm dòng</button></div>'
  +'<div id="ppPasteBox" style="display:none"><textarea id="ppPaste" rows="5" placeholder="Bôi đen vùng bảng trong Excel (gồm cả dòng tiêu đề) → Ctrl+C → dán vào đây"></textarea><button type="button" class="primary" onclick="importProgressText()">Đọc bảng đã dán</button></div>'
  +'<div id="ppWarnings"></div><div id="ppItems" style="overflow-x:auto"></div></fieldset>'
  +'<div class="toolbar"><button class="primary" onclick="saveProgressPlan()">Lưu bảng tiến độ</button>'+(planId&&canDeleteIn(projectId)?'<button class="danger" onclick="deleteProgressPlan()">🗑 Xóa bảng này</button>':'')+'</div><div id="ppMessage" class="muted"></div>');
 document.querySelector('#modal .modalbox')?.classList.add('wide');
 renderProgressItems();
}
function toggleProgressPaste(){const b=document.getElementById('ppPasteBox');if(b)b.style.display=b.style.display==='none'?'':'none'}
function readProgressGrid(){
 if(!progressEditor)return;
 document.querySelectorAll('#ppItems tr[data-i]').forEach(tr=>{const it=progressEditor.items[+tr.dataset.i];if(!it)return;
  const g=c=>tr.querySelector('[data-f="'+c+'"]');
  it.include=g('include').checked;it.code=g('code').value.trim();it.name=g('name').value.trim();it.unit=g('unit').value.trim();
  it.quantity=g('quantity').value===''?null:Number(g('quantity').value);it.weight=g('weight').value===''?null:Number(g('weight').value);
  it.start_date=g('start_date').value||null;it.end_date=g('end_date').value||null});
}
function renderProgressItems(){
 const box=document.getElementById('ppItems');if(!box||!progressEditor)return;const items=progressEditor.items;
 const warn=document.getElementById('ppWarnings');if(warn)warn.innerHTML=progressEditor.warnings.length?'<div class="notice" style="margin:6px 0"><b>Kiểm tra trước khi lưu:</b><ul style="margin:4px 0 0 16px;padding:0">'+progressEditor.warnings.map(w=>'<li>'+esc(w)+'</li>').join('')+'</ul></div>':'';
 if(!items.length){box.innerHTML='<p class="muted">Chưa có hạng mục. Tải tệp mẫu, điền theo bảng tiến độ của nhà thầu rồi bấm "Đọc từ Excel".</p>';return}
 const basis=document.getElementById('ppBasis')?.value||'VALUE';const wLabel=basis==='DURATION'?'Giá trị (không dùng)':basis==='MANUAL'?'Tỷ trọng %':'Giá trị (đồng)';
 const inc=items.filter(i=>i.include);const totalW=inc.reduce((s,i)=>s+(Number(i.weight)||0),0);
 const starts=inc.map(i=>i.start_date).filter(Boolean).sort(),ends=inc.map(i=>i.end_date).filter(Boolean).sort();
 box.innerHTML='<table class="pp-grid"><thead><tr><th>Tính</th><th>STT</th><th style="min-width:200px">Hạng mục</th><th>ĐV</th><th>KL</th><th>'+wLabel+'</th><th>Bắt đầu</th><th>Kết thúc</th><th>Ngày</th><th></th></tr></thead><tbody>'
  +items.map((it,i)=>{const bad=(it.problems&&it.problems.length)||!it.start_date||!it.end_date||(it.end_date<it.start_date);
   return '<tr data-i="'+i+'" style="'+(it.is_group?'background:#f9fafb;color:#667085':bad?'background:#fef3f2':'')+'"><td><input type="checkbox" data-f="include"'+(it.include?' checked':'')+' onchange="readProgressGrid();renderProgressItems()" title="'+(it.is_group?'Dòng nhóm/tổng — không nên tính':'Tính vào tiến độ')+'"></td>'
   +'<td><input data-f="code" value="'+esc(it.code||'')+'" style="width:56px"></td><td><input data-f="name" value="'+esc(it.name||'')+'"></td><td><input data-f="unit" value="'+esc(it.unit||'')+'" style="width:60px"></td>'
   +'<td><input data-f="quantity" type="number" step="any" value="'+(it.quantity??'')+'" style="width:90px"></td><td><input data-f="weight" type="number" step="any" min="0" value="'+(it.weight??'')+'" style="width:130px"></td>'
   +'<td><input data-f="start_date" type="date" value="'+esc(it.start_date||'')+'" onchange="readProgressGrid();renderProgressItems()"></td><td><input data-f="end_date" type="date" value="'+esc(it.end_date||'')+'" onchange="readProgressGrid();renderProgressItems()"></td>'
   +'<td>'+daysBetween(it.start_date,it.end_date)+'</td><td><button type="button" onclick="readProgressGrid();progressEditor.items.splice('+i+',1);renderProgressItems()">✕</button></td></tr>'}).join('')
  +'</tbody></table><p class="muted">Tính: <b>'+inc.length+'</b>/'+items.length+' dòng'+(basis!=='DURATION'?' · Tổng '+(basis==='MANUAL'?'tỷ trọng':'giá trị')+': <b>'+numVN(totalW,2)+'</b>'+(basis==='MANUAL'&&Math.abs(totalW-100)>0.01&&totalW>0?' (khác 100% — hệ thống tự quy đổi theo tỷ lệ)':''):'')+(starts.length?' · Thời gian: <b>'+progressDate(starts[0])+' → '+progressDate(ends[ends.length-1])+'</b> ('+daysBetween(starts[0],ends[ends.length-1])+' ngày)':'')+'</p>';
}
function addProgressItem(){readProgressGrid();progressEditor.items.push({code:'',name:'',unit:'',quantity:null,weight:null,start_date:'',end_date:'',include:true});renderProgressItems()}
async function importProgressXlsx(file){
 if(!file)return;if(!/\.xlsx$/i.test(file.name))return alert('Chỉ đọc được tệp .xlsx.');if(file.size>10*1024*1024)return alert('Tệp tối đa 10 MB.');
 try{const data=await toDataURL(file);const r=await apiRequest('/projects/'+encodeURIComponent(progressEditor.projectId)+'/progress-plans/parse',{method:'POST',body:JSON.stringify({file:{name:file.name,data}})});applyParsed(r)}
 catch(error){alert(error.message)}
}
async function onProgressFileChosen(input){const f=input.files?.[0];if(f&&/\.xlsx$/i.test(f.name)&&confirm('Đọc luôn danh sách hạng mục từ tệp Excel này?'))await importProgressXlsx(f)}
async function importProgressText(){
 const text=document.getElementById('ppPaste')?.value||'';if(!text.trim())return;
 try{const r=await apiRequest('/projects/'+encodeURIComponent(progressEditor.projectId)+'/progress-plans/parse',{method:'POST',body:JSON.stringify({text})});applyParsed(r);toggleProgressPaste()}
 catch(error){alert(error.message)}
}
async function saveProgressPlan(){
 const ed=progressEditor;if(!ed)return;readProgressGrid();const msg=document.getElementById('ppMessage');const say=t=>{if(msg)msg.textContent=t};
 const items=ed.items.filter(i=>i.include);
 const lost=(ed.originalWithActual||[]).filter(id=>!items.some(i=>i.id===id));
 if(lost.length&&!confirm(lost.length+' hạng mục đã có số liệu thực tế sẽ bị xóa cùng số liệu đó (do bạn bỏ khỏi danh sách hoặc bỏ tích "Tính"). Tiếp tục?'))return;
 for(const [n,it] of items.entries()){if(!it.name)return say('Dòng tính thứ '+(n+1)+' chưa có tên hạng mục.');if(!it.start_date||!it.end_date)return say('"'+it.name+'": thiếu ngày bắt đầu/kết thúc.');if(it.end_date<it.start_date)return say('"'+it.name+'": ngày kết thúc trước ngày bắt đầu.')}
 const file=document.getElementById('ppFile')?.files?.[0];if(file&&file.size>10*1024*1024)return say('Tệp gốc tối đa 10 MB.');
 const extension=!!document.getElementById('ppExtension')?.checked;
 const body={plan_name:document.getElementById('ppName').value.trim()||'Bảng tiến độ thi công',report_date:document.getElementById('ppDate').value||todayIso(),weight_basis:document.getElementById('ppBasis').value,original_end_date:document.getElementById('ppOriginalEnd').value||null,is_extension:extension,revised_end_date:extension?(document.getElementById('ppRevisedEnd').value||null):null,extension_reason:extension?(document.getElementById('ppReason').value.trim()||null):null,note:document.getElementById('ppNote').value.trim()||null,items:items.map(i=>({id:i.id||null,code:i.code,name:i.name,unit:i.unit,quantity:i.quantity,weight:i.weight,start_date:i.start_date,end_date:i.end_date}))};
 if(extension&&!body.revised_end_date)return say('Nhập hạn hoàn thành mới cho bảng gia hạn.');
 if(file)body.attachment={name:file.name,type:file.type,size:file.size,data:await toDataURL(file)};
 if(ed.removeAttachment&&!file)body.remove_attachment=true;
 try{
  say('Đang lưu...');
  const url='/projects/'+encodeURIComponent(ed.projectId)+'/progress-plans'+(ed.planId?'/'+encodeURIComponent(ed.planId):'');
  await apiRequest(url,{method:ed.planId?'PATCH':'POST',body:JSON.stringify(body)});
  audit(ed.planId?'UPDATE':'CREATE','project_progress_plan',ed.planId||'',body.plan_name+' ('+items.length+' hạng mục)');
  closeModal();progressEditor=null;await loadProjectProgressPlans(ed.projectId);await refreshProjectFromServer(ed.projectId);
 }catch(error){say('Không lưu được: '+error.message)}
}
async function deleteProgressPlan(){
 const ed=progressEditor;if(!ed?.planId)return;
 if(!canDeleteIn(ed.projectId))return alert('Tài khoản chưa được cấp quyền "Xóa" tại công trình này.');
 deleteContent('plan',ed.planId,'Bảng tiến độ (kèm hạng mục và số liệu thực tế)',ed.projectId);
}
// ---- Cập nhật thực tế theo hạng mục --------------------------------------------
async function openProgressActuals(projectId,dateIso){
 if(!apiOnline())return alert('Cần kết nối mạng để cập nhật thực tế.');
 const plans=db.progressPlans?.[projectId]||[];const current=plans.find(x=>x.is_current)||plans[0];if(!current)return;
 const date=dateIso||todayIso();
 let d;try{d=await apiRequest('/projects/'+encodeURIComponent(projectId)+'/progress-plans/'+encodeURIComponent(current.id)+'?as_of='+date)}catch(error){return alert(error.message)}
 openModal('Cập nhật thực tế — '+current.plan_name,
  '<div class="toolbar"><label style="margin:0">Ngày báo cáo</label><input id="paDate" type="date" style="max-width:170px" value="'+date+'" onchange="openProgressActuals(&quot;'+projectId+'&quot;,this.value)"><span class="muted">Kế hoạch lũy kế tại ngày này: <b>'+d.summary.planned_percent+'%</b> · Thực tế: <b>'+d.summary.actual_percent+'%</b></span></div>'
  +'<p class="muted">Nhập % khối lượng đã hoàn thành lũy kế của từng hạng mục (0–100). Để trống = giữ số đã báo cáo gần nhất.</p>'
  +'<div style="overflow-x:auto"><table><thead><tr><th>Hạng mục</th><th>Thời gian</th><th>KH tại ngày</th><th>TT gần nhất</th><th>TT mới (%)</th><th>Ghi chú</th></tr></thead><tbody>'
  +d.items.map(r=>'<tr data-item="'+r.id+'"><td>'+esc(r.name)+'</td><td>'+progressDate(r.start_date)+' → '+progressDate(r.end_date)+'</td><td>'+r.planned_percent+'%</td><td>'+r.actual_percent+'%'+(r.actual_date?'<br><span class="muted">'+progressDate(r.actual_date)+'</span>':'')+'</td><td><input class="paValue" type="number" min="0" max="100" step="0.1" style="width:90px" placeholder="'+r.actual_percent+'"></td><td><input class="paNote" style="min-width:140px"></td></tr>').join('')
  +'</tbody></table></div><div class="toolbar"><button class="primary" onclick="saveProgressActuals(&quot;'+projectId+'&quot;,&quot;'+current.id+'&quot;)">Lưu số liệu thực tế</button></div><div id="paMessage" class="muted"></div>');wideModal();
}
async function saveProgressActuals(projectId,planId){
 const date=document.getElementById('paDate')?.value;const msg=document.getElementById('paMessage');
 const rows=[...document.querySelectorAll('tr[data-item]')].map(tr=>({item_id:tr.dataset.item,v:tr.querySelector('.paValue').value,note:tr.querySelector('.paNote').value.trim()})).filter(r=>r.v!=='').map(r=>({item_id:r.item_id,actual_percent:Number(r.v),note:r.note}));
 if(!rows.length){msg.textContent='Chưa nhập số liệu nào.';return}
 if(rows.some(r=>!(r.actual_percent>=0&&r.actual_percent<=100))){msg.textContent='Tỷ lệ phải trong khoảng 0–100%.';return}
 try{msg.textContent='Đang lưu...';await apiRequest('/projects/'+encodeURIComponent(projectId)+'/progress-plans/'+encodeURIComponent(planId)+'/actuals',{method:'POST',body:JSON.stringify({report_date:date,rows})});
  audit('UPDATE_ACTUALS','project_progress_plan',planId,rows.length+' hạng mục, ngày '+date);closeModal();await loadProjectProgressPlans(projectId,date);await refreshProjectFromServer(projectId)}
 catch(error){msg.textContent='Không lưu được: '+error.message}
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
