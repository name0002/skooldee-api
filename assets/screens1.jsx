/* ============ บ้านมาริ — Dashboard & Schedule ============ */

/* ===================== DASHBOARD ===================== */
// Dashboard card: parents' replies to the "confirm class 1 day before" LINE reminder.
// Live-mode only (needs the API). Day toggle: today / tomorrow.
function ClassConfirmCard(){
  const [when, setWhen] = React.useState('tomorrow');   // today | tomorrow
  const [rows, setRows] = React.useState(null);          // null = loading
  const dateFor = (off)=>{ const d=new Date(); d.setDate(d.getDate()+off); return d.toISOString().slice(0,10); };
  React.useEffect(()=>{
    let alive=true; setRows(null);
    const date = dateFor(when==='today'?0:1);
    window.API.classConfirmations(date)
      .then(r=>{ if(alive) setRows(Array.isArray(r)?r:[]); })
      .catch(()=>{ if(alive) setRows([]); });
    return ()=>{ alive=false; };
  }, [when]);
  const list = rows||[];
  const n = (st)=> list.filter(x=>x.status===st).length;
  const STT = { confirmed:{c:'var(--ok)',t:'มาเรียน'}, cancelled:{c:'var(--danger)',t:'ลา'}, pending:{c:'var(--text-3)',t:'รอตอบ'} };
  const tab = (key,label)=>(
    <button onClick={()=>setWhen(key)} style={{ flex:1, padding:'6px 0', fontSize:12.5, fontWeight:600, borderRadius:8,
      border:'none', cursor:'pointer', background: when===key?'var(--primary)':'var(--surface-2)', color: when===key?'#fff':'var(--text-2)' }}>{label}</button>
  );
  const chip = (val,label,color)=>(
    <span style={{ flex:1, textAlign:'center', padding:'6px 2px', borderRadius:8, background:'var(--surface-2)', fontSize:12.5 }}>
      <b style={{ color, fontSize:15 }}>{val}</b> {label}
    </span>
  );
  return (
    <div className="card card-pad">
      <SectionHead title="ยืนยันคลาส · LINE"/>
      <div style={{ display:'flex', gap:6, marginBottom:12 }}>{tab('today','วันนี้')}{tab('tomorrow','พรุ่งนี้')}</div>
      {rows===null
        ? <div style={{ textAlign:'center', padding:'14px', color:'var(--text-3)', fontSize:13 }}>กำลังโหลด…</div>
        : list.length===0
        ? <div style={{ textAlign:'center', padding:'18px 8px', color:'var(--text-3)', fontSize:13 }}>
            <div style={{ fontSize:22, marginBottom:4 }}>📅</div>{when==='today'?'วันนี้':'พรุ่งนี้'}ไม่มีคาบเรียน</div>
        : <>
            <div style={{ display:'flex', gap:8, marginBottom:10 }}>
              {chip(n('confirmed'),'มา','var(--ok)')}{chip(n('cancelled'),'ลา','var(--danger)')}{chip(n('pending'),'รอตอบ','var(--text-2)')}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:2, maxHeight:230, overflowY:'auto' }}>
              {list.map(x=>{ const st=STT[x.status]||STT.pending; return (
                <div key={x.student_id} style={{ display:'flex', alignItems:'center', gap:9, padding:'7px 6px' }}>
                  <Avatar name={x.name} size={30}/>
                  <div style={{ flex:1, minWidth:0, fontSize:13.5, fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{x.nickname||x.name}</div>
                  <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:12, color:st.c, fontWeight:600 }}>
                    <span className="dotmark" style={{ background:st.c, width:8, height:8 }}></span>{st.t}
                  </span>
                </div>
              );})}
            </div>
          </>}
    </div>
  );
}

function Dashboard({ go }){
  const totalStudents = DATA.STUDENTS.filter(s=>s.status!=="paused").length;
  const todayCount = DATA.TODAY.length;
  const monthRev = DATA.REVENUE.length ? DATA.REVENUE[DATA.REVENUE.length-1].v : 0;
  const prevRev  = DATA.REVENUE.length>1 ? DATA.REVENUE[DATA.REVENUE.length-2].v : 0;
  const revDelta = prevRev>0 ? (((monthRev-prevRev)/prevRev)*100).toFixed(1) : '0.0';
  const currMonthLabel = DATA.REVENUE.length ? DATA.REVENUE[DATA.REVENUE.length-1].m : '';
  const outstanding = DATA.STUDENTS.reduce((a,s)=>a+s.balance,0);
  const nowYM = new Date().toISOString().slice(0,7);
  const newThisMonth = DATA.STUDENTS.filter(s=>s.joined && s.joined.startsWith(nowYM)).length;
  const remainingToday = DATA.TODAY.filter(c=>c.status!=='done').length;

  // student mix by category
  const mix = Object.values(DATA.CATS).map(c=>({
    label:c.label, color:c.color,
    v: DATA.STUDENTS.filter(s=>s.cats.includes(c.key)).length
  })).filter(m=>m.v>0);

  const followUp = DATA.STUDENTS.filter(s=> s.balance>0 || DATA.isNearEnding(s));
  const nearList = DATA.STUDENTS.filter(DATA.isNearEnding);
  const _h = new Date().getHours();
  const greeting = _h<12 ? 'สวัสดีตอนเช้า' : _h<17 ? 'สวัสดีตอนบ่าย' : _h<21 ? 'สวัสดีตอนเย็น' : 'สวัสดี';
  const canFinance = ['owner','admin','finance'].includes((DATA._userRaw&&DATA._userRaw.role)||'owner');

  // first-run setup checklist — guides new owners through initial setup, in order
  const setupSteps = [
    { key:'teachers', done: DATA.TEACHERS.length>0,                     icon:'teacher',  page:'teachers', label:'เพิ่มครูผู้สอน',   hint:'ครูที่จะสอนในโรงเรียน' },
    { key:'packages', done: !!(DATA.PACKAGES&&DATA.PACKAGES.length),    icon:'wallet',   page:'finance',  label:'ตั้งแพ็กเกจคอร์ส', hint:'กำหนดจำนวนคาบและราคา' },
    { key:'students', done: DATA.STUDENTS.length>0,                     icon:'users',    page:'students', label:'เพิ่มนักเรียน',     hint:'ข้อมูลนักเรียนและผู้ปกครอง' },
    { key:'schedule', done: DATA.SCHEDULE.length>0,                     icon:'calendar', page:'schedule', label:'สร้างตารางเรียน',   hint:'จองคาบเรียนประจำสัปดาห์' },
  ];
  const setupDone  = setupSteps.filter(s=>s.done).length;
  const showSetup  = DATA._isLiveMode && setupDone < setupSteps.length;

  return (
    <div className="content-inner">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:22, flexWrap:"wrap", gap:12 }}>
        <div>
          <h1 style={{ fontFamily:"var(--ff-display)", fontSize:26, fontWeight:700, margin:0, letterSpacing:"-0.02em" }}>{greeting} {DATA.SCHOOL.owner} 👋</h1>
          <p style={{ color:"var(--text-2)", margin:"5px 0 0", fontSize:14.5 }}>วันนี้มี <b style={{color:"var(--primary-ink)"}}>{todayCount} คาบเรียน</b> · มีนักเรียน {followUp.length} คนที่ต้องติดตาม</p>
        </div>
        <button className="btn btn-primary" onClick={()=>go("schedule")}><Icon n="plus" size={18}/> จองคาบเรียน</button>
      </div>

      {showSetup && (
        <div style={{ border:"1px solid var(--border)", borderRadius:16, padding:"18px 20px", marginBottom:18,
          background:"linear-gradient(135deg, var(--primary-soft), var(--surface))" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, marginBottom:14, flexWrap:"wrap" }}>
            <div>
              <div style={{ fontWeight:700, fontSize:16 }}>🚀 เริ่มต้นใช้งาน skooldee</div>
              <div style={{ fontSize:13, color:"var(--text-2)", marginTop:2 }}>ทำ {setupSteps.length} ขั้นนี้ให้ครบ แล้วโรงเรียนของคุณก็พร้อมใช้งานเต็มรูปแบบ</div>
            </div>
            <div style={{ fontWeight:700, fontSize:14, color:"var(--primary-ink)", whiteSpace:"nowrap" }}>{setupDone}/{setupSteps.length} เสร็จแล้ว</div>
          </div>
          {/* progress bar */}
          <div style={{ height:7, borderRadius:99, background:"var(--surface-2)", overflow:"hidden", marginBottom:16 }}>
            <div style={{ height:"100%", width:`${(setupDone/setupSteps.length)*100}%`, background:"var(--primary)", borderRadius:99, transition:"width .3s" }}/>
          </div>
          <div style={{ display:"grid", gap:8 }}>
            {setupSteps.map((s,i)=>{
              const isNext = !s.done && setupSteps.slice(0,i).every(x=>x.done);
              return (
                <div key={s.key} onClick={()=>go(s.page)} style={{ display:"flex", alignItems:"center", gap:13, padding:"11px 13px", borderRadius:11, cursor:"pointer",
                  background: s.done ? "transparent" : "var(--surface)",
                  border: isNext ? "1.5px solid var(--primary)" : "1px solid var(--border)",
                  opacity: s.done ? 0.65 : 1 }}>
                  <div style={{ width:30, height:30, borderRadius:9, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center",
                    background: s.done ? "var(--ok)" : "var(--primary-soft)", color: s.done ? "#fff" : "var(--primary-ink)" }}>
                    {s.done ? <Icon n="check" size={16}/> : <Icon n={s.icon} size={16}/>}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:600, fontSize:14, textDecoration: s.done?"line-through":"none" }}>{i+1}. {s.label}</div>
                    <div style={{ fontSize:12, color:"var(--text-3)" }}>{s.hint}</div>
                  </div>
                  {s.done
                    ? <span style={{ fontSize:12.5, color:"var(--ok)", fontWeight:600, whiteSpace:"nowrap" }}>✓ เสร็จแล้ว</span>
                    : <span style={{ fontSize:13, color: isNext?"var(--primary-ink)":"var(--text-3)", fontWeight:600, whiteSpace:"nowrap" }}>{isNext?"เริ่มเลย →":"→"}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {DATA._isLiveMode && DATA.ENROLLMENTS && DATA.ENROLLMENTS.length > 0 && (
        <div onClick={()=>go("students")} style={{ display:"flex", alignItems:"center", gap:13, padding:"13px 16px", borderRadius:14,
          background:"#ede9fe", border:"1.5px solid #8b5cf6", marginBottom:18, cursor:"pointer" }}>
          <div style={{ fontSize:22 }}>📝</div>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:700, color:"#5b21b6", fontSize:14.5 }}>มีผู้สมัครเรียนใหม่ {DATA.ENROLLMENTS.length} คน รอพิจารณา</div>
            <div style={{ fontSize:13, color:"#6d28d9", marginTop:1 }}>
              {DATA.ENROLLMENTS.slice(0,3).map(e=>e.student_name).join(" · ")}{DATA.ENROLLMENTS.length>3?` และอีก ${DATA.ENROLLMENTS.length-3} คน`:""}
            </div>
          </div>
          <button className="btn btn-sm" style={{ background:"#7c3aed", color:"#fff", border:"none", whiteSpace:"nowrap" }}
            onClick={e=>{e.stopPropagation();go("students");}}>ดูรายชื่อ →</button>
        </div>
      )}

      {nearList.length>0 && (
        <div onClick={()=>go("students")} style={{ display:"flex", alignItems:"center", gap:13, padding:"13px 16px", borderRadius:14,
          background:"var(--danger-soft)", border:"1px solid color-mix(in oklch,var(--danger) 22%,var(--border))", marginBottom:18, cursor:"pointer" }}>
          <div style={{ fontSize:22 }}>⚠️</div>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:700, color:"color-mix(in oklch,var(--danger) 80%,black)", fontSize:14.5 }}>มีนักเรียน {nearList.length} คนคอร์สใกล้หมด</div>
            <div style={{ fontSize:13, color:"color-mix(in oklch,var(--danger) 65%,black)", marginTop:1 }}>
              {nearList.slice(0,4).map(s=>`${s.name} (เหลือ ${s.remaining})`).join(" · ")}{nearList.length>4?` และอีก ${nearList.length-4} คน`:""} — ควรชวนต่อคอร์ส
            </div>
          </div>
          <button className="btn btn-sm hide-mobile" style={{ background:"#06c755", color:"#fff" }} onClick={(e)=>{ e.stopPropagation(); go("students"); }}><Icon n="bell" size={14}/> แจ้ง LINE</button>
        </div>
      )}

      {/* stats */}
      <div className="stat-grid" style={{ marginBottom:18 }}>
        <Stat label="นักเรียนกำลังเรียน" val={totalStudents} icon="users" tone="var(--c-piano)"
          meta={newThisMonth>0
            ? <span className="trend-up"><Icon n="trendUp" size={14}/> +{newThisMonth} เดือนนี้</span>
            : <span style={{color:"var(--text-3)"}}>นักเรียนที่ยังเรียนอยู่</span>}/>
        <Stat label="คาบเรียนวันนี้" val={todayCount} icon="calendar" tone="var(--c-dance)"
          meta={<span style={{color:"var(--text-3)"}}>เหลืออีก {remainingToday} คาบ</span>}/>
        {canFinance && <>
        <Stat label={`รายได้เดือน ${currMonthLabel}`} val={DATA.baht(monthRev)} icon="wallet" tone="var(--c-guitar)" big
          meta={Number(revDelta)>=0
            ? <span className="trend-up"><Icon n="trendUp" size={14}/> +{revDelta}% จากเดือนก่อน</span>
            : <span style={{color:"var(--danger)",fontWeight:600,display:"flex",alignItems:"center",gap:3,fontSize:12}}><Icon n="trendDown" size={14}/> {revDelta}% จากเดือนก่อน</span>}/>
        <Stat label="ยอดค้างชำระ" val={DATA.baht(outstanding)} icon="receipt" tone="var(--danger)" big
          meta={<span style={{color:"var(--danger)"}}>{followUp.filter(s=>s.balance>0).length} รายการ</span>}/>
        </>}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1.6fr 1fr", gap:18, alignItems:"start" }} className="dash-cols">
        {/* left */}
        <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
          <div className="card card-pad">
            <SectionHead title="รายได้ย้อนหลัง 7 เดือน">
              <span className="badge" style={{ background:"var(--ok-soft)", color:"color-mix(in oklch,var(--ok) 75%,black)" }}>
                <Icon n="trendUp" size={14}/> {prevRev>0 ? `+${revDelta}%` : 'เดือนนี้'}
              </span>
            </SectionHead>
            <BarChart data={DATA.REVENUE} height={150} color="var(--primary)"/>
          </div>

          <div className="card">
            <div className="card-pad" style={{ paddingBottom:6 }}>
              <SectionHead title={`ตารางวันนี้ · ${DATA.TODAY_LABEL}`}>
                <button className="btn btn-soft btn-sm" onClick={()=>go("schedule")}>ดูทั้งหมด <Icon n="chevron" size={14}/></button>
              </SectionHead>
            </div>
            <div style={{ padding:"0 8px 8px" }}>
              {DATA.TODAY.length===0
                ? <div style={{ textAlign:"center", padding:"22px 16px", color:"var(--text-3)", fontSize:13.5 }}>
                    <div style={{ fontSize:28, marginBottom:6 }}>📅</div>
                    วันนี้ไม่มีคาบเรียน
                  </div>
                : DATA.TODAY.map((c,i)=> <TodayRow key={i} c={c}/>)}
            </div>
          </div>
        </div>

        {/* right */}
        <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
          {DATA._isLiveMode && window.API && window.API.classConfirmations && <ClassConfirmCard/>}
          <div className="card card-pad">
            <SectionHead title="สัดส่วนนักเรียน"/>
            <div style={{ display:"flex", gap:18, alignItems:"center" }}>
              <Donut segments={mix} size={132}/>
              <div style={{ flex:1, display:"flex", flexDirection:"column", gap:9 }}>
                {mix.map((m,i)=>(
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:9, fontSize:13.5 }}>
                    <span className="dotmark" style={{ background:m.color, width:10, height:10 }}></span>
                    <span style={{ flex:1, color:"var(--text-2)" }}>{m.label}</span>
                    <b>{m.v}</b>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card card-pad">
            <SectionHead title="ต้องติดตาม">
              {followUp.length>0 && <span className="nav-badge" style={{ background:"var(--danger)" }}>{followUp.length}</span>}
            </SectionHead>
            <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
              {followUp.length===0 && <div style={{ textAlign:"center", padding:"18px 8px", color:"var(--text-3)", fontSize:13 }}>
                <div style={{ fontSize:24, marginBottom:4 }}>✓</div>ทุกอย่างเรียบร้อยดี
              </div>}
              {followUp.map(s=>(
                <div key={s.id} onClick={()=>go("students")} style={{ display:"flex", alignItems:"center", gap:11, padding:"9px 8px", borderRadius:11, cursor:"pointer" }}
                  onMouseEnter={e=>e.currentTarget.style.background="var(--surface-2)"} onMouseLeave={e=>e.currentTarget.style.background=""}>
                  <Avatar name={s.name} size={36}/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:600, fontSize:14 }}>{s.name}</div>
                    <div style={{ fontSize:12, color:"var(--text-3)" }}>{s.teacher}</div>
                  </div>
                  {s.balance>0
                    ? <span className="badge" style={{ background:"var(--danger-soft)", color:"color-mix(in oklch,var(--danger) 78%,black)" }}>ค้าง {DATA.baht(s.balance)}</span>
                    : <span className="badge" style={{ background:"var(--warn-soft)", color:"color-mix(in oklch,var(--warn) 70%,black)" }}>ใกล้หมด · {s.remaining} ครั้ง</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, val, icon, tone, meta, big }){
  return (
    <div className="card stat">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <div className="stat-label">{label}</div>
        <div style={{ width:34, height:34, borderRadius:10, display:"grid", placeItems:"center",
          background:`color-mix(in oklch, ${tone} 14%, white)`, color:tone }}>
          <Icon n={icon} size={18}/>
        </div>
      </div>
      <div className="stat-val" style={{ fontSize: big?26:30 }}>{val}</div>
      <div className="stat-meta">{meta}</div>
    </div>
  );
}

function TodayRow({ c }){
  const cat = DATA.CATS[c.cat] || Object.values(DATA.CATS)[0] || { color:"var(--primary)", icon:"📚", label:"" };
  const stMap = { done:{t:"จบแล้ว",c:"var(--text-3)"}, now:{t:"กำลังเรียน",c:"var(--ok)"}, next:{t:"ถัดไป",c:"var(--text-3)"} };
  const st = stMap[c.status];
  return (
    <div style={{ display:"flex", alignItems:"center", gap:13, padding:"11px 12px", borderRadius:11,
      background: c.status==="now" ? "var(--primary-soft)" : "transparent", marginBottom:2,
      opacity: c.status==="done"?0.55:1 }}>
      <div style={{ textAlign:"center", minWidth:46 }}>
        <div style={{ fontWeight:700, fontFamily:"var(--ff-display)", fontSize:15 }}>{c.time}</div>
      </div>
      <div style={{ width:3, alignSelf:"stretch", borderRadius:3, background:cat.color }}></div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontWeight:600, fontSize:14.5 }}>{cat.icon} {cat.label} <span style={{ color:"var(--text-3)", fontWeight:400, fontSize:12.5 }}>{c.time}–{c.end}</span></div>
        <div style={{ fontSize:12.5, color:"var(--text-3)" }}>{DATA.dispName(c.student)} · {c.teacher} · {c.room}</div>
      </div>
      {c.status==="now"
        ? <span className="badge" style={{ background:"var(--ok)", color:"#fff" }}>● สด</span>
        : <span style={{ fontSize:12.5, color:st.c, fontWeight:600 }}>{st.t}</span>}
    </div>
  );
}
window.Dashboard = Dashboard;

/* ===================== SCHEDULE ===================== */
function Schedule(){
  const [filter, setFilter] = useState("all");
  const [sel, setSel] = useState(null);   // selected class
  const [booking, setBooking] = useState(null); // {day,t} for new
  const [toast, showToast] = useToast();
  const [weekOffset, setWeekOffset] = useState(0); // 0=this week, -1=last, +1=next
  const [makeupOpen, setMakeupOpen] = useState(false);
  const [viewMode, setViewMode] = useState("day"); // "day" = columns are weekdays · "room" = columns are rooms
  const [roomDay, setRoomDay] = useState(()=> typeof DATA._todayDow==='number' ? DATA._todayDow : (new Date().getDay()+6)%7);

  const items = DATA.SCHEDULE.filter(s=> filter==="all" || s.cat===filter);
  const totalMin = DATA.DAY_END - DATA.DAY_START;
  const H = totalMin * DATA.PX_PER_MIN;
  const hours = [];
  for(let h=Math.floor(DATA.DAY_START/60); h<=Math.floor(DATA.DAY_END/60); h++) hours.push(h);
  const topOf = (min)=> (min - DATA.DAY_START) * DATA.PX_PER_MIN;
  const fmtMin = (min)=> `${String(Math.floor(min/60)).padStart(2,"0")}:${String(min%60).padStart(2,"0")}`;
  const _todayDow = typeof DATA._todayDow==='number' ? DATA._todayDow : (new Date().getDay()+6)%7;
  const TODAY_COL = weekOffset===0 ? _todayDow : -1; // only highlight today column on current week
  // compute displayed week's start date (offset by weekOffset * 7 days)
  const _thaiMons = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const _baseStart = DATA._weekStart || (()=>{ const d=new Date(); d.setDate(d.getDate()-_todayDow); d.setHours(0,0,0,0); return d; })();
  const _wd = new Date(_baseStart); _wd.setDate(_baseStart.getDate() + weekOffset*7);
  const _we = new Date(_wd); _we.setDate(_wd.getDate()+6);
  const weekLabel = _wd.getMonth()===_we.getMonth()
    ? `${_wd.getDate()} – ${_we.getDate()} ${_thaiMons[_wd.getMonth()]} ${_wd.getFullYear()+543}`
    : `${_wd.getDate()} ${_thaiMons[_wd.getMonth()]} – ${_we.getDate()} ${_thaiMons[_we.getMonth()]} ${_wd.getFullYear()+543}`;
  const dayDates = DATA.DAYS.map((_d,i)=>{ const d2=new Date(_wd); d2.setDate(_wd.getDate()+i); return { date:d2.getDate(), mon:_thaiMons[d2.getMonth()] }; });
  const weekHint = weekOffset===0 ? 'สัปดาห์นี้' : weekOffset===-1 ? 'สัปดาห์ที่แล้ว' : weekOffset===1 ? 'สัปดาห์หน้า' : (weekOffset>0?`อีก ${weekOffset} สัปดาห์`:`${Math.abs(weekOffset)} สัปดาห์ก่อน`);

  // date-specific exceptions for the displayed week
  const _ymd = (d)=> d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  const weekDateStrs = DATA.DAYS.map((_d,i)=>{ const d2=new Date(_wd); d2.setDate(_wd.getDate()+i); return _ymd(d2); });
  const EXC = DATA.EXCEPTIONS||[];
  const cancelByKey = {}; EXC.filter(e=>e.type==='cancel').forEach(e=>{ cancelByKey[e.slot_id+'|'+e.date]=e; });
  const makeups = EXC.filter(e=>e.type==='makeup' && weekDateStrs.indexOf(e.date)>=0 && (filter==='all'||e.cat===filter))
    .map(e=>({ ...e, day: weekDateStrs.indexOf(e.date), _makeup:true }));
  const byDay = DATA.DAYS.map((d,di)=> DATA.layoutDay([ ...items.filter(s=>s.day===di).map(s=>({ ...s, _src:s })), ...makeups.filter(m=>m.day===di) ]));

  // ---- per-day student counts, broken down by subject (shown in column headers) ----
  const dayStats = byDay.map(evs=>{
    let total=0; const byCat={};
    evs.forEach(e=>{ const n=(e._studentDbIds&&e._studentDbIds.length)?e._studentDbIds.length:1; total+=n; byCat[e.cat]=(byCat[e.cat]||0)+n; });
    return { total, byCat };
  });

  // ---- room view: columns are rooms, for one selected weekday ----
  const UNASSIGNED = '— ไม่ระบุห้อง —';
  const allRooms = Array.from(new Set((DATA.SCHEDULE||[]).map(s=>s.room).filter(r=>r&&r!=='-')));
  if(!allRooms.length) Object.values(DATA.CATS).forEach(c=>{ if(c.room && allRooms.indexOf(c.room)<0) allRooms.push(c.room); });
  const roomDayItems = items.filter(s=>s.day===roomDay);
  const hasUnassigned = roomDayItems.some(s=> !s.room || s.room==='-' || allRooms.indexOf(s.room)<0);
  const roomCols = hasUnassigned ? [...allRooms, UNASSIGNED] : allRooms;
  const byRoom = roomCols.map(rm=> DATA.layoutDay(roomDayItems.filter(s=>
    rm===UNASSIGNED ? (!s.room || s.room==='-' || allRooms.indexOf(s.room)<0) : (s.room===rm)
  )));
  const roomDateStr = weekDateStrs[roomDay];

  // ---- drag-to-reschedule (day view) ----
  const gridRef = React.useRef(null);
  const dragRef = React.useRef(null);        // live drag session (mutable, no re-render)
  const justDraggedRef = React.useRef(false); // suppress the click that follows a drag
  const [ghost, setGhost] = useState(null);   // { day, startMin } drop preview
  const [moveAsk, setMoveAsk] = useState(null); // pending move → confirm popup
  const _toMinT = (t)=>{ const p=String(t).split(':').map(Number); return p[0]*60+(p[1]||0); };

  const pointToDayTime = (clientX, clientY, durMin)=>{
    const grid = gridRef.current; if(!grid) return null;
    const cols = grid.querySelectorAll('.sc-col'); if(!cols.length) return null;
    let day=-1, colRect=null;
    for(let i=0;i<cols.length;i++){ const r=cols[i].getBoundingClientRect(); if(clientX>=r.left && clientX<r.right){ day=i; colRect=r; break; } }
    if(day<0){ const f=cols[0].getBoundingClientRect(), l=cols[cols.length-1].getBoundingClientRect();
      if(clientX<f.left){ day=0; colRect=f; } else { day=cols.length-1; colRect=l; } }
    let start = Math.round((DATA.DAY_START + (clientY-colRect.top)/DATA.PX_PER_MIN)/30)*30;
    start = Math.max(DATA.DAY_START, Math.min(DATA.DAY_END - durMin, start));
    return { day, startMin:start };
  };
  const onDragMove = (e)=>{
    const d = dragRef.current; if(!d) return;
    if(!d.moved){ if(Math.abs(e.clientX-d.startX)<5 && Math.abs(e.clientY-d.startY)<5) return; d.moved=true; }
    e.preventDefault();
    const t = pointToDayTime(e.clientX, e.clientY, d.dur); if(t) setGhost(t);
  };
  const onDragUp = (e)=>{
    window.removeEventListener('pointermove', onDragMove);
    const d = dragRef.current; dragRef.current=null; setGhost(null);
    if(!d || !d.moved) return;                 // a click, not a drag → let onClick open the drawer
    justDraggedRef.current = true; setTimeout(()=>{ justDraggedRef.current=false; }, 60);
    const t = pointToDayTime(e.clientX, e.clientY, d.dur); if(!t) return;
    if(t.day===d.originDay && t.startMin===d.ev._s) return; // dropped where it started
    const toEnd = t.startMin + d.dur;
    const conflicts = (DATA.SCHEDULE||[]).filter(o=>{
      if(o.day!==t.day || (d.ev._slotId!=null && o._slotId===d.ev._slotId)) return false;
      const os=_toMinT(o.start), oe=_toMinT(o.end);
      if(!(t.startMin<oe && os<toEnd)) return false;
      return (d.ev.teacher && o.teacher===d.ev.teacher) || (d.ev.room && o.room===d.ev.room);
    });
    setMoveAsk({ ev:d.ev, originDay:d.originDay, toDay:t.day, toStartMin:t.startMin, toEndMin:toEnd, conflicts });
  };
  const onEvDown = (e, ev, di)=>{
    if(ev._makeup || ev._cancelled) return;    // makeups/cancelled aren't draggable
    if(e.button!==undefined && e.button!==0) return;
    dragRef.current = { ev, originDay:di, startX:e.clientX, startY:e.clientY, dur:ev._e-ev._s, moved:false };
    window.addEventListener('pointermove', onDragMove);
    window.addEventListener('pointerup', onDragUp, { once:true });
  };

  const doMove = async (mode)=>{
    const m = moveAsk; if(!m) return;
    const fromDate = weekDateStrs[m.originDay], toDate = weekDateStrs[m.toDay];
    try{
      if(mode==='permanent'){
        if(DATA._isLiveMode && DATA.updateScheduleSlot && m.ev._slotId){
          await DATA.updateScheduleSlot(m.ev._slotId, { day_of_week:m.toDay, start_min:m.toStartMin, end_min:m.toEndMin });
        } else {
          DATA.SCHEDULE = DATA.SCHEDULE.map(s=> s===m.ev._src
            ? { ...s, day:m.toDay, start:fmtMin(m.toStartMin), end:fmtMin(m.toEndMin), _durationMin:m.toEndMin-m.toStartMin } : s);
          bumpData();
        }
        showToast('ย้ายคาบถาวรแล้ว ✓');
      } else {
        if(DATA._isLiveMode && DATA.addException){
          await DATA.addException({ type:'cancel', slot_id:m.ev._slotId, date:fromDate });
          await DATA.addException({ type:'makeup', date:toDate,
            student_id:(m.ev._studentDbIds&&m.ev._studentDbIds[0])||null,
            teacher_id:m.ev._teacherDbId||null, category:m.ev.cat,
            start_min:m.toStartMin, end_min:m.toEndMin });
        } else {
          DATA.SCHEDULE = DATA.SCHEDULE.map(s=> s===m.ev._src
            ? { ...s, day:m.toDay, start:fmtMin(m.toStartMin), end:fmtMin(m.toEndMin) } : s);
          bumpData();
        }
        showToast('ย้ายเฉพาะสัปดาห์นี้แล้ว ✓');
      }
    }catch(err){ showToast('ย้ายไม่สำเร็จ'); }
    setMoveAsk(null);
  };

  return (
    <div>
      <div className="section-head" style={{ marginBottom:16 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ display:"flex", gap:4 }}>
            <button className="icon-btn" title="สัปดาห์ก่อน" onClick={()=>setWeekOffset(v=>v-1)}><Icon n="chevL" size={18}/></button>
            <button className="icon-btn" title="สัปดาห์ถัดไป" onClick={()=>setWeekOffset(v=>v+1)}><Icon n="chevron" size={18}/></button>
          </div>
          <div>
            <div style={{ display:'flex', alignItems:'baseline', gap:8 }}>
              <div style={{ fontFamily:"var(--ff-display)", fontWeight:700, fontSize:18 }}>{weekLabel}</div>
              {weekOffset!==0 && <button className="btn btn-ghost btn-sm" style={{ fontSize:11, padding:'2px 8px', height:'auto' }} onClick={()=>setWeekOffset(0)}>กลับสัปดาห์นี้</button>}
            </div>
            <div style={{ fontSize:12.5, color:"var(--text-3)" }}>{weekHint} · {items.length} คาบเรียน</div>
          </div>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <div className="seg-toggle" style={{ display:"flex", background:"var(--surface-2)", borderRadius:10, padding:3, gap:2 }}>
            <button className={"btn btn-sm"+(viewMode==="day"?" btn-primary":" btn-ghost")} style={{ height:32, padding:"0 12px" }} onClick={()=>setViewMode("day")} title="ดูตารางตามวัน"><Icon n="calendar" size={14}/> <span className="hide-mobile">ตามวัน</span></button>
            <button className={"btn btn-sm"+(viewMode==="room"?" btn-primary":" btn-ghost")} style={{ height:32, padding:"0 12px" }} onClick={()=>setViewMode("room")} title="ดูตารางตามห้องเรียน">🚪 <span className="hide-mobile">ตามห้อง</span></button>
          </div>
          <button className="btn btn-ghost" onClick={()=>setMakeupOpen(true)} title="เพิ่มคาบเรียนชดเชยครั้งเดียว"><Icon n="plus" size={16}/> ชดเชย</button>
          <button className="btn btn-primary" onClick={()=>setBooking({})}><Icon n="plus" size={18}/> จองคาบเรียน</button>
        </div>
      </div>

      {/* category filter */}
      <div className="tag-filter" style={{ marginBottom:14 }}>
        <button className={"chip"+(filter==="all"?" active":"")} onClick={()=>setFilter("all")}>ทุกคลาส</button>
        {Object.values(DATA.CATS).map(c=>(
          <button key={c.key} className={"chip"+(filter===c.key?" active":"")} onClick={()=>setFilter(c.key)}>
            <span className="dotmark" style={{ background:c.color }}></span>{c.label}
          </button>
        ))}
      </div>

      {viewMode==="day" && (
      <div className="card" style={{ overflow:"hidden" }}>
        <div className="sc-wrap">
          <div className="sc-grid" ref={gridRef} style={{ gridTemplateColumns:`56px repeat(7, minmax(146px,1fr))`, minWidth:1060 }}>
            {/* header */}
            <div className="sc-corner"></div>
            {DATA.DAYS.map((d,i)=>(
              <div key={i} className="sc-dayhead" style={ i===TODAY_COL ? { background:"var(--primary-soft)" } : null }>
                <div className="cal-day" style={ i===TODAY_COL ? { color:"var(--primary-ink)" } : null }>{d.d}</div>
                <div className="cal-date">{dayDates[i].date} {dayDates[i].mon}</div>
                {dayStats[i].total>0 && (
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, marginTop:3, flexWrap:'wrap' }}
                    title={Object.entries(dayStats[i].byCat).map(([c,n])=>`${(DATA.CATS[c]||{}).label||c} ${n}`).join(' · ')}>
                    <span style={{ fontSize:11, fontWeight:700, color:'var(--text-2)' }}>{dayStats[i].total} คน</span>
                    <span style={{ display:'inline-flex', alignItems:'center', gap:5 }}>
                      {Object.entries(dayStats[i].byCat).map(([c,n])=>(
                        <span key={c} style={{ display:'inline-flex', alignItems:'center', gap:2, fontSize:10.5, color:'var(--text-3)' }}>
                          <span style={{ width:7, height:7, borderRadius:9, background:(DATA.CATS[c]||{}).color||'var(--primary)', display:'inline-block' }}></span>{n}
                        </span>
                      ))}
                    </span>
                  </div>
                )}
              </div>
            ))}
            {/* gutter */}
            <div className="sc-gutter" style={{ height:H }}>
              {hours.map(h=>(
                <div key={h} className="sc-hourlabel" style={{ top:topOf(h*60) }}>{h}:00</div>
              ))}
            </div>
            {/* day columns */}
            {byDay.map((evs,di)=>(
              <div key={di} className="sc-col" style={{ height:H, background: di===TODAY_COL ? "color-mix(in oklch,var(--primary-soft) 45%,transparent)" : null }}
                onClick={(e)=>{ if(justDraggedRef.current) return; const r=e.currentTarget.getBoundingClientRect(); let min=DATA.DAY_START+Math.round((e.clientY-r.top)/DATA.PX_PER_MIN/30)*30; min=Math.max(DATA.DAY_START,Math.min(DATA.DAY_END-30,min)); setBooking({ day:di, start:fmtMin(min) }); }}>
                {hours.map(h=>(<div key={h} className="sc-hour" style={{ top:topOf(h*60) }}></div>))}
                {ghost && ghost.day===di && dragRef.current && (
                  <div style={{ position:'absolute', top:topOf(ghost.startMin)+1, height:dragRef.current.dur*DATA.PX_PER_MIN-2,
                    left:2, right:3, borderRadius:8, border:'2px dashed var(--primary)', background:'var(--primary-soft)',
                    opacity:.8, pointerEvents:'none', zIndex:6, display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:11, fontWeight:700, color:'var(--primary-ink)' }}>
                    {fmtMin(ghost.startMin)}–{fmtMin(ghost.startMin+dragRef.current.dur)}
                  </div>
                )}
                {evs.map((ev,k)=>{
                  const cat = DATA.CATS[ev.cat] || Object.values(DATA.CATS)[0] || {};
                  const catC = cat.color||'var(--primary)', catS = cat.soft||'var(--primary-soft)';
                  const top = topOf(ev._s), ht = (ev._e-ev._s)*DATA.PX_PER_MIN;
                  const gap = 3;
                  const dateStr = weekDateStrs[di];
                  const cancelExc = ev._slotId ? cancelByKey[ev._slotId+'|'+dateStr] : null;
                  const cancelled = !!cancelExc;
                  const draggable = !ev._makeup && !cancelled;
                  return (
                    <div key={k} className="sc-ev"
                      onPointerDown={draggable ? (e)=>onEvDown(e, ev, di) : undefined}
                      onClick={(e)=>{ e.stopPropagation(); if(justDraggedRef.current) return; setSel({ ...ev, _date:dateStr, _cancelled:cancelled, _cancelExcId: cancelExc?cancelExc._dbId:null }); }}
                      style={{ top:top+1, height:ht-2, left:`calc(${(ev._lane/ev._cols)*100}% + 2px)`, width:`calc(${100/ev._cols}% - ${gap}px)`,
                        background: ev._makeup ? 'var(--surface)' : catS, borderColor:catC, color:`color-mix(in oklch, ${catC} 74%, black)`,
                        borderStyle: ev._makeup ? 'dashed' : 'solid',
                        cursor: draggable ? 'grab' : 'pointer', touchAction: draggable ? 'none' : 'auto',
                        opacity: cancelled ? 0.5 : 1, textDecoration: cancelled ? 'line-through' : 'none' }}>
                      <div className="sc-ev-name">{ev._makeup?'🔄 ':''}{DATA.dispName(ev.student)}{cancelled?' · ยกเลิก':''}</div>
                      {ht>=38 && <div className="sc-ev-time">{ev.start}–{ev.end}{ev._makeup?' · ชดเชย':''}</div>}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      )}

      {viewMode==="room" && (
      <div className="card" style={{ overflow:"hidden" }}>
        {/* weekday picker (room view shows one day at a time) */}
        <div style={{ display:"flex", gap:6, padding:"12px 14px", flexWrap:"wrap", borderBottom:"1px solid var(--border)", alignItems:"center" }}>
          <span style={{ fontSize:12.5, color:"var(--text-3)", marginRight:4 }}>วัน:</span>
          {DATA.DAYS.map((d,i)=>(
            <button key={i} className={"chip"+(roomDay===i?" active":"")} onClick={()=>setRoomDay(i)}>
              {d.d}{i===_todayDow && weekOffset===0 ? " ·วันนี้" : ""}
            </button>
          ))}
        </div>
        {roomCols.length===0 ? (
          <div style={{ textAlign:"center", padding:"42px 16px", color:"var(--text-3)", fontSize:14, lineHeight:1.6 }}>
            <div style={{ fontSize:30, marginBottom:8 }}>🚪</div>
            ยังไม่มีห้องเรียนในตาราง<br/>
            <span style={{ fontSize:12.5 }}>กำหนดห้องได้ตอน "จองคาบเรียน" หรือในตั้งค่า › ประเภทวิชา</span>
          </div>
        ) : (
        <div className="sc-wrap">
          <div className="sc-grid" style={{ gridTemplateColumns:`56px repeat(${roomCols.length}, minmax(146px,1fr))`, minWidth: 56 + roomCols.length*150 }}>
            <div className="sc-corner"></div>
            {roomCols.map((rm,i)=>(
              <div key={i} className="sc-dayhead">
                <div className="cal-day" style={{ fontSize:13, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>🚪 {rm}</div>
                <div className="cal-date">{byRoom[i].length} คาบ</div>
              </div>
            ))}
            <div className="sc-gutter" style={{ height:H }}>
              {hours.map(h=>(<div key={h} className="sc-hourlabel" style={{ top:topOf(h*60) }}>{h}:00</div>))}
            </div>
            {byRoom.map((evs,ci)=>{
              const rmName = roomCols[ci];
              return (
              <div key={ci} className="sc-col" style={{ height:H }}
                onClick={(e)=>{ const r=e.currentTarget.getBoundingClientRect(); let min=DATA.DAY_START+Math.round((e.clientY-r.top)/DATA.PX_PER_MIN/30)*30; min=Math.max(DATA.DAY_START,Math.min(DATA.DAY_END-30,min)); setBooking({ day:roomDay, start:fmtMin(min), room: rmName===UNASSIGNED?undefined:rmName }); }}>
                {hours.map(h=>(<div key={h} className="sc-hour" style={{ top:topOf(h*60) }}></div>))}
                {evs.map((ev,k)=>{
                  const cat = DATA.CATS[ev.cat] || Object.values(DATA.CATS)[0] || {};
                  const catC = cat.color||'var(--primary)', catS = cat.soft||'var(--primary-soft)';
                  const top = topOf(ev._s), ht = (ev._e-ev._s)*DATA.PX_PER_MIN; const gap = 3;
                  const cancelExc = ev._slotId ? cancelByKey[ev._slotId+'|'+roomDateStr] : null;
                  const cancelled = !!cancelExc;
                  return (
                    <div key={k} className="sc-ev" onClick={(e)=>{ e.stopPropagation(); setSel({ ...ev, _date:roomDateStr, _cancelled:cancelled, _cancelExcId: cancelExc?cancelExc._dbId:null }); }}
                      style={{ top:top+1, height:ht-2, left:`calc(${(ev._lane/ev._cols)*100}% + 2px)`, width:`calc(${100/ev._cols}% - ${gap}px)`,
                        background:catS, borderColor:catC, color:`color-mix(in oklch, ${catC} 74%, black)`,
                        opacity: cancelled ? 0.5 : 1, textDecoration: cancelled ? 'line-through' : 'none' }}>
                      <div className="sc-ev-name">{DATA.dispName(ev.student)}{cancelled?' · ยกเลิก':''}</div>
                      {ht>=38 && <div className="sc-ev-time">{ev.start}–{ev.end} · {ev.teacher}</div>}
                    </div>
                  );
                })}
              </div>
            );})}
          </div>
        </div>
        )}
      </div>
      )}

      {sel && <ClassDrawer c={sel} onClose={()=>setSel(null)} showToast={showToast} onCancel={async()=>{
        if(DATA._isLiveMode && DATA.deleteScheduleSlot && sel._slotId){
          try{ await DATA.deleteScheduleSlot(sel._slotId); }catch(e){ console.warn(e); }
        } else {
          DATA.SCHEDULE = DATA.SCHEDULE.filter(s=>s._slotId!==sel._slotId); bumpData();
        }
        setSel(null); showToast("ลบคาบเรียนถาวรแล้ว");
      }}/>}
      {booking && <BookingDrawer slot={booking} onClose={()=>setBooking(null)} onSave={()=>{ setBooking(null); showToast("จองคาบเรียนสำเร็จ"); }}/>}
      {makeupOpen && <MakeupDrawer onClose={()=>setMakeupOpen(false)} onSave={()=>{ setMakeupOpen(false); showToast("เพิ่มคาบชดเชยแล้ว ✓"); }}/>}
      {moveAsk && (
        <Drawer title="ย้ายคาบเรียน"
          sub={`${DATA.DAYS[moveAsk.originDay].d} ${moveAsk.ev.start} → ${DATA.DAYS[moveAsk.toDay].d} ${fmtMin(moveAsk.toStartMin)}–${fmtMin(moveAsk.toEndMin)} น.`}
          onClose={()=>setMoveAsk(null)} accent="var(--primary)"
          footer={<button className="btn btn-ghost" style={{ flex:1 }} onClick={()=>setMoveAsk(null)}>ยกเลิก</button>}>
          <div className="card" style={{ padding:"4px 16px", marginBottom:16 }}>
            <div className="kv"><span className="k">นักเรียน</span><span className="v">{DATA.dispName(moveAsk.ev.student)}</span></div>
            <div className="kv"><span className="k">ครู</span><span className="v">{moveAsk.ev.teacher}</span></div>
            <div className="kv"><span className="k">ย้ายไป</span><span className="v">{DATA.DAYS[moveAsk.toDay].d} · {fmtMin(moveAsk.toStartMin)}–{fmtMin(moveAsk.toEndMin)} น.</span></div>
          </div>
          {moveAsk.conflicts.length>0 && (
            <div style={{ background:'var(--warn-soft)', border:'1px solid color-mix(in oklch,var(--warn) 35%,var(--border))', borderRadius:10, padding:'10px 13px', marginBottom:14, fontSize:12.5, color:'color-mix(in oklch,var(--warn) 62%,black)', lineHeight:1.55 }}>
              ⚠️ เวลาทับซ้อนกับ {moveAsk.conflicts.slice(0,2).map(o=>`${DATA.dispName(o.student)} (${o.start}–${o.end})`).join(', ')} — ย้ายได้ แต่โปรดตรวจสอบ
            </div>
          )}
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <button className="btn btn-primary" onClick={()=>doMove('permanent')}>
              <Icon n="calendar" size={16}/> ย้ายถาวร (ทุกสัปดาห์)
            </button>
            <button className="btn btn-soft" onClick={()=>doMove('once')}>
              🔄 ย้ายเฉพาะสัปดาห์นี้
            </button>
            <div style={{ fontSize:12, color:'var(--text-3)', lineHeight:1.55, marginTop:2 }}>
              <b>ถาวร</b> = แก้ตารางประจำสัปดาห์ทุกสัปดาห์ · <b>เฉพาะสัปดาห์นี้</b> = ยกเลิกคาบเดิมเฉพาะวันนั้น แล้วสร้างคาบชดเชยในเวลาใหม่ (สัปดาห์อื่นยังเหมือนเดิม)
            </div>
          </div>
        </Drawer>
      )}
      {toast}
    </div>
  );
}

function ClassDrawer({ c, onClose, onCancel, showToast }){
  const [delBusy, setDelBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editRoom, setEditRoom] = useState(false);
  const [roomVal, setRoomVal] = useState(c.room && c.room!=='-' ? c.room : '');
  const [roomBusy, setRoomBusy] = useState(false);
  const cat = DATA.CATS[c.cat] || Object.values(DATA.CATS)[0] || {};
  const day = DATA.DAYS[c.day];
  const dateLabel = c._date ? (()=>{ const d=new Date(c._date+'T00:00:00'); return `${d.getDate()} ${['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'][d.getMonth()]}`; })() : '';
  const handleCancel = async()=>{ if(!confirm('ลบคาบนี้ถาวร (ทุกสัปดาห์)?')) return; setDelBusy(true); await onCancel(); };

  // cancel this specific date only
  const cancelThisDate = async()=>{
    setBusy(true);
    try{
      if(DATA.addException) await DATA.addException({ type:'cancel', slot_id:c._slotId, date:c._date });
      showToast(`ยกเลิกคาบวันที่ ${dateLabel} แล้ว`); onClose();
    }catch(e){ showToast('ทำรายการไม่สำเร็จ'); setBusy(false); }
  };
  // undo a date cancellation
  const undoCancel = async()=>{
    setBusy(true);
    try{
      if(DATA.deleteException) await DATA.deleteException(c._cancelExcId);
      showToast('กู้คืนคาบเรียนแล้ว'); onClose();
    }catch(e){ showToast('ทำรายการไม่สำเร็จ'); setBusy(false); }
  };
  // delete a one-time makeup class
  const delMakeup = async()=>{
    setBusy(true);
    try{
      if(DATA.deleteException) await DATA.deleteException(c.id||c._dbId);
      showToast('ลบคาบชดเชยแล้ว'); onClose();
    }catch(e){ showToast('ทำรายการไม่สำเร็จ'); setBusy(false); }
  };
  // save an edited room for this (recurring) slot — affects every week
  const saveRoom = async()=>{
    const nv = roomVal.trim();
    setRoomBusy(true);
    try{
      if(DATA._isLiveMode && DATA.updateScheduleSlot && c._slotId){
        await DATA.updateScheduleSlot(c._slotId, { room: nv });
      } else {
        DATA.SCHEDULE = DATA.SCHEDULE.map(s=> (c._slotId!=null && s._slotId===c._slotId) || (c._src && s===c._src) ? { ...s, room: nv||'-' } : s);
        bumpData();
      }
      c.room = nv||'-'; setEditRoom(false);
      showToast('แก้ห้องเรียนแล้ว ✓');
    }catch(e){ showToast('แก้ไม่สำเร็จ'); }
    setRoomBusy(false);
  };

  let footer;
  if(c._makeup){
    footer = <>
      <button className="btn btn-ghost" style={{ flex:1, color:'var(--danger)' }} onClick={delMakeup} disabled={busy}>{busy?'กำลังลบ…':'ลบคาบชดเชย'}</button>
      <button className="btn btn-primary" style={{ flex:1 }} onClick={onClose}><Icon n="check" size={17}/> เช็คชื่อ</button>
    </>;
  } else if(c._cancelled){
    footer = <>
      <button className="btn btn-primary" style={{ flex:1 }} onClick={undoCancel} disabled={busy}>{busy?'กำลังกู้คืน…':'↩ กู้คืนคาบนี้'}</button>
    </>;
  } else {
    footer = <>
      <button className="btn btn-ghost" style={{ flex:1 }} onClick={cancelThisDate} disabled={busy}>{busy?'…':`ยกเลิกวันที่ ${dateLabel}`}</button>
      <button className="btn btn-primary" style={{ flex:1 }} onClick={onClose}><Icon n="check" size={17}/> เช็คชื่อ</button>
    </>;
  }

  return (
    <Drawer title={cat.label||'คาบเรียน'} sub={`${day?day.d:''} ${c.start}–${c.end} น.${c._makeup?' · ชดเชย':''}`} onClose={onClose} accent={cat.color||'var(--primary)'}
      footer={footer}>
      <div style={{ display:"flex", alignItems:"center", gap:13, padding:"4px 0 18px" }}>
        <div style={{ width:48, height:48, borderRadius:13, display:"grid", placeItems:"center", fontSize:24, background:cat.soft||'var(--primary-soft)' }}>{cat.icon||'🎵'}</div>
        <div style={{ display:'flex', gap:7, alignItems:'center', flexWrap:'wrap' }}>
          <CatBadge cat={c.cat}/>
          {c._makeup && <span className="badge" style={{ background:'var(--primary)', color:'#fff', fontSize:11 }}>🔄 คาบชดเชย</span>}
          {c._cancelled && <span className="badge" style={{ background:'var(--danger-soft)', color:'var(--danger)', fontSize:11 }}>ยกเลิกวันนี้</span>}
        </div>
      </div>
      <div className="card" style={{ padding:"4px 16px", marginBottom:18 }}>
        <div className="kv"><span className="k">นักเรียน</span><span className="v">{DATA.dispName(c.student)}</span></div>
        <div className="kv"><span className="k">ครูผู้สอน</span><span className="v">{c.teacher}</span></div>
        {!c._makeup && (
          <div className="kv"><span className="k">ห้องเรียน</span>
            <span className="v">
              {editRoom ? (
                <span style={{ display:'inline-flex', gap:6, alignItems:'center', flexWrap:'wrap', justifyContent:'flex-end' }}>
                  <input list="bm-room-list" value={roomVal} onChange={e=>setRoomVal(e.target.value)} placeholder="ชื่อห้อง" maxLength={60}
                    onKeyDown={e=>e.key==='Enter'&&saveRoom()} autoFocus
                    style={{ width:130, padding:'5px 9px', border:'1.5px solid var(--border)', borderRadius:8, fontSize:13.5 }}/>
                  <datalist id="bm-room-list">{(window.allRooms?allRooms():[]).map(rm=><option key={rm} value={rm}/>)}</datalist>
                  <button className="btn btn-primary btn-sm" style={{ padding:'4px 11px', fontSize:12.5 }} disabled={roomBusy} onClick={saveRoom}>{roomBusy?'…':'บันทึก'}</button>
                  <button className="btn btn-sm" style={{ padding:'4px 9px', fontSize:12.5 }} onClick={()=>{ setEditRoom(false); setRoomVal(c.room&&c.room!=='-'?c.room:''); }}>✕</button>
                </span>
              ) : (
                <span style={{ display:'inline-flex', gap:8, alignItems:'center' }}>
                  {c.room||'-'}
                  <button className="btn btn-sm btn-ghost" style={{ padding:'3px 9px', fontSize:12 }} onClick={()=>setEditRoom(true)}>แก้</button>
                </span>
              )}
            </span>
          </div>
        )}
        <div className="kv"><span className="k">วันที่</span><span className="v">{dateLabel} · {c.start} – {c.end} น.</span></div>
      </div>

      {!c._makeup && !c._cancelled && (
        <div style={{ fontSize:12.5, color:'var(--text-3)', lineHeight:1.6, marginBottom:14 }}>
          💡 "ยกเลิกวันที่ {dateLabel}" จะยกเลิกเฉพาะสัปดาห์นี้ (คาบประจำสัปดาห์อื่นยังอยู่) · ถ้าต้องการเลื่อนไปวันอื่น ให้ยกเลิกแล้วกด "+ ชดเชย" เพิ่มคาบใหม่
        </div>
      )}

      {!c._makeup && (
        <button className="btn btn-ghost btn-sm" style={{ color:'var(--danger)' }} onClick={handleCancel} disabled={delBusy}>
          <Icon n="x" size={13}/> {delBusy?'กำลังลบ…':'ลบคาบนี้ถาวร (ทุกสัปดาห์)'}
        </button>
      )}
    </Drawer>
  );
}

function MakeupDrawer({ onClose, onSave }){
  const _today = new Date().toISOString().slice(0,10);
  const [stuName,setStuName] = useState(DATA.STUDENTS[0]?.name||"");
  const [cat,setCat]         = useState(DATA.STUDENTS[0]?.cats?.[0]||"piano");
  const [date,setDate]       = useState(_today);
  const [startTime,setStart] = useState("15:00");
  const [dur,setDur]         = useState("60");
  const [teacherNick,setTeacher] = useState("");
  const [busy,setBusy]       = useState(false);
  const [err,setErr]         = useState(null);

  const catTeachers = DATA.TEACHERS.filter(t=>t.cats.includes(cat));
  const firstTeacher = catTeachers[0]?.nick||"";

  const save = async()=>{
    const stu = DATA.STUDENTS.find(s=>s.name===stuName);
    if(!stu){ setErr("กรุณาเลือกนักเรียน"); return; }
    if(!date){ setErr("กรุณาเลือกวันที่"); return; }
    setBusy(true); setErr(null);
    const [h,m] = startTime.split(":").map(Number);
    const start_min = h*60+(m||0);
    const tc = DATA.TEACHERS.find(t=>t.nick===(teacherNick||firstTeacher));
    try{
      if(DATA.addException){
        await DATA.addException({ type:'makeup', date, student_id:stu._dbId||null,
          teacher_id:tc?._dbId??tc?.id??null, category:cat, start_min, end_min:start_min+Number(dur) });
      }
      onSave();
    }catch(e){ setErr(e.message||"บันทึกไม่สำเร็จ"); setBusy(false); }
  };

  const durLabel = { 30:'30 นาที', 60:'1 ชั่วโมง', 90:'1.5 ชั่วโมง', 120:'2 ชั่วโมง' }[Number(dur)]||dur+' นาที';
  return (
    <Drawer title="เพิ่มคาบเรียนชดเชย" sub={`คาบครั้งเดียว · ${durLabel}`} onClose={onClose} accent="var(--primary)"
      footer={<>
        <button className="btn btn-ghost" style={{flex:1}} onClick={onClose} disabled={busy}>ยกเลิก</button>
        <button className="btn btn-primary" style={{flex:1}} onClick={save} disabled={busy||!stuName||!date}>
          {busy?'กำลังบันทึก…':<><Icon n="check" size={16}/> เพิ่มคาบชดเชย</>}
        </button>
      </>}>
      {err && <div style={{background:'var(--danger-soft)',color:'var(--danger)',borderRadius:8,padding:'9px 13px',fontSize:13,marginBottom:12}}>{err}</div>}
      <div className="field"><label>นักเรียน</label>
        <select value={stuName} onChange={e=>{ setStuName(e.target.value); const s=DATA.STUDENTS.find(x=>x.name===e.target.value); if(s&&s.cats&&s.cats[0]) setCat(s.cats[0]); }}>
          {DATA.STUDENTS.map(s=><option key={s.id} value={s.name}>{DATA.dispName(s)}</option>)}
          {!DATA.STUDENTS.length && <option value="">— ยังไม่มีนักเรียน —</option>}
        </select>
      </div>
      <div className="field"><label>ประเภทคลาส</label>
        <div className="tag-filter">
          {Object.values(DATA.CATS).map(c=>(
            <button key={c.key} className={"chip"+(cat===c.key?" active":"")} onClick={()=>{setCat(c.key);setTeacher("");}}>
              <span className="dotmark" style={{background:c.color}}></span>{c.icon} {c.label}
            </button>
          ))}
        </div>
      </div>
      <div className="field"><label>ครูผู้สอน</label>
        <select value={teacherNick||firstTeacher} onChange={e=>setTeacher(e.target.value)}>
          {catTeachers.map(t=><option key={t.id} value={t.nick}>{t.nick}</option>)}
          {!catTeachers.length && <option value="">— ยังไม่มีครู —</option>}
        </select>
      </div>
      <div style={{display:"flex",gap:12}}>
        <div className="field" style={{flex:1}}><label>วันที่</label>
          <input type="date" value={date} onChange={e=>setDate(e.target.value)}/>
        </div>
        <div className="field" style={{flex:1}}><label>เวลาเริ่ม</label>
          <select value={startTime} onChange={e=>setStart(e.target.value)}>
            {DATA.SLOT_TIMES.map((t,i)=><option key={i} value={t}>{t} น.</option>)}
          </select>
        </div>
      </div>
      <div className="field"><label>ระยะเวลา</label>
        <select value={dur} onChange={e=>setDur(e.target.value)}>
          <option value="30">30 นาที</option>
          <option value="60">1 ชั่วโมง</option>
          <option value="90">1.5 ชั่วโมง</option>
          <option value="120">2 ชั่วโมง</option>
        </select>
      </div>
    </Drawer>
  );
}

function BookingDrawer({ slot, onClose, onSave }){
  const [cat,setCat]             = useState("piano");
  const [group,setGroup]         = useState(false);
  const [members,setMembers]     = useState([]);
  const [day,setDay]             = useState(slot.day??0);
  const [startTime,setStartTime] = useState(slot.start||"15:00");
  const [dur,setDur]             = useState("60");
  const [teacherNick,setTeacher] = useState("");
  const [stuName,setStuName]     = useState(DATA.STUDENTS[0]?.name||"");
  const [perSession,setPerSession] = useState(false);
  const [sessionFee,setSessionFee] = useState("");
  const [payRate,setPayRate]     = useState(""); // optional per-class teacher rate override
  const [room,setRoom]           = useState(()=> slot.room || DATA.CATS[slot.cat||"piano"]?.room || DATA.CATS["piano"]?.room || "");
  const [busy,setBusy]           = useState(false);
  const [err,setErr]             = useState(null);

  const toggleMember = name=> setMembers(m=> m.includes(name) ? m.filter(x=>x!==name) : [...m, name]);
  const catTeachers  = DATA.TEACHERS.filter(t=>t.cats.includes(cat));
  const firstTeacher = catTeachers[0]?.nick||"";
  const selTeacher   = DATA.TEACHERS.find(t=>t.nick===(teacherNick||firstTeacher));
  const defRate      = selTeacher?.rate||0;

  // ---- conflict detection: warn if this teacher or room is already booked at an overlapping time ----
  const _t2m = (t)=>{ const [h,m]=String(t).split(":").map(Number); return h*60+(m||0); };
  const _cs = _t2m(startTime), _ce = _cs + Number(dur);
  const effRoom    = (room||"").trim() || DATA.CATS[cat]?.room || "";
  const effTeacher = teacherNick||firstTeacher;
  const conflicts  = (DATA.SCHEDULE||[]).filter(o=>{
    if(o.day!==day || (slot._slotId!=null && o._slotId===slot._slotId)) return false;
    const os=_t2m(o.start), oe=_t2m(o.end);
    if(!(_cs < oe && os < _ce)) return false;            // time ranges must overlap
    return (effTeacher && o.teacher===effTeacher) || (effRoom && o.room===effRoom);
  });
  const teacherClash = conflicts.some(o=> effTeacher && o.teacher===effTeacher);
  const roomClash    = conflicts.some(o=> effRoom && o.room===effRoom);

  // suggested per-session price = package price ÷ sessions (match duration if possible)
  const suggestFee = ()=>{
    const pks = DATA.PACKAGES||[];
    if(!pks.length) return "";
    const byDur = pks.find(p=>Number(p.dur||p.duration_min)===Number(dur)) || pks[0];
    const per = byDur && byDur.sessions ? Math.round(byDur.price/byDur.sessions) : 0;
    return per>0 ? String(per) : "";
  };

  const save = async()=>{
    setBusy(true); setErr(null);
    const [h,m2] = startTime.split(":").map(Number);
    const start_min = h*60+(m2||0);
    const end_min   = start_min + Number(dur);
    const tc = DATA.TEACHERS.find(t=>t.nick===(teacherNick||firstTeacher));
    const studentIds = group
      ? members.map(n=>DATA.STUDENTS.find(s=>s.name===n)?._dbId).filter(Boolean)
      : [DATA.STUDENTS.find(s=>s.name===stuName)?._dbId].filter(Boolean);
    const fee = Math.max(0, parseInt(sessionFee)||0);
    const payload = {
      day_of_week:day, start_min, end_min, category:cat,
      teacher_id:tc?._dbId??tc?.id??null, student_ids:studentIds,
      per_session: perSession?1:0, session_fee: perSession?fee:0,
      rate: (payRate!=='' ? Math.max(0,parseInt(payRate)||0) : null),
      room: effRoom||null,
    };
    if(DATA._isLiveMode && window.API && DATA.addScheduleSlot){
      try{
        await DATA.addScheduleSlot(payload);
        // per-session → auto-create an invoice for this class fee
        if(perSession && fee>0 && !group && DATA.createInvoice){
          const stu = DATA.STUDENTS.find(s=>s.name===stuName);
          if(stu?._dbId){
            await DATA.createInvoice({
              student_id: stu._dbId, amount: fee, status:'unpaid',
              payment_method:'cash',
              note:'ค่าเรียนรายครั้ง — '+(DATA.CATS[cat]?.label||cat),
              _studentName: stuName,
            }).catch(console.warn);
          }
        }
        onSave();
      }catch(e){ setErr(e.message||"บันทึกไม่สำเร็จ"); setBusy(false); }
    } else {
      const todayDow=(new Date().getDay()+6)%7;
      if(day===todayDow){
        const pad=n=>String(n).padStart(2,'0');
        const sh=Math.floor(start_min/60),sm=start_min%60;
        const eh=Math.floor(end_min/60),em=end_min%60;
        DATA.TODAY.push({
          _slotId:null,_studentDbIds:[],
          time:`${pad(sh)}:${pad(sm)}`,end:`${pad(eh)}:${pad(em)}`,
          cat,teacher:teacherNick||firstTeacher||'-',
          student:group?`กลุ่ม (${members.length} คน)`:stuName,
          room:effRoom||'-',status:'next',
        });
      }
      bumpData(); onSave();
    }
  };

  const dayLabel = DATA.DAYS[day];
  const durLabel = { 30:'30 นาที', 60:'1 ชั่วโมง', 90:'1.5 ชั่วโมง', 120:'2 ชั่วโมง' }[Number(dur)]||dur+' นาที';
  return (
    <Drawer title="จองคาบเรียนใหม่" sub={dayLabel?`${dayLabel.d} ${startTime} น. · ${durLabel}`:"เลือกรายละเอียด"} onClose={onClose} accent="var(--primary)"
      footer={<>
        <button className="btn btn-ghost" style={{flex:1}} onClick={onClose} disabled={busy}>ยกเลิก</button>
        <button className="btn btn-primary" style={{flex:1}} onClick={save}
          disabled={busy||(!group&&!stuName)||(group&&!members.length)}>
          {busy ? 'กำลังบันทึก…' : <><Icon n="check" size={17}/> ยืนยันการจอง</>}
        </button>
      </>}>
      {err && <div style={{background:'var(--danger-soft)',color:'var(--danger)',borderRadius:8,padding:'9px 13px',fontSize:13,marginBottom:12}}>{err}</div>}
      <div className="field">
        <label>ประเภทคลาส</label>
        <div className="tag-filter">
          {Object.values(DATA.CATS).map(c=>(
            <button key={c.key} className={"chip"+(cat===c.key?" active":"")} onClick={()=>{setCat(c.key);setTeacher("");setRoom(DATA.CATS[c.key]?.room||"");}}>
              <span className="dotmark" style={{background:c.color}}></span>{c.icon} {c.label}
            </button>
          ))}
        </div>
      </div>
      <label className="grp-toggle">
        <input type="checkbox" checked={group} disabled={perSession} onChange={e=>setGroup(e.target.checked)} style={{width:18,height:18,accentColor:"var(--primary)"}}/>
        <span><b>เรียนเป็นกลุ่ม</b> — เลือกนักเรียนได้หลายคนในคาบเดียว</span>
      </label>
      <label className="grp-toggle">
        <input type="checkbox" checked={perSession} onChange={e=>{
          const on=e.target.checked; setPerSession(on);
          if(on){ setGroup(false); if(!sessionFee) setSessionFee(suggestFee()); }
        }} style={{width:18,height:18,accentColor:"var(--primary)"}}/>
        <span><b>เรียนรายครั้ง</b> — จ่ายเป็นคาบ ไม่ใช้แพ็กเกจ</span>
      </label>
      {perSession && (
        <div className="field">
          <label>ค่าเรียนต่อคาบ (บาท)</label>
          <input type="number" min={0} step={50} value={sessionFee}
            onChange={e=>setSessionFee(e.target.value)} placeholder="เช่น 350"/>
          <div style={{fontSize:12.5,color:'var(--text-3)',marginTop:6,lineHeight:1.5}}>
            {Math.max(0,parseInt(sessionFee)||0)>0
              ? `ระบบจะออกใบแจ้งหนี้ ฿${(parseInt(sessionFee)||0).toLocaleString()} สำหรับคาบนี้ให้อัตโนมัติ (สถานะ: ค้างชำระ)`
              : 'ใส่จำนวนเงินเพื่อให้ระบบออกใบแจ้งหนี้ให้อัตโนมัติ'}
          </div>
        </div>
      )}
      {group ? (
        <div className="field"><label>นักเรียนในกลุ่ม ({members.length} คน)</label>
          <div className="grp-list">
            {DATA.STUDENTS.map(s=>(
              <label key={s.id} className={"grp-item"+(members.includes(s.name)?" on":"")}>
                <input type="checkbox" checked={members.includes(s.name)} onChange={()=>toggleMember(s.name)}/>
                <Avatar name={s.name} size={26}/> <span>{s.name}</span>
              </label>
            ))}
          </div>
        </div>
      ) : (
        <div className="field"><label>นักเรียน</label>
          <select value={stuName} onChange={e=>setStuName(e.target.value)}>
            {DATA.STUDENTS.map(s=><option key={s.id} value={s.name}>{DATA.dispName(s)}</option>)}
            {!DATA.STUDENTS.length && <option value="">— ยังไม่มีนักเรียน —</option>}
          </select>
        </div>
      )}
      <div className="field"><label>ครูผู้สอน</label>
        <select value={teacherNick||firstTeacher} onChange={e=>setTeacher(e.target.value)}>
          {catTeachers.map(t=><option key={t.id} value={t.nick}>{t.nick}</option>)}
          {!catTeachers.length && <option value="">— ยังไม่มีครู (เพิ่มได้ทีหลัง) —</option>}
        </select>
      </div>
      <div style={{display:"flex",gap:12}}>
        <div className="field" style={{flex:1}}><label>วัน</label>
          <select value={day} onChange={e=>setDay(Number(e.target.value))}>
            {DATA.DAYS.map((d,i)=><option key={i} value={i}>{d.d}</option>)}
          </select>
        </div>
        <div className="field" style={{flex:1}}><label>เวลาเริ่ม</label>
          <select value={startTime} onChange={e=>setStartTime(e.target.value)}>
            {DATA.SLOT_TIMES.map((t,i)=><option key={i} value={t}>{t} น.</option>)}
          </select>
        </div>
      </div>
      <div className="field"><label>ระยะเวลา</label>
        <select value={dur} onChange={e=>setDur(e.target.value)}>
          <option value="30">30 นาที</option>
          <option value="60">1 ชั่วโมง</option>
          <option value="90">1.5 ชั่วโมง</option>
          <option value="120">2 ชั่วโมง</option>
        </select>
      </div>
      <div className="field"><label>ห้องเรียน</label>
        <input type="text" list="bm-room-list-book" value={room} onChange={e=>setRoom(e.target.value)}
          placeholder={DATA.CATS[cat]?.room||'เช่น ห้อง A'} maxLength={60}/>
        <datalist id="bm-room-list-book">{(window.allRooms?allRooms():[]).map(rm=><option key={rm} value={rm}/>)}</datalist>
        <div style={{fontSize:12,color:'var(--text-3)',marginTop:5,lineHeight:1.5}}>
          ค่าเริ่มต้นจากประเภทวิชา — พิมพ์ใหม่หรือเลือกจากห้องที่มีอยู่ได้
        </div>
      </div>
      {conflicts.length>0 && (
        <div style={{ background:'var(--warn-soft)', border:'1px solid color-mix(in oklch,var(--warn) 35%,var(--border))',
          borderRadius:10, padding:'11px 13px', marginBottom:14 }}>
          <div style={{ fontWeight:700, fontSize:13.5, color:'color-mix(in oklch,var(--warn) 72%,black)', display:'flex', alignItems:'center', gap:6 }}>
            ⚠️ พบเวลาทับซ้อน
          </div>
          <div style={{ fontSize:12.5, color:'color-mix(in oklch,var(--warn) 60%,black)', marginTop:4, lineHeight:1.55 }}>
            {teacherClash && <div>• <b>{effTeacher}</b> มีคาบสอนช่วงเวลานี้อยู่แล้ว</div>}
            {roomClash && <div>• <b>{effRoom}</b> ถูกใช้งานช่วงเวลานี้อยู่แล้ว</div>}
            {conflicts.slice(0,3).map((o,i)=>(
              <div key={i} style={{ opacity:.85 }}>↳ {DATA.dispName(o.student)} · {o.start}–{o.end} น.{o.teacher?` · ${o.teacher}`:''}{o.room?` · ${o.room}`:''}</div>
            ))}
            <div style={{ marginTop:3 }}>ยังบันทึกได้ แต่โปรดตรวจสอบก่อน</div>
          </div>
        </div>
      )}
      <div className="field">
        <label>ค่าสอนครู/ชม. สำหรับคาบนี้ <span style={{fontSize:11,color:'var(--muted)'}}>ไม่บังคับ</span></label>
        <input type="number" min={0} step={50} value={payRate} onChange={e=>setPayRate(e.target.value)}
          placeholder={defRate?`ว่าง = ใช้เรทครู ฿${defRate.toLocaleString()}/ชม.`:'เช่น 300'}/>
        <div style={{fontSize:12,color:'var(--text-3)',marginTop:5,lineHeight:1.5}}>
          {group ? 'คาบกลุ่มมักจ่ายเรทต่างจากคาบเดี่ยว — ใส่เรทเฉพาะคาบนี้ได้' : 'ใช้เมื่อวิชา/คาบนี้จ่ายค่าสอนไม่เท่าเรทปกติของครู'}
        </div>
      </div>
    </Drawer>
  );
}
window.Schedule = Schedule;

Object.assign(window, { Dashboard, Schedule, Stat });
