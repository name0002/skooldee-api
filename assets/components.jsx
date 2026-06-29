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
  trendUp:   <><path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/></>,
  trendDown: <><path d="M3 7l6 6 4-4 8 8"/><path d="M15 17h6v-6"/></>,
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
  key:     <><circle cx="7.5" cy="15.5" r="4.5"/><path d="M12 15.5h9M17 11.5v4"/></>,
  settings:<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
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

/* Bar chart that shows historical months (solid) plus forecast months (dashed/striped),
 * with an optional owner target drawn as a horizontal goal line.
 * history: [{ym,v,partial}]  ·  forecast: [{ym,v,lo,hi}] (future months, current-month dup already dropped by caller)
 * `fmt` formats the tooltip value. `goal` (number|null) draws the target line. Shows the
 * last 8 history months to stay readable. Bars and labels are separate rows so the goal
 * line's % position lines up exactly with the bar tops. */
function ForecastChart({ history, forecast, color="var(--primary)", height=160, fmt, goal }){
  fmt = fmt || (v=>v);
  const THMON = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const lbl = ym => THMON[Number(String(ym).slice(5,7))-1] || '';
  const hist = (history||[]).slice(-8).map(h=>({ ...h, kind: h.partial?'partial':'actual' }));
  const fut  = (forecast||[]).map(f=>({ ...f, kind:'forecast' }));
  const bars = hist.concat(fut);
  const g = goal>0 ? goal : 0;
  const max = Math.max(1, g, ...bars.map(b=> b.kind==='forecast' ? (b.hi||b.v) : b.v));
  return (
    <div>
      <div style={{ position:"relative", height }}>
        <div style={{ display:"flex", alignItems:"flex-end", gap:6, height:"100%" }}>
          {bars.map((b,i)=>{
            const h = (b.v/max)*100, isF = b.kind==='forecast', isP = b.kind==='partial';
            return (
              <div key={i} style={{ flex:1, display:"flex", alignItems:"flex-end", justifyContent:"center", height:"100%" }}>
                <div title={fmt(b.v)+(isF?' (คาดการณ์)':isP?' (ยังไม่จบเดือน)':'')} style={{
                  width:"100%", maxWidth:30, height:Math.max(2,h)+"%", borderRadius:"6px 6px 2px 2px",
                  background: isF ? "color-mix(in oklch, "+color+" 10%, white)" : (isP ? "color-mix(in oklch, "+color+" 45%, white)" : color),
                  border: isF ? "1.5px dashed "+color : "none",
                  transition:"height .5s cubic-bezier(.2,.7,.3,1)" }}></div>
              </div>
            );
          })}
        </div>
        {g>0 && (
          <div style={{ position:"absolute", left:0, right:0, bottom:((g/max)*100)+"%", borderTop:"1.5px dashed var(--warn)", pointerEvents:"none" }}>
            <span style={{ position:"absolute", right:0, top:-8, fontSize:10, fontWeight:700, color:"var(--warn)", background:"var(--surface)", padding:"0 4px", lineHeight:"16px" }}>เป้า {fmt(g)}</span>
          </div>
        )}
      </div>
      <div style={{ display:"flex", gap:6, marginTop:6 }}>
        {bars.map((b,i)=>(
          <span key={i} style={{ flex:1, textAlign:"center", fontSize:10.5, color:"var(--text-3)", fontWeight:(b.kind!=='actual')?700:500 }}>{lbl(b.ym)}</span>
        ))}
      </div>
    </div>
  );
}
window.ForecastChart = ForecastChart;

/* One-line forecast summary: this-month projection, next month, monthly trend %. */
function ForecastCaption({ fc, fmt }){
  if(!fc || !fc.points || !fc.points.length) return null;
  fmt = fmt || (v=>v);
  const cur = fc.points[0], next = fc.points[1];
  const up = (fc.trend_pct||0) >= 0;
  return (
    <div style={{ marginTop:12, display:"flex", flexWrap:"wrap", gap:14, alignItems:"center", fontSize:13 }}>
      {cur && <span style={{ color:"var(--text-2)" }}>เดือนนี้คาดถึง <b style={{ color:"var(--text)" }}>{fmt(cur.v)}</b></span>}
      {next && <span style={{ color:"var(--text-2)" }}>เดือนหน้า ~<b style={{ color:"var(--text)" }}>{fmt(next.v)}</b></span>}
      <span style={{ color: up?"var(--ok)":"var(--danger)", fontWeight:700, display:"inline-flex", alignItems:"center", gap:3 }}>
        <Icon n={up?"trendUp":"trendDown"} size={14}/>{up?"+":""}{fc.trend_pct}%/เดือน
      </span>
      {!fc.reliable && <span style={{ fontSize:11.5, color:"var(--text-3)" }}>· ข้อมูลยังน้อย คาดการณ์คร่าวๆ</span>}
    </div>
  );
}
window.ForecastCaption = ForecastCaption;

/* Progress toward an owner-set target. `current` = value so far this month; `projected`
 * (optional) = the model's end-of-month estimate. The end-of-month value can only be ≥
 * what's already happened, so the verdict uses max(current, projected) — that avoids a
 * "100% but will fall short" contradiction when the month already beat the trend.
 * Renders nothing when no goal is set. */
function GoalProgress({ label, current, projected, goal, fmt }){
  if(!goal || goal<=0) return null;
  fmt = fmt || (v=>v);
  const pct = Math.max(0, Math.min(100, Math.round((current/goal)*100)));
  const achieved = current >= goal;
  const end = projected!=null ? Math.max(current, projected) : current;
  const onTrack = end >= goal;
  const color = onTrack ? "var(--ok)" : "var(--warn)";
  return (
    <div style={{ marginTop:12 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", fontSize:12.5, marginBottom:5 }}>
        <span style={{ color:"var(--text-2)" }}>{label}</span>
        <span><b style={{ color:"var(--text)" }}>{fmt(current)}</b> <span style={{ color:"var(--text-3)" }}>/ {fmt(goal)} ({pct}%)</span></span>
      </div>
      <div style={{ height:8, borderRadius:99, background:"var(--surface-2)", overflow:"hidden" }}>
        <div style={{ height:"100%", width:pct+"%", background:color, borderRadius:99, transition:"width .5s cubic-bezier(.2,.7,.3,1)" }}/>
      </div>
      {(achieved || projected!=null) && (
        <div style={{ fontSize:11.5, marginTop:5, color, fontWeight:600 }}>
          {achieved ? "✓ ถึงเป้าแล้ว"
            : onTrack ? "✓ คาดว่าจะถึงเป้าสิ้นเดือน (" + fmt(end) + ")"
            : "⚠ คาดว่าจะต่ำกว่าเป้า (" + fmt(end) + ")"}
        </div>
      )}
    </div>
  );
}
window.GoalProgress = GoalProgress;

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

/* ---- known classroom names: union of managed list + category defaults + rooms in use ---- */
function allRooms(){
  const set = new Set();
  const managed = (DATA._schoolRaw && Array.isArray(DATA._schoolRaw.rooms)) ? DATA._schoolRaw.rooms : [];
  managed.forEach(r=>{ if(r) set.add(r); });
  Object.values(DATA.CATS||{}).forEach(c=>{ if(c && c.room) set.add(c.room); });
  (DATA.SCHEDULE||[]).forEach(s=>{ if(s.room && s.room!=='-') set.add(s.room); });
  return Array.from(set);
}
window.allRooms = allRooms;

/* ---- development-assessment rubric: sensible defaults per subject type ---- */
const DEFAULT_CRITERIA = {
  piano:['เทคนิค','จังหวะ','การอ่านโน้ต','การแสดงออก'],
  keyboard:['เทคนิค','จังหวะ','การอ่านโน้ต','การแสดงออก'],
  guitar:['เทคนิค','จังหวะ','การอ่านโน้ต','การแสดงออก'],
  ukulele:['เทคนิค','จังหวะ','การอ่านโน้ต','การแสดงออก'],
  violin:['เทคนิค','จังหวะ','การเข้าเสียง','การแสดงออก'],
  drums:['เทคนิค','จังหวะ','การควบคุม','การแสดงออก'],
  sing:['น้ำเสียง','จังหวะ','ลมหายใจ','อักขระ'],
  singing:['น้ำเสียง','จังหวะ','ลมหายใจ','อักขระ'],
  dance:['จังหวะ','ความจำท่า','การแสดงออก','ความคล่องตัว'],
  art:['ความคิดสร้างสรรค์','เทคนิค','การใช้สี','ความตั้งใจ'],
};
const DEFAULT_CRITERIA_GENERIC = ['ความเข้าใจ','ทักษะปฏิบัติ','ความตั้งใจ','พัฒนาการ'];
// criteria for a subject: school's custom rubric if set, otherwise a sensible default
function criteriaFor(catKey){
  const custom = (DATA.ASSESS_CRITERIA||{})[catKey];
  if(Array.isArray(custom) && custom.length) return custom;
  return DEFAULT_CRITERIA[catKey] || DEFAULT_CRITERIA_GENERIC;
}
window.DEFAULT_CRITERIA = DEFAULT_CRITERIA;
window.criteriaFor = criteriaFor;

/* ---- read-only star row (rating 0..5, 0 = unrated) ---- */
function Stars({ value, size=15 }){
  const v = Math.max(0, Math.min(5, Math.round(value||0)));
  return (
    <span style={{ letterSpacing:1, fontSize:size, lineHeight:1, color:"var(--warn,#F97316)" }}>
      {'★'.repeat(v)}<span style={{ color:"var(--border)" }}>{'★'.repeat(5-v)}</span>
    </span>
  );
}
window.Stars = Stars;

/* ---- LINE notify modal ---- */
function LineNotify({ student, homework, referral, onClose, onSent }){
  const [sending, setSending] = useState(false);
  const schoolName = DATA.SCHOOL&&DATA.SCHOOL.name ? DATA.SCHOOL.name : 'โรงเรียน';
  const slug = DATA._schoolRaw&&DATA._schoolRaw.slug ? DATA._schoolRaw.slug : 'school';
  const pkgTxt = student.dur===60 ? "1 ชม." : "30 นาที";
  const nm = student.name.replace(/^(น้อง|พี่|น้า|แม่)/,"");
  const code = referral ? DATA.refCode(student.name) : "";
  const link = referral
    ? `https://skooldee.com/${slug}?ref=${code}`
    : homework
    ? `https://skooldee.com/${slug}/homework`
    : `https://skooldee.com/${slug}/renew`;
  // relationship- & age-aware wording: addresses the actual LINE recipient (parent /
  // adult self-learner / sibling / relative) instead of always assuming "ผู้ปกครอง".
  const w = (DATA.recipientWords||((t,nm2)=>({greet:`คุณพ่อคุณแม่ของน้อง${nm2}`, studentRef:`น้อง${nm2}`, care:'', isSelf:false})))(student.recipient||'parent', nm, student.age, student.honorific);
  const buildHomework = ()=>{
    const tpl = (DATA._schoolRaw && DATA._schoolRaw.homework_message_template || '').trim();
    const detail = homework.detail && homework.detail!=="-" ? homework.detail : '';
    if(tpl){
      // school's custom template wins — placeholders resolve per-recipient
      return tpl
        .replace(/\{ผู้รับ\}/g, w.greet)
        .replace(/\{ชื่อ\}/g, nm)
        .replace(/\{หัวข้อ\}/g, homework.title||'')
        .replace(/\{รายละเอียด\}/g, detail)
        .replace(/\{กำหนดส่ง\}/g, homework.due||'')
        .replace(/[ \t]*\n{3,}/g, '\n\n');
    }
    const subj = w.isSelf ? 'ค่ะ' : `ของ${w.studentRef}`;
    return `สวัสดีค่ะ 📚 ${schoolName}
แจ้งการบ้าน${subj}

วิชา${(DATA.CATS[homework.cat]||{}).label||homework.cat} · ${homework.teacher}
📝 ${homework.title}
${detail ? detail+"\n" : ""}⏰ ส่งภายใน ${homework.due}

${w.care}`;
  };
  const [msg, setMsg] = useState( referral ?
`สวัสดีค่ะ 🎁 ${schoolName}
ชวนเพื่อนของ${nm} มาเรียนด้วยกันนะคะ 🎶

แจ้งโค้ดแนะนำ [${code}] ตอนสมัคร
✨ เพื่อนใหม่รับทันที ${DATA.REF_FRIEND_BONUS} แต้ม
✨ ${nm} รับ ${DATA.REF_REWARD} แต้มเมื่อเพื่อนสมัครเรียน

กดลิงก์ด้านล่างได้เลยค่ะ 👇
👉 ${link}` :
   homework ? buildHomework() :
`สวัสดีค่ะ 🎶 ${schoolName}
เรียนแจ้ง${w.greet} ค่ะ

คอร์ส${(DATA.CATS[student.cats&&student.cats[0]]||{}).label||'ดนตรี'} (${pkgTxt}/ครั้ง) ใกล้จะหมดแล้วนะคะ เหลืออีกเพียง ${student.remaining} ครั้ง 🔔

สนใจต่อคอร์สเพื่อเรียนต่อเนื่อง กดลิงก์ด้านล่างหรือทักแชทได้เลยค่ะ 💬
👉 ${link}`);
  useEffect(()=>{ const h=(e)=>e.key==="Escape"&&onClose(); window.addEventListener("keydown",h); return ()=>window.removeEventListener("keydown",h); },[]);
  return (
    <>
      <div className="scrim" onClick={onClose}></div>
      <div className="modal">
        <div className="modal-head">
          <div className="line-logo">LINE</div>
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:"var(--ff-display)", fontWeight:700, fontSize:16 }}>{referral?"ส่งโค้ดแนะนำ":homework?`แจ้งการบ้านถึง${w.isSelf?"ผู้เรียน":"ผู้ปกครอง"}`:"แจ้งเตือน"}</div>
            <div style={{ fontSize:12.5, color:"var(--text-3)" }}>{referral?`ถึง ${student.name} → แชร์ให้ ${referral.friend}`:`ส่งถึง ${student.guardian&&student.guardian!=="-"?student.guardian:w.greet} · ${student.phone}`}</div>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon n="x" size={18}/></button>
        </div>
        <div className="modal-body">
          <div className="line-preview">
            <div className="line-bubble">{msg}</div>
            <div className="line-card">
              <div style={{ fontWeight:700, fontSize:14 }}>{referral?"สมัครเรียน · รับแต้มฟรี 🎁":homework?"ส่งการบ้าน / ดูรายละเอียด 📖":`ต่อคอร์ส${(DATA.CATS[student.cats&&student.cats[0]]||{}).label||""} 🎵`}</div>
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
          <button className="btn btn-ghost" style={{ flex:1 }} onClick={onClose} disabled={sending}>ยกเลิก</button>
          <button className="btn" style={{ flex:1.4, background:"#06c755", color:"#fff" }} disabled={sending}
            onClick={async()=>{
              setSending(true);
              let result = { sent:true };
              if(DATA._isLiveMode && window.API && window.API.notifyLine){
                try{
                  const r = await window.API.notifyLine({
                    student_id: student._dbId||null,
                    phone: student.phone||null,
                    message: msg,
                  });
                  // server reports actual outcome: sent / simulated (no token or parent not linked)
                  result = r || { sent:false };
                }catch(e){ console.warn('[LINE notify]', e); result = { sent:false, error:true }; }
              }
              setSending(false);
              onSent(result);
            }}>
            {sending ? 'กำลังส่ง…' : <><Icon n="check" size={17}/> ส่งผ่าน LINE</>}
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

/* ---- แพ็กเกจการสมัครใช้งาน (subscription plan) ---- */
// Display metadata mirrors server plans.js keys + labels. Used by the sidebar
// chip and the Settings → "แพ็กเกจของฉัน" card so every plan (paid or trial)
// shows what it's on.
const PLAN_META = {
  trial:      { label:'ทดลองใช้',   bg:'#EFF6FF', c:'#1D4ED8' },
  studio:     { label:'STUDIO',     bg:'#F5F3FF', c:'#6D28D9' },
  academy:    { label:'ACADEMY',    bg:'#ECFDF5', c:'#065F46' },
  enterprise: { label:'ENTERPRISE', bg:'#FFF7ED', c:'#92400E' },
  cancelled:  { label:'หมดอายุ',    bg:'#FEF2F2', c:'#991B1B' },
};
function planMeta(plan){ return PLAN_META[plan] || PLAN_META.cancelled; }
// days until plan_expires (negative if already past); null when no expiry set
function planDaysLeft(expires){ return expires ? Math.ceil((new Date(expires)-Date.now())/86400_000) : null; }
function PlanBadge({ plan, small }){
  const m = planMeta(plan);
  return (
    <span style={{ fontSize: small?10.5:12, fontWeight:800, letterSpacing:'.02em', borderRadius:6,
      padding: small?'2px 7px':'3px 10px', background:m.bg, color:m.c, whiteSpace:'nowrap' }}>
      {m.label}
    </span>
  );
}
window.planMeta = planMeta;
window.planDaysLeft = planDaysLeft;
window.PlanBadge = PlanBadge;

Object.assign(window, { Icon, Avatar, CatBadge, StatusBadge, Progress, BarChart, Donut, Drawer, useToast, SectionHead, bumpData, useDataVersion, LineNotify, TierBadge, planMeta, planDaysLeft, PlanBadge });
