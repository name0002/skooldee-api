/* ============ บ้านมาริ — Homework (ระบบแจ้งการบ้าน) ============ */

function Homework(){
  useDataVersion();
  const [filter, setFilter] = useState("all");   // all | pending | done | overdue
  const [assign, setAssign] = useState(false);
  const [line, setLine] = useState(null);        // homework being notified
  const [toast, showToast] = useToast();

  const all = DATA.HOMEWORK;
  const counts = {
    pending: all.filter(h=>h.status==="pending").length,
    done: all.filter(h=>h.status==="done").length,
    overdue: all.filter(DATA.isOverdue).length,
  };
  const list = all.filter(h=>{
    if(filter==="all") return true;
    if(filter==="overdue") return DATA.isOverdue(h);
    return h.status===filter;
  });

  const toggleDone = (h)=>{
    DATA.updateHomework(h.id, { status: h.status==="done" ? "pending" : "done" });
    bumpData();
    showToast(h.status==="done" ? "ทำเครื่องหมายว่ายังไม่ส่ง" : "บันทึกว่าส่งแล้ว ✓");
  };

  return (
    <div className="content-inner">
      <div className="section-head">
        <div>
          <div style={{ fontFamily:"var(--ff-display)", fontWeight:700, fontSize:19 }}>การบ้าน &amp; แบบฝึกหัด</div>
          <div style={{ fontSize:13, color:"var(--text-3)" }}>มอบหมายและแจ้งเตือนผู้ปกครองผ่าน LINE</div>
        </div>
        <button className="btn btn-primary" onClick={()=>setAssign(true)}><Icon n="plus" size={18}/> มอบหมายการบ้าน</button>
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns:"repeat(3,1fr)", marginBottom:18 }}>
        <Stat label="รอส่ง" val={counts.pending} icon="clipboard" tone="var(--warn)" meta={<span style={{color:"var(--text-3)"}}>ชิ้นงาน</span>}/>
        <Stat label="ส่งแล้ว" val={counts.done} icon="check" tone="var(--ok)" meta={<span style={{color:"var(--text-3)"}}>ชิ้นงาน</span>}/>
        <Stat label="เกินกำหนด" val={counts.overdue} icon="bell" tone="var(--danger)" meta={<span style={{color:"var(--danger)"}}>ต้องติดตาม</span>}/>
      </div>

      <div className="tag-filter" style={{ marginBottom:14 }}>
        {[["all","ทั้งหมด"],["pending","รอส่ง"],["done","ส่งแล้ว"],["overdue","เกินกำหนด"]].map(([k,l])=>(
          <button key={k} className={"chip"+(filter===k?" active":"")} onClick={()=>setFilter(k)}>{l}</button>
        ))}
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        {list.map(h=>{
          // category may be missing/renamed → fall back to a neutral grey so the page never crashes
          const cat = DATA.CATS[h.cat] || { color:"var(--text-3)", label:"" };
          const over = DATA.isOverdue(h);
          const done = h.status==="done";
          return (
            <div key={h.id} className="card hw-card" style={{ padding:"15px 18px", display:"flex", alignItems:"center", gap:14, borderLeft:`3px solid ${cat.color}`, opacity: done?0.72:1 }}>
              <Avatar name={h.student} size={42}/>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:9, rowGap:5, flexWrap:"wrap", lineHeight:1.3 }}>
                  <span style={{ fontWeight:700, fontSize:15, textDecoration: done?"line-through":"none" }}>{h.title}</span>
                  <CatBadge cat={h.cat} small/>
                  {h.notified && <span className="badge" style={{ background:"color-mix(in oklch,#06c755 14%,white)", color:"#057a3e", fontSize:11 }}><Icon n="check" size={12}/> แจ้งแล้ว</span>}
                </div>
                <div style={{ fontSize:13, color:"var(--text-2)", marginTop:5 }}>{DATA.dispName(h.student)} · {h.teacher}{h.detail&&h.detail!=="-"?` · ${h.detail}`:""}</div>
                <div style={{ fontSize:12.5, marginTop:4, color: over?"var(--danger)":"var(--text-3)", fontWeight: over?700:400 }}>
                  <Icon n="clock" size={13}/> ส่งภายใน {h.due}{over?" · เกินกำหนด":""}
                </div>
              </div>
              <div className="hw-actions">
                <button className="btn btn-sm" style={{ background: h.notified?"var(--surface-3)":"#06c755", color: h.notified?"var(--text-2)":"#fff" }}
                  onClick={()=>setLine(h)}><Icon n="bell" size={14}/> LINE</button>
                <button className={"btn btn-sm "+(done?"btn-ghost":"btn-soft")} onClick={()=>toggleDone(h)}>
                  {done ? "ส่งแล้ว ✓" : "ทำเสร็จ"}
                </button>
                <button className="icon-btn" style={{ width:32, height:32, border:0, color:"var(--text-3)" }} title="ลบการบ้าน"
                  onClick={()=>{ if(confirm(`ลบการบ้าน "${h.title}" ออก?`)){ (DATA.deleteHomework||function(id){ DATA.HOMEWORK=DATA.HOMEWORK.filter(x=>x.id!==id); bumpData(); })(h.id); showToast("ลบการบ้านแล้ว"); } }}>
                  <Icon n="x" size={14}/>
                </button>
              </div>
            </div>
          );
        })}
        {list.length===0 && <div className="card empty">ไม่มีการบ้านในหมวดนี้</div>}
      </div>

      {assign && <HomeworkAssign onClose={()=>setAssign(false)} onSaved={(notify)=>{ setAssign(false); showToast(notify?"มอบหมาย + แจ้ง LINE แล้ว":"บันทึกการบ้านแล้ว"); }}/>}
      {line && <LineNotify student={DATA.STUDENTS.find(s=>s._dbId===line._studentDbId)||DATA.findStudent(line.student)||{name:line.student,cats:[line.cat],dur:60,guardian:"-",phone:"-",remaining:0,_dbId:line._studentDbId||null}} homework={line}
        onClose={()=>setLine(null)} onSent={(r)=>{ if(r&&r.sent){ DATA.updateHomework(line.id,{notified:true}); bumpData(); } setLine(null); showToast(DATA.lineResultMsg(r,"ส่งการบ้านผ่าน LINE แล้ว ✓")); }}/>}
      {toast}
    </div>
  );
}

function HomeworkAssign({ onClose, onSaved }){
  const [sid, setSid] = useState(DATA.STUDENTS[0]?.id||"");
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  // default due date = 7 days from today
  const [due, setDue] = useState(()=>{ const d=new Date(); d.setDate(d.getDate()+7); return d.toISOString().slice(0,10); });
  // default the LINE-notify checkbox from the school's "เมื่อมอบหมายการบ้าน" pref (default ON)
  const [notify, setNotify] = useState(()=>{
    try{ const p=DATA._schoolRaw&&DATA._schoolRaw.notify_prefs; const o=typeof p==='string'?JSON.parse(p):p; return !o || o.homework!==false; }
    catch(e){ return true; }
  });
  useEffect(()=>{ const h=(e)=>e.key==="Escape"&&onClose(); window.addEventListener("keydown",h); return ()=>window.removeEventListener("keydown",h); },[]);
  const stu = DATA.STUDENTS.find(s=>s.id===sid);
  const save = ()=>{
    if(!title.trim()||!stu) return;
    DATA.addHomework({ _studentDbId:stu._dbId, student:stu.name, cat:stu.cats[0]||'piano', teacher:stu.teacher||'-', title:title.trim(), detail:detail.trim()||"-", due, notified:notify });
    bumpData(); onSaved(notify);
  };
  return (
    <>
      <div className="scrim" onClick={onClose}></div>
      <div className="modal">
        <div className="modal-head">
          <div style={{ width:4, height:34, borderRadius:4, background:"var(--primary)" }}></div>
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:"var(--ff-display)", fontWeight:700, fontSize:16 }}>มอบหมายการบ้าน</div>
            <div style={{ fontSize:12.5, color:"var(--text-3)" }}>ส่งแบบฝึกหัดและแจ้งผู้ปกครอง</div>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon n="x" size={18}/></button>
        </div>
        <div className="modal-body" style={{ background:"var(--surface)" }}>
          <div className="field"><label>นักเรียน</label>
            <select value={sid} onChange={e=>setSid(e.target.value)}>
              {DATA.STUDENTS.map(s=>{ const c=DATA.CATS[s.cats&&s.cats[0]]; return <option key={s.id} value={s.id}>{s.name}{c?` · ${c.label}`:""} ({s.teacher})</option>; })}
            </select>
          </div>
          <div className="field"><label>หัวข้อการบ้าน</label><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="เช่น ฝึกสเกล C เมเจอร์"/></div>
          <div className="field"><label>รายละเอียด</label><textarea rows={3} value={detail} onChange={e=>setDetail(e.target.value)} placeholder="คำอธิบายเพิ่มเติม / สิ่งที่ต้องฝึก"></textarea></div>
          <div className="field"><label>กำหนดส่ง</label><input type="date" value={due} onChange={e=>setDue(e.target.value)}/></div>
          <label style={{ display:"flex", alignItems:"center", gap:10, fontSize:14, cursor:"pointer", padding:"4px 0" }}>
            <input type="checkbox" checked={notify} onChange={e=>setNotify(e.target.checked)} style={{ width:18, height:18, accentColor:"#06c755" }}/>
            แจ้งผู้ปกครองผ่าน LINE ทันทีหลังบันทึก
          </label>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" style={{ flex:1 }} onClick={onClose}>ยกเลิก</button>
          <button className="btn btn-primary" style={{ flex:1.4 }} onClick={save}><Icon n="check" size={17}/> บันทึกการบ้าน</button>
        </div>
      </div>
    </>
  );
}
window.Homework = Homework;

/* ============ ระบบแนะนำเพื่อน (Referrals) ============ */
function Referrals(){
  useDataVersion();
  const [filter, setFilter] = useState("all");
  const [invite, setInvite] = useState(false);
  const [line, setLine] = useState(null);   // referral being shared
  const [toast, showToast] = useToast();

  const all = DATA.REFERRALS;
  const counts = {
    joined: all.filter(r=>r.status==="joined").length,
    trial: all.filter(r=>r.status==="trial").length,
    invited: all.filter(r=>r.status==="invited").length,
  };
  const totalPts = all.filter(r=>r.rewarded).length * DATA.REF_REWARD;
  const list = all.filter(r=> filter==="all" || r.status===filter);

  // อันดับผู้แนะนำ (ตามจำนวนสมัครสำเร็จ)
  const leaders = DATA.STUDENTS.map(s=>({ s, st:DATA.refStats(s.name) }))
    .filter(x=>x.st.total>0).sort((a,b)=> b.st.joined-a.st.joined || b.st.total-a.st.total).slice(0,5);

  const convert = (r)=>{
    const order = { invited:"trial", trial:"joined", joined:"joined" };
    const next = order[r.status];
    DATA.setReferralStatus(r.id, next);
    bumpData();
    showToast(next==="joined" ? `เพื่อนสมัครแล้ว · ${r.referrer} ได้ +${DATA.REF_REWARD} แต้ม` : "อัปเดตสถานะแล้ว");
  };

  return (
    <div className="content-inner">
      <div className="section-head">
        <div>
          <div style={{ fontFamily:"var(--ff-display)", fontWeight:700, fontSize:19 }}>แนะนำเพื่อน</div>
          <div style={{ fontSize:13, color:"var(--text-3)" }}>ผู้แนะนำรับ {DATA.REF_REWARD} แต้ม · เพื่อนใหม่รับ {DATA.REF_FRIEND_BONUS} แต้มเมื่อสมัคร</div>
        </div>
        <button className="btn btn-primary" onClick={()=>setInvite(true)}><Icon n="plus" size={18}/> เพิ่มการแนะนำ</button>
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns:"repeat(4,1fr)", marginBottom:18 }}>
        <Stat label="สมัครสำเร็จ" val={counts.joined} icon="check" tone="var(--ok)" meta={<span style={{color:"var(--text-3)"}}>คน</span>}/>
        <Stat label="ทดลองเรียน" val={counts.trial} icon="star" tone="var(--warn)" meta={<span style={{color:"var(--text-3)"}}>รอติดตาม</span>}/>
        <Stat label="ส่งคำเชิญ" val={counts.invited} icon="bell" tone="var(--text-3)" meta={<span style={{color:"var(--text-3)"}}>รอตอบรับ</span>}/>
        <Stat label="แต้มที่จ่ายไป" val={totalPts} icon="wallet" tone="var(--primary)" meta={<span style={{color:"var(--text-3)"}}>สะสมรวม</span>}/>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1.55fr 1fr", gap:18, alignItems:"start" }} className="dash-cols">
        {/* referral list */}
        <div>
          <div className="tag-filter" style={{ marginBottom:14 }}>
            {[["all","ทั้งหมด"],["joined","สมัครแล้ว"],["trial","ทดลอง"],["invited","ส่งคำเชิญ"]].map(([k,l])=>(
              <button key={k} className={"chip"+(filter===k?" active":"")} onClick={()=>setFilter(k)}>{l}</button>
            ))}
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {list.map(r=>{
              const cat = DATA.CATS[r.cat] || { color:"var(--text-3)" };
              const st = DATA.REF_STATUS[r.status];
              return (
                <div key={r.id} className="card" style={{ padding:"15px 18px", display:"flex", alignItems:"center", gap:14, borderLeft:`3px solid ${cat.color}` }}>
                  <div style={{ display:"flex", alignItems:"center", gap:-6 }}>
                    <Avatar name={r.referrer} size={40}/>
                    <div style={{ marginLeft:-10, zIndex:1, border:"2px solid var(--surface)", borderRadius:"50%" }}><Avatar name={r.friend} size={40}/></div>
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:14.5 }}><b>{r.referrer}</b> <span style={{ color:"var(--text-3)" }}>แนะนำ</span> <b>{r.friend}</b></div>
                    <div style={{ fontSize:12.5, color:"var(--text-2)", marginTop:3, display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                      <CatBadge cat={r.cat} small/>
                      <span style={{ color:"var(--text-3)" }}>{r.date}</span>
                      {r.rewarded && <span className="badge" style={{ background:"var(--primary-soft)", color:"var(--primary-ink)", fontSize:11 }}>+{DATA.REF_REWARD} แต้ม</span>}
                    </div>
                  </div>
                  <StatusBadge map={DATA.REF_STATUS} k={r.status}/>
                  <div className="hw-actions">
                    {r.status==="invited" && <button className="btn btn-sm" style={{ background:"#06c755", color:"#fff" }} onClick={()=>setLine(r)}><Icon n="bell" size={14}/> LINE</button>}
                    {r.status!=="joined"
                      ? <button className="btn btn-soft btn-sm" onClick={()=>convert(r)}>{r.status==="invited"?"→ ทดลอง":"→ สมัครแล้ว"}</button>
                      : <button className="btn btn-ghost btn-sm" disabled style={{ opacity:.6 }}>เสร็จสิ้น</button>}
                  </div>
                </div>
              );
            })}
            {list.length===0 && <div className="card empty">ไม่มีรายการในหมวดนี้</div>}
          </div>
        </div>

        {/* leaderboard + how it works */}
        <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
          <div className="card card-pad">
            <SectionHead title="🏆 ผู้แนะนำยอดเยี่ยม"/>
            <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
              {leaders.map((x,i)=>(
                <div key={x.s.id} style={{ display:"flex", alignItems:"center", gap:11, padding:"8px 6px" }}>
                  <div style={{ width:22, textAlign:"center", fontWeight:700, fontFamily:"var(--ff-display)", color: i<3?"var(--primary)":"var(--text-3)" }}>{i+1}</div>
                  <Avatar name={x.s.name} size={34}/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:600, fontSize:13.5 }}>{x.s.name}</div>
                    <div style={{ fontSize:11.5, color:"var(--text-3)" }}>แนะนำ {x.st.total} · สมัคร {x.st.joined}</div>
                  </div>
                  <span style={{ fontWeight:700, color:"var(--primary-ink)", fontSize:13.5 }}>+{x.st.earned}</span>
                </div>
              ))}
              {leaders.length===0 && <div style={{ fontSize:13, color:"var(--text-3)", padding:"8px 6px" }}>ยังไม่มีผู้แนะนำ</div>}
            </div>
          </div>

          <div className="card card-pad">
            <SectionHead title="วิธีการทำงาน"/>
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              {[["1","แชร์โค้ดแนะนำ","นักเรียนส่งโค้ดส่วนตัวให้เพื่อนผ่าน LINE"],
                ["2","เพื่อนสมัครเรียน","กรอกโค้ด รับ "+DATA.REF_FRIEND_BONUS+" แต้มทันที"],
                ["3","ผู้แนะนำรับรางวัล","ได้ "+DATA.REF_REWARD+" แต้มเมื่อเพื่อนชำระคอร์ส"]].map(([n,t,d])=>(
                <div key={n} style={{ display:"flex", gap:12 }}>
                  <div style={{ width:28, height:28, flex:"0 0 28px", borderRadius:"50%", background:"var(--primary-soft)", color:"var(--primary-ink)", display:"grid", placeItems:"center", fontWeight:700, fontSize:13 }}>{n}</div>
                  <div><div style={{ fontWeight:600, fontSize:13.5 }}>{t}</div><div style={{ fontSize:12.5, color:"var(--text-3)" }}>{d}</div></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {invite && <ReferralInvite onClose={()=>setInvite(false)} onSaved={()=>{ setInvite(false); showToast("เพิ่มการแนะนำแล้ว"); }}/>}
      {line && <LineNotify student={(()=>{ const s=DATA.STUDENTS.find(x=>x._dbId===line._referrerDbId)||DATA.findStudent(line.referrer)||{name:line.referrer,cats:[line.cat],dur:60,guardian:"-",phone:"-",remaining:0,points:0,_dbId:line._referrerDbId||null}; return {...s, _refFriend:line.friend}; })()}
        referral={line} onClose={()=>setLine(null)} onSent={(r)=>{ setLine(null); showToast(DATA.lineResultMsg(r,"ส่งโค้ดแนะนำผ่าน LINE แล้ว ✓")); }}/>}
      {toast}
    </div>
  );
}

function ReferralInvite({ onClose, onSaved }){
  const [rid, setRid] = useState(DATA.STUDENTS[0]?.id||"");
  const [friend, setFriend] = useState("");
  const [phone, setPhone] = useState("");
  const [cat, setCat] = useState("piano");
  useEffect(()=>{ const h=(e)=>e.key==="Escape"&&onClose(); window.addEventListener("keydown",h); return ()=>window.removeEventListener("keydown",h); },[]);
  const referrer = DATA.STUDENTS.find(s=>s.id===rid);
  const code = referrer ? DATA.refCode(referrer.name) : "";
  const save = ()=>{ if(!friend.trim()||!referrer) return; DATA.addReferral({ _referrerDbId:referrer._dbId, referrer:referrer.name, friend:friend.trim(), phone:phone.trim()||null, cat }); bumpData(); onSaved(); };
  return (
    <>
      <div className="scrim" onClick={onClose}></div>
      <div className="modal">
        <div className="modal-head">
          <div style={{ width:4, height:34, borderRadius:4, background:"var(--primary)" }}></div>
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:"var(--ff-display)", fontWeight:700, fontSize:16 }}>เพิ่มการแนะนำเพื่อน</div>
            <div style={{ fontSize:12.5, color:"var(--text-3)" }}>บันทึกว่าใครแนะนำเพื่อนใหม่</div>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon n="x" size={18}/></button>
        </div>
        <div className="modal-body" style={{ background:"var(--surface)" }}>
          <div className="field"><label>ผู้แนะนำ (นักเรียนปัจจุบัน)</label>
            <select value={rid} onChange={e=>setRid(e.target.value)}>
              {DATA.STUDENTS.map(s=><option key={s.id} value={s.id}>{s.name} · {DATA.tierOf(s.points).label}</option>)}
            </select>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10, padding:"11px 13px", background:"var(--primary-soft)", borderRadius:11, marginBottom:16 }}>
            <Icon n="star" size={17}/>
            <span style={{ fontSize:13, color:"var(--primary-ink)" }}>โค้ดแนะนำของ {referrer.name}: <b style={{ fontFamily:"var(--ff-display)", letterSpacing:"0.03em" }}>{code}</b></span>
          </div>
          <div style={{display:'flex',gap:12}}>
            <div className="field" style={{flex:2}}><label>ชื่อเพื่อนใหม่ / ผู้ปกครอง</label><input value={friend} onChange={e=>setFriend(e.target.value)} placeholder="เช่น น้องพีช"/></div>
            <div className="field" style={{flex:1}}><label>เบอร์ติดต่อ</label><input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="08x-xxx"/></div>
          </div>
          <div className="field"><label>สนใจคลาส</label>
            <div className="tag-filter">
              {Object.values(DATA.CATS).map(c=>(
                <button key={c.key} className={"chip"+(cat===c.key?" active":"")} onClick={()=>setCat(c.key)}>
                  <span className="dotmark" style={{ background:c.color }}></span>{c.icon} {c.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" style={{ flex:1 }} onClick={onClose}>ยกเลิก</button>
          <button className="btn btn-primary" style={{ flex:1.4 }} onClick={save}><Icon n="check" size={17}/> บันทึก</button>
        </div>
      </div>
    </>
  );
}
window.Referrals = Referrals;

Object.assign(window, { Homework, Referrals });
