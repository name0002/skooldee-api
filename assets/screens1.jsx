/* ============ บ้านมาริ — Dashboard & Schedule ============ */

/* ===================== DASHBOARD ===================== */
function Dashboard({ go }){
  const totalStudents = DATA.STUDENTS.filter(s=>s.status!=="paused").length;
  const todayCount = DATA.TODAY.length;
  const monthRev = DATA.REVENUE[DATA.REVENUE.length-1].v;
  const prevRev = DATA.REVENUE[DATA.REVENUE.length-2].v;
  const revDelta = (((monthRev-prevRev)/prevRev)*100).toFixed(1);
  const outstanding = DATA.STUDENTS.reduce((a,s)=>a+s.balance,0);

  // student mix by category
  const mix = Object.values(DATA.CATS).map(c=>({
    label:c.label, color:c.color,
    v: DATA.STUDENTS.filter(s=>s.cats.includes(c.key)).length
  })).filter(m=>m.v>0);

  const followUp = DATA.STUDENTS.filter(s=> s.balance>0 || DATA.isNearEnding(s));
  const nearList = DATA.STUDENTS.filter(DATA.isNearEnding);

  return (
    <div className="content-inner">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:22, flexWrap:"wrap", gap:12 }}>
        <div>
          <h1 style={{ fontFamily:"var(--ff-display)", fontSize:26, fontWeight:700, margin:0, letterSpacing:"-0.02em" }}>สวัสดีตอนบ่าย {DATA.SCHOOL.owner} 👋</h1>
          <p style={{ color:"var(--text-2)", margin:"5px 0 0", fontSize:14.5 }}>วันนี้มี <b style={{color:"var(--primary-ink)"}}>{todayCount} คาบเรียน</b> · มีนักเรียน {followUp.length} คนที่ต้องติดตาม</p>
        </div>
        <button className="btn btn-primary" onClick={()=>go("schedule")}><Icon n="plus" size={18}/> จองคาบเรียน</button>
      </div>

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
          meta={<span className="trend-up"><Icon n="trendUp" size={14}/> +3 เดือนนี้</span>}/>
        <Stat label="คาบเรียนวันนี้" val={todayCount} icon="calendar" tone="var(--c-dance)"
          meta={<span style={{color:"var(--text-3)"}}>เหลืออีก 3 คาบ</span>}/>
        <Stat label="รายได้เดือน มิ.ย." val={DATA.baht(monthRev)} icon="wallet" tone="var(--c-guitar)" big
          meta={<span className="trend-up"><Icon n="trendUp" size={14}/> +{revDelta}% จากเดือนก่อน</span>}/>
        <Stat label="ยอดค้างชำระ" val={DATA.baht(outstanding)} icon="receipt" tone="var(--danger)" big
          meta={<span style={{color:"var(--danger)"}}>{followUp.filter(s=>s.balance>0).length} รายการ</span>}/>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1.6fr 1fr", gap:18, alignItems:"start" }} className="dash-cols">
        {/* left */}
        <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
          <div className="card card-pad">
            <SectionHead title="รายได้ย้อนหลัง 7 เดือน">
              <span className="badge" style={{ background:"var(--ok-soft)", color:"color-mix(in oklch,var(--ok) 75%,black)" }}>
                <Icon n="trendUp" size={14}/> เติบโต {revDelta}%
              </span>
            </SectionHead>
            <BarChart data={DATA.REVENUE} height={150} color="var(--primary)"/>
          </div>

          <div className="card">
            <div className="card-pad" style={{ paddingBottom:6 }}>
              <SectionHead title="ตารางวันนี้ · อังคาร 2 มิ.ย.">
                <button className="btn btn-soft btn-sm" onClick={()=>go("schedule")}>ดูทั้งหมด <Icon n="chevron" size={14}/></button>
              </SectionHead>
            </div>
            <div style={{ padding:"0 8px 8px" }}>
              {DATA.TODAY.map((c,i)=> <TodayRow key={i} c={c}/>)}
            </div>
          </div>
        </div>

        {/* right */}
        <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
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
              <span className="nav-badge" style={{ background:"var(--danger)" }}>{followUp.length}</span>
            </SectionHead>
            <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
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
  const cat = DATA.CATS[c.cat];
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
        <div style={{ fontSize:12.5, color:"var(--text-3)" }}>{c.student} · {c.teacher} · {c.room}</div>
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

  const items = DATA.SCHEDULE.filter(s=> filter==="all" || s.cat===filter);
  const totalMin = DATA.DAY_END - DATA.DAY_START;
  const H = totalMin * DATA.PX_PER_MIN;
  const hours = [];
  for(let h=10; h<=19; h++) hours.push(h);
  const byDay = DATA.DAYS.map((d,di)=> DATA.layoutDay(items.filter(s=>s.day===di)));
  const topOf = (min)=> (min - DATA.DAY_START) * DATA.PX_PER_MIN;
  const fmtMin = (min)=> `${String(Math.floor(min/60)).padStart(2,"0")}:${String(min%60).padStart(2,"0")}`;
  const TODAY_COL = 1; // อังคาร

  return (
    <div>
      <div className="section-head" style={{ marginBottom:16 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ display:"flex", gap:4 }}>
            <button className="icon-btn"><Icon n="chevL" size={18}/></button>
            <button className="icon-btn"><Icon n="chevron" size={18}/></button>
          </div>
          <div>
            <div style={{ fontFamily:"var(--ff-display)", fontWeight:700, fontSize:18 }}>1 – 7 มิถุนายน 2569</div>
            <div style={{ fontSize:12.5, color:"var(--text-3)" }}>{items.length} คาบเรียนในสัปดาห์นี้</div>
          </div>
        </div>
        <button className="btn btn-primary" onClick={()=>setBooking({})}><Icon n="plus" size={18}/> จองคาบเรียน</button>
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

      <div className="card" style={{ overflow:"hidden" }}>
        <div className="sc-wrap">
          <div className="sc-grid" style={{ gridTemplateColumns:`56px repeat(7, minmax(146px,1fr))`, minWidth:1060 }}>
            {/* header */}
            <div className="sc-corner"></div>
            {DATA.DAYS.map((d,i)=>(
              <div key={i} className="sc-dayhead" style={ i===TODAY_COL ? { background:"var(--primary-soft)" } : null }>
                <div className="cal-day" style={ i===TODAY_COL ? { color:"var(--primary-ink)" } : null }>{d.d}</div>
                <div className="cal-date">{d.n} มิ.ย.</div>
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
                onClick={(e)=>{ const r=e.currentTarget.getBoundingClientRect(); let min=DATA.DAY_START+Math.round((e.clientY-r.top)/DATA.PX_PER_MIN/30)*30; min=Math.max(DATA.DAY_START,Math.min(DATA.DAY_END-30,min)); setBooking({ day:di, start:fmtMin(min) }); }}>
                {hours.map(h=>(<div key={h} className="sc-hour" style={{ top:topOf(h*60) }}></div>))}
                {evs.map((ev,k)=>{
                  const cat = DATA.CATS[ev.cat];
                  const top = topOf(ev._s), ht = (ev._e-ev._s)*DATA.PX_PER_MIN;
                  const gap = 3;
                  return (
                    <div key={k} className="sc-ev" onClick={(e)=>{ e.stopPropagation(); setSel(ev); }}
                      style={{ top:top+1, height:ht-2, left:`calc(${(ev._lane/ev._cols)*100}% + 2px)`, width:`calc(${100/ev._cols}% - ${gap}px)`,
                        background:cat.soft, borderColor:cat.color, color:`color-mix(in oklch, ${cat.color} 74%, black)` }}>
                      <div className="sc-ev-name">{ev.student}</div>
                      {ht>=38 && <div className="sc-ev-time">{ev.start}–{ev.end}</div>}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {sel && <ClassDrawer c={sel} onClose={()=>setSel(null)} onCancel={()=>{ setSel(null); showToast("ยกเลิกคาบเรียนแล้ว"); }}/>}
      {booking && <BookingDrawer slot={booking} onClose={()=>setBooking(null)} onSave={()=>{ setBooking(null); showToast("จองคาบเรียนสำเร็จ"); }}/>}
      {toast}
    </div>
  );
}

function ClassDrawer({ c, onClose, onCancel }){
  const cat = DATA.CATS[c.cat];
  const day = DATA.DAYS[c.day];
  return (
    <Drawer title={cat.label} sub={`${day.d} ${c.start}–${c.end} น.`} onClose={onClose} accent={cat.color}
      footer={<>
        <button className="btn btn-ghost" style={{ flex:1 }} onClick={onCancel}>ยกเลิกคาบ</button>
        <button className="btn btn-primary" style={{ flex:1 }} onClick={onClose}><Icon n="check" size={17}/> เช็คชื่อเข้าเรียน</button>
      </>}>
      <div style={{ display:"flex", alignItems:"center", gap:13, padding:"4px 0 18px" }}>
        <div style={{ width:48, height:48, borderRadius:13, display:"grid", placeItems:"center", fontSize:24, background:cat.soft }}>{cat.icon}</div>
        <div><CatBadge cat={c.cat}/></div>
      </div>
      <div className="card" style={{ padding:"4px 16px", marginBottom:18 }}>
        <div className="kv"><span className="k">นักเรียน</span><span className="v">{c.student}</span></div>
        <div className="kv"><span className="k">ครูผู้สอน</span><span className="v">{c.teacher}</span></div>
        <div className="kv"><span className="k">ห้องเรียน</span><span className="v">{c.room}</span></div>
        <div className="kv"><span className="k">เวลา</span><span className="v">{day.d} {c.start} – {c.end} น.</span></div>
      </div>
      <div className="field">
        <label>บันทึกของครู</label>
        <textarea rows={3} placeholder="เช่น เพลงที่ฝึก / สิ่งที่ต้องปรับปรุง..." defaultValue=""></textarea>
      </div>
    </Drawer>
  );
}

function BookingDrawer({ slot, onClose, onSave }){
  const [cat, setCat] = useState("piano");
  const [group, setGroup] = useState(false);
  const [members, setMembers] = useState([]);
  const toggleMember = (name)=> setMembers(m=> m.includes(name) ? m.filter(x=>x!==name) : [...m, name]);
  const day = slot.day!=null ? DATA.DAYS[slot.day] : null;
  return (
    <Drawer title="จองคาบเรียนใหม่" sub={day ? `${day.d} ${slot.start||""} น.` : "เลือกรายละเอียดคาบเรียน"} onClose={onClose} accent="var(--primary)"
      footer={<>
        <button className="btn btn-ghost" style={{ flex:1 }} onClick={onClose}>ยกเลิก</button>
        <button className="btn btn-primary" style={{ flex:1 }} onClick={onSave}><Icon n="check" size={17}/> ยืนยันการจอง</button>
      </>}>
      <div className="field">
        <label>ประเภทคลาส</label>
        <div className="tag-filter">
          {Object.values(DATA.CATS).map(c=>(
            <button key={c.key} className={"chip"+(cat===c.key?" active":"")} onClick={()=>setCat(c.key)}>
              <span className="dotmark" style={{ background:c.color }}></span>{c.icon} {c.label}
            </button>
          ))}
        </div>
      </div>
      <div className="field"><label>แพ็กเกจ</label>
        <select>{DATA.loadPackages().map(p=><option key={p.id}>คอร์ส {p.sessions} ครั้ง · {p.dur===60?"1 ชม.":"30 นาที"} · {DATA.baht(p.price)}</option>)}</select>
      </div>
      <label className="grp-toggle">
        <input type="checkbox" checked={group} onChange={e=>setGroup(e.target.checked)} style={{ width:18, height:18, accentColor:"var(--primary)" }}/>
        <span><b>เรียนเป็นกลุ่ม</b> — เลือกนักเรียนได้หลายคนในคาบเดียว</span>
      </label>
      {group ? (
        <div className="field"><label>นักเรียนในกลุ่ม ({members.length} คน)</label>
          <div className="grp-list">
            {DATA.STUDENTS.filter(s=>s.cats.includes(cat)||true).map(s=>(
              <label key={s.id} className={"grp-item"+(members.includes(s.name)?" on":"")}>
                <input type="checkbox" checked={members.includes(s.name)} onChange={()=>toggleMember(s.name)}/>
                <Avatar name={s.name} size={26}/> <span>{s.name}</span>
              </label>
            ))}
          </div>
        </div>
      ) : (
        <div className="field"><label>นักเรียน</label>
          <select>{DATA.STUDENTS.map(s=><option key={s.id}>{s.name}</option>)}</select>
        </div>
      )}
      <div className="field"><label>ครูผู้สอน</label>
        <select>{DATA.TEACHERS.filter(t=>t.cats.includes(cat)).map(t=><option key={t.id}>{t.nick}</option>)}{!DATA.TEACHERS.some(t=>t.cats.includes(cat)) && <option>— ยังไม่มีครู —</option>}</select>
      </div>
      <div style={{ display:"flex", gap:12 }}>
        <div className="field" style={{ flex:1 }}><label>วัน</label>
          <select defaultValue={slot.day??0}>{DATA.DAYS.map((d,i)=><option key={i} value={i}>{d.d}</option>)}</select>
        </div>
        <div className="field" style={{ flex:1 }}><label>เวลาเริ่ม</label>
          <select defaultValue={slot.start||"15:00"}>{DATA.SLOT_TIMES.map((t,i)=><option key={i} value={t}>{t} น.</option>)}</select>
        </div>
      </div>
      <div className="field"><label>ระยะเวลา</label>
        <select><option>30 นาที</option><option>1 ชั่วโมง</option></select>
      </div>
      <div className="field"><label>ห้องเรียน</label>
        <select>{Object.values(DATA.CATS).map(c=><option key={c.key}>{c.room}</option>)}</select>
      </div>
    </Drawer>
  );
}
window.Schedule = Schedule;

Object.assign(window, { Dashboard, Schedule, Stat });
