/* ============ บ้านมาริ — Students, Teachers, Finance ============ */

/* ===================== STUDENTS ===================== */
function Students(){
  useDataVersion();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [status, setStatus] = useState("all");
  const [nearOnly, setNearOnly] = useState(false);
  const [sel, setSel] = useState(null);
  const [toast, showToast] = useToast();

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
          {nearCount>0 && <button className="btn btn-ghost" onClick={()=>showToast(`ส่งแจ้งเตือน LINE ถึงผู้ปกครอง ${nearCount} คนแล้ว`)} style={{ color:"#06c755", borderColor:"color-mix(in oklch,#06c755 35%,var(--border))" }}><Icon n="bell" size={16}/> แจ้งใกล้หมด ({nearCount})</button>}
          <button className="btn btn-primary"><Icon n="plus" size={18}/> เพิ่มนักเรียน</button>
        </div>
      </div>

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
                    <div><div style={{ fontWeight:600 }}>{s.name}</div><div style={{ fontSize:12, color:"var(--text-3)" }}>{s.age} ปี · แพ็ก {s.pkg} ครั้ง/{s.dur===60?"1ชม.":"30น."}</div></div>
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

      {sel && <StudentDrawer s={sel} onClose={()=>setSel(null)}/>}
      {toast}
    </div>
  );
}

function StudentDrawer({ s, onClose }){
  const [edit, setEdit] = useState(false);
  const [line, setLine] = useState(false);
  const [toast, showToast] = useToast();
  const [f, setF] = useState({});
  const startEdit = ()=>{ setF({ age:s.age, phone:s.phone, guardian:s.guardian==="-"?"":s.guardian, remaining:s.remaining, pkg:s.pkg, dur:s.dur, status:s.status, balance:s.balance }); setEdit(true); };
  const save = ()=>{
    DATA.updateStudent(s.id, {
      age:Number(f.age)||s.age, phone:f.phone||s.phone, guardian:f.guardian.trim()||"-",
      remaining:Math.max(0,Number(f.remaining)), pkg:Number(f.pkg), dur:Number(f.dur),
      status:f.status, balance:Math.max(0,Number(f.balance)||0)
    });
    bumpData(); setEdit(false); showToast("บันทึกข้อมูลแล้ว");
  };
  const set = (k,v)=> setF(p=>({ ...p, [k]:v }));

  return (
    <Drawer title={s.name} sub={`${s.age} ปี · ${s.teacher}`} onClose={onClose}
      footer={ edit ? <>
        <button className="btn btn-ghost" style={{ flex:1 }} onClick={()=>setEdit(false)}>ยกเลิก</button>
        <button className="btn btn-primary" style={{ flex:1 }} onClick={save}><Icon n="check" size={16}/> บันทึก</button>
      </> : <>
        <button className="btn btn-ghost" style={{ flex:1 }} onClick={()=>setLine(true)}><Icon n="bell" size={16}/> แจ้งเตือน LINE</button>
        <button className="btn btn-primary" style={{ flex:1 }} onClick={startEdit}><Icon n="edit" size={16}/> แก้ไขข้อมูล</button>
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
            <div className="field" style={{ flex:1 }}><label>อายุ (ปี)</label><input type="number" value={f.age} onChange={e=>set("age",e.target.value)}/></div>
            <div className="field" style={{ flex:1 }}><label>สถานะ</label>
              <select value={f.status} onChange={e=>set("status",e.target.value)}>
                {Object.entries(DATA.STATUS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
          <div className="field"><label>ผู้ปกครอง</label><input value={f.guardian} onChange={e=>set("guardian",e.target.value)} placeholder="เช่น คุณแม่นภา"/></div>
          <div className="field"><label>เบอร์ติดต่อ</label><input value={f.phone} onChange={e=>set("phone",e.target.value)}/></div>
          <div style={{ display:"flex", gap:12 }}>
            <div className="field" style={{ flex:1 }}><label>แพ็กเกจ (ครั้ง)</label>
              <select value={f.pkg} onChange={e=>set("pkg",e.target.value)}><option value={10}>10 ครั้ง</option><option value={4}>4 ครั้ง</option></select>
            </div>
            <div className="field" style={{ flex:1 }}><label>ระยะเวลา</label>
              <select value={f.dur} onChange={e=>set("dur",e.target.value)}><option value={60}>1 ชม.</option><option value={30}>30 นาที</option></select>
            </div>
          </div>
          <div style={{ display:"flex", gap:12 }}>
            <div className="field" style={{ flex:1 }}><label>คงเหลือ (ครั้ง)</label><input type="number" value={f.remaining} onChange={e=>set("remaining",e.target.value)}/></div>
            <div className="field" style={{ flex:1 }}><label>ยอดค้างชำระ (฿)</label><input type="number" value={f.balance} onChange={e=>set("balance",e.target.value)}/></div>
          </div>
        </>
      ) : (
        <>
          {DATA.isNearEnding(s) && (
            <div style={{ display:"flex", alignItems:"center", gap:11, padding:"12px 14px", borderRadius:12, background:"var(--danger-soft)", marginBottom:16 }}>
              <div style={{ fontSize:20 }}>⚠️</div>
              <div style={{ flex:1, fontSize:13.5, color:"color-mix(in oklch,var(--danger) 80%,black)" }}>
                <b>คอร์สใกล้หมด</b> — เหลือ {s.remaining} ครั้ง ควรชวนต่อคอร์ส
              </div>
              <button className="btn btn-sm" style={{ background:"#06c755", color:"#fff" }} onClick={()=>setLine(true)}><Icon n="bell" size={14}/> LINE</button>
            </div>
          )}

          <div style={{ display:"flex", gap:12, marginBottom:18 }}>
            <MiniStat label={`คงเหลือ (${s.pkg} ครั้ง)`} val={s.remaining+" ครั้ง"} tone={DATA.isNearEnding(s)?"var(--danger)":"var(--ok)"}/>
            <MiniStat label="ยอดค้างชำระ" val={s.balance>0?DATA.baht(s.balance):"ไม่มี"} tone={s.balance>0?"var(--danger)":"var(--text-3)"}/>
            <MiniStat label="แต้มสะสม" val={s.points} tone="var(--primary-ink)"/>
          </div>

          <div className="card" style={{ padding:"4px 16px", marginBottom:18 }}>
            <div className="kv"><span className="k">แพ็กเกจคอร์ส</span><span className="v">{s.pkg} ครั้ง · {s.dur===60?"1 ชม.":"30 นาที"}/ครั้ง</span></div>
            <div className="kv"><span className="k">ครูผู้สอน</span><span className="v">{s.teacher}</span></div>
            <div className="kv"><span className="k">ผู้ปกครอง</span><span className="v">{s.guardian}</span></div>
            <div className="kv"><span className="k">เบอร์ติดต่อ</span><span className="v">{s.phone}</span></div>
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
            {[["28 พ.ค.","เข้าเรียน",true],["21 พ.ค.","เข้าเรียน",true],["14 พ.ค.","ลา (แจ้งล่วงหน้า)",false],["7 พ.ค.","เข้าเรียน",true]].map(([d,t,ok],i)=>(
              <div key={i} style={{ display:"flex", alignItems:"center", gap:10, fontSize:13.5 }}>
                <span style={{ width:8, height:8, borderRadius:"50%", background: ok?"var(--ok)":"var(--text-3)" }}></span>
                <span style={{ width:62, color:"var(--text-3)" }}>{d}</span>
                <span>{t}</span>
              </div>
            ))}
          </div>
        </>
      )}
      {line && <LineNotify student={s} onClose={()=>setLine(false)} onSent={()=>{ setLine(false); showToast("ส่งข้อความผ่าน LINE แล้ว"); }}/>}
      {toast}
    </Drawer>
  );
}

function MiniStat({ label, val, tone }){
  return (
    <div className="card" style={{ flex:1, padding:14 }}>
      <div style={{ fontSize:12.5, color:"var(--text-2)" }}>{label}</div>
      <div style={{ fontFamily:"var(--ff-display)", fontWeight:700, fontSize:19, marginTop:4, color:tone }}>{val}</div>
    </div>
  );
}
window.Students = Students;

/* ===================== TEACHERS ===================== */
function Teachers(){
  const [sel, setSel] = useState(null);
  return (
    <div className="content-inner">
      <div className="section-head">
        <div className="page-sub" style={{ fontSize:14, color:"var(--text-2)" }}>ครูผู้สอน {DATA.TEACHERS.length} คน · ค่าสอนคำนวณตามจำนวนชั่วโมงจริง</div>
        <button className="btn btn-primary"><Icon n="plus" size={18}/> เพิ่มครู</button>
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

      {sel && <TeacherDrawer t={sel} onClose={()=>setSel(null)}/>}
    </div>
  );
}

function Metric({ v, l, tone }){
  return <div><div style={{ fontWeight:700, fontFamily:"var(--ff-display)", fontSize:15.5, color:tone||"var(--text)" }}>{v}</div><div style={{ fontSize:11, color:"var(--text-3)" }}>{l}</div></div>;
}

function TeacherDrawer({ t, onClose }){
  const pay = t.rate*t.hours;
  const myStudents = DATA.STUDENTS.filter(s=> s.teacher===t.nick);
  return (
    <Drawer title={t.nick} sub={t.name} onClose={onClose} accent={t.color}
      footer={<>
        <button className="btn btn-ghost" style={{ flex:1 }}><Icon n="receipt" size={16}/> สรุปค่าสอน</button>
        <button className="btn btn-primary" style={{ flex:1 }}><Icon n="edit" size={16}/> แก้ไข</button>
      </>}>
      <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:18 }}>
        <Avatar name={t.nick} size={58} color={t.color}/>
        <div style={{ display:"flex", gap:7, flexWrap:"wrap" }}>{t.cats.map(c=><CatBadge key={c} cat={c}/>)}</div>
      </div>

      <div className="card" style={{ padding:16, marginBottom:18, background:"var(--primary-soft)", border:0 }}>
        <div style={{ fontSize:12.5, color:"var(--primary-ink)", fontWeight:600 }}>ค่าสอนค้างจ่ายเดือน พ.ค.</div>
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
            <div style={{ flex:1 }}><div style={{ fontWeight:600, fontSize:13.5 }}>{s.name}</div></div>
            <span style={{ fontSize:12.5, color:"var(--text-3)" }}>เหลือ {s.remaining} ครั้ง</span>
          </div>
        ))}
      </div>
    </Drawer>
  );
}
window.Teachers = Teachers;

/* ===================== FINANCE ===================== */
function Finance(){
  const [tab, setTab] = useState("invoices");
  const [toast, showToast] = useToast();

  const paid = DATA.INVOICES.filter(i=>i.status==="paid").reduce((a,i)=>a+i.amount,0);
  const pending = DATA.INVOICES.filter(i=>i.status!=="paid").reduce((a,i)=>a+i.amount,0);

  return (
    <div className="content-inner">
      <div className="stat-grid" style={{ gridTemplateColumns:"repeat(3,1fr)", marginBottom:18 }}>
        <Stat label="รับชำระเดือนนี้" val={DATA.baht(paid)} icon="wallet" tone="var(--ok)" big meta={<span style={{color:"var(--text-3)"}}>{DATA.INVOICES.filter(i=>i.status==="paid").length} ใบเสร็จ</span>}/>
        <Stat label="รอ/ค้างชำระ" val={DATA.baht(pending)} icon="receipt" tone="var(--warn)" big meta={<span style={{color:"var(--text-3)"}}>{DATA.INVOICES.filter(i=>i.status!=="paid").length} รายการ</span>}/>
        <Stat label="แพ็กเกจราคา" val={DATA.PACKAGES_DEFAULT.length} icon="star" tone="var(--c-piano)" meta={<span style={{color:"var(--text-3)"}}>10/4 ครั้ง × 1ชม./30น.</span>}/>
      </div>

      <div className="tag-filter" style={{ marginBottom:14 }}>
        <button className={"chip"+(tab==="invoices"?" active":"")} onClick={()=>setTab("invoices")}><Icon n="receipt" size={15}/> ใบเสร็จ/บิล</button>
        <button className={"chip"+(tab==="courses"?" active":"")} onClick={()=>setTab("courses")}><Icon n="star" size={15}/> แพ็กเกจ & ราคา</button>
      </div>

      {tab==="invoices" ? (
        <div className="card" style={{ overflow:"hidden" }}>
          <div className="card-pad" style={{ paddingBottom:0 }}>
            <SectionHead title="รายการชำระเงินล่าสุด">
              <button className="btn btn-ghost btn-sm"><Icon n="download" size={15}/> ส่งออก</button>
              <button className="btn btn-primary btn-sm" onClick={()=>showToast("สร้างใบเสร็จใหม่แล้ว")}><Icon n="plus" size={15}/> ออกบิล</button>
            </SectionHead>
          </div>
          <table style={{ marginTop:8 }}>
            <thead><tr>
              <th>เลขที่</th><th>นักเรียน</th><th className="hide-mobile">คอร์ส</th><th className="hide-mobile">วันที่</th>
              <th>ยอด</th><th className="hide-mobile">ช่องทาง</th><th>สถานะ</th><th></th>
            </tr></thead>
            <tbody>
              {DATA.INVOICES.map(inv=>(
                <tr key={inv.id}>
                  <td style={{ fontFamily:"var(--ff-display)", fontWeight:600, fontSize:13 }}>{inv.id}</td>
                  <td style={{ fontWeight:600 }}>{inv.student}</td>
                  <td className="hide-mobile" style={{ color:"var(--text-2)" }}>{inv.course}</td>
                  <td className="hide-mobile" style={{ color:"var(--text-3)", fontSize:13 }}>{inv.date}</td>
                  <td style={{ fontWeight:700 }}>{DATA.baht(inv.amount)}</td>
                  <td className="hide-mobile" style={{ color:"var(--text-2)" }}>{inv.method}</td>
                  <td><StatusBadge map={DATA.PAY_STATUS} k={inv.status}/></td>
                  <td style={{ width:40 }}>
                    {inv.status!=="paid"
                      ? <button className="btn btn-soft btn-sm" onClick={()=>showToast("บันทึกการชำระแล้ว")}>รับเงิน</button>
                      : <button className="icon-btn" style={{ width:32, height:32, border:0 }} onClick={()=>showToast("กำลังพิมพ์ใบเสร็จ...")}><Icon n="receipt" size={16}/></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <PackagePricing showToast={showToast}/>
      )}
      {toast}
    </div>
  );
}
window.Finance = Finance;

/* ---- editable package pricing matrix ---- */
function PackagePricing({ showToast }){
  const [pkgs, setPkgs] = useState(()=> DATA.loadPackages());
  const [editing, setEditing] = useState(null);   // package id being edited
  const [draft, setDraft] = useState("");

  const startEdit = (p)=>{ setEditing(p.id); setDraft(String(p.price)); };
  const commit = (p)=>{
    const v = Math.max(0, parseInt(String(draft).replace(/[^0-9]/g,""),10) || 0);
    DATA.savePackagePrice(p.id, v);
    setPkgs(prev=> prev.map(x=> x.id===p.id ? { ...x, price:v } : x));
    setEditing(null);
    showToast("บันทึกราคาใหม่แล้ว");
  };
  const resetAll = ()=>{
    localStorage.removeItem("bm-packages");
    setPkgs(DATA.PACKAGES_DEFAULT.map(p=>({...p})));
    setEditing(null);
    showToast("คืนค่าราคาตั้งต้นแล้ว");
  };

  return (
    <div className="card card-pad">
      <SectionHead title="ราคาแพ็กเกจคอร์ส">
        <span style={{ fontSize:12.5, color:"var(--text-3)" }} className="hide-mobile">คลิกที่ราคาเพื่อแก้ไข</span>
        <button className="btn btn-ghost btn-sm" onClick={resetAll}>คืนค่าตั้งต้น</button>
      </SectionHead>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))", gap:14, marginTop:4 }}>
        {pkgs.map(p=>{
          const dur = p.dur===60 ? "1 ชม." : "30 นาที";
          const per = Math.round(p.price/p.sessions);
          const isEd = editing===p.id;
          return (
            <div key={p.id} className="card" style={{ padding:18, borderTop:`3px solid ${p.dur===60?"var(--primary)":"var(--c-piano)"}`, position:"relative" }}>
              {p.popular && <span className="badge" style={{ position:"absolute", top:12, right:12, background:"var(--primary)", color:"#fff", fontSize:11 }}>ขายดี</span>}
              <div style={{ fontSize:13, color:"var(--text-2)", fontWeight:600 }}>คอร์ส {p.sessions} ครั้ง</div>
              <div style={{ fontSize:12.5, color:"var(--text-3)", marginTop:2 }}>{dur} / ครั้ง</div>

              <div style={{ marginTop:16, minHeight:46 }}>
                {isEd ? (
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <span style={{ fontFamily:"var(--ff-display)", fontWeight:700, fontSize:22, color:"var(--primary-ink)" }}>฿</span>
                    <input autoFocus value={draft} onChange={e=>setDraft(e.target.value)}
                      onKeyDown={e=>{ if(e.key==="Enter") commit(p); if(e.key==="Escape") setEditing(null); }}
                      style={{ width:"100%", border:"1px solid var(--primary)", borderRadius:9, padding:"7px 10px",
                        fontFamily:"var(--ff-display)", fontWeight:700, fontSize:20, color:"var(--primary-ink)", outline:"none",
                        boxShadow:"0 0 0 3px var(--primary-soft)" }}/>
                  </div>
                ) : (
                  <div onClick={()=>startEdit(p)} style={{ cursor:"pointer", display:"inline-flex", alignItems:"baseline", gap:8 }}>
                    <div style={{ fontFamily:"var(--ff-display)", fontWeight:700, fontSize:28, color:"var(--primary-ink)", letterSpacing:"-0.02em" }}>{DATA.baht(p.price)}</div>
                  </div>
                )}
                {!isEd && <div style={{ fontSize:12, color:"var(--text-3)", marginTop:3 }}>เฉลี่ย {DATA.baht(per)}/ครั้ง</div>}
              </div>

              <div style={{ marginTop:14 }}>
                {isEd ? (
                  <div style={{ display:"flex", gap:8 }}>
                    <button className="btn btn-ghost btn-sm" style={{ flex:1 }} onClick={()=>setEditing(null)}>ยกเลิก</button>
                    <button className="btn btn-primary btn-sm" style={{ flex:1 }} onClick={()=>commit(p)}><Icon n="check" size={15}/> บันทึก</button>
                  </div>
                ) : (
                  <button className="btn btn-soft btn-sm" style={{ width:"100%" }} onClick={()=>startEdit(p)}><Icon n="edit" size={15}/> แก้ไขราคา</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop:18, padding:"13px 15px", background:"var(--surface-2)", borderRadius:12, fontSize:13, color:"var(--text-2)", display:"flex", gap:9, alignItems:"flex-start" }}>
        <Icon n="star" size={17}/> <span>ราคานี้ใช้ร่วมทุกคลาส (ร้องเพลง · เปียโน · เต้น · กลอง · กีตาร์) — ราคาที่แก้ไขจะถูกบันทึกไว้อัตโนมัติ</span>
      </div>
    </div>
  );
}
window.PackagePricing = PackagePricing;

Object.assign(window, { Students, Teachers, Finance });
