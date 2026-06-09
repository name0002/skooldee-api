/* ============ บ้านมาริ — App shell & routing ============ */
const NAV = [
  { id:"dashboard", label:"ภาพรวม",      m:"ภาพรวม", icon:"grid" },
  { id:"schedule",  label:"ตารางเรียน",  m:"ตาราง", icon:"calendar", badge:DATA.SCHEDULE.length },
  { id:"attendance",label:"เช็คชื่อ",     m:"เช็คชื่อ", icon:"clipboard" },
  { id:"homework",  label:"การบ้าน",      m:"การบ้าน", icon:"book" },
  { id:"students",  label:"นักเรียน",     m:"นักเรียน", icon:"users" },
  { id:"teachers",  label:"ครูผู้สอน",    m:"ครู", icon:"teacher" },
  { id:"finance",   label:"การเงิน & คอร์ส", m:"การเงิน", icon:"wallet" },
  { id:"referrals", label:"แนะนำเพื่อน",   m:"แนะนำ", icon:"gift" },
  { id:"reports",   label:"รายงาน",       m:"รายงาน", icon:"chart" },
];
const TITLES = {
  dashboard:{ t:"ภาพรวม", s:"สรุปกิจกรรมโรงเรียนวันนี้" },
  schedule: { t:"ตารางเรียน", s:"จองและจัดการคาบเรียนรายสัปดาห์" },
  attendance:{ t:"เช็คชื่อเข้าเรียน", s:"บันทึกการเข้าเรียนรายวัน" },
  homework: { t:"การบ้าน", s:"มอบหมายและแจ้งการบ้านผ่าน LINE" },
  students: { t:"นักเรียน", s:"ข้อมูลนักเรียนและความคืบหน้า" },
  teachers: { t:"ครูผู้สอน", s:"ครูและการคำนวณค่าสอน" },
  finance:  { t:"การเงิน & คอร์ส", s:"ใบเสร็จ การชำระเงิน และแพ็กเกจ" },
  referrals:{ t:"แนะนำเพื่อน", s:"ระบบแนะนำเพื่อนรับแต้มสะสม" },
  reports:  { t:"รายงานสรุป", s:"ภาพรวมผลการดำเนินงานรายเดือน" },
};

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "primary": "#0D9488",
  "fontBody": "Work Sans",
  "fontHead": "Work Sans",
  "nearLimit": 2,
  "radius": 12
}/*EDITMODE-END*/;

function App(){
  useDataVersion();
  const [tw, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [page, setPage] = useState(()=> localStorage.getItem("bm-page") || "dashboard");

  React.useEffect(()=>{
    const r = document.documentElement.style;
    r.setProperty("--primary", tw.primary);
    r.setProperty("--primary-ink", `color-mix(in oklch, ${tw.primary} 72%, black)`);
    r.setProperty("--primary-soft", `color-mix(in oklch, ${tw.primary} 13%, white)`);
    r.setProperty("--primary-soft2", `color-mix(in oklch, ${tw.primary} 26%, white)`);
    r.setProperty("--ff-ui", `"${tw.fontBody}","IBM Plex Sans Thai",system-ui,sans-serif`);
    r.setProperty("--ff-display", `"${tw.fontHead}","${tw.fontBody}",system-ui,sans-serif`);
    r.setProperty("--radius", tw.radius+"px");
    r.setProperty("--radius-sm", (tw.radius-5)+"px");
    r.setProperty("--radius-lg", (tw.radius+6)+"px");
    DATA.setNearLimit(tw.nearLimit);
    bumpData();
  }, [tw.primary, tw.fontBody, tw.fontHead, tw.radius, tw.nearLimit]);

  const nearN = DATA.STUDENTS.filter(DATA.isNearEnding).length;
  const go = (p)=>{ setPage(p); localStorage.setItem("bm-page", p); window.scrollTo(0,0); };

  const Screen = { dashboard:Dashboard, schedule:Schedule, attendance:Attendance, homework:Homework, students:Students, teachers:Teachers, finance:Finance, referrals:Referrals, reports:Reports }[page];
  const ti = TITLES[page];

  return (
    <div className="app">
      {/* ---- sidebar ---- */}
      <nav className="sidebar">
        <div className="brand">
          <div className="brand-mark">{DATA.SCHOOL.mark}</div>
          <div>
            <div className="brand-name">{DATA.SCHOOL.name}</div>
            <div className="brand-sub">{DATA.SCHOOL.sub}</div>
          </div>
        </div>

        <div className="nav-section">เมนูหลัก</div>
        {NAV.map(n=>(
          <button key={n.id} className={"nav-item"+(page===n.id?" active":"")} onClick={()=>go(n.id)}>
            <Icon n={n.icon} size={20}/>
            <span>{n.label}</span>
            {n.badge && <span className="nav-badge">{n.badge}</span>}
          </button>
        ))}

        <div className="side-foot">
          <div className="side-card" style={{ marginBottom:10, background:"var(--danger-soft)", border:0 }}>
            <div style={{ fontSize:13, fontWeight:700, color:"color-mix(in oklch,var(--danger) 80%,black)" }}>⚠️ คอร์สใกล้หมด {nearN} คน</div>
            <div style={{ fontSize:12, color:"color-mix(in oklch,var(--danger) 65%,black)", margin:"3px 0 9px" }}>ควรติดต่อชวนต่อคอร์ส</div>
            <button className="btn btn-sm" style={{ background:"var(--danger)", color:"#fff", width:"100%" }} onClick={()=>go("students")}>ดูรายชื่อ</button>
          </div>
          <div className="user-chip">
            <Avatar name={DATA.SCHOOL.owner.replace(/^คุณ/,"")} size={38} color="var(--primary)"/>
            <div style={{ flex:1, minWidth:0 }}>
              <div className="un" style={{ fontWeight:600, fontSize:13.5 }}>{DATA.SCHOOL.owner}</div>
              <div className="ur" style={{ fontSize:11.5 }}>{DATA.SCHOOL.ownerRole}</div>
            </div>
            <button className="icon-btn" style={{ width:32, height:32, border:0 }}><Icon n="logout" size={17}/></button>
          </div>
        </div>
      </nav>

      {/* ---- main ---- */}
      <div className="main">
        <header className="topbar">
          <div className="brand-mark only-mobile" style={{ width:34, height:34, fontSize:18, borderRadius:10 }}>{DATA.SCHOOL.mark}</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div className="page-title">{ti.t}</div>
            <div className="page-sub hide-mobile">{ti.s}</div>
          </div>
          <div className="search">
            <Icon n="search" size={17}/>
            <input placeholder="ค้นหานักเรียน ครู หรือคอร์ส..."/>
          </div>
          <button className="icon-btn"><Icon n="bell" size={19}/><span className="dot"></span></button>
        </header>

        <main className="content">
          <Screen go={go}/>
        </main>
      </div>

      {/* ---- mobile bottom nav ---- */}
      <nav className="mobnav">
        {NAV.map(n=>(
          <button key={n.id} className={page===n.id?"active":""} onClick={()=>go(n.id)}>
            <Icon n={n.icon} size={20}/>
            <span>{n.m}</span>
          </button>
        ))}
      </nav>

      {/* ---- Tweaks ---- */}
      <TweaksPanel>
        <TweakSection label="สีแบรนด์"/>
        <TweakColor label="สีหลัก" value={tw.primary}
          options={["#0D9488","#7C3AED","#0EA5E9","#059669","#E11D48"]}
          onChange={(v)=>setTweak("primary", v)}/>
        <TweakSlider label="ความมนขอบ" value={tw.radius} min={4} max={20} step={2} unit="px"
          onChange={(v)=>setTweak("radius", v)}/>
        <TweakSection label="ตัวอักษร"/>
        <TweakSelect label="ฟอนต์เนื้อหา" value={tw.fontBody}
          options={["Work Sans","IBM Plex Sans Thai","Noto Sans Thai","Sarabun","Prompt","Kanit"]}
          onChange={(v)=>setTweak("fontBody", v)}/>
        <TweakSelect label="ฟอนต์หัวข้อ" value={tw.fontHead}
          options={["Work Sans","Prompt","Kanit","Mitr","IBM Plex Sans Thai"]}
          onChange={(v)=>setTweak("fontHead", v)}/>
        <TweakSection label="การแจ้งเตือน"/>
        <TweakSlider label="เตือนเมื่อคอร์สเหลือ ≤" value={tw.nearLimit} min={1} max={4} unit=" ครั้ง"
          onChange={(v)=>setTweak("nearLimit", v)}/>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
