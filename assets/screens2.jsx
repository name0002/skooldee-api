/* ============ บ้านมาริ — Students, Teachers, Finance ============ */

/* Packages to offer in dropdowns/counts.
 * Live mode: use real DATA.PACKAGES only (empty = empty — never show demo packages).
 * Demo mode: fall back to localStorage demo packages when none loaded. */
function pkgChoices(){
  if(DATA.PACKAGES && DATA.PACKAGES.length) return DATA.PACKAGES;
  if(DATA._isLiveMode) return [];
  return (DATA.loadPackages && DATA.loadPackages()) || [];
}

// resize + compress an image File to a small JPEG data URL (keeps slip uploads tiny)
function compressImage(file, maxW=900, quality=0.6){
  return new Promise((resolve, reject)=>{
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = ()=>{
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxW/(img.width||maxW));
      const cw = Math.max(1, Math.round(img.width*scale)), ch = Math.max(1, Math.round(img.height*scale));
      const cv = document.createElement('canvas'); cv.width=cw; cv.height=ch;
      cv.getContext('2d').drawImage(img, 0, 0, cw, ch);
      try{ resolve(cv.toDataURL('image/jpeg', quality)); }catch(e){ reject(e); }
    };
    img.onerror = reject;
    img.src = url;
  });
}

/* ===================== STUDENTS ===================== */
/* ===================== ENROLLMENT REQUESTS PANEL ===================== */
function EnrollmentsPanel({ showToast, onClose }){
  const [rows, setRows] = useState(DATA.ENROLLMENTS || []);
  const [filter, setFilter] = useState('pending');
  const [busy, setBusy] = useState(null);

  const reload = async(status)=>{
    try {
      const r = await window.API.enrollments(status !== 'all' ? status : undefined);
      setRows(Array.isArray(r) ? r : []);
    } catch {}
  };
  React.useEffect(()=>{ reload(filter); }, [filter]);

  const fmtDate=(iso)=>{ if(!iso) return '-'; const p=iso.slice(0,10).split('-'); const M=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']; return parseInt(p[2])+' '+M[parseInt(p[1])-1]; };
  const catLabel=(cat)=>{ const c=DATA.CATS[cat]; if(c) return c.label; const fb={piano:'เปียโน',guitar:'กีตาร์',singing:'ร้องเพลง',dance:'เต้น',art:'ศิลปะ',drums:'กลอง',violin:'ไวโอลิน',english:'ภาษาอังกฤษ',math:'คณิตศาสตร์'}; return fb[cat]||cat||'-'; };

  const accept = async(enr)=>{
    if(!confirm(`รับ "${enr.student_name}" เข้าเรียน?\nระบบจะสร้างบัญชีนักเรียนใหม่ทันที`)) return;
    setBusy(enr.id);
    try{
      await window.API.acceptEnrollment(enr.id);
      if(DATA.reloadStudents) await DATA.reloadStudents();
      setRows(r=>r.filter(x=>x.id!==enr.id));
      DATA.ENROLLMENTS = (DATA.ENROLLMENTS||[]).filter(x=>x.id!==enr.id);
      bumpData();
      showToast(`รับ ${enr.student_name} เข้าเรียนแล้ว ✓`);
    }catch(e){ showToast('เกิดข้อผิดพลาด ❌'); }
    setBusy(null);
  };

  const reject = async(enr)=>{
    if(!confirm(`ปฏิเสธใบสมัครของ "${enr.student_name}"?`)) return;
    setBusy(enr.id);
    try{
      await window.API.rejectEnrollment(enr.id);
      setRows(r=>r.map(x=>x.id===enr.id?{...x,status:'rejected'}:x));
      DATA.ENROLLMENTS = (DATA.ENROLLMENTS||[]).filter(x=>x.id!==enr.id);
      bumpData();
      showToast('ปฏิเสธแล้ว');
    }catch(e){ showToast('เกิดข้อผิดพลาด ❌'); }
    setBusy(null);
  };

  const del = async(enr)=>{
    if(!confirm(`ลบข้อมูลสมัครของ "${enr.student_name}"?`)) return;
    setBusy(enr.id);
    try{
      await window.API.deleteEnrollment(enr.id);
      setRows(r=>r.filter(x=>x.id!==enr.id));
      DATA.ENROLLMENTS = (DATA.ENROLLMENTS||[]).filter(x=>x.id!==enr.id);
      bumpData();
      showToast('ลบแล้ว');
    }catch(e){ showToast('เกิดข้อผิดพลาด ❌'); }
    setBusy(null);
  };

  const ST = { pending:{label:'รอพิจารณา',color:'#d97706',bg:'#fef3c7'}, accepted:{label:'รับแล้ว',color:'#16a34a',bg:'#dcfce7'}, rejected:{label:'ปฏิเสธ',color:'#dc2626',bg:'#fee2e2'} };
  const enrollUrl = DATA._schoolRaw && DATA._schoolRaw.slug ? `${location.origin}/${DATA._schoolRaw.slug}/join` : null;
  const visible = rows.filter(r=>filter==='all'||r.status===filter);

  return (
    <div className="card" style={{ overflow:'hidden', marginBottom:18 }}>
      <div className="card-pad" style={{ paddingBottom:0 }}>
        <SectionHead title="ผู้สมัครเรียนใหม่">
          {enrollUrl && (
            <button className="btn btn-ghost btn-sm" onClick={()=>{
              navigator.clipboard.writeText(enrollUrl).then(()=>showToast('คัดลอกลิงก์สมัครแล้ว ✓'));
            }}><Icon n="link" size={15}/> คัดลอกลิงก์</button>
          )}
          <button className="icon-btn" style={{ width:30, height:30, border:0, color:'var(--text-3)' }} title="ปิด" onClick={onClose}><Icon n="x" size={15}/></button>
        </SectionHead>
        {enrollUrl && (
          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 0 4px', fontSize:12.5, color:'var(--text-3)', flexWrap:'wrap' }}>
            <span>ลิงก์สาธารณะ:</span>
            <span style={{ fontFamily:'monospace', background:'var(--surface-2)', padding:'2px 8px', borderRadius:6 }}>{enrollUrl}</span>
          </div>
        )}
        <div style={{ display:'flex', gap:6, padding:'10px 0 12px', flexWrap:'wrap' }}>
          {[['pending','รอพิจารณา'],['accepted','รับแล้ว'],['rejected','ปฏิเสธ'],['all','ทั้งหมด']].map(([k,l])=>(
            <button key={k} className={"chip"+(filter===k?" active":"")} onClick={()=>setFilter(k)}>{l}</button>
          ))}
        </div>
      </div>
      {visible.length===0 ? (
        <div style={{ textAlign:'center', padding:'28px 16px', color:'var(--text-3)', fontSize:13 }}>
          ไม่มีผู้สมัคร{filter==='pending'?' รอพิจารณา':''}
        </div>
      ) : (
        <table>
          <thead><tr>
            <th>ชื่อนักเรียน</th><th className="hide-mobile">ผู้ปกครอง</th>
            <th>เบอร์โทร</th><th className="hide-mobile">วิชา</th>
            <th className="hide-mobile">วันที่สมัคร</th><th>สถานะ</th><th></th>
          </tr></thead>
          <tbody>
            {visible.map(enr=>{
              const st = ST[enr.status]||ST.pending;
              return (
                <tr key={enr.id}>
                  <td style={{ fontWeight:600 }}>
                    {enr.student_name}
                    {enr.note && <div style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>{enr.note.slice(0,60)}{enr.note.length>60?'…':''}</div>}
                  </td>
                  <td className="hide-mobile" style={{ color:'var(--text-2)' }}>{enr.parent_name||'-'}</td>
                  <td><a href={`tel:${enr.phone}`} style={{ color:'var(--primary-ink)', fontWeight:600, textDecoration:'none' }}>{enr.phone||'-'}</a>
                    {enr.line_id && <div style={{ fontSize:12, color:'#06c755' }}>LINE: {enr.line_id}</div>}
                  </td>
                  <td className="hide-mobile" style={{ color:'var(--text-2)' }}>{catLabel(enr.category)}</td>
                  <td className="hide-mobile" style={{ color:'var(--text-3)', fontSize:13 }}>{fmtDate(enr.created_at)}</td>
                  <td><span style={{ display:'inline-block', padding:'3px 10px', borderRadius:99, fontSize:12, fontWeight:600, background:st.bg, color:st.color }}>{st.label}</span></td>
                  <td>
                    <div style={{ display:'flex', gap:4, justifyContent:'flex-end', alignItems:'center' }}>
                      {enr.status==='pending' && (<>
                        <button className="btn btn-sm" disabled={busy===enr.id}
                          style={{ background:'var(--ok)', color:'#fff', border:'none', fontSize:12, padding:'4px 10px', whiteSpace:'nowrap' }}
                          onClick={()=>accept(enr)}>{busy===enr.id?'…':'✓ รับเข้าเรียน'}</button>
                        <button className="btn btn-sm" disabled={busy===enr.id}
                          style={{ color:'var(--danger)', border:'1px solid var(--danger)', background:'transparent', fontSize:12, padding:'4px 8px' }}
                          onClick={()=>reject(enr)}>ปฏิเสธ</button>
                      </>)}
                      <button className="icon-btn" style={{ width:30, height:30, border:0, color:'var(--text-3)' }} title="ลบ" onClick={()=>del(enr)}>
                        <Icon n="x" size={14}/>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Students(){
  useDataVersion();
  // pre-fill from topbar global search — sync only when it CHANGES, otherwise the
  // (always-'' when topbar empty) global value would wipe the local search box every render.
  const [q, setQ] = useState(()=> DATA._searchQ||"");
  const _lastGlobalQ = React.useRef(DATA._searchQ||"");
  React.useEffect(()=>{
    if(DATA._searchQ!==undefined && DATA._searchQ!==_lastGlobalQ.current){
      _lastGlobalQ.current = DATA._searchQ;
      setQ(DATA._searchQ||"");
    }
  });
  const [cat, setCat] = useState("all");
  const [status, setStatus] = useState("all");
  const [nearOnly, setNearOnly] = useState(false);
  const [sel, setSel] = useState(null);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [view, setView] = useState('list'); // 'list' | 'pipeline'
  const [showEnroll, setShowEnroll] = useState(false);
  const [toast, showToast] = useToast();
  const pendingEnroll = (DATA.ENROLLMENTS||[]).length;

  const nearCount = DATA.STUDENTS.filter(DATA.isNearEnding).length;
  const list = DATA.STUDENTS.filter(s=>{
    const mq = !q || s.name.includes(q) || s.full.includes(q) || s.teacher.includes(q);
    const mc = cat==="all" || s.cats.includes(cat);
    const ms = status==="all" || s.status===status;
    const mn = !nearOnly || DATA.isNearEnding(s);
    return mq && mc && ms && mn;
  });

  return (
    <div className="content-inner">
      <div className="section-head">
        <div className="tag-filter">
          <div className="search" style={{ width:240 }}>
            <Icon n="search" size={17}/>
            <input placeholder="ค้นหานักเรียน..." value={q} onChange={e=>setQ(e.target.value)}/>
          </div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <div style={{ display:"flex", border:"1.5px solid var(--border)", borderRadius:9, overflow:"hidden" }}>
            {[['list','รายการ'],['pipeline','ไปป์ไลน์']].map(([v,l])=>(
              <button key={v} onClick={()=>setView(v)} style={{ padding:"0 14px", fontSize:13, fontWeight:600, border:0, cursor:"pointer",
                background: view===v?'var(--primary)':'transparent', color: view===v?'#fff':'var(--text-2)' }}>{l}</button>
            ))}
          </div>
          {nearCount>0 && <button className="btn btn-ghost" onClick={()=>showToast(`ส่งแจ้งเตือน LINE ถึงผู้ปกครอง ${nearCount} คนแล้ว`)} style={{ color:"#06c755", borderColor:"color-mix(in oklch,#06c755 35%,var(--border))" }}><Icon n="bell" size={16}/> แจ้งใกล้หมด ({nearCount})</button>}
          <button className="btn btn-ghost" title="ส่งออกรายชื่อนักเรียน CSV" onClick={()=>{
            const rows=[['ชื่อ','ครู','ประเภท','สถานะ','แพ็กเกจ (ครั้ง)','คงเหลือ','ยอดค้างชำระ','เบอร์ผู้ปกครอง','ผู้ปกครอง','วันที่สมัคร'],
              ...list.map(s=>[s.name,s.teacher,(s.cats||[]).join('/'),s.status,s.pkg,s.remaining,s.balance,s.phone,s.guardian,s.joined])];
            const esc=(v)=>{ const sv=String(v??''); return sv.includes(',')||sv.includes('"')?'"'+sv.replace(/"/g,'""')+'"':sv; };
            const csv=rows.map(r=>r.map(esc).join(',')).join('\r\n');
            const blob=new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8;'});
            const url=URL.createObjectURL(blob); const a=document.createElement('a');
            a.href=url; a.download='students.csv'; a.click(); URL.revokeObjectURL(url);
            showToast('ส่งออก CSV แล้ว ✓');
          }}><Icon n="download" size={16}/></button>
          {DATA.can('students','manage') && <button className="btn btn-ghost" onClick={()=>setImporting(true)} title="นำเข้านักเรียนจาก Excel/CSV"><Icon n="download" size={16} style={{transform:"rotate(180deg)"}}/> นำเข้า</button>}
          {DATA.can('students','manage') && DATA._isLiveMode && (
            <button className="btn btn-sm" onClick={()=>setShowEnroll(v=>!v)}
              style={ pendingEnroll>0 ? { background:'#7c3aed', color:'#fff', border:'none', position:'relative' } : { position:'relative' } }>
              📝 ผู้สมัคร{pendingEnroll>0 && <span className="nav-badge" style={{ background:'#fff', color:'#7c3aed', top:-6, right:-6 }}>{pendingEnroll}</span>}
            </button>
          )}
          {DATA.can('students','manage') && <button className="btn btn-primary" onClick={()=>setAdding(true)}><Icon n="plus" size={18}/> เพิ่มนักเรียน</button>}
        </div>
      </div>

      {showEnroll && DATA._isLiveMode && window.API && (
        <EnrollmentsPanel showToast={showToast} onClose={()=>setShowEnroll(false)}/>
      )}

      {view==='pipeline' && <PipelineBoard onOpen={setSel} showToast={showToast}/>}

      {view==='list' && <>
      <div className="tag-filter" style={{ marginBottom:6 }}>
        <button className={"chip"+(cat==="all"?" active":"")} onClick={()=>setCat("all")}>ทุกคลาส</button>
        {Object.values(DATA.CATS).map(c=>(
          <button key={c.key} className={"chip"+(cat===c.key?" active":"")} onClick={()=>setCat(c.key)}>
            <span className="dotmark" style={{ background:c.color }}></span>{c.label}
          </button>
        ))}
        <span style={{ width:1, background:"var(--border)", margin:"2px 4px" }}></span>
        {[["all","ทั้งหมด"],["active","กำลังเรียน"],["trial","ทดลอง"],["paused","พัก"]].map(([k,l])=>(
          <button key={k} className={"chip"+(status===k?" active":"")} onClick={()=>setStatus(k)}>{l}</button>
        ))}
        <button className={"chip"+(nearOnly?" active":"")} onClick={()=>setNearOnly(v=>!v)}
          style={ nearOnly ? { background:"var(--danger)", borderColor:"var(--danger)", color:"#fff" } : { color:"var(--danger)", borderColor:"color-mix(in oklch,var(--danger) 35%,var(--border))" }}>
          ⚠️ ใกล้หมด {nearCount>0 && <b>({nearCount})</b>}
        </button>
      </div>

      <div className="card" style={{ marginTop:12, overflow:"hidden" }}>
        <table>
          <thead><tr>
            <th>นักเรียน</th><th className="hide-mobile">คลาส</th><th className="hide-mobile">ครูผู้สอน</th>
            <th>คงเหลือ</th><th className="hide-mobile">สถานะ</th><th style={{textAlign:"right"}}>ยอดค้าง</th><th></th>
          </tr></thead>
          <tbody>
            {list.map(s=>(
              <tr key={s.id} style={{ cursor:"pointer" }} onClick={()=>setSel(s)}>
                <td>
                  <div style={{ display:"flex", alignItems:"center", gap:11 }}>
                    <Avatar name={s.name} size={38}/>
                    <div><div style={{ fontWeight:600 }}>{DATA.dispName(s)}</div><div style={{ fontSize:12, color:"var(--text-3)" }}>{s.age} ปี · แพ็ก {s.pkg} ครั้ง/{s.dur===60?"1ชม.":"30น."}</div></div>
                  </div>
                </td>
                <td className="hide-mobile"><div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>{s.cats.map(c=><CatBadge key={c} cat={c} small/>)}</div></td>
                <td className="hide-mobile" style={{ color:"var(--text-2)" }}>{s.teacher}</td>
                <td>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ fontWeight:700, color: DATA.isNearEnding(s)?"var(--danger)":"var(--text)" }}>{s.remaining}<span style={{ fontWeight:400, color:"var(--text-3)", fontSize:12 }}>/{s.pkg}</span></span>
                    <div style={{ width:42 }}><Progress value={s.remaining} max={s.pkg} color={DATA.isNearEnding(s)?"var(--danger)":"var(--ok)"}/></div>
                    {DATA.isNearEnding(s) && <span className="badge" style={{ background:"var(--danger-soft)", color:"color-mix(in oklch,var(--danger) 78%,black)", fontSize:11 }}>ใกล้หมด</span>}
                  </div>
                </td>
                <td className="hide-mobile"><StatusBadge map={DATA.STATUS} k={s.status}/></td>
                <td style={{ textAlign:"right" }}>{s.balance>0
                  ? <span style={{ color:"var(--danger)", fontWeight:700 }}>{DATA.baht(s.balance)}</span>
                  : <span style={{ color:"var(--text-3)" }}>—</span>}</td>
                <td style={{ width:40 }}><button className="icon-btn" style={{ width:32, height:32, border:0 }}><Icon n="chevron" size={16}/></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length===0 && <div className="empty">ไม่พบนักเรียนที่ตรงกับเงื่อนไข</div>}
      </div>
      </>}

      {sel && <StudentDrawer s={sel} onClose={()=>setSel(null)}/>}
      {adding && <AddStudentDrawer onClose={()=>setAdding(false)}
        onSaved={()=>{ setAdding(false); showToast("เพิ่มนักเรียนใหม่แล้ว ✓"); }}/>}
      {importing && <ImportStudentsDrawer onClose={()=>setImporting(false)}
        onDone={(n)=>{ setImporting(false); showToast(`นำเข้านักเรียน ${n} คนแล้ว ✓`); }}/>}
      {toast}
    </div>
  );
}

/* ===================== SALES PIPELINE BOARD ===================== */
function PipelineBoard({ onOpen, showToast }){
  useDataVersion();
  const stages = DATA.PIPELINE_STAGES || ['lead','trial_scheduled','trial_done','active'];
  const move = (s, dir)=>{
    const i = stages.indexOf(s.status);
    const ni = Math.min(stages.length-1, Math.max(0, (i<0?0:i)+dir));
    const next = stages[ni];
    if(next===s.status) return;
    DATA.updateStudent(s.id, { status: next });
    bumpData();
    showToast(`ย้าย ${DATA.dispName(s)} → ${(DATA.STATUS[next]||{}).label||next}`);
  };
  const inFunnel = DATA.STUDENTS.filter(s=>stages.includes(s.status)).length;
  const activeN = DATA.STUDENTS.filter(s=>s.status==='active').length;
  const convRate = inFunnel>0 ? Math.round(activeN/inFunnel*100) : 0;
  return (
    <div style={{ marginTop:12 }}>
      <div style={{ fontSize:13, color:'var(--text-3)', marginBottom:10 }}>
        ผู้สนใจในไปป์ไลน์ <b style={{color:'var(--text)'}}>{inFunnel}</b> คน · แปลงเป็นนักเรียนแล้ว <b style={{color:'var(--ok)'}}>{activeN}</b> ({convRate}%)
      </div>
      <div style={{ display:'flex', gap:12, overflowX:'auto', paddingBottom:8 }}>
        {stages.map((st,si)=>{
          const col = DATA.STUDENTS.filter(s=>s.status===st);
          const meta = DATA.STATUS[st]||{};
          return (
            <div key={st} style={{ flex:'0 0 250px', minWidth:250 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10, paddingBottom:8, borderBottom:`2px solid ${meta.color||'var(--border)'}` }}>
                <b style={{ fontSize:13.5 }}>{meta.label||st}</b>
                <span style={{ marginLeft:'auto', fontSize:12.5, fontWeight:700, color:'var(--text-3)' }}>{col.length}</span>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {col.map(s=>(
                  <div key={s.id} className="card" style={{ padding:'11px 12px', cursor:'pointer' }} onClick={()=>onOpen(s)}>
                    <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                      <Avatar name={s.name} size={30}/>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:600, fontSize:13.5 }}>{DATA.dispName(s)}</div>
                        <div style={{ fontSize:11.5, color:'var(--text-3)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.cats.map(c=>(DATA.CATS[c]||{}).label||c).join(' · ')||'-'}{s.phone&&s.phone!=='-'?' · '+s.phone:''}</div>
                      </div>
                    </div>
                    {s.goal && <div style={{ fontSize:11.5, color:'var(--text-2)', marginTop:6, fontStyle:'italic' }}>🎯 {s.goal}</div>}
                    <div style={{ display:'flex', gap:6, marginTop:9, justifyContent:'flex-end' }} onClick={e=>e.stopPropagation()}>
                      {si>0 && <button className="btn btn-sm" style={{ padding:'3px 10px', fontSize:12 }} onClick={()=>move(s,-1)}>←</button>}
                      {si<stages.length-1 && <button className="btn btn-soft btn-sm" style={{ padding:'3px 10px', fontSize:12 }} onClick={()=>move(s,1)}>ถัดไป →</button>}
                    </div>
                  </div>
                ))}
                {col.length===0 && <div style={{ fontSize:12.5, color:'var(--text-3)', padding:'16px 4px', textAlign:'center', border:'1px dashed var(--border)', borderRadius:10 }}>— ว่าง —</div>}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop:10, fontSize:12.5, color:'var(--text-3)', lineHeight:1.5 }}>
        💡 ตั้งสถานะนักเรียนเป็น "สนใจ / นัดทดลอง / ทดลองแล้ว" เพื่อให้อยู่ในไปป์ไลน์ · กด "ถัดไป →" เลื่อนสเตจ · แตะการ์ดเพื่อดู/แก้
      </div>
    </div>
  );
}

function StudentDrawer({ s, onClose }){
  const [edit, setEdit] = useState(false);
  const [line, setLine] = useState(false);
  const [givePts, setGivePts] = useState(false);
  const [delBusy, setDelBusy] = useState(false);
  const [toast, showToast] = useToast();
  const [f, setF] = useState({});
  const [editEnroll, setEditEnroll] = useState([]);
  const [attHistory, setAttHistory] = useState(null);
  const [attLoading, setAttLoading] = useState(false);
  const [assessOpen, setAssessOpen] = useState(false);
  const [assessList, setAssessList] = useState(null);
  const reloadAssess = React.useCallback(()=>{
    if(!DATA.listAssessments) return;
    Promise.resolve(DATA.listAssessments(s.id)).then(setAssessList).catch(()=>setAssessList([]));
  },[s.id]);
  const eePkgs = pkgChoices().slice().sort((a,b)=>a.sessions-b.sessions);
  const setEE = (i,patch)=> setEditEnroll(es=>es.map((e,j)=>j===i?{...e,...patch}:e));
  const removeEE = (i)=> setEditEnroll(es=> es.length>1 ? es.filter((_,j)=>j!==i):es);
  const addEE = ()=> setEditEnroll(es=>{ const p0=eePkgs[0]; const used=es.map(e=>e.category);
    const nc=((s.cats||[]).find(c=>!used.includes(c)))||(s.cats&&s.cats[0])||'piano';
    return [...es,{category:nc,package_id:p0?(p0._dbId||p0.id):null,sessions:p0?p0.sessions:10,remaining:p0?p0.sessions:10}]; });
  const onEEPkg = (i,v)=>{ if(v.startsWith('n')){const n=Number(v.slice(1)); setEE(i,{package_id:null,sessions:n,remaining:n}); return;}
    const p=eePkgs.find(x=>String(x._dbId||x.id)===v); if(p) setEE(i,{package_id:p._dbId||p.id,sessions:p.sessions,remaining:p.sessions}); };

  // Load real attendance history when viewing (not editing) and student has DB id
  React.useEffect(()=>{
    if(edit || !s._dbId || !DATA._isLiveMode) return;
    let cancelled = false;
    setAttLoading(true);
    fetch('/api/attendance?student_id='+s._dbId, { headers:{ 'x-school-id': DATA._schoolId||'1' } })
      .then(r=>r.json())
      .then(data=>{ if(!cancelled) setAttHistory(data.records||[]); })
      .catch(()=>{ if(!cancelled) setAttHistory([]); })
      .finally(()=>{ if(!cancelled) setAttLoading(false); });
    return ()=>{ cancelled=true; };
  },[s._dbId, edit]);

  // load development assessments when viewing (works in both demo + live)
  React.useEffect(()=>{ if(!edit) reloadAssess(); },[s.id, edit]);

  const startEdit = ()=>{
    // pre-fill the birthday day/month/year inputs from the stored CE date (shown in พ.ศ.)
    const bd = (()=>{
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.birthday||"");
      if(!m) return { bd_day:"", bd_mon:"", bd_year:"", bd_era:"be" };
      return { bd_day:String(Number(m[3])), bd_mon:String(Number(m[2])), bd_year:String(Number(m[1])+543), bd_era:"be" };
    })();
    setF({ name:s.name||s.full||"", nickname:s.nickname||"", age:s.age, phone:s.phone, guardian:s.guardian==="-"?"":s.guardian, email:s.email==="-"?"":(s.email||""), goal:s.goal||"", recipient:s.recipient||"parent", dur:s.dur, status:s.status, balance:s.balance, cats:(s.cats||[]).slice(), ...bd });
    const init = (s.packages&&s.packages.length)
      ? s.packages.map(p=>({ category:p.category||(s.cats&&s.cats[0])||'piano', package_id:p.package_id||null, sessions:p.sessions_total||0, remaining:p.sessions_remaining||0 }))
      : [{ category:(s.cats&&s.cats[0])||'piano', package_id:null, sessions:s.pkg||0, remaining:s.remaining||0 }];
    setEditEnroll(init);
    setEdit(true);
  };
  const save = ()=>{
    if(!(f.name||"").trim()){ showToast("กรุณากรอกชื่อ","error"); return; }
    const packages = editEnroll.map(e=>({ category:e.category||null, package_id:e.package_id||null,
      name:(eePkgs.find(p=>String(p._dbId||p.id)===String(e.package_id))||{}).name||null,
      sessions_total:Number(e.sessions)||0, sessions_remaining:Number(e.remaining)||0 }));
    if(bdInfo.bad){ showToast("วันเกิดไม่ถูกต้อง","error"); return; }
    DATA.updateStudent(s.id, {
      name:f.name.trim(), nickname:(f.nickname||"").trim()||null,
      age:bdInfo.age!=null ? bdInfo.age : (Number(f.age)||s.age),
      birthday:bdInfo.birthday, phone:f.phone||s.phone, guardian:f.guardian.trim()||"-",
      email:(f.email||"").trim()||null, goal:(f.goal||"").trim()||null, recipient:f.recipient||"parent",
      packages,
      status:f.status, balance:Math.max(0,Number(f.balance)||0),
      categories:(f.cats&&f.cats.length)?f.cats:s.cats
    });
    s.name=f.name.trim(); s.full=f.name.trim(); s.nickname=(f.nickname||"").trim()||null; s.birthday=bdInfo.birthday;
    bumpData(); setEdit(false); showToast("บันทึกข้อมูลแล้ว");
  };
  const toggleEditCat = (key)=> setF(p=>{
    const cur = p.cats||[]; const has = cur.includes(key);
    return { ...p, cats: has ? cur.filter(c=>c!==key) : [...cur, key] };
  });
  const del = async()=>{
    if(!confirm(`ลบ "${s.name}" ออกจากระบบ? ข้อมูลจะหายถาวร`)) return;
    setDelBusy(true);
    if(DATA._isLiveMode && DATA.deleteStudent){ try{ await DATA.deleteStudent(s.id); onClose(); }
      catch(e){ showToast("ลบไม่สำเร็จ ❌"); setDelBusy(false); }
    } else { DATA.STUDENTS=DATA.STUDENTS.filter(x=>x.id!==s.id); bumpData(); onClose(); }
  };
  const set = (k,v)=> setF(p=>({ ...p, [k]:v }));

  // derive birthday (CE YYYY-MM-DD) + age from the day/month/year + era inputs
  const bdInfo = (()=>{
    const d=parseInt(f.bd_day), mo=parseInt(f.bd_mon), yr=parseInt(f.bd_year);
    if(!d||!mo||!yr) return { birthday:null, age:null };
    const ceYear = f.bd_era==='be' ? yr-543 : yr;
    const nowY = new Date().getFullYear();
    if(ceYear<1900 || ceYear>nowY || mo<1 || mo>12 || d<1 || d>31) return { birthday:null, age:null, bad:true };
    const birthday = `${ceYear}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const today=new Date(); let age=today.getFullYear()-ceYear;
    if(today.getMonth()<mo-1 || (today.getMonth()===mo-1 && today.getDate()<d)) age--;
    return { birthday, age: age>=0&&age<=120 ? age : null };
  })();

  return (
    <Drawer title={DATA.dispName(s)} sub={`${s.age} ปี · ${s.teacher}`} onClose={onClose}
      footer={ edit ? <>
        <button className="btn btn-ghost" style={{ flex:1 }} onClick={()=>setEdit(false)}>ยกเลิก</button>
        <button className="btn btn-primary" style={{ flex:1 }} onClick={save}><Icon n="check" size={16}/> บันทึก</button>
      </> : <>
        <button className="btn btn-ghost" style={{ flex:1 }} onClick={()=>setLine(true)}><Icon n="bell" size={16}/> แจ้งเตือน LINE</button>
        {DATA.can('students','manage') && <button className="btn btn-primary" style={{ flex:1 }} onClick={startEdit}><Icon n="edit" size={16}/> แก้ไขข้อมูล</button>}
      </>}>
      <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:18 }}>
        <Avatar name={s.name} size={58}/>
        <div style={{ display:"flex", gap:7, flexWrap:"wrap" }}>
          {s.cats.map(c=><CatBadge key={c} cat={c}/>)}
          <StatusBadge map={DATA.STATUS} k={s.status}/>
          <TierBadge points={s.points}/>
        </div>
      </div>

      {edit ? (
        <>
          <div style={{ display:"flex", gap:12 }}>
            <div className="field" style={{ flex:2 }}><label>ชื่อ–นามสกุล <span style={{color:'var(--danger)'}}>*</span></label><input value={f.name} onChange={e=>set("name",e.target.value)} placeholder="ชื่อจริง"/></div>
            <div className="field" style={{ flex:1 }}><label>ชื่อเล่น</label><input value={f.nickname} onChange={e=>set("nickname",e.target.value)} placeholder="ชื่อเล่น"/></div>
          </div>
          <div style={{ display:"flex", gap:12 }}>
            <div className="field" style={{ flex:1 }}><label>อายุ (ปี)</label>
              {bdInfo.age!=null
                ? <input value={`${bdInfo.age} ปี (จากวันเกิด)`} disabled style={{background:'var(--surface-2)',color:'var(--text-2)'}}/>
                : <input type="number" value={f.age} onChange={e=>set("age",e.target.value)}/>}
            </div>
            <div className="field" style={{ flex:1 }}><label>สถานะ</label>
              <select value={f.status} onChange={e=>set("status",e.target.value)}>
                {Object.entries(DATA.STATUS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
          <div className="field">
            <label>วันเกิด <span style={{fontSize:11,color:'var(--text-3)'}}>เพิ่มทีหลังได้</span></label>
            <div style={{display:'flex',gap:8,alignItems:'stretch'}}>
              <input type="number" placeholder="วัน" min={1} max={31} value={f.bd_day||""} onChange={e=>set('bd_day',e.target.value)} style={{width:64}}/>
              <select value={f.bd_mon||""} onChange={e=>set('bd_mon',e.target.value)} style={{flex:1,minWidth:96}}>
                <option value="">เดือน</option>
                {['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'].map((m,i)=><option key={i} value={i+1}>{m}</option>)}
              </select>
              <input type="number" placeholder={f.bd_era==='ce'?'ค.ศ.':'พ.ศ.'} value={f.bd_year||""} onChange={e=>set('bd_year',e.target.value)} style={{width:88}}/>
              <div style={{display:'flex',border:'1.5px solid var(--border)',borderRadius:9,overflow:'hidden',flexShrink:0}}>
                {[['be','พ.ศ.'],['ce','ค.ศ.']].map(([er,l])=>(
                  <button key={er} type="button" onClick={()=>set('bd_era',er)}
                    style={{padding:'0 11px',fontSize:13,fontWeight:600,border:0,cursor:'pointer',
                      background:f.bd_era===er?'var(--primary)':'transparent',color:f.bd_era===er?'#fff':'var(--text-2)'}}>{l}</button>
                ))}
              </div>
            </div>
            {bdInfo.bad && <div style={{fontSize:12,color:'var(--danger)',marginTop:5}}>⚠️ วันเกิดไม่ถูกต้อง</div>}
            {bdInfo.birthday && <div style={{fontSize:12,color:'var(--text-3)',marginTop:5}}>วันเกิด {f.bd_day}/{f.bd_mon}/{f.bd_year} {f.bd_era==='ce'?'ค.ศ.':'พ.ศ.'} · อายุ {bdInfo.age} ปี</div>}
          </div>
          <div className="field">
            <label>ประเภทคลาส <span style={{fontSize:11,color:'var(--text-3)'}}>เลือกได้หลายวิชา</span></label>
            <div className="tag-filter" style={{flexWrap:'wrap'}}>
              {Object.values(DATA.CATS).map(c=>(
                <button key={c.key} className={"chip"+((f.cats||[]).includes(c.key)?" active":"")} onClick={()=>toggleEditCat(c.key)}>
                  <span className="dotmark" style={{background:c.color}}></span>{c.icon} {c.label}
                </button>
              ))}
            </div>
          </div>
          <div className="field"><label>ผู้ปกครอง / ผู้ติดต่อ</label><input value={f.guardian} onChange={e=>set("guardian",e.target.value)} placeholder="เช่น คุณแม่นภา"/></div>
          <div className="field"><label>เบอร์ติดต่อ</label><input value={f.phone} onChange={e=>set("phone",e.target.value)}/></div>
          <div className="field">
            <label>ผู้รับแจ้งเตือน LINE <span style={{fontSize:11,color:'var(--muted)'}}>ปรับคำในข้อความเชิญ/แจ้งการบ้าน</span></label>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              {(DATA.RECIPIENT_TYPES||[]).map(rt=>(
                <button key={rt.key} type="button" className={"chip"+((f.recipient||'parent')===rt.key?" active":"")} onClick={()=>set('recipient',rt.key)}>{rt.label}</button>
              ))}
            </div>
          </div>
          <div className="field"><label>อีเมล</label><input type="email" value={f.email} onChange={e=>set("email",e.target.value)} placeholder="parent@email.com"/></div>
          <div className="field"><label>เป้าหมายผู้เรียน</label><input value={f.goal} onChange={e=>set("goal",e.target.value)} placeholder="เช่น สอบเข้าดนตรี / เล่นเพลงโปรด"/></div>
          <div className="field">
            <label>แพ็กเกจคอร์ส {editEnroll.length>1 && <span style={{fontSize:11,color:'var(--text-3)'}}>· คงเหลือรวม {editEnroll.reduce((a,e)=>a+(Number(e.remaining)||0),0)} ครั้ง</span>}</label>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {editEnroll.map((e,i)=>(
                <div key={i} style={{display:'flex',gap:8,alignItems:'flex-end',flexWrap:'wrap'}}>
                  <div style={{flex:'1 1 100px'}}>
                    {i===0 && <div style={{fontSize:11,color:'var(--text-3)',marginBottom:3}}>วิชา</div>}
                    <select value={e.category||''} onChange={ev=>setEE(i,{category:ev.target.value||null})}>
                      {Object.values(DATA.CATS).map(c=><option key={c.key} value={c.key}>{c.icon} {c.label}</option>)}
                    </select>
                  </div>
                  <div style={{flex:'2 1 140px'}}>
                    {i===0 && <div style={{fontSize:11,color:'var(--text-3)',marginBottom:3}}>จำนวนครั้ง (รวม)</div>}
                    <input type="number" value={e.sessions} min={1} max={999} onChange={ev=>{
                      const n=Math.max(1,Number(ev.target.value)||1);
                      setEE(i,{package_id:null,sessions:n,remaining:Math.min(e.remaining,n)});
                    }}/>
                  </div>
                  <div style={{flex:'0 0 70px'}}>
                    {i===0 && <div style={{fontSize:11,color:'var(--text-3)',marginBottom:3}}>คงเหลือ</div>}
                    <input type="number" value={e.remaining} min={0} max={e.sessions||999} onChange={ev=>setEE(i,{remaining:Number(ev.target.value)})}/>
                  </div>
                  <button type="button" className="icon-btn" disabled={editEnroll.length<=1} title="ลบแพ็กเกจ"
                    style={{width:34,height:34,border:0,color:editEnroll.length<=1?'var(--text-3)':'var(--danger)',opacity:editEnroll.length<=1?0.4:1}}
                    onClick={()=>removeEE(i)}><Icon n="x" size={15}/></button>
                </div>
              ))}
            </div>
            <button type="button" className="btn btn-ghost btn-sm" style={{marginTop:8}} onClick={addEE}>
              <Icon n="plus" size={14}/> เพิ่มแพ็กเกจ (เรียนหลายวิชา)
            </button>
          </div>
          <div className="field"><label>ยอดค้างชำระ (฿)</label><input type="number" value={f.balance} onChange={e=>set("balance",e.target.value)}/></div>
          <div style={{marginTop:8,textAlign:'center'}}>
            <button className="btn btn-ghost btn-sm" style={{color:'var(--danger)'}} onClick={del} disabled={delBusy}>
              <Icon n="x" size={13}/> {delBusy?'กำลังลบ…':'ลบนักเรียนคนนี้ออกจากระบบ'}
            </button>
          </div>
        </>
      ) : (
        <>
          {DATA.isNearEnding(s) && (()=>{ const ne=DATA.nearEndingInfo?DATA.nearEndingInfo(s):{remaining:s.remaining,perSubject:false,category:null};
            const subjLabel=ne.perSubject&&ne.category?((DATA.CATS[ne.category]||{}).label||ne.category):null;
            return (
            <div style={{ display:"flex", alignItems:"center", gap:11, padding:"12px 14px", borderRadius:12, background:"var(--danger-soft)", marginBottom:16 }}>
              <div style={{ fontSize:20 }}>⚠️</div>
              <div style={{ flex:1, fontSize:13.5, color:"color-mix(in oklch,var(--danger) 80%,black)" }}>
                <b>{ne.remaining<=0?(subjLabel?`วิชา${subjLabel}หมดแล้ว`:'คอร์สหมดแล้ว'):(subjLabel?`วิชา${subjLabel}ใกล้หมด`:'คอร์สใกล้หมด')}</b> — {ne.remaining<=0?'ควรชวนต่อคอร์ส':`เหลือ ${ne.remaining} ครั้ง ควรชวนต่อคอร์ส`}
              </div>
              <button className="btn btn-sm" style={{ background:"#06c755", color:"#fff" }} onClick={()=>setLine(true)}><Icon n="bell" size={14}/> LINE</button>
            </div>
          ); })()}

          <div style={{ display:"flex", gap:12, marginBottom:18 }}>
            <MiniStat label={`คงเหลือ (${s.pkg} ครั้ง)`} val={s.remaining+" ครั้ง"} tone={DATA.isNearEnding(s)?"var(--danger)":"var(--ok)"}/>
            <MiniStat label="ยอดค้างชำระ" val={s.balance>0?DATA.baht(s.balance):"ไม่มี"} tone={s.balance>0?"var(--danger)":"var(--text-3)"}/>
            <MiniStat label="แต้มสะสม" val={s.points} tone="var(--primary-ink)"
              onClick={()=>setGivePts(true)} hint="แตะเพื่อให้แต้มรางวัล"/>
          </div>

          <div className="card" style={{ padding:"4px 16px", marginBottom:18 }}>
            {(s.packages&&s.packages.length>1) ? (
              <div className="kv" style={{alignItems:'flex-start'}}>
                <span className="k">แพ็กเกจคอร์ส</span>
                <span className="v" style={{textAlign:'right'}}>
                  {s.packages.map((p,i)=>(
                    <div key={i} style={{fontSize:13}}>
                      {(DATA.CATS[p.category]||{}).label||p.category||'-'}: {p.name||(p.sessions_total+' ครั้ง')} <span style={{color:'var(--text-3)'}}>({p.sessions_remaining}/{p.sessions_total})</span>
                      {(p.round>1) && <span style={{color:'var(--primary-ink)',fontWeight:600}}> · คอร์สที่ {p.round}</span>}
                    </div>
                  ))}
                </span>
              </div>
            ) : (
              <div className="kv"><span className="k">แพ็กเกจคอร์ส</span><span className="v">{s.pkg} ครั้ง · {s.dur===60?"1 ชม.":"30 นาที"}/ครั้ง{(s.packages&&s.packages[0]&&s.packages[0].round>1)?` · คอร์สที่ ${s.packages[0].round}`:''}</span></div>
            )}
            <div className="kv"><span className="k">ครูผู้สอน</span><span className="v">{s.teacher}</span></div>
            <div className="kv"><span className="k">ผู้ปกครอง</span><span className="v">{s.guardian}</span></div>
            <div className="kv"><span className="k">เบอร์ติดต่อ</span><span className="v">{s.phone}</span></div>
            {s.email && s.email!=='-' && <div className="kv"><span className="k">อีเมล</span><span className="v">{s.email}</span></div>}
            {s.birthday && <div className="kv"><span className="k">วันเกิด</span><span className="v">{(()=>{ const d=new Date(s.birthday+'T00:00:00'); return isNaN(d)?s.birthday:`${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()+543} (พ.ศ.)`; })()}</span></div>}
            {s.goal && <div className="kv"><span className="k">เป้าหมายผู้เรียน</span><span className="v" style={{textAlign:'right',maxWidth:'60%'}}>{s.goal}</span></div>}
            {s.referral_code && (
              <div className="kv">
                <span className="k">เชื่อม LINE ผู้ปกครอง</span>
                <span className="v">
                  {s.lineLinked
                    ? (()=>{
                        const unlink = async()=>{
                          if(!confirm(`ยกเลิกการเชื่อม LINE ของน้อง${DATA.dispName(s)}?\n${s.lineName?`(ตอนนี้เชื่อมกับ "${s.lineName}")\n`:''}ผู้ปกครองที่ถูกต้องจะเชื่อมใหม่ได้ด้วยลิงก์เดิม`)) return;
                          try{
                            if(DATA._isLiveMode && window.API && window.API.unlinkStudentLine && s._dbId){
                              await window.API.unlinkStudentLine(s._dbId);
                            }
                            s.lineLinked=false; s.lineName=null; bumpData();
                            showToast("ยกเลิกการเชื่อมแล้ว — ส่งลิงก์ให้ผู้ปกครองเชื่อมใหม่ได้เลย ✓");
                          }catch(ex){ showToast(ex.message||"ยกเลิกไม่สำเร็จ","error"); }
                        };
                        return (
                          <span style={{ display:"inline-flex", alignItems:"center", gap:8, flexWrap:"wrap", justifyContent:"flex-end" }}>
                            <span style={{ color:"#06a046", fontWeight:600 }}>✓ เชื่อมแล้ว{s.lineName?` · ${s.lineName}`:""}</span>
                            <button className="btn btn-sm btn-ghost" style={{ fontSize:11.5, padding:"3px 9px", color:"var(--danger)" }}
                              onClick={unlink} title="ยกเลิกการเชื่อม เพื่อให้ผู้ปกครองที่ถูกต้องเชื่อมใหม่">
                              ยกเลิกการเชื่อม
                            </button>
                          </span>
                        );
                      })()
                    : (()=>{
                        const sr = DATA._schoolRaw||{};
                        // best path: one-tap LIFF auto-link (no typing). Needs LIFF ID set in settings + a parent_token.
                        const liffLink = (sr.liff_id && s.parent_token)
                          ? `https://liff.line.me/${sr.liff_id}?token=${s.parent_token}` : '';
                        let basic = sr.line_oa_basic_id || '';
                        if(!basic && sr.line_oa_url){ const m=String(sr.line_oa_url).match(/@[\w.\-]+/); if(m) basic=m[0]; }
                        const inviteLink = basic ? `https://line.me/R/oaMessage/${basic}/?${encodeURIComponent(s.referral_code)}` : '';
                        // build the full message to copy: invite template (with {ชื่อ}/{ลิงก์} filled) + link.
                        // empty template → copy just the link (backward compatible).
                        const buildMsg = (link)=>{
                          const tpl = sr.invite_message_template;
                          if(!tpl) return link;
                          const nm = s.nickname||s.name||'';
                          const w = (DATA.recipientWords||function(){return{greet:'คุณพ่อคุณแม่ของน้อง'+nm};})(s.recipient||'parent', nm);
                          let msg = String(tpl).replace(/\{ผู้รับ\}/g, w.greet).replace(/\{ชื่อ\}/g, nm);
                          msg = msg.includes('{ลิงก์}') ? msg.replace(/\{ลิงก์\}/g, link) : (msg+'\n'+link);
                          return msg;
                        };
                        const copyToast = sr.invite_message_template
                          ? "คัดลอกข้อความ + ลิงก์แล้ว — วางในแชต LINE ส่งให้ผู้ปกครองได้เลย ✓"
                          : "คัดลอกลิงก์แล้ว — ส่งให้ผู้ปกครองแตะลิงก์เดียว เชื่อมเสร็จทันที ไม่ต้องพิมพ์ ✓";
                        return (
                          <span style={{ display:"inline-flex", alignItems:"center", gap:6, flexWrap:"wrap", justifyContent:"flex-end" }}>
                            {liffLink
                              ? <button className="btn btn-sm" style={{ fontSize:12.5, padding:"4px 12px", background:"#06c755", color:"#fff" }}
                                  onClick={()=>{ try{ navigator.clipboard.writeText(buildMsg(liffLink)); showToast(copyToast); }catch(e){} }}
                                  title="ผู้ปกครองแตะลิงก์นี้ = เชื่อมอัตโนมัติทันที ไม่ต้องพิมพ์รหัส">
                                  <Icon n="bell" size={13}/> คัดลอกลิงก์เชื่อมอัตโนมัติ
                                </button>
                              : inviteLink
                              ? <button className="btn btn-sm" style={{ fontSize:12.5, padding:"4px 12px", background:"#06c755", color:"#fff" }}
                                  onClick={()=>{ try{ navigator.clipboard.writeText(inviteLink); showToast("คัดลอกลิงก์แล้ว — ส่งให้ผู้ปกครองแตะแล้วกดส่งเพื่อเชื่อม ✓"); }catch(e){} }}
                                  title="ผู้ปกครองแตะลิงก์นี้แล้วกดส่ง = เชื่อม (ตั้ง LIFF ID ในตั้งค่าเพื่อให้เชื่อมอัตโนมัติไม่ต้องกดส่ง)">
                                  <Icon n="bell" size={13}/> คัดลอกลิงก์เชื่อม
                                </button>
                              : <span style={{ color:"var(--text-3)", fontSize:12 }}>เชื่อม LINE ในตั้งค่าก่อน เพื่อสร้างลิงก์</span>}
                            <button className="btn btn-sm btn-ghost" style={{ fontSize:12, padding:"4px 10px", fontFamily:"var(--ff-display)", letterSpacing:"0.02em" }}
                              onClick={()=>{ try{ navigator.clipboard.writeText(s.referral_code); showToast("คัดลอกรหัสแล้ว ✓"); }catch(e){} }}
                              title="หรือคัดลอกเฉพาะรหัสเชื่อมต่อ">{s.referral_code}</button>
                          </span>
                        );
                      })()}
                </span>
              </div>
            )}
            {s.parent_token && (
              <div className="kv">
                <span className="k">ลิงก์ผู้ปกครอง</span>
                <span className="v">
                  <button className="btn btn-sm" style={{ fontSize:12.5, padding:"4px 12px" }}
                    onClick={()=>{ try{ navigator.clipboard.writeText(`https://skooldee.com/parent.html?t=${s.parent_token}`); showToast("คัดลอกลิงก์ผู้ปกครองแล้ว ✓"); }catch(e){} }}>
                    <Icon n="clipboard" size={13}/> คัดลอกลิงก์
                  </button>
                </span>
              </div>
            )}
            <div className="kv"><span className="k">โค้ดแนะนำเพื่อน</span><span className="v" style={{ fontFamily:"var(--ff-display)", letterSpacing:"0.03em", color:"var(--primary-ink)" }}>{DATA.refCode(s.name)}</span></div>
            <div className="kv"><span className="k">แนะนำเพื่อนสำเร็จ</span><span className="v">{DATA.refStats(s.name).joined} คน · +{DATA.refStats(s.name).earned} แต้ม</span></div>
            <div className="kv"><span className="k">วันที่สมัคร</span><span className="v">{s.joined}</span></div>
          </div>

          <div className="section-title" style={{ fontSize:15, marginBottom:10 }}>การบ้านล่าสุด</div>
          <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:18 }}>
            {DATA.HOMEWORK.filter(h=>h.student===s.name).slice(0,4).map(h=>(
              <div key={h.id} style={{ display:"flex", alignItems:"center", gap:10, fontSize:13.5 }}>
                <span style={{ width:8, height:8, borderRadius:"50%", background: h.status==="done"?"var(--ok)":(DATA.isOverdue(h)?"var(--danger)":"var(--warn)") }}></span>
                <span style={{ flex:1, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{h.title}</span>
                <span style={{ color:"var(--text-3)", fontSize:12 }}>{h.status==="done"?"ส่งแล้ว":h.due}</span>
              </div>
            ))}
            {DATA.HOMEWORK.filter(h=>h.student===s.name).length===0 && <div style={{ fontSize:13, color:"var(--text-3)" }}>— ยังไม่มีการบ้าน —</div>}
          </div>

          <div className="section-title" style={{ fontSize:15, marginBottom:10 }}>ประวัติการเรียนล่าสุด</div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {attLoading && <div style={{ fontSize:13, color:"var(--text-3)" }}>กำลังโหลด…</div>}
            {!attLoading && attHistory && attHistory.length===0 && (
              <div style={{ fontSize:13, color:"var(--text-3)" }}>— ยังไม่มีประวัติการเรียน —</div>
            )}
            {!attLoading && attHistory && attHistory.length>0 && attHistory.slice(0,8).map((a,i)=>{
              const statusMap = { present:['เข้าเรียน','var(--ok)'], absent:['ขาดเรียน','var(--danger)'], leave:['ลา (แจ้งล่วงหน้า)','var(--text-3)'] };
              const [label, dotColor] = statusMap[a.status] || [a.status,'var(--text-3)'];
              const d = a.date ? new Date(a.date) : null;
              const dateLabel = d ? d.toLocaleDateString('th-TH',{day:'numeric',month:'short'}) : a.date;
              return (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:10, fontSize:13.5 }}>
                  <span style={{ width:8, height:8, borderRadius:"50%", background:dotColor, flexShrink:0 }}></span>
                  <span style={{ width:72, color:"var(--text-3)", flexShrink:0 }}>{dateLabel}</span>
                  <span style={{ flex:1, color: a.status==='present'?'':'var(--text-2)' }}>{label}</span>
                  {a.points_awarded>0 && <span style={{ fontSize:11.5, color:"var(--primary-ink)", fontWeight:600 }}>+{a.points_awarded}pt</span>}
                </div>
              );
            })}
            {/* Demo fallback when not in live mode */}
            {!attLoading && !attHistory && !DATA._isLiveMode && [["28 พ.ค.","เข้าเรียน","var(--ok)"],["21 พ.ค.","เข้าเรียน","var(--ok)"],["14 พ.ค.","ลา (แจ้งล่วงหน้า)","var(--text-3)"],["7 พ.ค.","เข้าเรียน","var(--ok)"]].map(([d,t,c],i)=>(
              <div key={i} style={{ display:"flex", alignItems:"center", gap:10, fontSize:13.5 }}>
                <span style={{ width:8, height:8, borderRadius:"50%", background:c }}></span>
                <span style={{ width:72, color:"var(--text-3)" }}>{d}</span>
                <span>{t}</span>
              </div>
            ))}
          </div>

          {/* ── DEVELOPMENT ASSESSMENT ── */}
          <div className="section-title" style={{ fontSize:15, margin:"18px 0 10px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <span>📊 คะแนนพัฒนาการ</span>
            <button className="btn btn-sm btn-soft" onClick={()=>setAssessOpen(true)}><Icon n="plus" size={13}/> ประเมิน</button>
          </div>
          {(()=>{
            const list = assessList||[];
            if(!list.length) return <div style={{ fontSize:13, color:"var(--text-3)" }}>— ยังไม่มีผลประเมิน · กด "ประเมิน" เพื่อบันทึก —</div>;
            const latestByCat = {};
            list.forEach(a=>{ const k=a.category||"_"; if(!latestByCat[k]) latestByCat[k]=a; });
            return (
              <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                {Object.values(latestByCat).map(a=>{
                  const scores = a.scores||{};
                  const names = Object.keys(scores);
                  const avg = names.length ? names.reduce((acc,n)=>acc+scores[n],0)/names.length : 0;
                  const catLabel = (DATA.CATS[a.category]||{}).label || a.category || "ทั่วไป";
                  return (
                    <div key={a.id} className="card" style={{ padding:"12px 15px" }}>
                      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                        <div style={{ fontWeight:700, fontSize:14 }}>{catLabel}</div>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <Stars value={Math.round(avg)} size={14}/>
                          <span style={{ fontSize:12.5, color:"var(--text-3)" }}>{a.date}</span>
                          <button className="icon-btn" style={{ width:26, height:26, border:0, color:"var(--text-3)" }} title="ลบผลประเมินนี้"
                            onClick={async()=>{ if(confirm("ลบผลประเมินนี้?")){ try{ await DATA.deleteAssessment(s.id, a.id); reloadAssess(); showToast("ลบแล้ว"); }catch(e){ showToast("ลบไม่สำเร็จ","error"); } } }}>
                            <Icon n="x" size={12}/>
                          </button>
                        </div>
                      </div>
                      {names.map(n=>(
                        <div key={n} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"3px 0", fontSize:13 }}>
                          <span style={{ color:"var(--text-2)" }}>{n}</span>
                          <Stars value={scores[n]} size={13}/>
                        </div>
                      ))}
                      {a.note && <div style={{ fontSize:12.5, color:"var(--text-3)", marginTop:6, fontStyle:"italic" }}>📝 {a.note}</div>}
                    </div>
                  );
                })}
                {list.length > Object.keys(latestByCat).length && (
                  <div style={{ fontSize:12, color:"var(--text-3)", textAlign:"center" }}>ประเมินไปแล้วทั้งหมด {list.length} ครั้ง</div>
                )}
              </div>
            );
          })()}
        </>
      )}
      {line && <LineNotify student={s} onClose={()=>setLine(false)} onSent={(r)=>{ setLine(false); showToast(DATA.lineResultMsg(r,"ส่งข้อความผ่าน LINE แล้ว ✓")); }}/>}
      {assessOpen && <AssessModal student={s} onClose={()=>setAssessOpen(false)}
        onDone={(rec, err)=>{
          setAssessOpen(false);
          if(err){ showToast(err||"บันทึกไม่สำเร็จ ❌","error"); return; }
          reloadAssess();
          showToast("บันทึกผลประเมินแล้ว ✓");
        }}/>}
      {givePts && <GivePointsModal student={s} onClose={()=>setGivePts(false)}
        onDone={(d, updated, err)=>{
          setGivePts(false);
          if(err){ showToast(err||"ให้แต้มไม่สำเร็จ ❌","error"); return; }
          if(updated && updated.points!=null) s.points = updated.points;
          bumpData();
          if(d>0) showToast(`ให้ ${d} แต้มแล้ว ✓ · รวม ${s.points} แต้ม`);
          else if(d<0) showToast(`หัก ${Math.abs(d)} แต้มแล้ว · รวม ${s.points} แต้ม`);
        }}/>}
      {toast}
    </Drawer>
  );
}

function MiniStat({ label, val, tone, onClick, hint }){
  return (
    <div className="card" style={{ flex:1, padding:14, cursor:onClick?"pointer":"default", position:"relative" }}
      onClick={onClick} title={onClick?hint:undefined}>
      <div style={{ fontSize:12.5, color:"var(--text-2)" }}>{label}</div>
      <div style={{ fontFamily:"var(--ff-display)", fontWeight:700, fontSize:19, marginTop:4, color:tone }}>{val}</div>
      {onClick && <div style={{ position:"absolute", top:10, right:11, fontSize:13, opacity:.7 }}>⭐</div>}
    </div>
  );
}

/* ===================== GIVE REWARD POINTS ===================== */
function GivePointsModal({ student, onClose, onDone }){
  const [delta, setDelta] = useState(5);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(()=>{ const h=(e)=>e.key==="Escape"&&onClose(); window.addEventListener("keydown",h); return ()=>window.removeEventListener("keydown",h); },[]);

  const cur = student.points || 0;
  const next = Math.max(0, cur + (Number(delta)||0));
  const curTier = DATA.tierOf(cur), nextTier = DATA.tierOf(next);
  const tierChanged = curTier.key !== nextTier.key;
  const PRESETS = [1, 5, 10, 20];
  const REASONS = ["ทำการบ้านครบ", "ตั้งใจเรียนดี", "มาตรงเวลา", "พัฒนาการดีขึ้น", "ช่วยเหลือเพื่อน"];

  const submit = async ()=>{
    const d = Math.trunc(Number(delta)||0);
    if(!d){ return; }
    setBusy(true);
    try{
      const updated = await (DATA.givePoints
        ? DATA.givePoints(student.id, d, reason.trim()||null)
        : Promise.resolve(null));
      onDone(d, updated);
    }catch(ex){ onDone(null, null, ex&&ex.message); }
    setBusy(false);
  };

  return (
    <>
      <div className="scrim" onClick={onClose}></div>
      <div className="modal">
        <div className="modal-head">
          <div style={{ width:4, height:34, borderRadius:4, background:"var(--primary)" }}></div>
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:"var(--ff-display)", fontWeight:700, fontSize:16 }}>⭐ ให้แต้มรางวัล</div>
            <div style={{ fontSize:12.5, color:"var(--text-3)" }}>{DATA.dispName(student)}</div>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon n="x" size={18}/></button>
        </div>
        <div className="modal-body" style={{ background:"var(--surface)" }}>
          {/* quick presets */}
          <div className="field">
            <label>จำนวนแต้ม</label>
            <div className="tag-filter" style={{ flexWrap:"wrap" }}>
              {PRESETS.map(p=>(
                <button key={p} className={"chip"+(Number(delta)===p?" active":"")} onClick={()=>setDelta(p)}>+{p}</button>
              ))}
              <input type="number" value={delta} onChange={e=>setDelta(e.target.value)}
                style={{ width:96, padding:"7px 10px", borderRadius:8, border:"1.5px solid var(--border)", fontSize:14, textAlign:"center" }}/>
            </div>
            <div style={{ fontSize:11.5, color:"var(--text-3)", marginTop:6 }}>ใส่ค่าติดลบเพื่อหักแต้ม (เช่น -5) · สูงสุด ±500 ต่อครั้ง</div>
          </div>

          {/* reason quick-pick + free text */}
          <div className="field">
            <label>เหตุผล <span style={{ fontSize:11, color:"var(--text-3)" }}>ไม่บังคับ</span></label>
            <div className="tag-filter" style={{ flexWrap:"wrap", marginBottom:8 }}>
              {REASONS.map(rz=>(
                <button key={rz} className={"chip"+(reason===rz?" active":"")} onClick={()=>setReason(rz)}>{rz}</button>
              ))}
            </div>
            <input value={reason} onChange={e=>setReason(e.target.value)} placeholder="เช่น เล่นเพลงใหม่ได้ดี"
              style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:"1.5px solid var(--border)", fontSize:14, boxSizing:"border-box" }}/>
          </div>

          {/* preview */}
          <div className="card" style={{ padding:"13px 15px", display:"flex", alignItems:"center", justifyContent:"space-between", background:"var(--primary-soft)" }}>
            <div style={{ fontSize:13, color:"var(--text-2)" }}>แต้มสะสม</div>
            <div style={{ display:"flex", alignItems:"center", gap:8, fontFamily:"var(--ff-display)", fontWeight:700 }}>
              <span style={{ color:"var(--text-3)" }}>{cur}</span>
              <span style={{ color:"var(--text-3)" }}>→</span>
              <span style={{ fontSize:20, color:"var(--primary-ink)" }}>{next}</span>
              <span style={{ fontSize:13 }}>{nextTier.icon}</span>
            </div>
          </div>
          {tierChanged && (
            <div style={{ fontSize:12.5, color:"var(--primary-ink)", fontWeight:600, marginTop:8, textAlign:"center" }}>
              🎉 เลื่อนระดับเป็น {nextTier.icon} {nextTier.label}!
            </div>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" style={{ flex:1 }} onClick={onClose}>ยกเลิก</button>
          <button className="btn btn-primary" style={{ flex:1.4 }} onClick={submit} disabled={busy||!Math.trunc(Number(delta)||0)}>
            <Icon n="check" size={17}/> {busy?"กำลังบันทึก…":(Number(delta)<0?"หักแต้ม":"ให้แต้ม")}
          </button>
        </div>
      </div>
    </>
  );
}

/* ===================== DEVELOPMENT ASSESSMENT (star rubric) ===================== */
function StarInput({ value, onChange, size=26 }){
  return (
    <span style={{ display:"inline-flex", gap:3 }}>
      {[1,2,3,4,5].map(i=>(
        <span key={i} onClick={()=>onChange(i===value?0:i)} role="button"
          style={{ cursor:"pointer", fontSize:size, lineHeight:1, userSelect:"none",
            color: i<=(value||0) ? "var(--warn,#F97316)" : "var(--border)" }}>★</span>
      ))}
    </span>
  );
}

function AssessModal({ student, onClose, onDone }){
  const cats = (student.cats&&student.cats.length) ? student.cats : ["piano"];
  const [cat, setCat] = useState(cats[0]);
  const [scores, setScores] = useState({});
  const [note, setNote] = useState("");
  const [date, setDate] = useState(()=> new Date().toISOString().slice(0,10));
  const [busy, setBusy] = useState(false);
  useEffect(()=>{ const h=(e)=>e.key==="Escape"&&onClose(); window.addEventListener("keydown",h); return ()=>window.removeEventListener("keydown",h); },[]);

  const criteria = window.criteriaFor(cat);
  const pickCat = (c)=>{ setCat(c); setScores({}); };
  const setScore = (name,v)=> setScores(p=>({ ...p, [name]:v }));
  const rated = criteria.map(c=>scores[c]||0).filter(Boolean);
  const avg = rated.length ? (rated.reduce((a,b)=>a+b,0)/rated.length) : 0;

  const submit = async ()=>{
    const clean = {};
    criteria.forEach(c=>{ const v=scores[c]; if(v>=1&&v<=5) clean[c]=v; });
    if(!Object.keys(clean).length) return;
    setBusy(true);
    try{
      const rec = await DATA.addAssessment(student.id, { category:cat, date, scores:clean, note:note.trim()||null });
      onDone(rec);
    }catch(ex){ onDone(null, ex&&ex.message); }
    setBusy(false);
  };

  return (
    <>
      <div className="scrim" onClick={onClose}></div>
      <div className="modal">
        <div className="modal-head">
          <div style={{ width:4, height:34, borderRadius:4, background:"var(--primary)" }}></div>
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:"var(--ff-display)", fontWeight:700, fontSize:16 }}>📊 ประเมินพัฒนาการ</div>
            <div style={{ fontSize:12.5, color:"var(--text-3)" }}>{DATA.dispName(student)}</div>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon n="x" size={18}/></button>
        </div>
        <div className="modal-body" style={{ background:"var(--surface)" }}>
          {/* subject picker (only if >1 subject) */}
          {cats.length>1 && (
            <div className="field">
              <label>วิชา</label>
              <div className="tag-filter" style={{ flexWrap:"wrap" }}>
                {cats.map(c=>(
                  <button key={c} className={"chip"+(cat===c?" active":"")} onClick={()=>pickCat(c)}>
                    {(DATA.CATS[c]||{}).label||c}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* criteria star rows */}
          <div className="field">
            <label>เกณฑ์ประเมิน <span style={{ fontSize:11, color:"var(--text-3)" }}>· {(DATA.CATS[cat]||{}).label||cat}</span></label>
            <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
              {criteria.map(name=>(
                <div key={name} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 2px", borderBottom:"1px solid var(--border)" }}>
                  <span style={{ fontSize:14 }}>{name}</span>
                  <StarInput value={scores[name]||0} onChange={v=>setScore(name,v)}/>
                </div>
              ))}
            </div>
            <div style={{ fontSize:11.5, color:"var(--text-3)", marginTop:6 }}>แตะดาวเพื่อให้คะแนน · แตะดาวเดิมซ้ำเพื่อล้าง · เกณฑ์ปรับได้ที่ ตั้งค่า → เกณฑ์ประเมิน</div>
          </div>

          <div className="field"><label>วันที่ประเมิน</label>
            <input type="date" value={date} onChange={e=>setDate(e.target.value)}
              style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:"1.5px solid var(--border)", fontSize:14, boxSizing:"border-box" }}/>
          </div>
          <div className="field"><label>บันทึกเพิ่มเติม <span style={{ fontSize:11, color:"var(--text-3)" }}>ไม่บังคับ</span></label>
            <textarea rows={2} value={note} onChange={e=>setNote(e.target.value)} placeholder="เช่น เล่นเพลงใหม่ได้ดี ฝึกมือซ้ายเพิ่ม"
              style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:"1.5px solid var(--border)", fontSize:14, boxSizing:"border-box", fontFamily:"inherit" }}/>
          </div>

          {/* average preview */}
          <div className="card" style={{ padding:"12px 15px", display:"flex", alignItems:"center", justifyContent:"space-between", background:"var(--primary-soft)" }}>
            <div style={{ fontSize:13, color:"var(--text-2)" }}>คะแนนเฉลี่ย</div>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <Stars value={Math.round(avg)}/>
              <span style={{ fontFamily:"var(--ff-display)", fontWeight:700, color:"var(--primary-ink)" }}>{avg?avg.toFixed(1):"–"}</span>
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" style={{ flex:1 }} onClick={onClose}>ยกเลิก</button>
          <button className="btn btn-primary" style={{ flex:1.4 }} onClick={submit} disabled={busy||!rated.length}>
            <Icon n="check" size={17}/> {busy?"กำลังบันทึก…":"บันทึกผลประเมิน"}
          </button>
        </div>
      </div>
    </>
  );
}

window.Students = Students;

/* ===================== ADD STUDENT DRAWER ===================== */
function AddStudentDrawer({ onClose, onSaved }){
  const [busy,setBusy] = useState(false);
  const pkgs = pkgChoices().slice().sort((a,b)=>a.sessions-b.sessions);
  const [f,setF] = useState(()=>{
    const first = pkgs[0];
    return {
      name:'', nickname:'', age:'', categories:['piano'], status:'active',
      bd_day:'', bd_mon:'', bd_year:'', bd_era:'be',
      parent_name:'', parent_phone:'', email:'', goal:'', recipient:'parent',
      package_id: first?(first._dbId||first.id):null,
      sessions_total: first?first.sessions:10,
      sessions_remaining: first?first.sessions:10,
      dur: first?(first.duration_min||first.dur||60):60,
    };
  });
  const set = (k,v)=> setF(p=>({...p,[k]:v}));

  // derive birthday (CE YYYY-MM-DD) + age from day/month/year + era inputs
  const bdInfo = (()=>{
    const d=parseInt(f.bd_day), mo=parseInt(f.bd_mon), yr=parseInt(f.bd_year);
    if(!d||!mo||!yr) return { birthday:null, age:null };
    const ceYear = f.bd_era==='be' ? yr-543 : yr;
    const nowY = new Date().getFullYear();
    if(ceYear<1900 || ceYear>nowY || mo<1 || mo>12 || d<1 || d>31) return { birthday:null, age:null, bad:true };
    const birthday = `${ceYear}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const today=new Date(); let age=today.getFullYear()-ceYear;
    if(today.getMonth()<mo-1 || (today.getMonth()===mo-1 && today.getDate()<d)) age--;
    return { birthday, age: age>=0&&age<=120 ? age : null };
  })();
  const toggleCat = (key)=> setF(p=>{
    const has = p.categories.includes(key);
    return { ...p, categories: has ? p.categories.filter(c=>c!==key) : [...p.categories, key] };
  });

  // multi-package enrollments (one line per subject/course the student takes)
  const [enrollments, setEnrollments] = useState(()=>{
    const p0 = pkgs[0];
    return [{ category:'piano', package_id: p0?(p0._dbId||p0.id):null, sessions: p0?p0.sessions:10, remaining: p0?p0.sessions:10 }];
  });
  const setEnroll = (i, patch)=> setEnrollments(es=> es.map((e,j)=> j===i ? {...e, ...patch} : e));
  const removeEnroll = (i)=> setEnrollments(es=> es.length>1 ? es.filter((_,j)=>j!==i) : es);
  const addEnroll = ()=> setEnrollments(es=>{
    const p0 = pkgs[0]; const used = es.map(e=>e.category);
    const nextCat = (f.categories.find(c=>!used.includes(c))) || f.categories[0] || 'piano';
    return [...es, { category:nextCat, package_id: p0?(p0._dbId||p0.id):null, sessions: p0?p0.sessions:10, remaining: p0?p0.sessions:10 }];
  });
  const onEnrollPkg = (i, v)=>{
    if(v.startsWith('n')){ const n=Number(v.slice(1)); setEnroll(i,{ package_id:null, sessions:n, remaining:n }); return; }
    const p = pkgs.find(x=>String(x._dbId||x.id)===v);
    if(p) setEnroll(i, { package_id:p._dbId||p.id, sessions:p.sessions, remaining:p.sessions });
  };
  const totalRemain = enrollments.reduce((a,e)=>a+(Number(e.remaining)||0),0);

  // package dropdown value: real package id, or "n<count>" for the no-packages fallback
  const pkgSelValue = f.package_id ? String(f.package_id) : ('n'+f.sessions_total);
  const onPkgChange = (v)=>{
    if(v.startsWith('n')){
      const n = Number(v.slice(1));
      setF(p=>({ ...p, package_id:null, sessions_total:n, sessions_remaining:n, dur:60 }));
      return;
    }
    const p = pkgs.find(x=>String(x._dbId||x.id)===v);
    if(p) setF(prev=>({ ...prev, package_id:p._dbId||p.id, sessions_total:p.sessions, sessions_remaining:p.sessions, dur:p.duration_min||p.dur||60 }));
  };

  // optional recurring weekly class — saves a schedule slot right after the student
  const [recur,setRecur]       = useState(false);
  const [recurDay,setRecurDay] = useState(0);
  const [recurTime,setRecurTime] = useState('15:00');
  const [recurDur,setRecurDur]   = useState('60');

  const save = async()=>{
    if(!f.name.trim()) return;
    setBusy(true);
    const payload = {
      name: f.name.trim(),
      nickname: f.nickname.trim()||null,
      age: bdInfo.age!=null ? bdInfo.age : (Number(f.age)||null),
      birthday: bdInfo.birthday,
      categories: f.categories,
      category: f.categories[0]||null,
      status: f.status,
      parent_name: f.parent_name.trim()||null,
      parent_phone: f.parent_phone.trim()||null,
      recipient_type: f.recipient||'parent',
      email: (f.email||'').trim()||null,
      goal: (f.goal||'').trim()||null,
      packages: enrollments.map(e=>({
        category: e.category||null,
        package_id: e.package_id||null,
        name: (pkgs.find(p=>String(p._dbId||p.id)===String(e.package_id))||{}).name||null,
        sessions_total: Number(e.sessions)||0,
        sessions_remaining: Number(e.remaining)||0,
      })),
      package_id: enrollments[0]?.package_id||null,
      sessions_total: enrollments.reduce((a,e)=>a+(Number(e.sessions)||0),0),
      sessions_remaining: enrollments.reduce((a,e)=>a+(Number(e.remaining)||0),0),
    };
    try{
      if(DATA.addStudent){
        const newS = await DATA.addStudent(payload);
        // optionally create a recurring weekly slot for this student
        if(recur && newS && newS.id && DATA.addScheduleSlot){
          const [h,m] = recurTime.split(':').map(Number);
          const start_min = h*60+(m||0);
          const primaryCat = f.categories[0]||null;
          const tc = DATA.TEACHERS.find(t=>t.cats.includes(primaryCat));
          await DATA.addScheduleSlot({
            day_of_week: recurDay, start_min, end_min: start_min+Number(recurDur),
            category: primaryCat, teacher_id: tc?._dbId??tc?.id??null,
            student_ids: [newS.id],
          }).catch(console.warn);
        }
      } else {
        // demo fallback: push locally
        DATA.STUDENTS.push(Object.assign({
          id:'s'+Date.now(), _dbId:null,
          full:payload.name, cats:(payload.categories&&payload.categories.length)?payload.categories.slice():(payload.category?[payload.category]:[]),
          teacher:DATA.TEACHER_BY_CAT&&DATA.TEACHER_BY_CAT[payload.category]||'-',
          balance:0, dur:60,
          joined:DATA.TODAY_KEY||new Date().toISOString().slice(0,10),
          phone:payload.parent_phone||'-', guardian:payload.parent_name||'-',
          line_id:null, points:0, referral_code:null,
        }, payload, { remaining:payload.sessions_remaining, pkg:payload.sessions_total, age:payload.age||'-' }));
        bumpData();
      }
      onSaved();
    } catch(e){
      console.error(e);
      alert('เพิ่มนักเรียนไม่สำเร็จ กรุณาลองใหม่');
    }
    setBusy(false);
  };

  return (
    <Drawer title="เพิ่มนักเรียนใหม่" sub="กรอกข้อมูลพื้นฐาน (แก้ไขได้ทีหลัง)"
      onClose={onClose} accent="var(--primary)"
      footer={<>
        <button className="btn btn-ghost" style={{flex:1}} onClick={onClose} disabled={busy}>ยกเลิก</button>
        <button className="btn btn-primary" style={{flex:1}} onClick={save}
          disabled={busy||!f.name.trim()}>
          {busy ? 'กำลังบันทึก…' : <><Icon n="check" size={16}/> บันทึก</>}
        </button>
      </>}>

      <div style={{display:'flex',gap:12}}>
        <div className="field" style={{flex:2}}>
          <label>ชื่อ–นามสกุล <span style={{color:'var(--danger)'}}>*</span></label>
          <input autoFocus value={f.name} onChange={e=>set('name',e.target.value)} placeholder="น้องอินดี้ สมมติ"/>
        </div>
        <div className="field" style={{flex:1}}>
          <label>ชื่อเล่น</label>
          <input value={f.nickname} onChange={e=>set('nickname',e.target.value)} placeholder="อินดี้"/>
        </div>
      </div>

      <div style={{display:'flex',gap:12}}>
        <div className="field" style={{flex:1}}>
          <label>อายุ (ปี)</label>
          {bdInfo.age!=null
            ? <input value={`${bdInfo.age} ปี (จากวันเกิด)`} disabled style={{background:'var(--surface-2)',color:'var(--text-2)'}}/>
            : <input type="number" value={f.age} onChange={e=>set('age',e.target.value)} placeholder="8" min={1} max={120}/>}
        </div>
        <div className="field" style={{flex:1}}>
          <label>สถานะ</label>
          <select value={f.status} onChange={e=>set('status',e.target.value)}>
            {Object.entries(DATA.STATUS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
      </div>

      <div className="field">
        <label>วันเกิด <span style={{fontSize:11,color:'var(--muted)'}}>ไม่บังคับ</span></label>
        <div style={{display:'flex',gap:8,alignItems:'stretch'}}>
          <input type="number" placeholder="วัน" min={1} max={31} value={f.bd_day} onChange={e=>set('bd_day',e.target.value)} style={{width:64}}/>
          <select value={f.bd_mon} onChange={e=>set('bd_mon',e.target.value)} style={{flex:1,minWidth:96}}>
            <option value="">เดือน</option>
            {['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'].map((m,i)=><option key={i} value={i+1}>{m}</option>)}
          </select>
          <input type="number" placeholder={f.bd_era==='be'?'พ.ศ.':'ค.ศ.'} value={f.bd_year} onChange={e=>set('bd_year',e.target.value)} style={{width:88}}/>
          <div style={{display:'flex',border:'1.5px solid var(--border)',borderRadius:9,overflow:'hidden',flexShrink:0}}>
            {[['be','พ.ศ.'],['ce','ค.ศ.']].map(([er,l])=>(
              <button key={er} type="button" onClick={()=>set('bd_era',er)}
                style={{padding:'0 11px',fontSize:13,fontWeight:600,border:0,cursor:'pointer',
                  background:f.bd_era===er?'var(--primary)':'transparent',color:f.bd_era===er?'#fff':'var(--text-2)'}}>{l}</button>
            ))}
          </div>
        </div>
        {bdInfo.bad && <div style={{fontSize:12,color:'var(--danger)',marginTop:5}}>⚠️ วันเกิดไม่ถูกต้อง</div>}
        {bdInfo.birthday && <div style={{fontSize:12,color:'var(--text-3)',marginTop:5}}>วันเกิด {f.bd_day}/{f.bd_mon}/{f.bd_year} {f.bd_era==='be'?'พ.ศ.':'ค.ศ.'} · อายุ {bdInfo.age} ปี</div>}
      </div>

      <div className="field">
        <label>ประเภทคลาส <span style={{fontSize:11,color:'var(--text-3)'}}>เลือกได้หลายวิชา</span></label>
        <div className="tag-filter" style={{flexWrap:'wrap'}}>
          {Object.values(DATA.CATS).map(c=>(
            <button key={c.key} className={"chip"+(f.categories.includes(c.key)?" active":"")} onClick={()=>toggleCat(c.key)}>
              <span className="dotmark" style={{background:c.color}}></span>{c.icon} {c.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{display:'flex',gap:12}}>
        <div className="field" style={{flex:1}}>
          <label>ผู้ปกครอง / ผู้ติดต่อ</label>
          <input value={f.parent_name} onChange={e=>set('parent_name',e.target.value)} placeholder="คุณแม่สมใจ"/>
        </div>
        <div className="field" style={{flex:1}}>
          <label>เบอร์ติดต่อ</label>
          <input value={f.parent_phone} onChange={e=>set('parent_phone',e.target.value)} placeholder="081-xxx-xxxx"/>
        </div>
      </div>

      <div className="field">
        <label>ผู้รับแจ้งเตือน LINE <span style={{fontSize:11,color:'var(--muted)'}}>ข้อความเชิญ/แจ้งการบ้านจะปรับคำตามนี้</span></label>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          {(DATA.RECIPIENT_TYPES||[]).map(rt=>(
            <button key={rt.key} type="button" className={"chip"+(f.recipient===rt.key?" active":"")} onClick={()=>set('recipient',rt.key)}>{rt.label}</button>
          ))}
        </div>
      </div>

      <div className="field">
        <label>อีเมล <span style={{fontSize:11,color:'var(--muted)'}}>ไม่บังคับ</span></label>
        <input type="email" value={f.email} onChange={e=>set('email',e.target.value)} placeholder="parent@email.com"/>
      </div>

      <div className="field">
        <label>เป้าหมายผู้เรียน <span style={{fontSize:11,color:'var(--muted)'}}>ไม่บังคับ</span></label>
        <input value={f.goal} onChange={e=>set('goal',e.target.value)} placeholder="เช่น สอบเข้าดนตรี ม.ปลาย / เล่นเพลงโปรดได้"/>
      </div>

      <div className="field">
        <label>แพ็กเกจคอร์ส {enrollments.length>1 && <span style={{fontSize:11,color:'var(--text-3)'}}>· คงเหลือรวม {totalRemain} ครั้ง</span>}</label>
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {enrollments.map((e,i)=>(
            <div key={i} style={{display:'flex',gap:8,alignItems:'flex-end',flexWrap:'wrap'}}>
              <div style={{flex:'1 1 110px'}}>
                {i===0 && <div style={{fontSize:11,color:'var(--text-3)',marginBottom:3}}>วิชา</div>}
                <select value={e.category||''} onChange={ev=>setEnroll(i,{category:ev.target.value||null})}>
                  {Object.values(DATA.CATS).map(c=><option key={c.key} value={c.key}>{c.icon} {c.label}</option>)}
                </select>
              </div>
              <div style={{flex:'2 1 150px'}}>
                {i===0 && <div style={{fontSize:11,color:'var(--text-3)',marginBottom:3}}>จำนวนครั้ง (รวม)</div>}
                <input type="number" value={e.sessions} min={1} max={999} onChange={ev=>{
                  const n=Math.max(1,Number(ev.target.value)||1);
                  setEnroll(i,{package_id:null,sessions:n,remaining:Math.min(e.remaining,n)});
                }}/>
              </div>
              <div style={{flex:'0 0 78px'}}>
                {i===0 && <div style={{fontSize:11,color:'var(--text-3)',marginBottom:3}}>คงเหลือ</div>}
                <input type="number" value={e.remaining} min={0} max={e.sessions||999} onChange={ev=>setEnroll(i,{remaining:Number(ev.target.value)})}/>
              </div>
              <button type="button" className="icon-btn" disabled={enrollments.length<=1} title="ลบแพ็กเกจ"
                style={{width:34,height:34,border:0,color:enrollments.length<=1?'var(--text-3)':'var(--danger)',opacity:enrollments.length<=1?0.4:1}}
                onClick={()=>removeEnroll(i)}><Icon n="x" size={15}/></button>
            </div>
          ))}
        </div>
        <button type="button" className="btn btn-ghost btn-sm" style={{marginTop:8}} onClick={addEnroll}>
          <Icon n="plus" size={14}/> เพิ่มแพ็กเกจ (เรียนหลายวิชา)
        </button>
      </div>

      {/* optional recurring weekly class */}
      <label className="grp-toggle" style={{marginTop:4}}>
        <input type="checkbox" checked={recur} onChange={e=>setRecur(e.target.checked)} style={{width:18,height:18,accentColor:'var(--primary)'}}/>
        <span><b>ตั้งคาบเรียนประจำ</b> — สร้างตารางเรียนรายสัปดาห์ให้เลย (ไม่บังคับ)</span>
      </label>
      {recur && (
        <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
          <div className="field" style={{flex:1,minWidth:120}}>
            <label>วัน</label>
            <select value={recurDay} onChange={e=>setRecurDay(Number(e.target.value))}>
              {DATA.DAYS.map((d,i)=><option key={i} value={i}>{d.d}</option>)}
            </select>
          </div>
          <div className="field" style={{flex:1,minWidth:120}}>
            <label>เวลาเริ่ม</label>
            <select value={recurTime} onChange={e=>setRecurTime(e.target.value)}>
              {DATA.SLOT_TIMES.map((t,i)=><option key={i} value={t}>{t} น.</option>)}
            </select>
          </div>
          <div className="field" style={{flex:1,minWidth:120}}>
            <label>ระยะเวลา</label>
            <select value={recurDur} onChange={e=>setRecurDur(e.target.value)}>
              <option value="30">30 นาที</option>
              <option value="60">1 ชั่วโมง</option>
              <option value="90">1.5 ชั่วโมง</option>
              <option value="120">2 ชั่วโมง</option>
            </select>
          </div>
        </div>
      )}
    </Drawer>
  );
}
window.AddStudentDrawer = AddStudentDrawer;

/* ===================== IMPORT STUDENTS (CSV / Excel paste) ===================== */
function ImportStudentsDrawer({ onClose, onDone }){
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState(null);

  // resolve a subject token (Thai label or key) → category key
  const catMap = (()=>{ const m={}; Object.values(DATA.CATS).forEach(c=>{ m[c.key.toLowerCase()]=c.key; m[(c.label||'').toLowerCase()]=c.key; }); return m; })();
  const resolveCat = (s)=>{ const k=String(s||'').trim().toLowerCase(); return catMap[k]||null; };

  const parsed = (()=>{
    return text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean).map(line=>{
      const cols = line.split(/\t|,/).map(c=>c.trim());
      if((cols[0]||'').replace(/\s/g,'')==='ชื่อ'||(cols[0]||'').toLowerCase()==='name') return null; // header
      const [name, nickname, phone, catStr, sess] = cols;
      const cats = (catStr||'').split(/[\/|]/).map(resolveCat).filter(Boolean);
      const n = parseInt((sess||'').replace(/[^0-9]/g,''))||0;
      return { name, nickname:nickname||null, parent_phone:phone||null,
        categories:cats, category:cats[0]||null, sessions_total:n, sessions_remaining:n };
    }).filter(r=>r&&r.name);
  })();

  const doImport = async()=>{
    if(!parsed.length){ setErr('ไม่พบข้อมูลที่อ่านได้ — ตรวจรูปแบบอีกครั้ง'); return; }
    setBusy(true); setErr(null);
    try{
      if(DATA._isLiveMode && DATA.importStudents){
        await DATA.importStudents(parsed);
      } else {
        parsed.forEach(p=>{
          DATA.STUDENTS.push(Object.assign({
            id:'s'+Date.now()+Math.random().toString(36).slice(2,5), _dbId:null,
            full:p.name, cats:p.categories.length?p.categories.slice():(p.category?[p.category]:[]),
            teacher:DATA.TEACHER_BY_CAT&&DATA.TEACHER_BY_CAT[p.category]||'-',
            balance:0, dur:60, joined:DATA.TODAY_KEY||new Date().toISOString().slice(0,10),
            phone:p.parent_phone||'-', guardian:'-', line_id:null, points:0, referral_code:null,
            status:'active', age:'-', remaining:p.sessions_remaining, pkg:p.sessions_total,
          }, p));
        });
        bumpData();
      }
      onDone(parsed.length);
    }catch(e){ setErr(e.message||'นำเข้าไม่สำเร็จ'); setBusy(false); }
  };

  const inp = { width:'100%', boxSizing:'border-box', border:'1.5px solid var(--border)', borderRadius:10,
    padding:'10px 12px', fontSize:13, fontFamily:'monospace', background:'var(--surface)', color:'var(--text)', outline:'none' };

  return (
    <Drawer title="นำเข้านักเรียนจาก Excel/CSV" sub="วางข้อมูลจาก Excel หรือ Google Sheets ทีละหลายคน" onClose={onClose} accent="var(--primary)"
      footer={<>
        <button className="btn btn-ghost" style={{flex:1}} onClick={onClose} disabled={busy}>ยกเลิก</button>
        <button className="btn btn-primary" style={{flex:1}} onClick={doImport} disabled={busy||!parsed.length}>
          {busy?'กำลังนำเข้า…':<><Icon n="check" size={16}/> นำเข้า {parsed.length} คน</>}
        </button>
      </>}>
      {err && <div style={{background:'var(--danger-soft)',color:'var(--danger)',borderRadius:8,padding:'9px 13px',fontSize:13,marginBottom:12}}>{err}</div>}

      <div style={{background:'var(--primary-soft)',borderRadius:10,padding:'12px 14px',marginBottom:14,fontSize:12.5,color:'var(--primary-ink)',lineHeight:1.7}}>
        <b>รูปแบบ:</b> วางทีละบรรทัด คั่นคอลัมน์ด้วย <b>วรรค Tab (จาก Excel)</b> หรือ <b>คอมมา</b><br/>
        <code style={{background:'rgba(255,255,255,.5)',padding:'1px 5px',borderRadius:4}}>ชื่อ, ชื่อเล่น, เบอร์ผู้ปกครอง, วิชา, จำนวนครั้ง</code><br/>
        วิชาหลายวิชาใส่ <b>/</b> คั่น เช่น <b>เปียโน/กีตาร์</b> · บรรทัดหัวตาราง "ชื่อ" จะถูกข้ามให้
      </div>

      <div className="field">
        <label>วางข้อมูลที่นี่</label>
        <textarea rows={8} value={text} onChange={e=>setText(e.target.value)} style={inp}
          placeholder={"น้องมินต์ สดใส, มินต์, 081-234-5678, เปียโน/กีตาร์, 10\nน้องเจ ใจดี, เจ, 089-999-0000, ร้องเพลง, 8"}/>
      </div>

      {parsed.length>0 && (
        <div className="field">
          <label>ตรวจสอบก่อนนำเข้า ({parsed.length} คน)</label>
          <div className="card" style={{overflow:'hidden'}}>
            <table style={{fontSize:12.5}}>
              <thead><tr><th>ชื่อ</th><th>วิชา</th><th style={{textAlign:'right'}}>ครั้ง</th></tr></thead>
              <tbody>
                {parsed.slice(0,6).map((p,i)=>(
                  <tr key={i}>
                    <td>{p.name}{p.nickname?` (${p.nickname})`:''}</td>
                    <td style={{color:'var(--text-2)'}}>{p.categories.map(c=>DATA.CATS[c]?.label||c).join(' / ')||<span style={{color:'var(--text-3)'}}>—</span>}</td>
                    <td style={{textAlign:'right'}}>{p.sessions_total||'—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {parsed.length>6 && <div style={{padding:'8px 14px',fontSize:12,color:'var(--text-3)'}}>…และอีก {parsed.length-6} คน</div>}
          </div>
        </div>
      )}
    </Drawer>
  );
}
window.ImportStudentsDrawer = ImportStudentsDrawer;

/* ===================== TEACHERS ===================== */
function Teachers(){
  useDataVersion();
  const [sel, setSel] = useState(null);
  const [adding, setAdding] = useState(false);
  const [toast, showToast] = useToast();
  return (
    <div className="content-inner">
      <div className="section-head">
        <div className="page-sub" style={{ fontSize:14, color:"var(--text-2)" }}>ครูผู้สอน {DATA.TEACHERS.length} คน · ค่าสอนคำนวณตามจำนวนชั่วโมงจริง</div>
        <button className="btn btn-primary" onClick={()=>setAdding(true)}><Icon n="plus" size={18}/> เพิ่มครู</button>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:16, marginTop:14 }}>
        {DATA.TEACHERS.map(t=>{
          const pay = t.rate*t.hours;
          return (
            <div key={t.id} className="card card-pad" style={{ cursor:"pointer", transition:".14s" }} onClick={()=>setSel(t)}
              onMouseEnter={e=>{e.currentTarget.style.boxShadow="var(--shadow-md)"; e.currentTarget.style.transform="translateY(-2px)";}}
              onMouseLeave={e=>{e.currentTarget.style.boxShadow=""; e.currentTarget.style.transform="";}}>
              <div style={{ display:"flex", alignItems:"center", gap:13, marginBottom:14 }}>
                <Avatar name={t.nick} size={48} color={t.color}/>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, fontFamily:"var(--ff-display)", fontSize:16 }}>{t.nick}</div>
                  <div style={{ fontSize:12.5, color:"var(--text-3)" }}>{t.name}</div>
                </div>
              </div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:14 }}>{t.cats.map(c=><CatBadge key={c} cat={c} small/>)}</div>
              <div style={{ display:"flex", justifyContent:"space-between", textAlign:"center", borderTop:"1px solid var(--border)", paddingTop:13 }}>
                <Metric v={t.students} l="นักเรียน"/>
                <Metric v={t.hours+" ชม."} l="เดือนนี้"/>
                <Metric v={DATA.baht(pay)} l="ค่าสอน" tone="var(--primary-ink)"/>
              </div>
            </div>
          );
        })}
      </div>

      {sel && <TeacherDrawer t={sel} onClose={()=>setSel(null)}
        onUpdated={()=>{ setSel(null); showToast("อัปเดตข้อมูลครูแล้ว ✓"); }}
        onDeleted={()=>{ setSel(null); showToast("ลบครูออกจากระบบแล้ว"); }}/>}
      {adding && <AddTeacherDrawer onClose={()=>setAdding(false)}
        onSaved={()=>{ setAdding(false); showToast("เพิ่มครูใหม่แล้ว ✓"); }}/>}
      {toast}
    </div>
  );
}

function Metric({ v, l, tone }){
  return <div><div style={{ fontWeight:700, fontFamily:"var(--ff-display)", fontSize:15.5, color:tone||"var(--text)" }}>{v}</div><div style={{ fontSize:11, color:"var(--text-3)" }}>{l}</div></div>;
}

async function printTeacherPaySlip(t, month){
  const school = DATA.SCHOOL||{};
  const THMON = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  // open the window synchronously so popup blockers don't kill it, then fill after fetch
  const w = window.open('','_blank','width=520,height=700');
  if(w){ try{ w.document.write('<p style="font-family:sans-serif;padding:28px;color:#555">กำลังโหลดข้อมูลค่าสอน…</p>'); }catch(e){} }

  // fetch actual (attendance-based) payslip in live mode
  let data = null;
  if(DATA._isLiveMode && window.API && window.API.teacherPayslip && t._dbId){
    try{ data = await window.API.teacherPayslip(t._dbId, month||undefined); }catch(e){ data = null; }
  }

  const monthYM = data ? data.month : new Date().toISOString().slice(0,7);
  const [yy,mm] = monthYM.split('-').map(Number);
  const monthLabel = THMON[(mm||1)-1] + ' ' + ((yy||new Date().getFullYear())+543);
  const rate = data ? data.teacher.rate : t.rate;
  const actualHours = data ? data.actual_hours : t.hours;
  const theoHours   = data ? data.theoretical_hours : (t.hours||0);
  const pay = Math.round((actualHours||0) * (rate||0));

  // session rows: actual taught classes (live) or fallback to weekly schedule (demo)
  let rowsHtml = '', tableHead = '', sectionTitle = '';
  if(data && data.sessions && data.sessions.length){
    sectionTitle = 'คาบที่สอนจริงเดือนนี้ ('+data.sessions_count+' คาบ)';
    tableHead = '<tr><th>วันที่</th><th>เวลา</th><th>ประเภท</th><th style="text-align:right">เรท/ชม.</th></tr>';
    rowsHtml = data.sessions.map(s=>`<tr><td>${s.date}${s.makeup?' 🔄':''}${s.group?' 👥':''}</td><td>${s.start}–${s.end}</td><td>${(DATA.CATS[s.category]||{}).label||s.category||'-'}</td><td style="text-align:right">${DATA.baht(s.rate||0)}</td></tr>`).join('');
  } else if(!data){
    const mySlots = DATA.SCHEDULE.filter(s=>s.teacher===t.nick||s.teacher===t.name);
    if(mySlots.length){
      sectionTitle = 'ตารางสอนประจำสัปดาห์';
      tableHead = '<tr><th>วัน</th><th>เวลา</th><th>นักเรียน</th><th>ประเภท</th></tr>';
      rowsHtml = mySlots.map(s=>`<tr><td>${['จ.','อ.','พ.','พฤ.','ศ.','ส.','อา.'][s.day]||'?'}</td><td>${s.start}–${s.end}</td><td>${s.student}</td><td>${(DATA.CATS[s.cat]||{}).label||s.cat}</td></tr>`).join('');
    }
  }

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>สรุปค่าสอน ${t.nick} · ${monthLabel}</title>
<style>
  body{font-family:'Sarabun','IBM Plex Sans Thai',sans-serif;padding:32px 40px;max-width:460px;margin:0 auto;color:#111;font-size:14px}
  .center{text-align:center}.logo{font-size:20px;font-weight:800;margin-bottom:2px}
  .sub{color:#666;font-size:12px;margin-bottom:18px}.teacher{font-size:18px;font-weight:700;margin:12px 0 4px}
  hr{border:none;border-top:1px dashed #ccc;margin:14px 0}
  .row{display:flex;justify-content:space-between;margin:6px 0}.label{color:#555}.val{font-weight:600}
  .total{font-size:22px;font-weight:800;color:#009488;margin:4px 0}
  .muted{color:#999;font-size:12px}
  table{width:100%;border-collapse:collapse;font-size:12.5px;margin-top:8px}
  th{text-align:left;padding:5px 4px;border-bottom:1px solid #e5e7eb;color:#777;font-weight:600}
  td{padding:5px 4px;border-bottom:1px solid #f3f4f6}
  @media print{body{padding:16px}}
</style>
</head><body>
<div class="center">
  <div class="logo">${school.mark||'🎵'} ${school.name||'skooldee'}</div>
  <div class="sub">ใบสรุปค่าสอนประจำเดือน ${monthLabel}</div>
</div>
<hr>
<div class="teacher">${t.nick}</div>
<div style="font-size:13px;color:#666;margin-bottom:12px">${t.name&&t.name!==t.nick?t.name+' · ':''}${t.phone&&t.phone!=='-'?t.phone:''}</div>
<div class="row"><span class="label">เรตค่าสอน</span><span class="val">${DATA.baht(rate)} / ชม.</span></div>
<div class="row"><span class="label">ชั่วโมงสอน${data?'จริง':' (ประมาณการ)'}</span><span class="val">${actualHours} ชม.</span></div>
${data?`<div class="row"><span class="muted">เทียบประมาณการตาราง</span><span class="muted">${theoHours} ชม.</span></div>`:''}
<hr>
<div class="row"><span style="font-weight:700;font-size:15px">ค่าสอนรวม</span><span class="total">${DATA.baht(pay)}</span></div>
${data?'<div class="muted" style="margin-top:2px">* คำนวณจากคาบที่เช็คชื่อว่าสอนจริง (มีนักเรียนมาเรียน)</div>':''}
${rowsHtml?`<div style="margin-top:16px;font-weight:700;font-size:13px">${sectionTitle}</div>
<table><thead>${tableHead}</thead><tbody>${rowsHtml}</tbody></table>`:'<div class="muted" style="margin-top:16px">— ยังไม่มีคาบที่สอนในเดือนนี้ —</div>'}
<hr>
<div class="center" style="font-size:11px;color:#aaa;margin-top:8px">${school.name||'skooldee'} · พิมพ์เมื่อ ${new Date().toLocaleDateString('th-TH')}</div>
<script>window.onload=function(){ window.print(); }</script>
</body></html>`;

  if(w){ try{ w.document.open(); w.document.write(html); w.document.close(); }catch(e){} }
}

function TeacherDrawer({ t, onClose, onUpdated, onDeleted }){
  const [editing, setEditing] = useState(false);
  if(editing) return <EditTeacherDrawer t={t} onClose={()=>setEditing(false)}
    onSaved={()=>{ setEditing(false); onUpdated&&onUpdated(); }} onDeleted={onDeleted}/>;
  const pay = t.rate*t.hours;
  const myStudents = DATA.STUDENTS.filter(s=> s.teacher===t.nick||s.teacher===t.name);
  return (
    <Drawer title={t.nick} sub={t.name} onClose={onClose} accent={t.color}
      footer={<>
        <button className="btn btn-ghost" style={{ flex:1 }} onClick={()=>printTeacherPaySlip(t)}><Icon n="receipt" size={16}/> สรุปค่าสอน</button>
        <button className="btn btn-primary" style={{ flex:1 }} onClick={()=>setEditing(true)}><Icon n="edit" size={16}/> แก้ไข</button>
      </>}>
      <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:18 }}>
        <Avatar name={t.nick} size={58} color={t.color}/>
        <div style={{ display:"flex", gap:7, flexWrap:"wrap" }}>{t.cats.map(c=><CatBadge key={c} cat={c}/>)}</div>
      </div>

      <div className="card" style={{ padding:16, marginBottom:18, background:"var(--primary-soft)", border:0 }}>
        <div style={{ fontSize:12.5, color:"var(--primary-ink)", fontWeight:600 }}>
          ค่าสอนประมาณการเดือน {DATA.REVENUE.length?DATA.REVENUE[DATA.REVENUE.length-1].m:['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'][new Date().getMonth()]}
        </div>
        <div style={{ fontFamily:"var(--ff-display)", fontWeight:700, fontSize:30, color:"var(--primary-ink)", marginTop:2 }}>{DATA.baht(pay)}</div>
        <div style={{ fontSize:13, color:"var(--primary-ink)", opacity:.8, marginTop:2 }}>{t.hours} ชม. × {DATA.baht(t.rate)}/ชม.</div>
      </div>

      <div className="card" style={{ padding:"4px 16px", marginBottom:18 }}>
        <div className="kv"><span className="k">เรตค่าสอน</span><span className="v">{DATA.baht(t.rate)} / ชม.</span></div>
        <div className="kv"><span className="k">ชั่วโมงสอนเดือนนี้</span><span className="v">{t.hours} ชม.</span></div>
        <div className="kv"><span className="k">เบอร์ติดต่อ</span><span className="v">{t.phone}</span></div>
      </div>

      <div className="section-title" style={{ fontSize:15, marginBottom:10 }}>นักเรียนในความดูแล ({myStudents.length})</div>
      <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
        {myStudents.map(s=>(
          <div key={s.id} style={{ display:"flex", alignItems:"center", gap:11, padding:"7px 6px" }}>
            <Avatar name={s.name} size={34}/>
            <div style={{ flex:1 }}><div style={{ fontWeight:600, fontSize:13.5 }}>{DATA.dispName(s)}</div></div>
            <span style={{ fontSize:12.5, color:"var(--text-3)" }}>เหลือ {s.remaining} ครั้ง</span>
          </div>
        ))}
      </div>
    </Drawer>
  );
}
/* ===================== ADD TEACHER DRAWER ===================== */
function AddTeacherDrawer({ onClose, onSaved }){
  const [f,setF] = useState({name:'',categories:['piano'],hourly_rate:'',phone:''});
  const [busy,setBusy] = useState(false);
  const [err,setErr] = useState(null);
  const set = (k,v)=>setF(p=>({...p,[k]:v}));
  const toggleCat = (key)=>setF(p=>({ ...p, categories: p.categories.includes(key) ? p.categories.filter(c=>c!==key) : [...p.categories, key] }));

  const save = async()=>{
    setBusy(true); setErr(null);
    const payload = {
      name:f.name.trim(), categories:f.categories, category:f.categories[0]||null,
      hourly_rate:parseFloat(f.hourly_rate)||0, phone:f.phone||null,
    };
    if(DATA._isLiveMode && window.API && DATA.addTeacher){
      try{ await DATA.addTeacher(payload); onSaved(); }
      catch(e){ setErr(e.message||"บันทึกไม่สำเร็จ"); setBusy(false); }
    } else {
      DATA.TEACHERS.push({ id:'t'+(DATA.TEACHERS.length+1), _dbId:null,
        nick:f.name, name:f.name, cats:f.categories.slice(),
        rate:parseFloat(f.hourly_rate)||0, hours:0, phone:f.phone||'-',
        color:'#009488', students:0 });
      bumpData(); onSaved();
    }
  };

  return (
    <Drawer title="เพิ่มครูผู้สอน" sub="กรอกข้อมูลพื้นฐาน (แก้ไขได้ทีหลัง)" onClose={onClose} accent="var(--primary)"
      footer={<>
        <button className="btn btn-ghost" style={{flex:1}} onClick={onClose} disabled={busy}>ยกเลิก</button>
        <button className="btn btn-primary" style={{flex:1}} onClick={save} disabled={busy||!f.name.trim()}>
          {busy?'กำลังบันทึก…':<><Icon n="check" size={16}/> เพิ่มครู</>}
        </button>
      </>}>
      {err && <div style={{background:'var(--danger-soft)',color:'var(--danger)',borderRadius:8,padding:'9px 13px',fontSize:13,marginBottom:12}}>{err}</div>}
      <div className="field">
        <label>ชื่อ-นามสกุล <span style={{color:'var(--danger)'}}>*</span></label>
        <input autoFocus value={f.name} onChange={e=>set('name',e.target.value)} placeholder="เช่น ครูสมใจ มีสุข"/>
      </div>
      <div className="field">
        <label>สอนประเภทคลาส <span style={{fontSize:11,color:'var(--text-3)'}}>เลือกได้หลายวิชา</span></label>
        <div className="tag-filter" style={{flexWrap:'wrap'}}>
          {Object.values(DATA.CATS).map(c=>(
            <button key={c.key} className={"chip"+(f.categories.includes(c.key)?" active":"")} onClick={()=>toggleCat(c.key)}>
              <span className="dotmark" style={{background:c.color}}></span>{c.icon} {c.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{display:'flex',gap:12}}>
        <div className="field" style={{flex:1}}>
          <label>เรตค่าสอน (บาท/ชม.)</label>
          <input type="number" value={f.hourly_rate} onChange={e=>set('hourly_rate',e.target.value)} placeholder="300" min={0}/>
        </div>
        <div className="field" style={{flex:1}}>
          <label>เบอร์ติดต่อ</label>
          <input value={f.phone} onChange={e=>set('phone',e.target.value)} placeholder="08x-xxx-xxxx"/>
        </div>
      </div>
    </Drawer>
  );
}

/* ===================== EDIT TEACHER DRAWER ===================== */
function EditTeacherDrawer({ t, onClose, onSaved, onDeleted }){
  const [f,setF] = useState({
    name:t.name||t.nick||'',
    categories:(t.cats&&t.cats.length)?t.cats.slice():['piano'],
    hourly_rate:String(t.rate||''),
    phone:t.phone==='-'?'':t.phone||'',
  });
  const [busy,setBusy] = useState(false);
  const [err,setErr] = useState(null);
  const set = (k,v)=>setF(p=>({...p,[k]:v}));
  const toggleCat = (key)=>setF(p=>({ ...p, categories: p.categories.includes(key) ? p.categories.filter(c=>c!==key) : [...p.categories, key] }));

  const save = async()=>{
    setBusy(true); setErr(null);
    const apiPatch  = { name:f.name.trim(), categories:f.categories, category:f.categories[0]||null, hourly_rate:parseFloat(f.hourly_rate)||0, phone:f.phone||null };
    const localPatch = { nick:f.name.trim(), name:f.name.trim(), cats:f.categories.slice(), rate:parseFloat(f.hourly_rate)||0, phone:f.phone||'-' };
    if(DATA._isLiveMode && window.API && DATA.patchTeacher && t._dbId){
      try{ await DATA.patchTeacher(t._dbId, apiPatch, localPatch); onSaved(); }
      catch(e){ setErr(e.message||"แก้ไขไม่สำเร็จ"); setBusy(false); }
    } else {
      Object.assign(t, localPatch); bumpData(); onSaved();
    }
  };

  const del = async()=>{
    if(!confirm(`ลบ "${t.nick}" ออกจากระบบ?`)) return;
    setBusy(true);
    if(DATA._isLiveMode && window.API && DATA.deleteTeacher && t._dbId){
      try{ await DATA.deleteTeacher(t._dbId); onDeleted&&onDeleted(); }
      catch(e){ setErr(e.message||"ลบไม่สำเร็จ"); setBusy(false); }
    } else {
      DATA.TEACHERS = DATA.TEACHERS.filter(x=>x.id!==t.id); bumpData(); onDeleted&&onDeleted();
    }
  };

  return (
    <Drawer title={"แก้ไข: "+t.nick} sub="อัปเดตข้อมูลครูผู้สอน" onClose={onClose} accent="var(--primary)"
      footer={<>
        <button className="btn btn-ghost" style={{flex:1}} onClick={onClose} disabled={busy}>ยกเลิก</button>
        <button className="btn btn-primary" style={{flex:1}} onClick={save} disabled={busy||!f.name.trim()}>
          {busy?'กำลังบันทึก…':<><Icon n="check" size={16}/> บันทึก</>}
        </button>
      </>}>
      {err && <div style={{background:'var(--danger-soft)',color:'var(--danger)',borderRadius:8,padding:'9px 13px',fontSize:13,marginBottom:12}}>{err}</div>}
      <div className="field">
        <label>ชื่อ-นามสกุล <span style={{color:'var(--danger)'}}>*</span></label>
        <input autoFocus value={f.name} onChange={e=>set('name',e.target.value)}/>
      </div>
      <div className="field">
        <label>สอนประเภทคลาส <span style={{fontSize:11,color:'var(--text-3)'}}>เลือกได้หลายวิชา</span></label>
        <div className="tag-filter" style={{flexWrap:'wrap'}}>
          {Object.values(DATA.CATS).map(c=>(
            <button key={c.key} className={"chip"+(f.categories.includes(c.key)?" active":"")} onClick={()=>toggleCat(c.key)}>
              <span className="dotmark" style={{background:c.color}}></span>{c.icon} {c.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{display:'flex',gap:12}}>
        <div className="field" style={{flex:1}}>
          <label>เรตค่าสอน (บาท/ชม.)</label>
          <input type="number" value={f.hourly_rate} onChange={e=>set('hourly_rate',e.target.value)} min={0}/>
        </div>
        <div className="field" style={{flex:1}}>
          <label>เบอร์ติดต่อ</label>
          <input value={f.phone} onChange={e=>set('phone',e.target.value)} placeholder="08x-xxx-xxxx"/>
        </div>
      </div>
      <div style={{marginTop:12,textAlign:'center'}}>
        <button className="btn btn-ghost btn-sm" style={{color:'var(--danger)'}} onClick={del} disabled={busy}>
          <Icon n="x" size={13}/> ลบครูคนนี้ออกจากระบบ
        </button>
      </div>
    </Drawer>
  );
}
window.Teachers = Teachers;

/* ---- Receipt / Invoice printer ---- */
function printReceipt(inv){
  const school = DATA.SCHOOL || {};
  const raw = DATA._schoolRaw || {};
  const logo = DATA.SCHOOL_LOGO || null;
  const isPaid = inv.status === 'paid';
  const isPending = inv.status === 'pending_verification';
  const docTitle = isPaid ? 'ใบเสร็จรับเงิน' : 'ใบแจ้งหนี้';
  const stampColor = isPaid ? '#009488' : isPending ? '#7c3aed' : '#d97706';
  const stampLabel = isPaid ? '✓ ชำระแล้ว' : isPending ? '⏳ รอตรวจสอบสลิป' : '⚠ รอชำระเงิน';
  const discountAmt = (inv.subtotal||0) > (inv.amount||0) ? (inv.subtotal||0) - (inv.amount||0) : 0;
  const THMON = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const fmtD = (iso)=>{ if(!iso) return '-'; const p=iso.slice(0,10).split('-'); return parseInt(p[2])+' '+THMON[parseInt(p[1])-1]+' '+(parseInt(p[0])+543); };
  const esc = (s)=>String(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const logoHtml = logo
    ? `<img src="${logo}" alt="logo" style="width:72px;height:72px;object-fit:contain;border-radius:12px;display:block;margin:0 auto 10px"/>`
    : `<div style="width:72px;height:72px;background:rgba(255,255,255,.25);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 10px;font-size:30px;font-weight:800">${esc((school.name||'S')[0].toUpperCase())}</div>`;
  const w = window.open('','_blank','width=720,height=960');
  w.document.write(`<!DOCTYPE html><html lang="th"><head>
<meta charset="utf-8"/>
<title>${docTitle} ${inv.id}</title>
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Sarabun',sans-serif;background:#f0f5f4;color:#1a2b29;font-size:15px;-webkit-font-smoothing:antialiased}
  .page{max-width:640px;margin:24px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 6px 32px rgba(0,0,0,.12)}
  .hdr{background:linear-gradient(135deg,#0a7a70,#009488 55%,#11a393);color:#fff;padding:32px 40px 28px;text-align:center}
  .school-name{font-size:21px;font-weight:800;margin-bottom:3px;letter-spacing:.2px}
  .school-sub{font-size:13px;opacity:.85;margin-bottom:2px}
  .doc-badge{display:inline-block;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.35);border-radius:20px;padding:3px 14px;font-size:12px;letter-spacing:1px;margin-top:10px}
  .body{padding:28px 40px}
  .meta-row{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:18px;border-bottom:1.5px solid #e5ecea;margin-bottom:20px}
  .inv-no-box .lbl{font-size:11px;color:#9ab0aa;font-weight:600;letter-spacing:.6px;margin-bottom:3px}
  .inv-no{font-size:24px;font-weight:800;color:#009488;font-variant-numeric:tabular-nums}
  .date-box{text-align:right;font-size:13px;color:#6b7c79;line-height:1.8}
  .date-box b{color:#1a2b29;font-size:14px}
  .section{background:#f7faf9;border-radius:12px;padding:14px 18px;margin-bottom:16px}
  .s-title{font-size:11px;font-weight:700;color:#9ab0aa;letter-spacing:.8px;text-transform:uppercase;margin-bottom:10px}
  .row{display:flex;justify-content:space-between;align-items:baseline;margin:5px 0;font-size:14.5px}
  .row .lbl{color:#6b7c79}
  .row .val{font-weight:600;text-align:right;max-width:55%}
  .amount-box{background:#f0faf8;border-radius:12px;padding:16px 18px;margin-bottom:18px}
  .disc-row{display:flex;justify-content:space-between;font-size:14px;margin:4px 0;color:#6b7c79}
  .disc-row .disc-val{color:#dc2626;font-weight:600}
  .divider{border:none;border-top:1.5px dashed #c4d8d4;margin:10px 0}
  .total-row{display:flex;justify-content:space-between;align-items:center;margin-top:10px;padding-top:10px;border-top:2px solid #009488}
  .total-lbl{font-size:16px;font-weight:700}
  .total-val{font-size:28px;font-weight:800;color:#009488;line-height:1}
  .stamp-wrap{text-align:center;margin-bottom:6px}
  .stamp{display:inline-block;padding:8px 28px;border-radius:10px;font-weight:800;font-size:16px;border:3px solid ${stampColor};color:${stampColor}}
  .footer{text-align:center;padding:18px 40px;border-top:1px solid #e5ecea;font-size:12.5px;color:#9ab0aa;line-height:1.8}
  @media print{
    body{background:#fff}
    .page{box-shadow:none;margin:0;border-radius:0;max-width:100%}
    @page{size:A4;margin:8mm 14mm}
  }
</style>
</head><body>
<div class="page">
  <div class="hdr">
    ${logoHtml}
    <div class="school-name">${esc(school.name||'skooldee')}</div>
    <div class="school-sub">${esc(raw.category||school.sub||'โรงเรียนกวดวิชา')}</div>
    ${raw.contact_phone?`<div class="school-sub">☎ ${esc(raw.contact_phone)}</div>`:''}
    <div class="doc-badge">${docTitle}</div>
  </div>
  <div class="body">
    <div class="meta-row">
      <div class="inv-no-box">
        <div class="lbl">เลขที่</div>
        <div class="inv-no">${esc(inv.id)}</div>
      </div>
      <div class="date-box">
        <div>วันที่ออกบิล</div><div><b>${fmtD(inv.date)}</b></div>
        ${inv.paid_at?`<div style="margin-top:4px">วันที่ชำระ</div><div style="color:#009488;font-weight:700">${fmtD(inv.paid_at)}</div>`:''}
      </div>
    </div>
    <div class="section">
      <div class="s-title">ผู้ชำระ</div>
      <div class="row"><span class="lbl">นักเรียน</span><span class="val">${esc(inv.student)}</span></div>
    </div>
    <div class="section">
      <div class="s-title">รายการ</div>
      <div class="row"><span class="lbl">คอร์ส / แพ็กเกจ</span><span class="val">${esc(inv.course)}</span></div>
      <div class="row"><span class="lbl">ช่องทางชำระ</span><span class="val">${esc(inv.method)}</span></div>
    </div>
    <div class="amount-box">
      <div class="s-title">ยอดเงิน</div>
      ${discountAmt > 0 ? `
      <div class="disc-row"><span>ราคาปกติ</span><span>${DATA.baht(inv.subtotal)}</span></div>
      <div class="disc-row"><span>ส่วนลด${inv.discount_type==='percent'?' ('+inv.discount_value+'%)':''}</span><span class="disc-val">−${DATA.baht(discountAmt)}</span></div>
      <hr class="divider"/>` : ''}
      <div class="total-row">
        <span class="total-lbl">ยอดสุทธิ</span>
        <span class="total-val">${DATA.baht(inv.amount)}</span>
      </div>
    </div>
    <div class="stamp-wrap">
      <span class="stamp">${stampLabel}</span>
    </div>
  </div>
  <div class="footer">
    ${esc(school.name||'skooldee')} · ขอบคุณที่ใช้บริการ
  </div>
</div>
<script>document.fonts.ready.then(function(){ window.print(); });</script>
</body></html>`);
  w.document.close();
}

/* ===================== FINANCE ===================== */
function Finance(){
  useDataVersion();
  const [tab, setTab] = useState("invoices");
  const [addingInv, setAddingInv] = useState(false);
  const [editInv, setEditInv] = useState(null);
  const [invQ, setInvQ] = useState("");
  const [invStatus, setInvStatus] = useState("all");
  const [toast, showToast] = useToast();

  const paid = DATA.INVOICES.filter(i=>i.status==="paid").reduce((a,i)=>a+i.amount,0);
  const pending = DATA.INVOICES.filter(i=>i.status!=="paid").reduce((a,i)=>a+i.amount,0);
  const pendingSlips = DATA.INVOICES.filter(i=>i.status==="pending_verification");

  const payInv = async(inv)=>{
    if(DATA._isLiveMode && window.API && inv._dbId){
      try{ await window.API.payInvoice(inv._dbId); }
      catch(e){ showToast("บันทึกไม่สำเร็จ ❌"); return; }
      if(inv._packageDbId && inv._studentDbId){
        const pkg = DATA.PACKAGES && DATA.PACKAGES.find(p=>p._dbId===inv._packageDbId);
        const stu = DATA.STUDENTS.find(s=>s._dbId===inv._studentDbId);
        if(pkg && stu && DATA.updateStudent)
          DATA.updateStudent(stu.id, { remaining:(stu.remaining||0)+pkg.sessions, pkg:pkg.sessions });
      }
    }
    inv.status='paid'; bumpData();
    showToast("บันทึกการชำระแล้ว ✓");
  };

  const approveSlipFn = async(inv)=>{
    if(!confirm(`อนุมัติการชำระเงิน ${inv.id}?\nระบบจะเปลี่ยนสถานะเป็น "ชำระแล้ว" และเพิ่มคาบเรียน (ถ้ามีแพ็กเกจ)`)) return;
    try{
      if(DATA._isLiveMode && window.API && inv._dbId) await window.API.approveSlip(inv._dbId);
      if(inv._packageDbId && inv._studentDbId){
        const pkg = DATA.PACKAGES && DATA.PACKAGES.find(p=>p._dbId===inv._packageDbId);
        const stu = DATA.STUDENTS.find(s=>s._dbId===inv._studentDbId);
        if(pkg && stu && DATA.updateStudent)
          DATA.updateStudent(stu.id, { remaining:(stu.remaining||0)+pkg.sessions, pkg:pkg.sessions });
      }
      inv.status='paid'; bumpData();
      showToast("อนุมัติการชำระเงินแล้ว ✓");
    }catch(e){ showToast("อนุมัติไม่สำเร็จ ❌"); }
  };

  const rejectSlipFn = async(inv)=>{
    if(!confirm(`ปฏิเสธสลิปของ ${DATA.dispName(inv.student)}?\nบิลจะกลับไปสถานะ "รอชำระ" และสลิปจะถูกลบ`)) return;
    try{
      if(DATA._isLiveMode && window.API && inv._dbId) await window.API.rejectSlip(inv._dbId);
      inv.status='pending'; inv.has_slip=false; bumpData();
      showToast("ปฏิเสธสลิปแล้ว — บิลกลับสถานะ รอชำระ");
    }catch(e){ showToast("ดำเนินการไม่สำเร็จ ❌"); }
  };

  const viewSlipFn = async(inv)=>{
    try{
      const r = (DATA._isLiveMode && window.API && inv._dbId) ? await window.API.invoiceSlip(inv._dbId) : null;
      if(r && r.image){ const w=window.open('','_blank','width=420,height=640'); if(w){ w.document.write('<title>สลิป</title><img src="'+r.image+'" style="max-width:100%;display:block;margin:0 auto"/>'); w.document.close(); } }
      else showToast('ไม่พบสลิป');
    }catch(ex){ showToast('ไม่สามารถดูสลิปได้'); }
  };

  const delInv = async(inv)=>{
    if(!confirm(`ยกเลิกบิล ${inv.id}? บิลจะถูกลบออกจากระบบถาวร`)) return;
    try{
      if(DATA._isLiveMode && DATA.deleteInvoice){ await DATA.deleteInvoice(inv); }
      else { DATA.INVOICES = DATA.INVOICES.filter(x=>x!==inv); bumpData(); }
      showToast("ยกเลิกบิลแล้ว");
    }catch(e){ showToast("ยกเลิกไม่สำเร็จ ❌"); }
  };

  return (
    <div className="content-inner">
      <div className="stat-grid" style={{ gridTemplateColumns:"repeat(3,1fr)", marginBottom:18 }}>
        <Stat label="รับชำระเดือนนี้" val={DATA.baht(paid)} icon="wallet" tone="var(--ok)" big meta={<span style={{color:"var(--text-3)"}}>{DATA.INVOICES.filter(i=>i.status==="paid").length} ใบเสร็จ</span>}/>
        <Stat label="รอ/ค้างชำระ" val={DATA.baht(pending)} icon="receipt" tone="var(--warn)" big meta={<span style={{color:"var(--text-3)"}}>{DATA.INVOICES.filter(i=>i.status!=="paid").length} รายการ</span>}/>
        <Stat label="แพ็กเกจคอร์ส" val={pkgChoices().length} icon="star" tone="var(--c-piano)" meta={<span style={{color:"var(--text-3)"}}>แพ็กเกจทั้งหมด</span>}/>
      </div>

      <div className="tag-filter" style={{ marginBottom:14 }}>
        <button className={"chip"+(tab==="invoices"?" active":"")} onClick={()=>setTab("invoices")}><Icon n="receipt" size={15}/> ใบเสร็จ/บิล</button>
        <button className={"chip"+(tab==="courses"?" active":"")} onClick={()=>setTab("courses")}><Icon n="star" size={15}/> แพ็กเกจ & ราคา</button>
      </div>

      {tab==="invoices" ? (
        <div className="card" style={{ overflow:"hidden" }}>
          <div className="card-pad" style={{ paddingBottom:0 }}>
            <SectionHead title="รายการชำระเงินล่าสุด">
              <button className="btn btn-ghost btn-sm" onClick={()=>{
                const rows=[['เลขที่','นักเรียน','คอร์ส','วันที่','ยอด (฿)','ช่องทาง','สถานะ'],
                  ...DATA.INVOICES.map(i=>[i.id,i.student,i.course,i.date,i.amount,i.method,
                    i.status==='paid'?'ชำระแล้ว':i.status==='pending_verification'?'รอตรวจสลิป':'รอชำระ'])];
                const esc=(v)=>{ const s=String(v??''); return s.includes(',')||s.includes('"')?'"'+s.replace(/"/g,'""')+'"':s; };
                const csv=rows.map(r=>r.map(esc).join(',')).join('\r\n');
                const blob=new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8;'});
                const url=URL.createObjectURL(blob); const a=document.createElement('a');
                a.href=url; a.download='invoices.csv'; a.click(); URL.revokeObjectURL(url);
                showToast('ส่งออก CSV แล้ว ✓');
              }}><Icon n="download" size={15}/> ส่งออก CSV</button>
              <button className="btn btn-primary btn-sm" onClick={()=>setAddingInv(true)}><Icon n="plus" size={15}/> ออกบิล</button>
            </SectionHead>

            {/* ── pending slip notification banner ── */}
            {pendingSlips.length > 0 && (
              <div style={{ background:'#ede9fe', border:'1.5px solid #8b5cf6', borderRadius:10,
                            padding:'10px 14px', marginBottom:4, display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontSize:18 }}>🧾</span>
                <span style={{ fontWeight:700, color:'#6d28d9', flex:1 }}>
                  มีสลิปรอตรวจ {pendingSlips.length} รายการ — กดเพื่อดูและอนุมัติ
                </span>
                <button className="btn btn-sm"
                  style={{ background:'#7c3aed', color:'#fff', border:'none', whiteSpace:'nowrap' }}
                  onClick={()=>setInvStatus('pending_verification')}>
                  ดูสลิป →
                </button>
              </div>
            )}

            {/* search + filter row */}
            <div style={{ display:"flex", gap:8, padding:"8px 0 12px", alignItems:"center", flexWrap:"wrap" }}>
              <div className="search" style={{ flex:1, minWidth:180 }}>
                <Icon n="search" size={15}/>
                <input placeholder="ค้นหาชื่อนักเรียน หรือเลขบิล..." value={invQ} onChange={e=>setInvQ(e.target.value)}/>
              </div>
              {[["all","ทั้งหมด"],["pending_verification","🧾 รอตรวจสลิป"],["paid","ชำระแล้ว"],["pending","รอชำระ"]].map(([k,l])=>(
                <button key={k} className={"chip"+(invStatus===k?" active":"")} onClick={()=>setInvStatus(k)}
                  style={k==="pending_verification"&&invStatus!==k&&pendingSlips.length>0?{borderColor:"#8b5cf6",color:"#7c3aed"}:{}}>
                  {l}{k==="pending_verification"&&pendingSlips.length>0?` (${pendingSlips.length})`:''}
                </button>
              ))}
            </div>
          </div>
          <table style={{ marginTop:0 }}>
            <thead><tr>
              <th>เลขที่</th><th>นักเรียน</th><th className="hide-mobile">คอร์ส</th><th className="hide-mobile">วันที่</th>
              <th>ยอด</th><th className="hide-mobile">ช่องทาง</th><th>สถานะ</th><th></th>
            </tr></thead>
            <tbody>
              {DATA.INVOICES
                .filter(inv=>{
                  const mq = !invQ || inv.student.includes(invQ) || inv.id.includes(invQ) || (inv.course||'').includes(invQ);
                  const ms = invStatus==='all' || inv.status===invStatus;
                  return mq && ms;
                })
                .map(inv=>(
                <tr key={inv.id} style={inv.status==='pending_verification'?{background:'#faf5ff'}:{}}>
                  <td style={{ fontFamily:"var(--ff-display)", fontWeight:600, fontSize:13 }}>{inv.id}</td>
                  <td style={{ fontWeight:600 }}>{DATA.dispName(inv.student)}</td>
                  <td className="hide-mobile" style={{ color:"var(--text-2)" }}>{inv.course}</td>
                  <td className="hide-mobile" style={{ color:"var(--text-3)", fontSize:13 }}>{inv.date}</td>
                  <td style={{ fontWeight:700 }}>{DATA.baht(inv.amount)}</td>
                  <td className="hide-mobile" style={{ color:"var(--text-2)" }}>{inv.method}{inv.has_slip && <span title="มีสลิปแนบ" style={{marginLeft:6}}>📎</span>}</td>
                  <td><StatusBadge map={DATA.PAY_STATUS} k={inv.status}/></td>
                  <td style={{ width:160 }}>
                    <div style={{ display:"flex", gap:4, alignItems:"center", justifyContent:"flex-end" }}>
                      <button className="icon-btn" style={{ width:32, height:32, border:0 }} title="แก้ไขบิล"
                        onClick={()=>setEditInv(inv)}><Icon n="edit" size={15}/></button>
                      <button className="icon-btn" style={{ width:32, height:32, border:0, color:"var(--danger)" }} title="ยกเลิกบิล"
                        onClick={()=>delInv(inv)}><Icon n="x" size={15}/></button>
                      <button className="icon-btn" style={{ width:32, height:32, border:0, color:"var(--text-2)" }} title="พิมพ์ / ดาวน์โหลด PDF"
                        onClick={()=>printReceipt(inv)}><Icon n="receipt" size={15}/></button>
                      {inv.status==='pending_verification' ? (
                        <>
                          <button className="btn btn-ghost btn-sm" title="ดูสลิป" onClick={()=>viewSlipFn(inv)}>📎</button>
                          <button className="btn btn-sm"
                            style={{ background:'#16a34a', color:'#fff', border:'none', fontSize:12, padding:'4px 8px' }}
                            onClick={()=>approveSlipFn(inv)}>✓ อนุมัติ</button>
                          <button className="btn btn-sm"
                            style={{ color:'var(--danger)', border:'1px solid var(--danger)', background:'transparent', fontSize:12, padding:'4px 8px' }}
                            onClick={()=>rejectSlipFn(inv)}>ปฏิเสธ</button>
                        </>
                      ) : inv.status!=='paid' ? (
                        <button className="btn btn-soft btn-sm" onClick={()=>payInv(inv)}>รับเงิน</button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {DATA.INVOICES.filter(inv=>{
                const mq = !invQ || inv.student.includes(invQ) || inv.id.includes(invQ);
                const ms = invStatus==='all' || inv.status===invStatus;
                return mq && ms;
              }).length===0 && (
                <tr><td colSpan={8} style={{ textAlign:"center", padding:"24px 16px", color:"var(--text-3)", fontSize:13 }}>ไม่พบรายการที่ตรงกัน</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <PackagePricing showToast={showToast}/>
      )}
      {addingInv && <CreateInvoiceDrawer onClose={()=>setAddingInv(false)} onSaved={(msg)=>{ setAddingInv(false); showToast(msg); }}/>}
      {editInv && <CreateInvoiceDrawer inv={editInv} onClose={()=>setEditInv(null)} onSaved={(msg)=>{ setEditInv(null); showToast(msg); }}/>}
      {toast}
    </div>
  );
}

/* ===================== CREATE / EDIT INVOICE DRAWER ===================== */
function CreateInvoiceDrawer({ onClose, onSaved, inv }){
  const packages = pkgChoices();
  const editMode = !!inv;
  const initStudent = editMode
    ? (DATA.STUDENTS.find(s=>s._dbId===inv._studentDbId)?.id || DATA.STUDENTS[0]?.id || "")
    : (DATA.STUDENTS[0]?.id||"");

  const [studentId, setStudentId] = useState(initStudent);
  const [pkgKey, setPkgKey]       = useState(editMode && inv._packageDbId ? String(inv._packageDbId) : "");
  // which SUBJECT this invoice renews (so multi-subject students top up the right course)
  const selStudent = DATA.STUDENTS.find(s=>s.id===studentId);
  const subjects   = (selStudent && selStudent.cats && selStudent.cats.length) ? selStudent.cats : (selStudent && selStudent.category ? [selStudent.category] : []);
  const [cat, setCat] = useState(editMode ? (inv.category||"") : (subjects[0]||""));
  // default the subject to the student's first subject whenever the student changes
  const _lastStu = React.useRef(studentId);
  React.useEffect(()=>{ if(studentId!==_lastStu.current){ _lastStu.current=studentId; setCat(subjects[0]||""); } });
  const [subtotal, setSubtotal]   = useState(editMode ? String(inv.subtotal!=null?inv.subtotal:inv.amount) : "");
  const [discType, setDiscType]   = useState(editMode ? (inv.discount_type||'none') : 'none'); // none|percent|amount
  const [discValue, setDiscValue] = useState(editMode && inv.discount_value ? String(inv.discount_value) : "");
  const [note, setNote]           = useState(editMode ? (inv.course||"") : "");
  const [method, setMethod]       = useState(editMode ? (inv.payment_method||'transfer') : 'transfer');
  const [busy, setBusy]           = useState(false);
  const [err, setErr]             = useState(null);
  const [hasSlip, setHasSlip]     = useState(editMode ? !!inv.has_slip : false);
  const [slipBusy, setSlipBusy]   = useState(false);

  const onSlipFile = async(e)=>{
    const file = e.target.files && e.target.files[0]; if(!file) return;
    setSlipBusy(true); setErr(null);
    try{
      const dataUrl = await compressImage(file);
      if(DATA._isLiveMode && window.API && window.API.uploadInvoiceSlip && inv._dbId){
        await window.API.uploadInvoiceSlip(inv._dbId, dataUrl);
      }
      inv.has_slip = true; setHasSlip(true);
    }catch(ex){ setErr('อัปโหลดสลิปไม่สำเร็จ'); }
    setSlipBusy(false);
  };
  const viewSlip = async()=>{
    try{
      const r = (DATA._isLiveMode && window.API && inv._dbId) ? await window.API.invoiceSlip(inv._dbId) : null;
      if(r && r.image){ const w=window.open('','_blank','width=420,height=640'); if(w){ w.document.write('<title>สลิป</title><img src="'+r.image+'" style="max-width:100%;display:block;margin:0 auto"/>'); w.document.close(); } }
    }catch(ex){}
  };
  const removeSlip = async()=>{
    if(!confirm('ลบสลิปออกจากบิลนี้?')) return;
    setSlipBusy(true);
    try{
      if(DATA._isLiveMode && window.API && inv._dbId) await window.API.uploadInvoiceSlip(inv._dbId, '');
      inv.has_slip = false; setHasSlip(false);
    }catch(ex){ setErr('ลบสลิปไม่สำเร็จ'); }
    setSlipBusy(false);
  };

  const METHOD_OPTS = [
    { v:"transfer", l:"โอนเงิน 🏦" },
    { v:"cash",     l:"เงินสด 💵" },
    { v:"qr",       l:"QR Code 📱" },
    { v:"card",     l:"บัตรเครดิต 💳" },
  ];

  // live net calculation
  const sub     = Math.max(0, parseFloat(subtotal)||0);
  const dval    = Math.max(0, parseFloat(discValue)||0);
  const discAmt = discType==='percent' ? Math.round(sub*Math.min(dval,100)/100)
                : discType==='amount'  ? Math.min(dval, sub) : 0;
  const net     = Math.max(0, sub - discAmt);

  // auto-fill price when package changes
  const handlePkgChange = (val)=>{
    setPkgKey(val);
    if(val){
      const p = packages.find(p=>String(p._dbId||p.id)===val);
      if(p){ setSubtotal(String(p.price)); setNote(p.name||`คอร์ส ${p.sessions} ครั้ง`); }
    } else {
      setSubtotal(""); setNote("");
    }
  };

  const save = async()=>{
    if(!sub||sub<=0){ setErr("กรุณาระบุยอดเต็ม"); return; }
    setBusy(true); setErr(null);
    const stu = DATA.STUDENTS.find(s=>s.id===studentId);
    const pkg = pkgKey ? packages.find(p=>String(p._dbId||p.id)===pkgKey) : null;
    const methodLabel = { transfer:'โอนเงิน', cash:'เงินสด', qr:'QR Code', card:'บัตรเครดิต' }[method]||method;
    const payload = {
      student_id:   stu?._dbId||null,
      package_id:   pkg?._dbId||null,
      category:     (pkg && cat) ? cat : null,
      amount:       net,
      subtotal:     sub,
      discount_type: discType==='none'?null:discType,
      discount_value: discType==='none'?0:dval,
      note:         note||pkg?.name||null,
      payment_method: method,
      _studentName: stu?.name||'-',
    };
    try{
      if(editMode){
        if(DATA._isLiveMode && DATA.updateInvoice){
          await DATA.updateInvoice(inv, payload);
        } else {
          Object.assign(inv, {
            student:stu?.name||inv.student, course:payload.note||inv.course,
            amount:net, subtotal:sub, discount_type:payload.discount_type, discount_value:payload.discount_value,
            payment_method:method, method:methodLabel,
            _studentDbId:stu?._dbId||inv._studentDbId, _packageDbId:pkg?._dbId||null,
          });
          bumpData();
        }
        onSaved("แก้ไขบิลแล้ว ✓");
      } else if(DATA._isLiveMode && window.API && DATA.createInvoice){
        await DATA.createInvoice(payload);
        onSaved("ออกบิลใหม่แล้ว ✓");
      } else {
        const idx = DATA.INVOICES.length+1;
        DATA.INVOICES.unshift({
          id:'INV-'+String(idx).padStart(4,'0'), _dbId:null,
          student:stu?.name||'-', course:payload.note||'คอร์สเรียน',
          amount:net, subtotal:sub, discount_type:payload.discount_type, discount_value:payload.discount_value,
          date:new Date().toISOString().slice(0,10),
          payment_method:method, method:methodLabel, status:'pending',
          _packageDbId:pkg?._dbId||null, _studentDbId:stu?._dbId||null,
        });
        bumpData(); onSaved("ออกบิลใหม่แล้ว ✓");
      }
    }catch(e){ setErr(e.message||"บันทึกไม่สำเร็จ"); setBusy(false); }
  };

  const segBtn = (val, label)=>(
    <button type="button" onClick={()=>setDiscType(val)} style={{
      flex:1, padding:'8px 4px', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer',
      border:'1.5px solid '+(discType===val?'var(--primary)':'var(--border)'),
      background: discType===val?'var(--primary-soft)':'transparent',
      color: discType===val?'var(--primary-ink)':'var(--text-2)' }}>{label}</button>
  );

  return (
    <Drawer title={editMode?"แก้ไขบิล":"ออกบิล / ใบเสร็จ"} sub={editMode?`${inv.id} · แก้ไขรายละเอียดบิล`:"บันทึกการรับชำระเงินจากนักเรียน"} onClose={onClose} accent="var(--ok)"
      footer={<>
        <button className="btn btn-ghost" style={{flex:1}} onClick={onClose} disabled={busy}>ยกเลิก</button>
        <button className="btn btn-primary" style={{flex:1}} onClick={save} disabled={busy||!sub}>
          {busy?'กำลังบันทึก…':<><Icon n="check" size={16}/> {editMode?'บันทึกการแก้ไข':'ออกบิล'}</>}
        </button>
      </>}>
      {err && <div style={{background:'var(--danger-soft)',color:'var(--danger)',borderRadius:8,padding:'9px 13px',fontSize:13,marginBottom:12}}>{err}</div>}
      <div className="field">
        <label>นักเรียน <span style={{color:'var(--danger)'}}>*</span></label>
        <select value={studentId} onChange={e=>setStudentId(e.target.value)}>
          {DATA.STUDENTS.map(s=><option key={s.id} value={s.id}>{DATA.dispName(s)}</option>)}
          {!DATA.STUDENTS.length && <option value="">— ยังไม่มีนักเรียน —</option>}
        </select>
      </div>
      <div className="field">
        <label>แพ็กเกจคอร์ส</label>
        <select value={pkgKey} onChange={e=>handlePkgChange(e.target.value)}>
          <option value="">— ไม่ระบุแพ็กเกจ (กรอกราคาเอง) —</option>
          {packages.map(p=>{
            const pid = String(p._dbId||p.id);
            const dur = (p.duration_min||p.dur||60)===60?'1ชม.':'30น.';
            return <option key={pid} value={pid}>{p.name||`คอร์ส ${p.sessions} ครั้ง`} · {dur} · {DATA.baht(p.price)}</option>;
          })}
        </select>
        {pkgKey && !editMode && <div style={{fontSize:12.5,color:'var(--ok)',marginTop:5,fontWeight:600}}>
          ✓ เมื่อชำระเงินแล้ว ระบบจะเติมครั้งเรียนให้นักเรียนอัตโนมัติ
        </div>}
      </div>
      {/* subject to top up — only relevant when renewing a package for a multi-subject student */}
      {pkgKey && subjects.length>1 && (
        <div className="field">
          <label>เติมครั้งเรียนให้วิชา</label>
          <select value={cat} onChange={e=>setCat(e.target.value)}>
            {subjects.map(c=> <option key={c} value={c}>{(DATA.CATS[c]||{}).label||c}</option>)}
          </select>
          <div style={{fontSize:12,color:'var(--text-3)',marginTop:5}}>เลือกวิชาที่จะต่อคอร์ส (ระบบเติมครั้ง + นับรอบคอร์สให้วิชานี้)</div>
        </div>
      )}
      <div style={{display:'flex',gap:12}}>
        <div className="field" style={{flex:1}}>
          <label>ยอดเต็ม (บาท) <span style={{color:'var(--danger)'}}>*</span></label>
          <input type="number" value={subtotal} onChange={e=>setSubtotal(e.target.value)} placeholder="เช่น 1500" min={1}/>
        </div>
        <div className="field" style={{flex:1}}>
          <label>ช่องทางชำระ</label>
          <select value={method} onChange={e=>setMethod(e.target.value)}>
            {METHOD_OPTS.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        </div>
      </div>

      {/* discount */}
      <div className="field">
        <label>ส่วนลด</label>
        <div style={{display:'flex',gap:8,marginBottom:discType==='none'?0:10}}>
          {segBtn('none','ไม่มี')}
          {segBtn('percent','เปอร์เซ็นต์ %')}
          {segBtn('amount','จำนวนเงิน ฿')}
        </div>
        {discType!=='none' && (
          <div style={{position:'relative'}}>
            <input type="number" value={discValue} onChange={e=>setDiscValue(e.target.value)}
              placeholder={discType==='percent'?'เช่น 10':'เช่น 500'} min={0}
              max={discType==='percent'?100:sub} style={{paddingRight:42}}/>
            <span style={{position:'absolute',right:14,top:'50%',transform:'translateY(-50%)',color:'var(--text-3)',fontWeight:700,fontSize:14}}>
              {discType==='percent'?'%':'฿'}
            </span>
          </div>
        )}
      </div>

      {/* net summary */}
      <div style={{background:'var(--surface-2)',borderRadius:12,padding:'13px 16px',marginBottom:4}}>
        <div style={{display:'flex',justifyContent:'space-between',fontSize:13.5,color:'var(--text-2)',marginBottom:discAmt>0?7:0}}>
          <span>ยอดเต็ม</span><span>{DATA.baht(sub)}</span>
        </div>
        {discAmt>0 && (
          <div style={{display:'flex',justifyContent:'space-between',fontSize:13.5,color:'var(--danger)',marginBottom:7}}>
            <span>ส่วนลด{discType==='percent'?` (${dval}%)`:''}</span><span>−{DATA.baht(discAmt)}</span>
          </div>
        )}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',
          borderTop:discAmt>0?'1px solid var(--border)':'none',paddingTop:discAmt>0?9:0}}>
          <span style={{fontWeight:700,fontSize:14}}>ยอดสุทธิ</span>
          <span style={{fontWeight:700,fontSize:22,fontFamily:'var(--ff-display)',color:'var(--primary-ink)'}}>{DATA.baht(net)}</span>
        </div>
      </div>

      <div className="field">
        <label>หมายเหตุ / รายการ</label>
        <input value={note} onChange={e=>setNote(e.target.value)} placeholder="เช่น คอร์สเปียโน 10 ครั้ง"/>
      </div>

      {editMode && (
        <div className="field">
          <label>สลิปการโอนเงิน</label>
          {hasSlip ? (
            <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
              <span style={{color:'#06a046',fontWeight:600,fontSize:13}}>✓ แนบสลิปแล้ว</span>
              <button type="button" className="btn btn-sm" onClick={viewSlip}>ดูสลิป</button>
              <button type="button" className="btn btn-sm" style={{color:'var(--danger)'}} onClick={removeSlip} disabled={slipBusy}>ลบ</button>
            </div>
          ) : (
            <label className="btn btn-ghost" style={{cursor:'pointer',display:'inline-flex'}}>
              {slipBusy?'กำลังอัปโหลด…':'📎 แนบรูปสลิป'}
              <input type="file" accept="image/*" capture="environment" style={{display:'none'}} onChange={onSlipFile} disabled={slipBusy}/>
            </label>
          )}
          <div style={{fontSize:12,color:'var(--text-3)',marginTop:5}}>รูปจะถูกย่อขนาดอัตโนมัติก่อนบันทึก</div>
        </div>
      )}
    </Drawer>
  );
}
window.Finance = Finance;

/* ---- editable package pricing matrix ---- */
function PackagePricing({ showToast }){
  useDataVersion();
  const isLive = DATA._isLiveMode && Array.isArray(DATA.PACKAGES);
  // demo-mode: use localStorage packages; live-mode: use DATA.PACKAGES
  const [demoPkgs, setDemoPkgs] = useState(()=> DATA.loadPackages());
  const packages = isLive ? DATA.PACKAGES : demoPkgs;

  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingName, setEditingName] = useState(null);
  const [nameDraft, setNameDraft] = useState('');

  const pidOf = (p)=> p._dbId||p.id;
  const startEdit = (p)=>{ setEditing(pidOf(p)); setDraft(String(p.price)); };
  const startEditName = (p)=>{ setEditingName(pidOf(p)); setNameDraft(p.name||''); };
  const commitName = async(p)=>{
    const v = (nameDraft||'').trim() || `คอร์ส ${p.sessions} ครั้ง`;
    if(isLive && DATA.updatePackage){
      try{ await DATA.updatePackage(p._dbId, {name:v}); showToast('บันทึกชื่อคอร์สแล้ว ✓'); }
      catch(e){ showToast('บันทึกไม่สำเร็จ ❌'); }
    } else {
      setDemoPkgs(prev=> prev.map(x=> x.id===p.id ? {...x, name:v} : x));
      showToast('บันทึกชื่อคอร์สแล้ว ✓');
    }
    setEditingName(null);
  };

  const commit = async(p)=>{
    const v = Math.max(0, parseInt(String(draft).replace(/[^0-9]/g,''),10)||0);
    if(isLive && DATA.updatePackage){
      try{ await DATA.updatePackage(p._dbId, {price:v}); showToast('บันทึกราคาใหม่แล้ว ✓'); }
      catch(e){ showToast('บันทึกไม่สำเร็จ ❌'); }
    } else {
      DATA.savePackagePrice(p.id, v);
      setDemoPkgs(prev=> prev.map(x=> x.id===p.id ? {...x, price:v} : x));
      showToast('บันทึกราคาใหม่แล้ว ✓');
    }
    setEditing(null);
  };

  const del = async(p)=>{
    if(!confirm(`ลบแพ็กเกจ "${p.name}"?`)) return;
    if(isLive && DATA.deletePackage){
      try{ await DATA.deletePackage(p._dbId); showToast('ลบแพ็กเกจแล้ว'); }
      catch(e){ showToast('ลบไม่สำเร็จ ❌'); }
    }
  };

  const resetAll = ()=>{
    localStorage.removeItem('bm-packages');
    setDemoPkgs(DATA.PACKAGES_DEFAULT.map(p=>({...p})));
    setEditing(null);
    showToast('คืนค่าราคาตั้งต้นแล้ว');
  };

  return (
    <div className="card card-pad">
      <SectionHead title="ราคาแพ็กเกจคอร์ส">
        <span style={{ fontSize:12.5, color:'var(--text-3)' }} className="hide-mobile">คลิกที่ชื่อหรือราคาเพื่อแก้ไข</span>
        {isLive
          ? <button className="btn btn-primary btn-sm" onClick={()=>setAdding(true)}><Icon n="plus" size={15}/> เพิ่มแพ็กเกจ</button>
          : <button className="btn btn-ghost btn-sm" onClick={resetAll}>คืนค่าตั้งต้น</button>
        }
      </SectionHead>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:14, marginTop:4 }}>
        {packages.map(p=>{
          const dur = (p.duration_min||p.dur||60)===60 ? '1 ชม.' : (p.duration_min||p.dur||60)===30 ? '30 นาที' : `${p.duration_min||p.dur} น.`;
          const per = p.sessions>0 ? Math.round(p.price/p.sessions) : 0;
          const pid = pidOf(p);
          const isEd = editing===pid;
          return (
            <div key={pid} className="card" style={{ padding:18, borderTop:`3px solid ${(p.duration_min||p.dur||60)===60?"var(--primary)":"var(--c-piano)"}`, position:'relative' }}>
              {(p.is_default||p.popular) && <span className="badge" style={{ position:'absolute', top:12, right:12, background:'var(--primary)', color:'#fff', fontSize:11 }}>ยอดนิยม</span>}
              {editingName===pid ? (
                <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                  <input autoFocus value={nameDraft} onChange={e=>setNameDraft(e.target.value)}
                    onKeyDown={e=>{ if(e.key==='Enter') commitName(p); if(e.key==='Escape') setEditingName(null); }}
                    placeholder={`คอร์ส ${p.sessions} ครั้ง`}
                    style={{ flex:1, minWidth:0, border:'1px solid var(--primary)', borderRadius:8, padding:'5px 8px', fontSize:13, fontWeight:600, outline:'none', boxShadow:'0 0 0 3px var(--primary-soft)' }}/>
                  <button className="icon-btn" style={{ width:28, height:28, border:0, color:'var(--ok)' }} onClick={()=>commitName(p)}><Icon n="check" size={15}/></button>
                  <button className="icon-btn" style={{ width:28, height:28, border:0 }} onClick={()=>setEditingName(null)}><Icon n="x" size={14}/></button>
                </div>
              ) : (
                <div onClick={()=>startEditName(p)} title="คลิกเพื่อแก้ชื่อคอร์ส"
                  style={{ fontSize:13, color:'var(--text-2)', fontWeight:600, cursor:'pointer', display:'inline-flex', alignItems:'center', gap:5 }}>
                  {p.name||`คอร์ส ${p.sessions} ครั้ง`}
                  <Icon n="edit" size={12} style={{ opacity:0.5 }}/>
                </div>
              )}
              <div style={{ fontSize:12.5, color:'var(--text-3)', marginTop:2 }}>{p.sessions} ครั้ง · {dur} / ครั้ง</div>

              <div style={{ marginTop:16, minHeight:46 }}>
                {isEd ? (
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <span style={{ fontFamily:'var(--ff-display)', fontWeight:700, fontSize:22, color:'var(--primary-ink)' }}>฿</span>
                    <input autoFocus value={draft} onChange={e=>setDraft(e.target.value)}
                      onKeyDown={e=>{ if(e.key==='Enter') commit(p); if(e.key==='Escape') setEditing(null); }}
                      style={{ width:'100%', border:'1px solid var(--primary)', borderRadius:9, padding:'7px 10px',
                        fontFamily:'var(--ff-display)', fontWeight:700, fontSize:20, color:'var(--primary-ink)', outline:'none',
                        boxShadow:'0 0 0 3px var(--primary-soft)' }}/>
                  </div>
                ) : (
                  <div onClick={()=>startEdit(p)} style={{ cursor:'pointer', display:'inline-flex', alignItems:'baseline' }}>
                    <div style={{ fontFamily:'var(--ff-display)', fontWeight:700, fontSize:28, color:'var(--primary-ink)', letterSpacing:'-0.02em' }}>{DATA.baht(p.price)}</div>
                  </div>
                )}
                {!isEd && <div style={{ fontSize:12, color:'var(--text-3)', marginTop:3 }}>เฉลี่ย {DATA.baht(per)}/ครั้ง</div>}
              </div>

              <div style={{ marginTop:14 }}>
                {isEd ? (
                  <div style={{ display:'flex', gap:8 }}>
                    <button className="btn btn-ghost btn-sm" style={{ flex:1 }} onClick={()=>setEditing(null)}>ยกเลิก</button>
                    <button className="btn btn-primary btn-sm" style={{ flex:1 }} onClick={()=>commit(p)}><Icon n="check" size={15}/> บันทึก</button>
                  </div>
                ) : (
                  <div style={{ display:'flex', gap:8 }}>
                    <button className="btn btn-soft btn-sm" style={{ flex:1 }} onClick={()=>startEdit(p)}><Icon n="edit" size={15}/> แก้ไขราคา</button>
                    {isLive && <button className="icon-btn" style={{ border:0, color:'var(--danger)' }} title="ลบแพ็กเกจ" onClick={()=>del(p)}><Icon n="x" size={14}/></button>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {packages.length===0 && (
          <div style={{ gridColumn:'1/-1', textAlign:'center', padding:'48px 20px', color:'var(--text-3)' }}>
            <div style={{ fontSize:32, marginBottom:12 }}>📦</div>
            <div style={{ fontWeight:600 }}>ยังไม่มีแพ็กเกจ</div>
            <div style={{ fontSize:13, marginTop:6 }}>กดปุ่ม "เพิ่มแพ็กเกจ" เพื่อสร้างแพ็กเกจแรก</div>
          </div>
        )}
      </div>

      {!isLive && <div style={{ marginTop:18, padding:'13px 15px', background:'var(--surface-2)', borderRadius:12, fontSize:13, color:'var(--text-2)', display:'flex', gap:9, alignItems:'flex-start' }}>
        <Icon n="star" size={17}/> <span>ราคานี้ใช้ร่วมทุกคลาส — ราคาที่แก้ไขจะถูกบันทึกไว้อัตโนมัติ</span>
      </div>}

      {adding && <AddPackageDrawer onClose={()=>setAdding(false)} onSaved={()=>{ setAdding(false); showToast('เพิ่มแพ็กเกจใหม่แล้ว ✓'); }}/>}
    </div>
  );
}

/* ---- add package drawer ---- */
function AddPackageDrawer({ onClose, onSaved }){
  const [f, setF] = useState({ name:'', sessions:'10', duration_min:'60', price:'' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const set = (k,v)=>setF(p=>({...p,[k]:v}));
  const priceNum = parseFloat(f.price)||0;
  const sessNum  = parseInt(f.sessions)||1;
  const perClass = priceNum>0 && sessNum>0 ? Math.round(priceNum/sessNum) : 0;

  const save = async()=>{
    if(!f.price){ setErr('กรุณาระบุราคา'); return; }
    setBusy(true); setErr(null);
    const payload = {
      name: f.name.trim() || `คอร์ส ${f.sessions} ครั้ง`,
      sessions: parseInt(f.sessions)||10,
      duration_min: parseInt(f.duration_min)||60,
      price: parseFloat(f.price)||0,
    };
    if(DATA._isLiveMode && DATA.addPackage){
      try{ await DATA.addPackage(payload); onSaved(); }
      catch(e){ setErr(e.message||'บันทึกไม่สำเร็จ'); setBusy(false); }
    } else {
      bumpData(); onSaved();
    }
  };

  return (
    <Drawer title="เพิ่มแพ็กเกจใหม่" sub="กำหนดจำนวนครั้งและราคา" onClose={onClose} accent="var(--primary)"
      footer={<>
        <button className="btn btn-ghost" style={{flex:1}} onClick={onClose} disabled={busy}>ยกเลิก</button>
        <button className="btn btn-primary" style={{flex:1}} onClick={save} disabled={busy||!f.price}>
          {busy?'กำลังบันทึก…':<><Icon n="check" size={16}/> เพิ่มแพ็กเกจ</>}
        </button>
      </>}>
      {err && <div style={{background:'var(--danger-soft)',color:'var(--danger)',borderRadius:8,padding:'9px 13px',fontSize:13,marginBottom:12}}>{err}</div>}
      <div className="field">
        <label>ชื่อแพ็กเกจ</label>
        <input value={f.name} onChange={e=>set('name',e.target.value)} placeholder={`คอร์ส ${f.sessions} ครั้ง`}/>
        <div style={{fontSize:12,color:'var(--text-3)',marginTop:4}}>ถ้าไม่ระบุจะใช้ชื่อจากจำนวนครั้งอัตโนมัติ</div>
      </div>
      <div style={{display:'flex',gap:12}}>
        <div className="field" style={{flex:1}}>
          <label>จำนวนครั้ง</label>
          <select value={f.sessions} onChange={e=>set('sessions',e.target.value)}>
            {[4,8,10,12,16,20,24].map(n=><option key={n} value={n}>{n} ครั้ง</option>)}
          </select>
        </div>
        <div className="field" style={{flex:1}}>
          <label>ระยะเวลา/ครั้ง</label>
          <select value={f.duration_min} onChange={e=>set('duration_min',e.target.value)}>
            <option value={30}>30 นาที</option>
            <option value={60}>1 ชั่วโมง</option>
            <option value={90}>1.5 ชั่วโมง</option>
          </select>
        </div>
      </div>
      <div className="field">
        <label>ราคา (บาท) <span style={{color:'var(--danger)'}}>*</span></label>
        <input type="number" value={f.price} onChange={e=>set('price',e.target.value)} placeholder="เช่น 3500" min={0}/>
        {perClass>0 && <div style={{fontSize:12.5,color:'var(--primary-ink)',marginTop:5,fontWeight:600}}>เฉลี่ย {DATA.baht(perClass)}/ครั้ง</div>}
      </div>
    </Drawer>
  );
}
window.PackagePricing = PackagePricing;

Object.assign(window, { Students, Teachers, Finance });
