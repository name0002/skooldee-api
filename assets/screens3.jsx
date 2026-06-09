/* ============ บ้านมาริ — Attendance & Reports ============ */

/* ===================== ATTENDANCE (เช็คชื่อรายวัน) ===================== */
function Attendance(){
  useDataVersion();
  const [att, setAtt] = useState(()=> (DATA.loadAttendance()[DATA.TODAY_KEY]) || {});
  const [toast, showToast] = useToast();

  const setStatus = (idx, status)=>{
    const cls = DATA.TODAY[idx];
    const prev = att[idx];
    const next = prev===status ? undefined : status;     // กดซ้ำ = ยกเลิก
    // ปรับจำนวนครั้งคงเหลือเมื่อสถานะ "มาเรียน" เปลี่ยน
    const stu = DATA.findStudent(cls.student);
    if(stu){
      const was = prev==="present", now = next==="present";
      if(was && !now) DATA.updateStudent(stu.id, { remaining: stu.remaining+1, points: Math.max(0, stu.points-10) });
      if(!was && now) DATA.updateStudent(stu.id, { remaining: Math.max(0, stu.remaining-1), points: stu.points+10 });
    }
    const m = { ...att }; if(next) m[idx]=next; else delete m[idx];
    setAtt(m);
    const all = DATA.loadAttendance(); all[DATA.TODAY_KEY]=m; DATA.saveAttendance(all);
    bumpData();
    if(next) showToast(`${cls.student} ${DATA.ATT_STATUS[next].label}${next==="present"?" · +10 แต้ม":""}`);
  };

  const counts = { present:0, leave:0, absent:0 };
  DATA.TODAY.forEach((c,i)=>{ if(att[i]) counts[att[i]]++; });
  const done = counts.present+counts.leave+counts.absent;
  const total = DATA.TODAY.length;

  return (
    <div className="content-inner">
      <div className="section-head">
        <div>
          <div style={{ fontFamily:"var(--ff-display)", fontWeight:700, fontSize:19 }}>เช็คชื่อเข้าเรียน</div>
          <div style={{ fontSize:13, color:"var(--text-3)" }}>{DATA.TODAY_LABEL} · {total} คาบเรียน</div>
        </div>
        <button className="btn btn-ghost" onClick={()=>showToast("ส่งสรุปการเข้าเรียนแล้ว")}><Icon n="download" size={16}/> ส่งสรุปวันนี้</button>
      </div>

      {/* summary */}
      <div className="stat-grid" style={{ gridTemplateColumns:"repeat(4,1fr)", marginBottom:18 }}>
        <Stat label="เช็คแล้ว" val={`${done}/${total}`} icon="check" tone="var(--primary)" meta={<span style={{color:"var(--text-3)"}}>คาบเรียน</span>}/>
        <Stat label="มาเรียน" val={counts.present} icon="users" tone="var(--ok)" meta={<span style={{color:"var(--text-3)"}}>คน</span>}/>
        <Stat label="ลา" val={counts.leave} icon="calendar" tone="var(--warn)" meta={<span style={{color:"var(--text-3)"}}>คน</span>}/>
        <Stat label="ขาด" val={counts.absent} icon="x" tone="var(--danger)" meta={<span style={{color:"var(--text-3)"}}>คน</span>}/>
      </div>

      <div className="card" style={{ overflow:"hidden" }}>
        {DATA.TODAY.map((c,i)=>{
          const cat = DATA.CATS[c.cat];
          const stu = DATA.findStudent(c.student);
          const st = att[i];
          return (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 18px", borderBottom: i<total-1?"1px solid var(--border)":"none",
              background: st==="present"?"color-mix(in oklch,var(--ok-soft) 55%,transparent)": st==="absent"?"color-mix(in oklch,var(--danger-soft) 45%,transparent)":"transparent" }}>
              <div style={{ textAlign:"center", minWidth:52 }}>
                <div style={{ fontWeight:700, fontFamily:"var(--ff-display)", fontSize:15 }}>{c.time}</div>
                <div style={{ fontSize:10.5, color:"var(--text-3)" }}>{c.end}</div>
              </div>
              <div style={{ width:3, alignSelf:"stretch", borderRadius:3, background:cat.color }}></div>
              <Avatar name={c.student} size={40}/>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:600, fontSize:14.5 }}>{c.student}</div>
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
      {toast}
    </div>
  );
}
window.Attendance = Attendance;

/* ===================== REPORTS (รายงานสรุปรายเดือน) ===================== */
function Reports(){
  useDataVersion();
  const [toast, showToast] = useToast();

  const monthRev = DATA.REVENUE[DATA.REVENUE.length-1].v;
  const prevRev = DATA.REVENUE[DATA.REVENUE.length-2].v;
  const revDelta = (((monthRev-prevRev)/prevRev)*100).toFixed(1);

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

  const mix = Object.values(DATA.CATS).map(c=>({
    label:c.label, color:c.color, v: DATA.STUDENTS.filter(s=>s.cats.includes(c.key)).length
  })).filter(m=>m.v>0);

  return (
    <div className="content-inner">
      <div className="section-head">
        <div>
          <div style={{ fontFamily:"var(--ff-display)", fontWeight:700, fontSize:19 }}>รายงานสรุป · มิถุนายน 2569</div>
          <div style={{ fontSize:13, color:"var(--text-3)" }}>ภาพรวมผลการดำเนินงานประจำเดือน</div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <select className="rep-month"><option>มิถุนายน 2569</option><option>พฤษภาคม 2569</option><option>เมษายน 2569</option></select>
          <button className="btn btn-primary" onClick={()=>showToast("กำลังส่งออกรายงาน PDF...")}><Icon n="download" size={16}/> ส่งออก</button>
        </div>
      </div>

      <div className="stat-grid" style={{ marginBottom:18 }}>
        <Stat label="รายได้รวม" val={DATA.baht(monthRev)} icon="wallet" tone="var(--c-guitar)" big meta={<span className="trend-up"><Icon n="trendUp" size={14}/> +{revDelta}%</span>}/>
        <Stat label="นักเรียนกำลังเรียน" val={activeCount} icon="users" tone="var(--c-piano)" meta={<span style={{color:"var(--text-3)"}}>+ ทดลอง {trialCount} คน</span>}/>
        <Stat label="ชั่วโมงสอนรวม" val={totalHours+" ชม."} icon="clock" tone="var(--c-dance)" meta={<span style={{color:"var(--text-3)"}}>ครู {DATA.TEACHERS.length} คน</span>}/>
        <Stat label="อัตราเข้าเรียน" val={attRate+"%"} icon="check" tone="var(--ok)" meta={<span style={{color:"var(--text-3)"}}>เฉลี่ยทั้งเดือน</span>}/>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1.5fr 1fr", gap:18, alignItems:"start" }} className="dash-cols">
        <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
          <div className="card card-pad">
            <SectionHead title="แนวโน้มรายได้ 7 เดือน"/>
            <BarChart data={DATA.REVENUE} height={150} color="var(--primary)"/>
          </div>

          <div className="card">
            <div className="card-pad" style={{ paddingBottom:6 }}><SectionHead title="ค่าสอนครู (ประจำเดือน)"/></div>
            <table>
              <thead><tr><th>ครู</th><th className="hide-mobile">หมวด</th><th style={{textAlign:"right"}}>ชั่วโมง</th><th style={{textAlign:"right"}} className="hide-mobile">เรต</th><th style={{textAlign:"right"}}>ค่าสอน</th></tr></thead>
              <tbody>
                {DATA.TEACHERS.map(t=>(
                  <tr key={t.id}>
                    <td><div style={{ display:"flex", alignItems:"center", gap:10 }}><Avatar name={t.nick} size={32} color={t.color}/><b>{t.nick}</b></div></td>
                    <td className="hide-mobile">{t.cats.map(c=><CatBadge key={c} cat={c} small/>)}</td>
                    <td style={{ textAlign:"right" }}>{t.hours} ชม.</td>
                    <td style={{ textAlign:"right" }} className="hide-mobile">{DATA.baht(t.rate)}</td>
                    <td style={{ textAlign:"right", fontWeight:700, color:"var(--primary-ink)" }}>{DATA.baht(t.rate*t.hours)}</td>
                  </tr>
                ))}
                <tr><td colSpan={2} style={{ fontWeight:700 }}>รวมค่าสอน</td>
                  <td style={{ textAlign:"right", fontWeight:700 }}>{totalHours} ชม.</td>
                  <td className="hide-mobile"></td>
                  <td style={{ textAlign:"right", fontWeight:700, fontFamily:"var(--ff-display)", fontSize:15 }}>{DATA.baht(totalPay)}</td></tr>
              </tbody>
            </table>
          </div>
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

Object.assign(window, { Attendance, Reports });
