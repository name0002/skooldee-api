/* ============ บ้านมาริ — shared UI primitives ============ */
const { useState, useMemo, useEffect, useRef } = React;

/* ---- icon set (simple stroke icons) ---- */
const ICONS = {
  grid:    <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></>,
  calendar:<><rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9h18M8 2.5v4M16 2.5v4"/></>,
  users:   <><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19.5a5.5 5.5 0 0 1 11 0M16 5.5a3 3 0 0 1 0 5.8M20.5 19.5a5 5 0 0 0-3.2-4.7"/></>,
  teacher: <><path d="M3 7l9-3.5L21 7l-9 3.5z"/><path d="M7 9.5V14c0 1.4 2.2 2.6 5 2.6s5-1.2 5-2.6V9.5M21 7v4.5"/></>,
  wallet:  <><rect x="3" y="5.5" width="18" height="14" rx="2.5"/><path d="M3 9.5h18M16 14.5h2.5"/></>,
  search:  <><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></>,
  bell:    <><path d="M18 8.5a6 6 0 1 0-12 0c0 6-2.5 7.5-2.5 7.5h17S18 14.5 18 8.5M10 20a2.2 2.2 0 0 0 4 0"/></>,
  plus:    <><path d="M12 5v14M5 12h14"/></>,
  clock:   <><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></>,
  phone:   <><path d="M6 3.5h3l1.5 4-2 1.5a11 11 0 0 0 5 5l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4 5.7 2 2 0 0 1 6 3.5"/></>,
  check:   <><path d="M5 12.5l4.5 4.5L19 7"/></>,
  more:    <><circle cx="12" cy="5.5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="18.5" r="1.4"/></>,
  edit:    <><path d="M4 20h4l10-10-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></>,
  x:       <><path d="M6 6l12 12M18 6 6 18"/></>,
  chevron: <><path d="M9 6l6 6-6 6"/></>,
  chevL:   <><path d="M15 6l-6 6 6 6"/></>,
  trendUp: <><path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/></>,
  filter:  <><path d="M3 5h18l-7 8v6l-4 2v-8z"/></>,
  pin:     <><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11"/><circle cx="12" cy="10" r="2.5"/></>,
  receipt: <><path d="M5 3.5h14v17l-2.5-1.5L14 20l-2-1.4L10 20l-2.5-1L5 20.5z"/><path d="M9 8h6M9 12h6"/></>,
  download:<><path d="M12 4v10m0 0 4-4m-4 4-4-4M5 19h14"/></>,
  logout:  <><path d="M14 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4"/><path d="M10 12H3m0 0 3.5-3.5M3 12l3.5 3.5"/></>,
  star:    <><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z"/></>,
  clipboard: <><rect x="5" y="4.5" width="14" height="17" rx="2.5"/><path d="M9 4.5a3 3 0 0 1 6 0M8.5 12l2 2 4-4"/></>,
  chart:   <><path d="M4 20V4M4 20h16"/><rect x="7.5" y="11" width="3" height="6"/><rect x="13" y="7.5" width="3" height="9.5"/><rect x="18.5" y="13.5" width="0.1" height="3.5"/></>,
  book:    <><path d="M5 4.5h10a2 2 0 0 1 2 2V21l-3.5-2-3.5 2V6.5a2 2 0 0 0-2-2H5z"/><path d="M5 4.5v15M9 9h4"/></>,
  gift:    <><rect x="3.5" y="8.5" width="17" height="4" rx="1"/><path d="M5 12.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7.5M12 8.5V21"/><path d="M12 8.5S10.5 4 8 4a2 2 0 0 0 0 4.5zM12 8.5S13.5 4 16 4a2 2 0 0 1 0 4.5z"/></>,
};
function Icon({ n, size=20, sw=1.7, cls="" }){
  return (
    <svg className={"ic "+cls} width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      {ICONS[n]}
    </svg>
  );
}
window.Icon = Icon;

/* ---- avatar with deterministic warm color ---- */
const AV_COLORS = ["var(--c-sing)","var(--c-piano)","var(--c-dance)","var(--c-drums)","var(--c-guitar)","var(--primary)"];
function Avatar({ name, size=38, color }){
  const ch = (name||"?").replace(/^(น้อง|พี่|ครู)/,"").trim()[0] || (name||"?")[0];
  const c = color || AV_COLORS[[...(name||"")].reduce((a,x)=>a+x.charCodeAt(0),0) % AV_COLORS.length];
  return (
    <div className="avatar" style={{ width:size, height:size, fontSize:size*0.42,
      background:`color-mix(in oklch, ${c} 88%, white)` }}>{ch}</div>
  );
}
window.Avatar = Avatar;

/* ---- category badge ---- */
function CatBadge({ cat, withIcon=true, small=false }){
  const c = DATA.CATS[cat]; if(!c) return null;
  return (
    <span className="badge" style={{ background:c.soft, color:`color-mix(in oklch, ${c.color} 78%, black)`, fontSize:small?11.5:12.5 }}>
      <span className="dotmark" style={{ background:c.color }}></span>{c.label}
    </span>
  );
}
window.CatBadge = CatBadge;

function StatusBadge({ map, k }){
  const s = map[k]; if(!s) return null;
  return (
    <span className="badge" style={{ background:s.soft, color:`color-mix(in oklch, ${s.color} 75%, black)` }}>
      <span className="dotmark" style={{ background:s.color }}></span>{s.label}
    </span>
  );
}
window.StatusBadge = StatusBadge;

/* ---- progress bar ---- */
function Progress({ value, max, color="var(--primary)" }){
  const pct = Math.max(0, Math.min(100, (value/max)*100));
  return <div className="progress"><i style={{ width:pct+"%", background:color }}></i></div>;
}
window.Progress = Progress;

/* ---- sparkline / bar mini-chart ---- */
function BarChart({ data, height=120, color="var(--primary)" }){
  const max = Math.max(...data.map(d=>d.v));
  return (
    <div style={{ display:"flex", alignItems:"flex-end", gap:10, height }}>
      {data.map((d,i)=>{
        const h = (d.v/max)*100;
        const last = i===data.length-1;
        return (
          <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:8, height:"100%", justifyContent:"flex-end" }}>
            <div title={DATA.baht(d.v)} style={{ width:"100%", maxWidth:34, height:h+"%", borderRadius:"7px 7px 3px 3px",
              background: last ? color : "color-mix(in oklch, "+color+" 22%, white)", transition:"height .5s cubic-bezier(.2,.7,.3,1)" }}></div>
            <span style={{ fontSize:11.5, color:"var(--text-3)", fontWeight: last?700:500 }}>{d.m}</span>
          </div>
        );
      })}
    </div>
  );
}
window.BarChart = BarChart;

/* ---- donut (pure CSS conic) ---- */
function Donut({ segments, size=140 }){
  const total = segments.reduce((a,s)=>a+s.v,0);
  let acc = 0;
  const stops = segments.map(s=>{
    const start = (acc/total)*100; acc += s.v; const end = (acc/total)*100;
    return `${s.color} ${start}% ${end}%`;
  }).join(", ");
  return (
    <div style={{ width:size, height:size, borderRadius:"50%", background:`conic-gradient(${stops})`, position:"relative", flex:`0 0 ${size}px` }}>
      <div style={{ position:"absolute", inset:size*0.26, background:"var(--surface)", borderRadius:"50%",
        display:"grid", placeItems:"center" }}>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontFamily:"var(--ff-display)", fontWeight:700, fontSize:size*0.2, lineHeight:1 }}>{total}</div>
          <div style={{ fontSize:11, color:"var(--text-3)" }}>นักเรียน</div>
        </div>
      </div>
    </div>
  );
}
window.Donut = Donut;

/* ---- drawer shell ---- */
function Drawer({ title, sub, onClose, children, footer, accent="var(--primary)" }){
  useEffect(()=>{
    const h = (e)=> e.key==="Escape" && onClose();
    window.addEventListener("keydown", h); return ()=> window.removeEventListener("keydown", h);
  },[]);
  return (
    <>
      <div className="scrim" onClick={onClose}></div>
      <aside className="drawer">
        <div className="drawer-head">
          <div style={{ width:4, height:34, borderRadius:4, background:accent }}></div>
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:"var(--ff-display)", fontWeight:700, fontSize:18 }}>{title}</div>
            {sub && <div style={{ fontSize:12.5, color:"var(--text-3)" }}>{sub}</div>}
          </div>
          <button className="icon-btn" onClick={onClose}><Icon n="x" size={18}/></button>
        </div>
        <div className="drawer-body">{children}</div>
        {footer && <div className="drawer-foot">{footer}</div>}
      </aside>
    </>
  );
}
window.Drawer = Drawer;

/* ---- toast ---- */
function useToast(){
  const [toast, setToast] = useState(null);
  const show = (msg)=>{ setToast(msg); setTimeout(()=>setToast(null), 2400); };
  const node = toast ? (
    <div style={{ position:"fixed", bottom:84, left:"50%", transform:"translateX(-50%)", zIndex:60,
      background:"var(--text)", color:"var(--surface)", padding:"11px 20px", borderRadius:12,
      boxShadow:"var(--shadow-lg)", fontSize:14, fontWeight:600, display:"flex", alignItems:"center", gap:9,
      animation:"slidein .2s ease" }}>
      <Icon n="check" size={17}/> {toast}
    </div>
  ) : null;
  return [node, show];
}
window.useToast = useToast;

/* ---- section header ---- */
function SectionHead({ title, children }){
  return <div className="section-head"><div className="section-title">{title}</div><div style={{ display:"flex", gap:8, alignItems:"center" }}>{children}</div></div>;
}
window.SectionHead = SectionHead;

/* ---- live data store: re-render \u0e17\u0e31\u0e49\u0e07\u0e41\u0e2d\u0e1b\u0e40\u0e21\u0e37\u0e48\u0e2d\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e40\u0e1b\u0e25\u0e35\u0e48\u0e22\u0e19 ---- */
const __bmListeners = new Set();
function bumpData(){ __bmListeners.forEach(l=>l()); }
function useDataVersion(){
  const [,set] = useState(0);
  useEffect(()=>{ const l=()=>set(v=>v+1); __bmListeners.add(l); return ()=>__bmListeners.delete(l); },[]);
}
window.bumpData = bumpData;
window.useDataVersion = useDataVersion;

/* ---- LINE notify modal (mock) ---- */
function LineNotify({ student, homework, referral, onClose, onSent }){
  const pkgTxt = student.dur===60 ? "1 ชม." : "30 นาที";
  const nm = student.name.replace(/^(น้อง|พี่|น้า|แม่)/,"");
  const code = referral ? DATA.refCode(student.name) : "";
  const link = referral ? "https://liff.line.me/baanmari/invite?ref="+code : homework ? "https://liff.line.me/baanmari/homework" : "https://liff.line.me/baanmari/renew";
  const [msg, setMsg] = useState( referral ?
`สวัสดีค่ะ 🎁 โรงเรียนดนตรีบ้านมาริ
ชวนเพื่อของ${nm} มาเรียนด้วยกันนะคะ 🎶

แจ้งโค้ดแนะนำ ย${code}ย ตอนสมัคร
✨ เพื่อนใหม่รับทันที ${DATA.REF_FRIEND_BONUS} แต้ม
✨ ${nm} รับ ${DATA.REF_REWARD} แต้มเมื่อเพื่อนสมัครเรียน

กดลิงก์ด้านล่างได้เลยค่ะ 👇` :
   homework ?
`สวัสดีค่ะ 📚 โรงเรียนดนตรีบ้านมาริ
แจ้งการบ้านของน้อง${nm} ค่ะ

วิชา${DATA.CATS[homework.cat].label} · ${homework.teacher}
📝 ${homework.title}
${homework.detail && homework.detail!=="-" ? homework.detail+"\n" : ""}⏰ ส่งภายใน ${homework.due}

รบกวนผู้ปกครองช่วยดูแลน้องฝึกด้วยนะคะ 😊` :
`สวัสดีค่ะ 🎶 โรงเรียนดนตรีบ้านมาริ
เรียนแจ้งผู้ปกครองน้อง${nm} ค่ะ

คอร์ส${DATA.CATS[student.cats[0]].label} (${pkgTxt}/ครั้ง) ใกล้จะหมดแล้วนะคะ เหลืออีกเพียง ${student.remaining} ครั้ง 🔔

สนใจต่อคอร์สเพื่อเรียนต่อเนื่อง กดที่ลิงก์ด้านล่างหรือทักแชทได้เลยค่ะ 💬`);
  useEffect(()=>{ const h=(e)=>e.key==="Escape"&&onClose(); window.addEventListener("keydown",h); return ()=>window.removeEventListener("keydown",h); },[]);
  return (
    <>
      <div className="scrim" onClick={onClose}></div>
      <div className="modal">
        <div className="modal-head">
          <div className="line-logo">LINE</div>
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:"var(--ff-display)", fontWeight:700, fontSize:16 }}>{referral?"ส่งโค้ดแนะนำ":homework?"แจ้งการบ้านถึงผู้ปกครอง":"แจ้งเตือนผู้ปกครอง"}</div>
            <div style={{ fontSize:12.5, color:"var(--text-3)" }}>{referral?`ถึง ${student.name} → แชร์ให้ ${referral.friend}`:`ส่งถึง ${student.guardian!=="-"?student.guardian:"ผู้ปกครอง"} · ${student.phone}`}</div>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon n="x" size={18}/></button>
        </div>
        <div className="modal-body">
          <div className="line-preview">
            <div className="line-bubble">{msg}</div>
            <div className="line-card">
              <div style={{ fontWeight:700, fontSize:14 }}>{referral?"สมัครเรียน · รับแต้มฟรี 🎁":homework?"ส่งการบ้าน / ดูรายละเอียด 📖":`ต่อคอร์ส${DATA.CATS[student.cats[0]].label} 🎵`}</div>
              <div style={{ fontSize:12.5, color:"var(--text-3)", margin:"2px 0 10px", wordBreak:"break-all" }}>{link}</div>
              <button className="btn btn-sm" style={{ background:"#06c755", color:"#fff", width:"100%" }}>{referral?"สมัครด้วยโค้ดนี้":homework?"ส่งการบ้าน":"เปิดดูแพ็กเกจ"}</button>
            </div>
          </div>
          <div className="field" style={{ marginTop:14, marginBottom:0 }}>
            <label>แก้ไขข้อความก่อนส่ง</label>
            <textarea rows={5} value={msg} onChange={e=>setMsg(e.target.value)}></textarea>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" style={{ flex:1 }} onClick={onClose}>ยกเลิก</button>
          <button className="btn" style={{ flex:1.4, background:"#06c755", color:"#fff" }} onClick={onSent}>
            <Icon n="check" size={17}/> ส่งผ่าน LINE
          </button>
        </div>
      </div>
    </>
  );
}
window.LineNotify = LineNotify;

/* ---- แต้มสะสม / ระดับสมาชิก ---- */
function TierBadge({ points, small }){
  const t = DATA.tierOf(points);
  return (
    <span className="badge" style={{ background:`color-mix(in oklch, ${t.color} 16%, white)`, color:`color-mix(in oklch, ${t.color} 70%, black)`, fontSize: small?11.5:12.5 }}>
      {t.icon} {t.label} · {points} แต้ม
    </span>
  );
}
window.TierBadge = TierBadge;

Object.assign(window, { Icon, Avatar, CatBadge, StatusBadge, Progress, BarChart, Donut, Drawer, useToast, SectionHead, bumpData, useDataVersion, LineNotify, TierBadge });
