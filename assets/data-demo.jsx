/* ============ Tempo DEMO data — ชื่อสมมติทั้งหมด (ดนตรี · เต้น · ศิลปะ) ============ */
/* ใช้ localStorage prefix "demo-" เพื่อแยกจากบัญชีจริง */
const PFX = "demo-";
const SCHOOL = { name:"เมโลดี้ สตูดิโอ", sub:"Music · Dance · Art", mark:"M", owner:"คุณเดมโม่", ownerRole:"ผู้จัดการสตูดิโอ" };

const CATS = {
  piano:  { key:"piano",  label:"เปียโน",   color:"var(--c-piano)",  soft:"var(--c-piano-soft)",  icon:"🎹", room:"ห้องเปียโน" },
  guitar: { key:"guitar", label:"กีตาร์",   color:"var(--c-guitar)", soft:"var(--c-guitar-soft)", icon:"🎸", room:"ห้องกีตาร์" },
  sing:   { key:"sing",   label:"ร้องเพลง", color:"var(--c-sing)",   soft:"var(--c-sing-soft)",   icon:"🎤", room:"ห้องร้องเพลง" },
  dance:  { key:"dance",  label:"เต้น",     color:"var(--c-dance)",  soft:"var(--c-dance-soft)",  icon:"💃", room:"สตูดิโอเต้น" },
  art:    { key:"art",    label:"ศิลปะ",    color:"var(--c-art)",    soft:"var(--c-art-soft)",    icon:"🎨", room:"ห้องศิลปะ" },
};

const TEACHERS = [
  { id:"t1", nick:"ครูฟ้า",  name:"ครูฟ้า (เปียโน)",  cats:["piano"],  rate:420, color:"var(--c-piano)",  students:12, hours:42, phone:"081-555-0010" },
  { id:"t2", nick:"ครูกาย",  name:"ครูกาย (กีตาร์)",  cats:["guitar"], rate:380, color:"var(--c-guitar)", students:7,  hours:24, phone:"081-555-0020" },
  { id:"t3", nick:"ครูมุก",  name:"ครูมุก (ร้องเพลง)",cats:["sing"],   rate:360, color:"var(--c-sing)",   students:6,  hours:20, phone:"081-555-0030" },
  { id:"t4", nick:"ครูเจน",  name:"ครูเจน (เต้น)",    cats:["dance"],  rate:350, color:"var(--c-dance)",  students:9,  hours:26, phone:"081-555-0040" },
  { id:"t5", nick:"ครูพิม",  name:"ครูพิม (ศิลปะ)",   cats:["art"],    rate:340, color:"var(--c-art)",    students:8,  hours:22, phone:"081-555-0050" },
];
const TEACHER_BY_CAT = { piano:"ครูฟ้า", guitar:"ครูกาย", sing:"ครูมุก", dance:"ครูเจน", art:"ครูพิม" };

const COURSES = [
  { id:"c1", cat:"piano",  name:"เปียโน",    level:"ทุกระดับ" },
  { id:"c2", cat:"guitar", name:"กีตาร์",     level:"ทุกระดับ" },
  { id:"c3", cat:"sing",   name:"ร้องเพลง",  level:"ทุกระดับ" },
  { id:"c4", cat:"dance",  name:"เต้น",       level:"ทุกระดับ" },
  { id:"c5", cat:"art",    name:"ศิลปะ",      level:"ทุกระดับ" },
];

const PACKAGES_DEFAULT = [
  { id:"p10-60", sessions:10, dur:60, price:8500, popular:true },
  { id:"p10-30", sessions:10, dur:30, price:5800, popular:false },
  { id:"p4-60",  sessions:4,  dur:60, price:3800, popular:false },
  { id:"p4-30",  sessions:4,  dur:30, price:2600, popular:false },
];
function loadPackages(){
  try{ const s = localStorage.getItem(PFX+"packages"); if(s){
    const saved = JSON.parse(s);
    return PACKAGES_DEFAULT.map(p=> ({ ...p, price: saved[p.id]!=null ? saved[p.id] : p.price }));
  } }catch(e){}
  return PACKAGES_DEFAULT.map(p=>({...p}));
}
function savePackagePrice(id, price){
  let saved = {};
  try{ saved = JSON.parse(localStorage.getItem(PFX+"packages")||"{}"); }catch(e){}
  saved[id] = price;
  localStorage.setItem(PFX+"packages", JSON.stringify(saved));
}

function hashStr(s){ let h=0; for(const c of s) h=(h*31 + c.charCodeAt(0))>>>0; return h; }
const AGES = [6,7,8,9,10,11,12,14,16,18,21,24,28,32];
const GUARDIANS = ["คุณแม่","คุณพ่อ","ผู้ปกครอง","-"];
function mkStudent(id, name, cats, over){
  const h = hashStr(name);
  const pkg = [10,10,10,4][h%4];
  const dur = (h%4===0) ? 30 : 60;
  const statusPool = ["active","active","active","active","active","trial","paused"];
  const status = statusPool[h%statusPool.length];
  let remaining = h % (pkg+1);
  if(status==="paused") remaining = 0;
  if(status==="trial") remaining = 1;
  const m = (h%28)+1, mm = ((h>>3)%12);
  const joined = `2025-${String((mm%12)+1).padStart(2,"0")}-${String(m).padStart(2,"0")}`;
  const phone = `08${h%9}-${String(h%900+100)}-${String((h>>4)%9000+1000)}`;
  const g = GUARDIANS[h%GUARDIANS.length];
  const guardian = g==="-" ? "-" : g;
  const base = { id, name, full:name, age:AGES[h%AGES.length], cats,
    teacher: TEACHER_BY_CAT[cats[0]], status, balance:0, pkg, dur, remaining, joined, phone, guardian,
    points: (h%880)+40 };
  return Object.assign(base, over||{});
}
const TIERS = [
  { key:"bronze", label:"บรอนซ์", min:0,   color:"oklch(0.6 0.08 50)",  icon:"🥉" },
  { key:"silver", label:"ซิลเวอร์", min:400, color:"oklch(0.65 0.02 250)", icon:"🥈" },
  { key:"gold",   label:"โกลด", min:800, color:"oklch(0.72 0.13 85)",  icon:"🥇" },
];
function tierOf(points){
  let t = TIERS[0], next = null;
  for(let i=0;i<TIERS.length;i++){ if(points>=TIERS[i].min){ t=TIERS[i]; next=TIERS[i+1]||null; } }
  return { ...t, next };
}
/* ชื่อสมมติทั้งหมด (ไม่ซ้ำกับข้อมูลจริง) */
const STUDENT_SEED = [
  ["น้องอินดี้",["piano"]], ["น้องเฌอ",["piano"],{remaining:2,status:"active"}], ["น้องปอนด์",["guitar"]],
  ["น้องข้าวปุ้น",["dance"]], ["น้องมีโม่",["art"]], ["น้องเตเต้",["piano","sing"]],
  ["น้องแทนคุณ",["guitar"],{balance:1900,remaining:1,status:"active"}], ["น้องฟ้าใส",["sing"]],
  ["น้องจังโกะ",["drums"in CATS?"drums":"piano"]], ["น้องมินตรา",["dance"],{remaining:2,status:"active"}],
  ["น้องปุณณ์",["art"]], ["น้องไทก้า",["piano"]], ["น้องลีลา",["dance"]],
  ["น้องโอบนุช",["sing"],{status:"trial"}], ["น้องกานต์",["guitar"]], ["น้องพราว",["art"],{remaining:1,status:"active"}],
  ["น้องเซย่า",["piano"]], ["น้องริว",["dance"]], ["น้องแพรวา",["sing","piano"]], ["น้องเอม",["art"],{status:"trial"}],
];
const __studOv = (()=>{ try{ return JSON.parse(localStorage.getItem(PFX+"students")||"{}"); }catch(e){ return {}; } })();
const STUDENTS = STUDENT_SEED.map((row,i)=>{
  const s = mkStudent("s"+(i+1), row[0], row[1], row[2]);
  return Object.assign(s, __studOv[s.id]||{});
});
function updateStudent(id, patch){
  const s = STUDENTS.find(x=>x.id===id); if(!s) return;
  Object.assign(s, patch);
  let ov={}; try{ ov=JSON.parse(localStorage.getItem(PFX+"students")||"{}"); }catch(e){}
  ov[id] = Object.assign(ov[id]||{}, patch);
  localStorage.setItem(PFX+"students", JSON.stringify(ov));
}
// IMPORTANT: read from the LIVE list (window.DATA.STUDENTS gets REASSIGNED in live mode),
// not the demo-seed `STUDENTS` const this closure was created over — otherwise lookups
// silently miss every real student (e.g. LINE send → "ยังไม่เชื่อม" though the parent IS linked).
const findStudent = (name)=> ((window.DATA && window.DATA.STUDENTS) || STUDENTS).find(s=> s.name===name);

// display-name helper: returns nickname or full name based on the school's NAME_DISPLAY setting.
// Accepts a student object OR a full-name string (looks it up in the CURRENT students list).
let NAME_DISPLAY = 'full';
function setNameDisplay(m){ NAME_DISPLAY = (m==='nick'||m==='both') ? m : 'full'; }
function dispName(x){
  var s = (x && typeof x==='object') ? x
        : ((window.DATA && window.DATA.STUDENTS) || STUDENTS).find(function(st){ return st.name===x || st.full===x; });
  if(!s) return (typeof x==='string') ? x : '-';
  var mode = (window.DATA && window.DATA.NAME_DISPLAY) || NAME_DISPLAY;
  var full = s.name||s.full||'-';
  if(mode==='nick' && s.nickname) return s.nickname;
  if(mode==='both' && s.nickname) return full+' ('+s.nickname+')';
  return full;
}

let NEAR_LIMIT = 2;
function setNearLimit(n){ NEAR_LIMIT = n; }
// Near-ending = aggregate low OR (for multi-subject students) ANY one subject at/under
// the threshold — so a finished course isn't hidden behind a high combined remaining.
const isNearEnding = (s)=>{
  if(s.status!=="active") return false;
  const pkgs = Array.isArray(s.packages) ? s.packages : [];
  if(pkgs.some(p=> p && (p.sessions_total||0)>0 && (p.sessions_remaining||0)<=NEAR_LIMIT)) return true;
  if(pkgs.length>1) return false; // multi-course but every subject still has room
  return (s.remaining||0)<=NEAR_LIMIT;
};
// Detail of WHICH course is near-ending — returns the worst subject for multi-course
// students (so banners/messages can name it) or the aggregate for single-course.
// { remaining, category|null, perSubject }  — call only when isNearEnding(s) is true.
const nearEndingInfo = (s)=>{
  const pkgs = Array.isArray(s.packages) ? s.packages : [];
  const hits = pkgs
    .filter(p=> p && (p.sessions_total||0)>0 && (p.sessions_remaining||0)<=NEAR_LIMIT)
    .sort((a,b)=> (a.sessions_remaining||0)-(b.sessions_remaining||0));
  if(hits.length){ const p=hits[0]; return { remaining:p.sessions_remaining||0, category:p.category||null, perSubject:(pkgs.length>1) }; }
  return { remaining:(s.remaining||0), category:(s.cats&&s.cats[0])||null, perSubject:false };
};

const STATUS = {
  lead:            { label:"สนใจ",            color:"var(--c-piano)",  soft:"var(--c-piano-soft)" },
  trial_scheduled: { label:"นัดทดลองเรียน",   color:"var(--c-dance)",  soft:"var(--c-dance-soft)" },
  trial_done:      { label:"ทดลองเรียนแล้ว",  color:"var(--c-sing)",   soft:"var(--c-sing-soft)" },
  active:          { label:"กำลังเรียน",       color:"var(--ok)",       soft:"var(--ok-soft)" },
  trial:           { label:"ทดลองเรียน",       color:"var(--warn)",     soft:"var(--warn-soft)" },
  paused:          { label:"พักเรียน",         color:"var(--text-3)",   soft:"var(--surface-3)" },
};
// pipeline funnel order (subset of STATUS used as sales stages)
const PIPELINE_STAGES = ['lead','trial_scheduled','trial_done','active'];

const DAYS = [
  {d:"จันทร์", short:"จ", n:"1"}, {d:"อังคาร", short:"อ", n:"2"}, {d:"พุธ", short:"พ", n:"3"},
  {d:"พฤหัสบดี", short:"พฤ", n:"4"}, {d:"ศุกร์", short:"ศ", n:"5"}, {d:"เสาร์", short:"ส", n:"6"}, {d:"อาทิตย์", short:"อา", n:"7"},
];
const toMin = (t)=>{ const [h,m]=t.split(":").map(Number); return h*60+m; };
const DAY_START = toMin("10:00");
const DAY_END   = toMin("19:30");
const PX_PER_MIN = 1.45;

const C = (day,start,end,cat,student)=>({ day,start,end,cat,student, teacher:TEACHER_BY_CAT[cat], room:CATS[cat].room });
const SCHEDULE = [
  // จันทร์
  C(0,"10:00","11:00","piano","น้องอินดี้"), C(0,"11:00","12:00","guitar","น้องปอนด์"),
  C(0,"15:30","16:30","piano","น้องเฌอ"), C(0,"16:00","17:00","art","น้องมีโม่"),
  C(0,"17:00","18:00","dance","น้องข้าวปุ้น"),
  // อังคาร (วันนี้)
  C(1,"13:00","14:00","piano","น้องเตเต้"), C(1,"14:30","15:30","guitar","น้องแทนคุณ"),
  C(1,"15:00","16:00","sing","น้องฟ้าใส"), C(1,"16:30","17:30","piano","น้องไทก้า"),
  C(1,"18:00","19:00","dance","น้องมินตรา"),
  // พุธ
  C(2,"10:30","11:30","art","น้องปุณณ์"), C(2,"16:00","17:00","dance","น้องลีลา"),
  // พฤหัส
  C(3,"15:00","16:00","piano","น้องเซย่า"), C(3,"16:00","16:30","sing","น้องโอบนุช"),
  C(3,"17:00","18:00","guitar","น้องกานต์"),
  // ศุกร์
  C(4,"15:00","16:00","art","น้องพราว"), C(4,"16:00","17:00","dance","น้องริว"), C(4,"17:30","18:30","piano","น้องแพรวา"),
  // เสาร์
  C(5,"10:00","11:00","piano","น้องอินดี้"), C(5,"11:00","12:00","sing","น้องแพรวา"),
  C(5,"13:00","14:00","dance","น้องมินตรา"), C(5,"13:00","14:00","art","น้องเอม"),
  C(5,"14:00","15:00","dance","น้องลีลา"), C(5,"15:00","16:00","guitar","น้องกานต์"),
  C(5,"16:00","17:00","art","น้องปุณณ์"),
  // อาทิตย์
  C(6,"13:00","14:00","piano","น้องไทก้า"), C(6,"14:00","15:00","dance","น้องข้าวปุ้น"),
  C(6,"15:00","16:00","sing","น้องฟ้าใส"), C(6,"16:00","17:00","art","น้องมีโม่"),
];

function layoutDay(items){
  const evs = items.map(e=>({ ...e, _s:toMin(e.start), _e:toMin(e.end) }))
    .sort((a,b)=> a._s-b._s || a._e-b._e);
  const laneEnds = [];
  evs.forEach(ev=>{
    let placed=false;
    for(let i=0;i<laneEnds.length;i++){ if(laneEnds[i]<=ev._s){ laneEnds[i]=ev._e; ev._lane=i; placed=true; break; } }
    if(!placed){ ev._lane=laneEnds.length; laneEnds.push(ev._e); }
  });
  let cur=[], curEnd=-1;
  const flush=()=>{ const cols=Math.max(...cur.map(e=>e._lane))+1; cur.forEach(e=>e._cols=cols); cur=[]; curEnd=-1; };
  evs.forEach(ev=>{ if(cur.length && ev._s>=curEnd){ flush(); } cur.push(ev); curEnd=Math.max(curEnd,ev._e); });
  if(cur.length) flush();
  return evs;
}

const SLOT_TIMES = [];
for(let m=DAY_START; m<=DAY_END; m+=30){ SLOT_TIMES.push(`${String(Math.floor(m/60)).padStart(2,"0")}:${String(m%60).padStart(2,"0")}`); }

const TODAY = [
  { time:"13:00", end:"14:00", cat:"piano",  teacher:"ครูฟ้า", student:"น้องเตเต้",  room:"ห้องเปียโน",   status:"done" },
  { time:"14:30", end:"15:30", cat:"guitar", teacher:"ครูกาย", student:"น้องแทนคุณ", room:"ห้องกีตาร์",   status:"now"  },
  { time:"15:00", end:"16:00", cat:"sing",   teacher:"ครูมุก", student:"น้องฟ้าใส",  room:"ห้องร้องเพลง", status:"next" },
  { time:"16:30", end:"17:30", cat:"piano",  teacher:"ครูฟ้า", student:"น้องไทก้า",  room:"ห้องเปียโน",   status:"next" },
  { time:"18:00", end:"19:00", cat:"dance",  teacher:"ครูเจน", student:"น้องมินตรา", room:"สตูดิโอเต้น",  status:"next" },
];

const INVOICES = [
  { id:"INV-2606-008", student:"น้องเอม",     course:"ศิลปะ 10 ครั้ง · 1 ชม.",  amount:8500, date:"2026-06-01", method:"โอนเงิน",   status:"paid" },
  { id:"INV-2606-007", student:"น้องเซย่า",   course:"เปียโน 10 ครั้ง · 30 นาที", amount:5800, date:"2026-06-01", method:"บัตรเครดิต", status:"paid" },
  { id:"INV-2606-006", student:"น้องริว",     course:"เต้น 4 ครั้ง · 1 ชม.",     amount:3800, date:"2026-05-31", method:"เงินสด",    status:"paid" },
  { id:"INV-2606-005", student:"น้องแทนคุณ",  course:"กีตาร์ 4 ครั้ง · 1 ชม.",   amount:1900, date:"2026-05-30", method:"-",         status:"pending" },
  { id:"INV-2606-004", student:"น้องเฌอ",     course:"เปียโน 10 ครั้ง · 1 ชม.",  amount:8500, date:"2026-05-29", method:"-",         status:"pending" },
  { id:"INV-2606-003", student:"น้องพราว",    course:"ศิลปะ 10 ครั้ง · 1 ชม.",   amount:2400, date:"2026-05-22", method:"-",         status:"overdue" },
  { id:"INV-2606-002", student:"น้องแพรวา",   course:"เปียโน 10 ครั้ง · 30 นาที", amount:5800, date:"2026-05-20", method:"โอนเงิน",   status:"paid" },
  { id:"INV-2606-001", student:"น้องอินดี้",  course:"เปียโน 10 ครั้ง · 1 ชม.",  amount:8500, date:"2026-05-18", method:"บัตรเครดิต", status:"paid" },
];

const PAY_STATUS = {
  paid:                 { label:"ชำระแล้ว",    color:"var(--ok)",     soft:"var(--ok-soft)"   },
  pending:              { label:"รอชำระ",       color:"var(--warn)",   soft:"var(--warn-soft)" },
  pending_verification: { label:"รอตรวจสลิป",  color:"#7c3aed",       soft:"#ede9fe"          },
  overdue:              { label:"เกินกำหนด",   color:"var(--danger)", soft:"var(--danger-soft)"},
};

const REVENUE = [
  { m:"ธ.ค.", v:142000 }, { m:"ม.ค.", v:158000 }, { m:"ก.พ.", v:151000 },
  { m:"มี.ค.", v:174000 }, { m:"เม.ย.", v:182000 }, { m:"พ.ค.", v:196000 }, { m:"มิ.ย.", v:208500 },
];

const baht = (n)=> "฿" + n.toLocaleString("th-TH");

const TODAY_KEY = "2026-06-02";
const TODAY_LABEL = "อังคาร 2 มิถุนายน 2569";
const ATT_STATUS = {
  present: { label:"มาเรียน", color:"var(--ok)",     soft:"var(--ok-soft)" },
  leave:   { label:"ลา",       color:"var(--warn)",   soft:"var(--warn-soft)" },
  absent:  { label:"ขาด",      color:"var(--danger)", soft:"var(--danger-soft)" },
};
function loadAttendance(){ try{ return JSON.parse(localStorage.getItem(PFX+"attend")||"{}"); }catch(e){ return {}; } }
function saveAttendance(map){ localStorage.setItem(PFX+"attend", JSON.stringify(map)); }

const NOW_KEY = "2026-06-03";
const HW_STATUS = {
  pending: { label:"รอส่ง",    color:"var(--warn)",   soft:"var(--warn-soft)" },
  done:    { label:"ส่งแล้ว",  color:"var(--ok)",     soft:"var(--ok-soft)" },
};
const HOMEWORK_SEED = [
  { id:"h1", student:"น้องเตเต้",  cat:"piano", teacher:"ครูฟ้า", title:"ฝึกสเกล G เมเจอร์", detail:"เล่นขึ้น-ลง 2 อ็อกเตฟ วันละ 10 นาที", assigned:"2026-06-02", due:"2026-06-09", status:"pending", notified:true },
  { id:"h2", student:"น้องแทนคุณ", cat:"guitar",teacher:"ครูกาย", title:"จับคอร์ด G-C-D ให้คล่อง", detail:"เปลี่ยนคอร์ดตามจังหวะช้า", assigned:"2026-06-01", due:"2026-06-08", status:"pending", notified:false },
  { id:"h3", student:"น้องฟ้าใส",  cat:"sing",  teacher:"ครูมุก", title:"ฝึกหายใจ + วอร์มเสียง", detail:"อัดคลิปวอร์มเสียงส่งครู", assigned:"2026-05-28", due:"2026-06-02", status:"pending", notified:true },
  { id:"h4", student:"น้องมีโม่",  cat:"art",   teacher:"ครูพิม", title:"วาดภาพหุ่นนิ่ง", detail:"ใช้ดินสอ ลงน้ำหนักแสงเงา", assigned:"2026-05-30", due:"2026-06-06", status:"done", notified:true },
  { id:"h5", student:"น้องมินตรา", cat:"dance", teacher:"ครูเจน", title:"ซ้อมท่าชุดที่ 2", detail:"ซ้อมตามคลิป 15 นาที/วัน", assigned:"2026-06-01", due:"2026-06-07", status:"pending", notified:false },
  { id:"h6", student:"น้องเฌอ",    cat:"piano", teacher:"ครูฟ้า", title:"อ่านโน้ตบทที่ 4", detail:"อ่านให้คล่องก่อนเรียนครั้งหน้า", assigned:"2026-05-29", due:"2026-06-01", status:"done", notified:true },
];
let HOMEWORK = (()=>{ try{ const s=localStorage.getItem(PFX+"homework"); if(s) return JSON.parse(s); }catch(e){} return HOMEWORK_SEED.map(x=>({...x})); })();
function persistHW(){ localStorage.setItem(PFX+"homework", JSON.stringify(HOMEWORK)); }
function addHomework(hw){ HOMEWORK.unshift({ id:"h"+Date.now(), status:"pending", notified:false, assigned:NOW_KEY, ...hw }); persistHW(); }
function updateHomework(id, patch){ const h=HOMEWORK.find(x=>x.id===id); if(h){ Object.assign(h, patch); persistHW(); } }
const isOverdue = (hw)=> hw.status==="pending" && hw.due < NOW_KEY;

const REF_REWARD = 200;
const REF_FRIEND_BONUS = 100;
function refCode(name){
  const h = hashStr(name);
  return "MELO-" + String.fromCharCode(65+(h%26)) + String.fromCharCode(65+((h>>5)%26)) + (100+(h%900));
}
const REF_STATUS = {
  joined:  { label:"สมัคร+จ่ายแล้ว", color:"var(--ok)",     soft:"var(--ok-soft)",   paid:true },
  trial:   { label:"ทดลองเรียน",     color:"var(--warn)",   soft:"var(--warn-soft)", paid:false },
  invited: { label:"ส่งคำเชิญแล้ว",  color:"var(--text-3)", soft:"var(--surface-3)", paid:false },
};
const REFERRAL_SEED = [
  { id:"r1", referrer:"น้องเฌอ",    friend:"น้องพิงค์",   cat:"piano", status:"joined",  date:"2026-05-22", rewarded:true },
  { id:"r2", referrer:"น้องฟ้าใส",  friend:"คุณแม่อร",    cat:"sing",  status:"joined",  date:"2026-05-18", rewarded:true },
  { id:"r3", referrer:"น้องไทก้า",  friend:"น้องบีม",     cat:"piano", status:"trial",   date:"2026-05-30", rewarded:false },
  { id:"r4", referrer:"น้องมินตรา", friend:"น้องเอเชีย",  cat:"dance", status:"invited", date:"2026-06-01", rewarded:false },
  { id:"r5", referrer:"น้องมีโม่",  friend:"น้องวุ้นเส้น", cat:"art",   status:"trial",   date:"2026-05-28", rewarded:false },
  { id:"r6", referrer:"น้องแพรวา",  friend:"น้องเฟิร์น",  cat:"sing",  status:"invited", date:"2026-06-02", rewarded:false },
];
let REFERRALS = (()=>{ try{ const s=localStorage.getItem(PFX+"referrals"); if(s) return JSON.parse(s); }catch(e){} return REFERRAL_SEED.map(x=>({...x})); })();
function persistRef(){ localStorage.setItem(PFX+"referrals", JSON.stringify(REFERRALS)); }
function addReferral(ref){ REFERRALS.unshift({ id:"r"+Date.now(), status:"invited", rewarded:false, date:NOW_KEY, ...ref }); persistRef(); }
function setReferralStatus(id, status){
  const r = REFERRALS.find(x=>x.id===id); if(!r) return;
  r.status = status;
  if(status==="joined" && !r.rewarded){
    r.rewarded = true;
    const s = findStudent(r.referrer);
    if(s) updateStudent(s.id, { points: s.points + REF_REWARD });
  }
  persistRef();
}
function refStats(name){
  const mine = REFERRALS.filter(r=>r.referrer===name);
  return { total:mine.length, joined:mine.filter(r=>r.status==="joined").length,
    earned:mine.filter(r=>r.rewarded).length*REF_REWARD };
}

/* demo-mode reward points: floor at 0, mirror the live API shape ({ points }) */
function givePoints(id, delta, _reason){
  const s = STUDENTS.find(x=>x.id===id); if(!s) return Promise.resolve(null);
  s.points = Math.max(0, (s.points||0) + (Math.trunc(Number(delta))||0));
  updateStudent(id, { points: s.points });
  return Promise.resolve({ id, name:s.name, points:s.points });
}

/* demo-mode development assessments — kept in localStorage, mirror live API shapes */
let __ASSESS = (()=>{ try{ return JSON.parse(localStorage.getItem(PFX+"assess")||"{}"); }catch(e){ return {}; } })();
function __persistAssess(){ try{ localStorage.setItem(PFX+"assess", JSON.stringify(__ASSESS)); }catch(e){} }
function listAssessments(studentId){
  return Promise.resolve(((__ASSESS[studentId]||[]).slice()).sort((a,b)=> a.date<b.date?1:-1));
}
function addAssessment(studentId, payload){
  const rec = { id:'a'+Date.now(), category:payload.category||null, date:payload.date,
    scores:payload.scores||{}, note:payload.note||null, created_at:new Date().toISOString() };
  (__ASSESS[studentId] = __ASSESS[studentId]||[]).unshift(rec); __persistAssess();
  return Promise.resolve(rec);
}
function deleteAssessment(studentId, id){
  if(__ASSESS[studentId]) __ASSESS[studentId] = __ASSESS[studentId].filter(a=>a.id!==id);
  __persistAssess(); return Promise.resolve({ ok:true });
}

window.DATA = { SCHOOL, CATS, TEACHERS, TEACHER_BY_CAT, COURSES, STUDENTS, STATUS, DAYS, SCHEDULE, layoutDay,
  DAY_START, DAY_END, PX_PER_MIN, toMin, SLOT_TIMES, TODAY, INVOICES, PAY_STATUS, REVENUE, baht,
  PACKAGES_DEFAULT, loadPackages, savePackagePrice, NEAR_LIMIT, isNearEnding, nearEndingInfo,
  updateStudent, findStudent, TODAY_KEY, TODAY_LABEL, ATT_STATUS, loadAttendance, saveAttendance,
  TIERS, tierOf, givePoints, ASSESS_CRITERIA:{}, SHOW_ASSESS_PARENTS:false, SHOW_COURSE_NO_PARENTS:false, PAYMENT_QR_IMAGE:null, SCHOOL_LOGO:null, ENROLLMENTS:[],
  listAssessments, addAssessment, deleteAssessment, NOW_KEY, HW_STATUS, HOMEWORK, addHomework, updateHomework, isOverdue, setNearLimit,
  REF_REWARD, REF_FRIEND_BONUS, refCode, REF_STATUS, REFERRALS, addReferral, setReferralStatus, refStats,
  NAME_DISPLAY, setNameDisplay, dispName, PIPELINE_STAGES };
