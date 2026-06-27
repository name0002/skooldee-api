/* ============ บ้านมาริ — Attendance & Reports ============ */

/* ===================== ATTENDANCE (เช็คชื่อรายวัน) ===================== */
function Attendance(){
  useDataVersion();
  const todayKey = DATA.TODAY_KEY || new Date().toISOString().slice(0,10);
  const [selDate, setSelDate] = useState(todayKey);
  const isToday = selDate === todayKey;

  const [att, setAtt]           = useState(()=> (DATA.loadAttendance()[todayKey]) || {});
  const [histData, setHistData] = useState(null);   // {summary, records} for past dates
  const [histLoading, setHistLoading] = useState(false);
  const [toast, showToast] = useToast();

  // today's effective classes = recurring (minus cancelled today) + makeup classes for today
  const _exc = DATA.EXCEPTIONS||[];
  const _cancelledToday = new Set(_exc.filter(e=>e.type==='cancel' && e.date===todayKey).map(e=>e.slot_id));
  const _makeupToday = _exc.filter(e=>e.type==='makeup' && e.date===todayKey).map(e=>({
    _slotId:null, _exceptionId:e._dbId||e.id, _studentDbIds:e.student_id?[e.student_id]:[], _makeup:true,
    time:e.start, end:e.end, cat:e.cat, teacher:e.teacher||'-',
    student:e.student||'-', room:(DATA.CATS[e.cat]||{}).room||'-', status:'next',
  }));
  const todayClasses = [ ...DATA.TODAY.filter(c=>!_cancelledToday.has(c._slotId)), ..._makeupToday ];

  // reload whenever selDate changes (or on first mount for today)
  React.useEffect(()=>{
    if(!DATA._isLiveMode || !window.API) return;
    if(isToday){
      window.API.attendance(todayKey).then(data=>{
        const m = {};
        (data.records||[]).forEach(rec=>{
          todayClasses.forEach((slot,idx)=>{
            const match = slot._makeup
              ? (rec.exception_id && rec.exception_id===slot._exceptionId)
              : (slot._slotId===rec.slot_id || (slot._studentDbIds||[]).includes(rec.student_id));
            if(match && !m[idx]) m[idx] = rec.status;
          });
        });
        if(Object.keys(m).length) setAtt(m);
      }).catch(()=>{});
    } else {
      setHistData(null); setHistLoading(true);
      window.API.attendance(selDate)
        .then(data=>setHistData(data))
        .catch(()=>setHistData({summary:{present:0,absent:0,leave:0},records:[]}))
        .finally(()=>setHistLoading(false));
    }
  },[selDate]);

  // apply the server's authoritative student state (sessions + per-subject packages) to the local cache
  const syncResp = (resp)=>{
    if(!resp || !resp.student) return;
    const s = DATA.STUDENTS.find(x=>x._dbId===resp.student.id);
    if(!s) return;
    s.remaining = resp.student.sessions_remaining;
    s.points = resp.student.points;
    if(resp.student.packages_json){ try{ const a=JSON.parse(resp.student.packages_json); if(Array.isArray(a)) s.packages=a; }catch(e){} }
    bumpData();
  };
  const postAtt = (cls, action, prevPresent)=>{
    (cls._studentDbIds||[]).forEach(dbId=>{
      window.API.req('/api/attendance',{ method:'POST', body:JSON.stringify({
        student_id:dbId, status:action, slot_id:cls._slotId||null, exception_id:cls._exceptionId||null,
        category:cls.cat||null, prev_present:!!prevPresent, date:todayKey }) }).then(syncResp).catch(()=>{});
    });
  };

  const setStatus = (idx, status)=>{
    const cls = todayClasses[idx];
    const prev = att[idx];
    const cleared = prev===status;
    const next = cleared ? undefined : status;
    const action = cleared ? 'clear' : status;
    const prevPresent = prev==='present';
    const m = { ...att }; if(next) m[idx]=next; else delete m[idx];
    setAtt(m);
    const allAtt = DATA.loadAttendance(); allAtt[todayKey]=m; DATA.saveAttendance(allAtt);
    if(DATA._isLiveMode && window.API && cls._studentDbIds && cls._studentDbIds.length){
      postAtt(cls, action, prevPresent);   // server is authoritative; local syncs from response
    } else {
      const stu = DATA.findStudent(cls.student);
      if(stu){
        if(prevPresent && next!=='present') DATA.updateStudent(stu.id, { remaining: stu.remaining+1, points: Math.max(0, stu.points-10) });
        if(!prevPresent && next==='present') DATA.updateStudent(stu.id, { remaining: Math.max(0, stu.remaining-1), points: stu.points+10 });
      }
    }
    bumpData();
    if(next) showToast(`${DATA.dispName(cls.student)} ${DATA.ATT_STATUS[next].label}${next==="present"?" · +10 แต้ม":""}`);
  };

  // mark every class today as present in one go (owner then edits the few who are absent/late)
  const markAllPresent = ()=>{
    if(!todayClasses.length) return;
    const m = { ...att };
    let changed = 0;
    todayClasses.forEach((cls,idx)=>{
      if(m[idx]==='present') return;
      m[idx]='present'; changed++;
      if(DATA._isLiveMode && window.API && cls._studentDbIds && cls._studentDbIds.length){
        postAtt(cls, 'present', false);
      } else {
        const stu = DATA.findStudent(cls.student);
        if(stu) DATA.updateStudent(stu.id, { remaining: Math.max(0, stu.remaining-1), points: stu.points+10 });
      }
    });
    setAtt(m);
    const allAtt = DATA.loadAttendance(); allAtt[todayKey]=m; DATA.saveAttendance(allAtt);
    bumpData();
    showToast(changed ? `เช็ค "มาเรียน" ${changed} คาบแล้ว ✓ แก้รายคนที่ขาด/ลาได้เลย` : 'ทุกคาบมาเรียนครบแล้ว');
  };

  // date label helpers
  const _thaiDay = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
  const _thaiMon = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const selLabel = isToday ? DATA.TODAY_LABEL : (()=>{
    const d = new Date(selDate+'T00:00:00');
    return `${_thaiDay[d.getDay()]} ${d.getDate()} ${_thaiMon[d.getMonth()]} ${d.getFullYear()+543}`;
  })();

  const shiftDate = (delta)=>{
    const d = new Date(selDate+'T00:00:00'); d.setDate(d.getDate()+delta);
    const k = d.toISOString().slice(0,10);
    if(k <= todayKey) setSelDate(k);
  };

  // summary counts
  const counts = { present:0, leave:0, absent:0 };
  if(isToday) todayClasses.forEach((_,i)=>{ if(att[i]) counts[att[i]]++; });
  else if(histData?.summary) Object.assign(counts, histData.summary);
  const done  = isToday ? counts.present+counts.leave+counts.absent : (histData?.records?.length||0);
  const total = isToday ? todayClasses.length : done;

  return (
    <div className="content-inner">
      <div className="section-head">
        <div>
          <div style={{ fontFamily:"var(--ff-display)", fontWeight:700, fontSize:19 }}>เช็คชื่อเข้าเรียน</div>
          <div style={{ fontSize:13, color:"var(--text-3)" }}>
            {selLabel}{isToday ? ` · ${todayClasses.length} คาบเรียน` : ' · ประวัติ'}
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <button className="icon-btn" onClick={()=>shiftDate(-1)} title="วันก่อนหน้า"><Icon n="chevL" size={17}/></button>
          <input type="date" value={selDate} max={todayKey}
            onChange={e=>{ if(e.target.value && e.target.value<=todayKey) setSelDate(e.target.value); }}
            style={{ border:"1.5px solid var(--border)", borderRadius:9, padding:"6px 10px", fontSize:13,
              background:"var(--surface)", color:"var(--text)", cursor:"pointer", outline:"none" }}/>
          <button className="icon-btn" onClick={()=>shiftDate(1)} disabled={isToday} title="วันถัดไป"><Icon n="chevron" size={17}/></button>
          <button className="btn btn-ghost" onClick={()=>{
            const statusMap = { present:'เข้าเรียน', absent:'ขาด', leave:'ลา (แจ้งล่วงหน้า)' };
            if(isToday){
              const rows = [
                ['สรุปการเช็คชื่อ', selLabel],
                ['โรงเรียน', DATA.SCHOOL.name||''],
                [''],
                ['นักเรียน','ครู','คลาส','สถานะ'],
                ...todayClasses.map((cls,idx)=>[cls.student, cls.teacher, cls.cat, statusMap[att[idx]]||'ยังไม่เช็ค']),
                [''],
                ['รวมมาเรียน', counts.present],
                ['รวมลา', counts.leave],
                ['รวมขาด', counts.absent],
              ];
              downloadCsv(`attendance-${selDate}.csv`, rows);
            } else if(histData?.records?.length){
              const rows = [
                ['ประวัติการเช็คชื่อ', selLabel],
                [''],
                ['นักเรียน','สถานะ','วันที่'],
                ...histData.records.map(r=>[r.student_name||'', statusMap[r.status]||r.status, r.date]),
              ];
              downloadCsv(`attendance-${selDate}.csv`, rows);
            } else { showToast('ไม่มีข้อมูลสำหรับส่งออก'); return; }
            showToast('ส่งออกสรุปการเช็คชื่อแล้ว ✓');
          }}><Icon n="download" size={16}/> ส่งออก CSV</button>
        </div>
      </div>

      {/* summary stats */}
      <div className="stat-grid" style={{ gridTemplateColumns:"repeat(4,1fr)", marginBottom:18 }}>
        {isToday
          ? <Stat label="เช็คแล้ว" val={`${done}/${total}`} icon="check" tone="var(--primary)" meta={<span style={{color:"var(--text-3)"}}>คาบเรียน</span>}/>
          : <Stat label="บันทึกแล้ว" val={done} icon="check" tone="var(--primary)" meta={<span style={{color:"var(--text-3)"}}>รายการ</span>}/>}
        <Stat label="มาเรียน" val={counts.present} icon="users" tone="var(--ok)" meta={<span style={{color:"var(--text-3)"}}>คน</span>}/>
        <Stat label="ลา" val={counts.leave} icon="calendar" tone="var(--warn)" meta={<span style={{color:"var(--text-3)"}}>คน</span>}/>
        <Stat label="ขาด" val={counts.absent} icon="x" tone="var(--danger)" meta={<span style={{color:"var(--text-3)"}}>คน</span>}/>
      </div>

      {isToday ? (
        /* ---- editable today view ---- */
        <>
        {todayClasses.length>0 && (
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, marginBottom:12, flexWrap:"wrap" }}>
            <div style={{ fontSize:13, color:"var(--text-3)" }}>กดมาเรียนทั้งหมด แล้วค่อยแก้เฉพาะคนที่ขาด/ลา</div>
            <button className="btn btn-primary" onClick={markAllPresent}
              disabled={todayClasses.every((_,i)=>att[i]==='present')}>
              <Icon n="check" size={16}/> มาเรียนทั้งหมด
            </button>
          </div>
        )}
        <div className="card" style={{ overflow:"hidden" }}>
          {todayClasses.length===0 && <div className="empty">ไม่มีคาบเรียนวันนี้</div>}
          {todayClasses.map((c,i)=>{
            const cat = DATA.CATS[c.cat] || Object.values(DATA.CATS)[0] || {};
            const stu = DATA.findStudent(c.student);
            const st = att[i];
            return (
              <div key={i} className="att-row" style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 18px",
                borderBottom: i<todayClasses.length-1?"1px solid var(--border)":"none",
                background: st==="present"?"color-mix(in oklch,var(--ok-soft) 55%,transparent)":
                            st==="absent" ?"color-mix(in oklch,var(--danger-soft) 45%,transparent)":"transparent" }}>
                <div style={{ textAlign:"center", minWidth:52 }}>
                  <div style={{ fontWeight:700, fontFamily:"var(--ff-display)", fontSize:15 }}>{c.time}</div>
                  <div style={{ fontSize:10.5, color:"var(--text-3)" }}>{c.end}</div>
                </div>
                <div style={{ width:3, alignSelf:"stretch", borderRadius:3, background:cat.color||'var(--primary)' }}></div>
                <Avatar name={c.student} size={40}/>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:600, fontSize:14.5 }}>{DATA.dispName(c.student)}{c._makeup && <span className="badge" style={{ marginLeft:7, background:'var(--primary-soft)', color:'var(--primary-ink)', fontSize:10.5 }}>🔄 ชดเชย</span>}</div>
                  <div style={{ fontSize:12.5, color:"var(--text-3)" }}>{cat.icon} {cat.label} · {c.teacher} · {c.room}</div>
                </div>
                {stu && <div className="hide-mobile" style={{ textAlign:"right", marginRight:6 }}>
                  <div style={{ fontSize:12, color:"var(--text-3)" }}>คงเหลือ</div>
                  <div style={{ fontWeight:700, color: DATA.isNearEnding(stu)?"var(--danger)":"var(--text)" }}>{stu.remaining}/{stu.pkg}</div>
                </div>}
                <div className="seg">
                  {Object.entries(DATA.ATT_STATUS).map(([k,v])=>(
                    <button key={k} className={"seg-btn"+(st===k?" on":"")} onClick={()=>setStatus(i,k)}
                      style={ st===k ? { background:v.color, color:"#fff", borderColor:v.color } : null }>{v.label}</button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        </>
      ) : histLoading ? (
        /* ---- loading past date ---- */
        <div className="card card-pad" style={{ textAlign:"center", padding:"48px", color:"var(--text-3)" }}>กำลังโหลด…</div>
      ) : (
        /* ---- read-only history view ---- */
        <div className="card" style={{ overflow:"hidden" }}>
          {(!histData?.records?.length) && (
            <div className="empty" style={{ padding:"48px 20px" }}>
              <div style={{ fontSize:32, marginBottom:10 }}>📋</div>
              <div style={{ fontWeight:600 }}>ไม่มีบันทึกการเช็คชื่อ</div>
              <div style={{ fontSize:13, color:"var(--text-3)", marginTop:4 }}>วันที่ {selLabel} ยังไม่มีข้อมูล</div>
            </div>
          )}
          {(histData?.records||[]).map((rec,i)=>{
            const st = DATA.ATT_STATUS[rec.status]||{label:rec.status,color:"var(--text-3)"};
            const timeStr = (rec.created_at||'').slice(11,16);
            return (
              <div key={rec.id||i} style={{ display:"flex", alignItems:"center", gap:14, padding:"13px 18px",
                borderBottom: i<(histData.records.length-1)?"1px solid var(--border)":"none" }}>
                <Avatar name={rec.student_name||'?'} size={40}/>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:600, fontSize:14.5 }}>{DATA.dispName(rec.student_name)||'-'}</div>
                  {timeStr && <div style={{ fontSize:12.5, color:"var(--text-3)" }}>บันทึก {timeStr} น.</div>}
                </div>
                <span className="badge" style={{ background:st.color, color:"#fff" }}>{st.label}</span>
              </div>
            );
          })}
        </div>
      )}
      {toast}
    </div>
  );
}
window.Attendance = Attendance;

/* ---- CSV download helper ---- */
function downloadCsv(filename, rows){
  const escape = (v)=>{ const s=String(v==null?'':v); return s.includes(',')||s.includes('"')||s.includes('\n') ? '"'+s.replace(/"/g,'""')+'"' : s; };
  const csv = rows.map(r=>r.map(escape).join(',')).join('\r\n');
  const blob = new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=filename; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

/* ===================== REPORTS (รายงานสรุปรายเดือน) ===================== */
function Reports(){
  useDataVersion();
  const [toast, showToast] = useToast();
  const [analytics, setAnalytics] = useState(null);
  useEffect(()=>{
    if(!DATA._isLiveMode || !window.API || !window.API.analytics) return;
    window.API.analytics(12, 3).then(setAnalytics).catch(()=>{});
  }, []);
  const revLen = DATA.REVENUE.length;
  const [selMonthIdx, setSelMonthIdx] = useState(revLen>0 ? revLen-1 : 0);
  // clamp if data was updated
  const mIdx = Math.min(selMonthIdx, revLen-1);

  const monthRev      = revLen ? (DATA.REVENUE[mIdx]?.v||0) : 0;
  const prevRev       = mIdx>0 ? (DATA.REVENUE[mIdx-1]?.v||0) : 0;
  const revDelta      = prevRev>0 ? (((monthRev-prevRev)/prevRev)*100).toFixed(1) : '0.0';
  const currMonthLabel= revLen ? (DATA.REVENUE[mIdx]?.m||'') : '';

  const activeCount = DATA.STUDENTS.filter(s=>s.status==="active").length;
  const trialCount = DATA.STUDENTS.filter(s=>s.status==="trial").length;
  const totalHours = DATA.TEACHERS.reduce((a,t)=>a+t.hours,0);
  const totalPay = DATA.TEACHERS.reduce((a,t)=>a+t.rate*t.hours,0);
  const outstanding = DATA.STUDENTS.reduce((a,s)=>a+s.balance,0);
  const nearN = DATA.STUDENTS.filter(DATA.isNearEnding).length;

  // attendance rate (this month, mock-derived from today's marks + baseline)
  const att = (DATA.loadAttendance()[DATA.TODAY_KEY])||{};
  const marked = Object.values(att);
  const present = marked.filter(x=>x==="present").length;
  const attRate = marked.length ? Math.round((present/marked.length)*100) : 94;

  const exportReport = ()=>{
    const yr = new Date().getFullYear()+543;
    const rows = [
      ['รายงานสรุปประจำเดือน', `${currMonthLabel} ${yr}`],
      ['จัดทำโดย', DATA.SCHOOL.name||''],
      [''],
      ['สถิติรวม',''],
      ['รายได้รวม', monthRev],
      ['นักเรียนกำลังเรียน', activeCount],
      ['นักเรียนทดลอง', trialCount],
      ['ชั่วโมงสอนรวม', totalHours],
      ['ยอดค้างชำระรวม', outstanding],
      ['คอร์สใกล้หมด', nearN+' คน'],
      [''],
      ['ชื่อนักเรียน','ครู','สถานะ','แพ็กเกจ (ครั้ง)','คงเหลือ','ยอดค้างชำระ'],
      ...DATA.STUDENTS.map(s=>[s.name, s.teacher, s.status==='active'?'กำลังเรียน':s.status==='trial'?'ทดลอง':'พัก', s.pkg, s.remaining, s.balance]),
      [''],
      ['ครูผู้สอน','ชั่วโมง','เรต/ชม.','ค่าสอน'],
      ...DATA.TEACHERS.map(t=>[t.nick, t.hours, t.rate, t.rate*t.hours]),
      ['รวมค่าสอน', totalHours, '', totalPay],
    ];
    downloadCsv(`skooldee-${currMonthLabel}-${yr}.csv`, rows);
    showToast('ส่งออกรายงาน CSV แล้ว ✓');
  };

  const mix = Object.values(DATA.CATS).map(c=>({
    label:c.label, color:c.color, v: DATA.STUDENTS.filter(s=>s.cats.includes(c.key)).length
  })).filter(m=>m.v>0);

  return (
    <div className="content-inner">
      <div className="section-head">
        <div>
          <div style={{ fontFamily:"var(--ff-display)", fontWeight:700, fontSize:19 }}>รายงานสรุป · {currMonthLabel} {(new Date().getFullYear()+543)}</div>
          <div style={{ fontSize:13, color:"var(--text-3)" }}>ภาพรวมผลการดำเนินงานประจำเดือน</div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <select className="rep-month"
            value={mIdx}
            onChange={e=>setSelMonthIdx(Number(e.target.value))}>
            {[...DATA.REVENUE].map((r,i)=><option key={i} value={i}>{r.m} {new Date().getFullYear()+543}</option>).reverse()}
          </select>
          <button className="btn btn-primary" onClick={exportReport}><Icon n="download" size={16}/> ส่งออก CSV</button>
        </div>
      </div>

      <div className="stat-grid" style={{ marginBottom:18 }}>
        <Stat label="รายได้รวม" val={DATA.baht(monthRev)} icon="wallet" tone="var(--c-guitar)" big
          meta={Number(revDelta)>=0
            ? <span className="trend-up"><Icon n="trendUp" size={14}/> +{revDelta}%</span>
            : <span style={{color:"var(--danger)",fontWeight:600,display:"flex",alignItems:"center",gap:3,fontSize:12}}><Icon n="trendDown" size={14}/> {revDelta}%</span>}/>
        <Stat label="นักเรียนกำลังเรียน" val={activeCount} icon="users" tone="var(--c-piano)" meta={<span style={{color:"var(--text-3)"}}>+ ทดลอง {trialCount} คน</span>}/>
        <Stat label="ชั่วโมงสอนรวม" val={totalHours+" ชม."} icon="clock" tone="var(--c-dance)" meta={<span style={{color:"var(--text-3)"}}>ครู {DATA.TEACHERS.length} คน</span>}/>
        <Stat label="อัตราเข้าเรียน" val={attRate+"%"} icon="check" tone="var(--ok)" meta={<span style={{color:"var(--text-3)"}}>เฉลี่ยทั้งเดือน</span>}/>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1.5fr 1fr", gap:18, alignItems:"start" }} className="dash-cols">
        <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
          {DATA._isLiveMode && analytics ? (
            <>
              {analytics.revenue && (
                <div className="card card-pad">
                  <SectionHead title="แนวโน้มรายได้ + คาดการณ์"/>
                  <ForecastChart history={analytics.revenue.history} forecast={analytics.revenue.forecast.points.slice(1)} color="var(--primary)" fmt={DATA.baht}/>
                  <ForecastCaption fc={analytics.revenue.forecast} fmt={DATA.baht}/>
                </div>
              )}
              <div className="card card-pad">
                <SectionHead title="นักเรียนใหม่ + คาดการณ์"/>
                <ForecastChart history={analytics.new_students.history} forecast={analytics.new_students.forecast.points.slice(1)} color="var(--c-piano)" fmt={v=>v+" คน"}/>
                <ForecastCaption fc={analytics.new_students.forecast} fmt={v=>v+" คน"}/>
              </div>
            </>
          ) : (
            <div className="card card-pad">
              <SectionHead title="แนวโน้มรายได้ 7 เดือน"/>
              <BarChart data={DATA.REVENUE} height={150} color="var(--primary)"/>
            </div>
          )}

          <PayrollSection showToast={showToast}/>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
          <div className="card card-pad">
            <SectionHead title="สัดส่วนนักเรียนตามคลาส"/>
            <div style={{ display:"flex", gap:16, alignItems:"center" }}>
              <Donut segments={mix} size={130}/>
              <div style={{ flex:1, display:"flex", flexDirection:"column", gap:8 }}>
                {mix.map((m,i)=>(
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:9, fontSize:13.5 }}>
                    <span className="dotmark" style={{ background:m.color, width:10, height:10 }}></span>
                    <span style={{ flex:1, color:"var(--text-2)" }}>{m.label}</span><b>{m.v}</b>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card card-pad">
            <SectionHead title="สิ่งที่ต้องดำเนินการ"/>
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <RepRow icon="receipt" tone="var(--danger)" label="ยอดค้างชำระ" val={DATA.baht(outstanding)}/>
              <RepRow icon="bell" tone="var(--warn)" label="คอร์สใกล้หมด" val={nearN+" คน"}/>
              <RepRow icon="star" tone="var(--c-piano)" label="นักเรียนทดลอง (รอปิดการขาย)" val={trialCount+" คน"}/>
            </div>
          </div>
        </div>
      </div>
      {toast}
    </div>
  );
}
function RepRow({ icon, tone, label, val }){
  return (
    <div style={{ display:"flex", alignItems:"center", gap:12 }}>
      <div style={{ width:34, height:34, borderRadius:10, display:"grid", placeItems:"center", background:`color-mix(in oklch, ${tone} 14%, white)`, color:tone }}><Icon n={icon} size={17}/></div>
      <span style={{ flex:1, fontSize:14, color:"var(--text-2)" }}>{label}</span>
      <b style={{ color:tone }}>{val}</b>
    </div>
  );
}
window.Reports = Reports;

/* ===================== PAYROLL SECTION ===================== */
function PayrollSection({ showToast }){
  const THMON = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const [month, setMonth] = useState(()=> new Date().toISOString().slice(0,7));
  const [payslips, setPayslips] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(new Set());

  useEffect(()=>{
    if(!DATA._isLiveMode || !window.API || !window.API.teacherPayslip) return;
    setLoading(true);
    const results = {};
    Promise.all(DATA.TEACHERS.map(async (t)=>{
      if(!t._dbId) return;
      try{ const ps = await window.API.teacherPayslip(t._dbId, month); results[t._dbId] = ps; }catch(e){}
    })).then(()=>{ setPayslips(results); setLoading(false); });
  }, [month]);

  const toggle = (id)=> setExpanded(prev=>{ const n=new Set(prev); n.has(id)?n.delete(id):n.add(id); return n; });

  const monthOpts = [];
  const now = new Date();
  for(let i=0; i<12; i++){
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    const ym = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
    monthOpts.push({ ym, lbl: THMON[d.getMonth()]+' '+(d.getFullYear()+543) });
  }
  const [selYY, selMM] = month.split('-').map(Number);
  const monthLabel = THMON[(selMM||1)-1]+' '+(selYY+543);
  const isLive = DATA._isLiveMode;

  const rows = DATA.TEACHERS.map(t=>{
    const ps = payslips && t._dbId ? payslips[t._dbId] : null;
    if(ps) return { t, hours:ps.actual_hours, pay:ps.pay, sessions:ps.sessions||[], rate:ps.teacher.rate, cnt:ps.sessions_count };
    return { t, hours:t.hours||0, pay:(t.rate||0)*(t.hours||0), sessions:[], rate:t.rate||0, cnt:null };
  });

  const totalHours = rows.reduce((a,r)=>a+(r.hours||0), 0);
  const totalPay   = rows.reduce((a,r)=>a+(r.pay||0),   0);

  const sel = { padding:'6px 10px', borderRadius:8, border:'1.5px solid var(--border)', fontSize:13, background:'var(--surface)', color:'var(--text)' };

  const printAll = async()=>{
    for(const r of rows) await printTeacherPaySlip(r.t, isLive ? month : null);
  };

  return (
    <div className="card">
      <div className="card-pad" style={{ paddingBottom:8 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
          <div>
            <div style={{ fontWeight:700, fontSize:15 }}>ค่าสอนครู</div>
            <div style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>
              {isLive && !loading && payslips ? `จากเช็คชื่อจริง · ${monthLabel}` : !isLive ? 'ประมาณการ (ตาราง × 4 สัปดาห์)' : ''}
            </div>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            {isLive && (
              <select value={month} onChange={e=>setMonth(e.target.value)} style={sel}>
                {monthOpts.map(o=><option key={o.ym} value={o.ym}>{o.lbl}</option>)}
              </select>
            )}
            <button className="btn" style={{ fontSize:12.5 }} onClick={printAll}>
              <Icon n="receipt" size={14}/> พิมพ์ทั้งหมด
            </button>
          </div>
        </div>
        {loading && <div style={{ fontSize:12.5, color:'var(--text-3)', marginTop:6 }}>กำลังโหลด…</div>}
      </div>

      <table>
        <thead>
          <tr>
            <th>ครู</th>
            <th className="hide-mobile">วิชา</th>
            <th style={{ textAlign:'right' }}>ชม.สอน</th>
            <th style={{ textAlign:'right' }} className="hide-mobile">เรต</th>
            <th style={{ textAlign:'right' }}>ค่าสอน</th>
            <th style={{ width:34 }}></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r=>{
            const isExp = expanded.has(r.t.id);
            const hasSess = r.sessions && r.sessions.length > 0;
            return (
              <React.Fragment key={r.t.id}>
                <tr style={{ cursor:hasSess?'pointer':'default' }} onClick={()=>hasSess&&toggle(r.t.id)}>
                  <td>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontSize:10, color:'var(--text-3)', width:10, flexShrink:0, userSelect:'none' }}>{hasSess?(isExp?'▼':'▶'):''}</span>
                      <Avatar name={r.t.nick} size={30} color={r.t.color}/>
                      <b>{r.t.nick}</b>
                    </div>
                  </td>
                  <td className="hide-mobile">{r.t.cats.map(c=><CatBadge key={c} cat={c} small/>)}</td>
                  <td style={{ textAlign:'right' }}>
                    <span style={{ fontWeight:600 }}>{typeof r.hours==='number'?r.hours.toFixed(1):r.hours}</span>
                    <span style={{ fontSize:11, color:'var(--text-3)' }}> ชม.</span>
                    {r.cnt!=null && <div style={{ fontSize:11, color:'var(--text-3)' }}>{r.cnt} คาบ</div>}
                  </td>
                  <td style={{ textAlign:'right' }} className="hide-mobile">{DATA.baht(r.rate)}</td>
                  <td style={{ textAlign:'right', fontWeight:700, color:'var(--primary-ink)' }}>{DATA.baht(r.pay)}</td>
                  <td onClick={e=>e.stopPropagation()}>
                    <button className="icon-btn" title="พิมพ์สลิป" onClick={()=>printTeacherPaySlip(r.t, isLive?month:null)}>
                      <Icon n="receipt" size={14}/>
                    </button>
                  </td>
                </tr>
                {isExp && r.sessions.map((s,i)=>(
                  <tr key={i} style={{ background:'var(--surface-2)', fontSize:12 }}>
                    <td style={{ paddingLeft:42, color:'var(--text-2)' }}>
                      {s.date.slice(5)}
                      {s.makeup && <span style={{ marginLeft:5, fontSize:10, padding:'1px 5px', borderRadius:4, background:'#fef3c7', color:'#92400e' }}>เสริม</span>}
                      {s.group && <span style={{ marginLeft:4, fontSize:10, color:'var(--text-3)' }}>กลุ่ม</span>}
                    </td>
                    <td className="hide-mobile" style={{ color:'var(--text-3)' }}>
                      {(DATA.CATS[s.category]||{}).label||s.category||'-'}
                    </td>
                    <td style={{ textAlign:'right', color:'var(--text-2)' }}>{s.start}–{s.end}</td>
                    <td style={{ textAlign:'right', color:'var(--text-3)' }} className="hide-mobile">{DATA.baht(s.rate||0)}</td>
                    <td style={{ textAlign:'right', color:'var(--text-3)' }}>
                      {DATA.baht(Math.round((s.minutes||0)/60*(s.rate||0)))}
                    </td>
                    <td></td>
                  </tr>
                ))}
              </React.Fragment>
            );
          })}
          <tr style={{ borderTop:'2px solid var(--border)' }}>
            <td colSpan={2} style={{ fontWeight:700 }}>รวมค่าสอน</td>
            <td style={{ textAlign:'right', fontWeight:700 }}>{totalHours.toFixed(1)} ชม.</td>
            <td className="hide-mobile"></td>
            <td style={{ textAlign:'right', fontWeight:800, fontFamily:'var(--ff-display)', fontSize:16, color:'var(--primary-ink)' }}>{DATA.baht(totalPay)}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

Object.assign(window, { Attendance, Reports });
