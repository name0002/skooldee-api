/* ============ skooldee — Auth gate + App shell ============ */

/* ---- map API student object → DATA.STUDENTS format ---- */
function mapStudent(s){
  return {
    id:'s'+s.id, _dbId:s.id,
    name:s.name, full:s.name,
    nickname:s.nickname||null, age:s.age||'-',
    cats:(function(){ try{ if(s.categories_json){ var a=JSON.parse(s.categories_json); if(Array.isArray(a)&&a.length) return a; } }catch(e){} return s.category?[s.category]:[]; })(),
    category:s.category||null,
    teacher:s.teacher_name||'-',
    status:s.status||'active',
    balance:s.balance_due||0,
    pkg:s.sessions_total||0, dur:60,
    remaining:s.sessions_remaining||0,
    joined:(s.created_at||'').slice(0,10),
    phone:s.parent_phone||'-',
    guardian:s.parent_name||'-',
    line_id:s.line_id||null,
    lineLinked:!!s.line_user_id,
    lineName:s.line_display_name||null,
    points:s.points||0,
    referral_code:s.referral_code||null,
    parent_token:s.parent_token||null,
    goal:s.goal||null,
    email:s.email||null,
    birthday:s.birthday||null,
    recipient:s.recipient_type||'parent',
    packages:(function(){ try{ if(s.packages_json){ var a=JSON.parse(s.packages_json); if(Array.isArray(a)) return a; } }catch(e){} return []; })(),
  };
}

/* ---- map API schedule slot → DATA.TODAY format ---- */
function mapApiSlot(slot){
  var cat     = slot.category||'piano';
  var catData = DATA.CATS[cat]||Object.values(DATA.CATS)[0]||{};
  var stuArr  = slot.students||[];
  var stuName = slot.is_group && stuArr.length>1
    ? 'กลุ่ม ('+stuArr.length+' คน)' : stuArr.length ? stuArr[0].name : (slot.title||catData.label||cat);
  var now2 = new Date(); var nowMin2 = now2.getHours()*60+now2.getMinutes();
  var s = slot.start_min||0, e = slot.end_min||0;
  return {
    _slotId: slot.id, _studentDbIds: stuArr.map(function(x){ return x.id; }),
    _teacherDbId: slot.teacher_id||null,
    time: slot.start, end: slot.end, cat: cat,
    teacher: slot.teacher_name||'-', student: stuName,
    room: slot.room||catData.room||'-',
    status: nowMin2>=e ? 'done' : nowMin2>=s ? 'now' : 'next',
  };
}

/* ---- map API schedule slot → weekly DATA.SCHEDULE format ---- */
function mapApiWeekSlot(slot){
  var cat     = slot.category||'piano';
  var catData = DATA.CATS[cat]||Object.values(DATA.CATS)[0]||{};
  var stuArr  = slot.students||[];
  var stuName = slot.is_group && stuArr.length>1
    ? 'กลุ่ม ('+stuArr.length+' คน)' : stuArr.length ? stuArr[0].name : (slot.title||catData.label||cat);
  return {
    _slotId: slot.id,
    _studentDbIds: stuArr.map(function(x){ return x.id; }),
    _teacherDbId: slot.teacher_id||null,
    day: typeof slot.day_of_week==='number' ? slot.day_of_week : 0,
    start: slot.start||'10:00', end: slot.end||'11:00',
    _durationMin: (slot.end_min||0) - (slot.start_min||0),
    cat: cat,
    teacher: slot.teacher_name||'-', student: stuName,
    room: slot.room||catData.room||'-',
  };
}

/* ---- map API homework → DATA.HOMEWORK format ---- */
function mapApiHomework(hw){
  var stu = DATA.STUDENTS.find(function(s){ return s._dbId===hw.student_id; })||{};
  return {
    id:'h'+hw.id, _dbId:hw.id, _studentDbId:hw.student_id,
    student: hw.student_name||stu.name||'-',
    cat: stu.cats&&stu.cats[0]||'piano',
    teacher: stu.teacher||'-',
    title: hw.title||'-',
    detail: hw.detail||'-',
    due: hw.due_date||(new Date()).toISOString().slice(0,10),
    status: hw.status||'pending',
    notified: !!hw.notified,
    assigned: (hw.created_at||'').slice(0,10),
  };
}

/* ---- map API referral → DATA.REFERRALS format ---- */
function mapApiReferral(r){
  var stu = DATA.STUDENTS.find(function(s){ return s._dbId===r.referrer_student_id; })||{};
  return {
    id:'r'+r.id, _dbId:r.id, _referrerDbId:r.referrer_student_id,
    referrer: r.referrer_name||stu.name||'-',
    friend: r.friend_name||'-',
    phone: r.friend_phone||'-',
    cat: stu.cats&&stu.cats[0]||'piano',
    date: (r.created_at||'').slice(0,10),
    status: r.status==='subscribed'?'joined':r.status||'invited',
    rewarded: r.status==='subscribed',
    referralCode: r.referral_code||stu.referral_code||'',
  };
}

/* ---- Full-screen loader (used during token check + data fetch) ---- */
function AppLoader({ msg }){
  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
                  background:'var(--surface-2)', flexDirection:'column', gap:14 }}>
      <img src="/assets/logo-icon.svg" width="52" height="52" alt="skooldee"/>
      <div style={{ color:'var(--text-2)', fontSize:14 }}>{msg||'กำลังโหลด…'}</div>
    </div>
  );
}

/* ---- Login screen (+ forgot-password flow) ---- */
function LoginScreen({ onLogin }){
  const [mode,setMode]       = useState('login');   // 'login' | 'forgot' | 'sent'
  const [email,setEmail]     = useState('');
  const [pass,setPass]       = useState('');
  const [forgotEmail,setFE]  = useState('');
  const [busy,setBusy]       = useState(false);
  const [err,setErr]         = useState('');

  const inp = { width:'100%', padding:'10px 14px', borderRadius:10,
                border:'1.5px solid var(--border)', fontSize:14,
                background:'var(--surface)', color:'var(--text)',
                boxSizing:'border-box', outline:'none' };

  const submit = async(e)=>{
    e.preventDefault(); setBusy(true); setErr('');
    try{ await window.API.login(email, pass); onLogin(); }
    catch(ex){ setErr(ex.status===401?'อีเมลหรือรหัสผ่านไม่ถูกต้อง':'เกิดข้อผิดพลาด กรุณาลองใหม่'); setBusy(false); }
  };

  const sendReset = async(e)=>{
    e.preventDefault(); setBusy(true); setErr('');
    try{ await window.API.forgotPassword(forgotEmail); setMode('sent'); }
    catch(ex){ setErr('เกิดข้อผิดพลาด กรุณาลองใหม่'); }
    setBusy(false);
  };

  const Brand = ()=>(
    <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:28 }}>
      <img src="/assets/logo-icon.svg" width="38" height="38" alt="skooldee"/>
      <div>
        <div style={{ fontWeight:700, fontSize:18, fontFamily:'var(--ff-display)' }}>skooldee</div>
        <div style={{ fontSize:11.5, color:'var(--text-3)' }}>ระบบจัดการโรงเรียนกวดวิชา</div>
      </div>
    </div>
  );

  const card = { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:20,
                 padding:'36px 32px', width:'100%', maxWidth:400, boxShadow:'var(--shadow-lg)' };

  if(mode==='sent') return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--surface-2)', padding:20 }}>
      <div style={card}>
        <Brand/>
        <div style={{ textAlign:'center', padding:'8px 0 16px' }}>
          <div style={{ fontSize:40, marginBottom:12 }}>📧</div>
          <div style={{ fontWeight:700, fontSize:17, marginBottom:8 }}>ตรวจสอบอีเมลของคุณ</div>
          <div style={{ color:'var(--text-2)', fontSize:13.5, lineHeight:1.6 }}>
            หากอีเมล <b>{forgotEmail}</b> มีบัญชีในระบบ เราได้ส่งลิงก์รีเซ็ตรหัสผ่านให้แล้ว
          </div>
        </div>
        <button className="btn" style={{ width:'100%', marginTop:16 }} onClick={()=>setMode('login')}>
          กลับหน้าเข้าสู่ระบบ
        </button>
      </div>
    </div>
  );

  if(mode==='forgot') return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--surface-2)', padding:20 }}>
      <div style={card}>
        <Brand/>
        <div style={{ fontWeight:700, fontSize:19, marginBottom:5 }}>ลืมรหัสผ่าน?</div>
        <div style={{ color:'var(--text-2)', fontSize:13.5, marginBottom:22 }}>ใส่อีเมลที่ใช้ลงทะเบียน แล้วเราจะส่งลิงก์รีเซ็ตให้</div>
        <form onSubmit={sendReset}>
          <div style={{ marginBottom:16 }}>
            <label style={{ display:'block', fontWeight:600, fontSize:13, marginBottom:6 }}>อีเมล</label>
            <input type="email" required autoFocus value={forgotEmail} onChange={e=>setFE(e.target.value)}
              placeholder="your@school.com" style={inp}/>
          </div>
          {err && <div style={{ background:'var(--danger-soft)', color:'var(--danger)', borderRadius:8, padding:'9px 13px', fontSize:13, marginBottom:12 }}>{err}</div>}
          <button type="submit" disabled={busy} className="btn btn-primary"
            style={{ width:'100%', padding:'11px', fontSize:14.5, fontWeight:700 }}>
            {busy?'กำลังส่ง…':'ส่งลิงก์รีเซ็ตรหัสผ่าน'}
          </button>
        </form>
        <div style={{ textAlign:'center', marginTop:16, fontSize:13 }}>
          <button style={{ border:0, background:'none', color:'var(--primary)', cursor:'pointer', fontWeight:600 }}
            onClick={()=>{ setMode('login'); setErr(''); }}>
            ← กลับหน้าเข้าสู่ระบบ
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
                  background:'var(--surface-2)', padding:20 }}>
      <div style={card}>
        <Brand/>
        <div style={{ fontWeight:700, fontSize:20, marginBottom:6 }}>เข้าสู่ระบบ</div>
        <div style={{ color:'var(--text-2)', fontSize:13.5, marginBottom:22 }}>ใส่อีเมลและรหัสผ่านของบัญชีโรงเรียน</div>
        <form onSubmit={submit}>
          <div style={{ marginBottom:14 }}>
            <label style={{ display:'block', fontWeight:600, fontSize:13, marginBottom:6 }}>อีเมล</label>
            <input type="email" required value={email} onChange={e=>setEmail(e.target.value)}
              placeholder="your@school.com" autoComplete="email" style={inp}/>
          </div>
          <div style={{ marginBottom:18 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
              <label style={{ fontWeight:600, fontSize:13 }}>รหัสผ่าน</label>
              <button type="button" onClick={()=>{ setMode('forgot'); setFE(email); setErr(''); }}
                style={{ border:0, background:'none', fontSize:12, color:'var(--primary)', cursor:'pointer', padding:0 }}>
                ลืมรหัสผ่าน?
              </button>
            </div>
            <input type="password" required value={pass} onChange={e=>setPass(e.target.value)}
              placeholder="••••••••" autoComplete="current-password" style={inp}/>
          </div>
          {err && <div style={{ background:'var(--danger-soft)', color:'var(--danger)', borderRadius:8,
                                padding:'9px 13px', fontSize:13, marginBottom:14 }}>{err}</div>}
          <button type="submit" disabled={busy} className="btn btn-primary"
            style={{ width:'100%', padding:'12px', fontSize:15, fontWeight:700 }}>
            {busy?'กำลังเข้าสู่ระบบ…':'เข้าสู่ระบบ'}
          </button>
        </form>
        <div style={{ textAlign:'center', marginTop:18, fontSize:13, color:'var(--text-2)' }}>
          ยังไม่มีบัญชี?{' '}
          <a href="signup.html" style={{ color:'var(--primary)', fontWeight:600 }}>สมัครใช้งานฟรี</a>
          {' · '}
          <a href="demo.html" style={{ color:'var(--text-3)' }}>ดูตัวอย่าง</a>
        </div>
      </div>
    </div>
  );
}

/* ---- AuthRoot — manages login → data hydration → renders App ---- */
function AuthRoot(){
  // phase: 'check' | 'login' | 'reset' | 'loading' | 'ready' | 'error'
  const [resetToken] = useState(()=> new URLSearchParams(window.location.search).get('reset')||'');
  const [phase,setPhase] = useState(()=>{
    if(new URLSearchParams(window.location.search).get('reset')) return 'reset';
    return window.API.getToken() ? 'check' : 'login';
  });
  const [msg,setMsg]     = useState('กำลังตรวจสอบบัญชี…');

  // On first mount, verify stored token
  React.useEffect(()=>{ if(phase==='check') verify(); },[]);

  async function verify(){
    try{
      setMsg('กำลังตรวจสอบบัญชี…');
      const { user, school } = await window.API.me();
      await hydrate(school, user);
    } catch(ex){
      setPhase(ex.status===401 ? 'login' : 'error');
    }
  }

  async function hydrate(school, user){
    setPhase('loading'); setMsg('กำลังโหลดข้อมูล…');
    try{
      /* -- load all data in parallel -- */
      const dow = (new Date().getDay()+6)%7; // Mon=0..Sun=6
      const [students, dashboard, todaySlots, invoices, teachers, revenueHistory, homeworkRows, referralRows, weekSlots, packagesData, exceptionRows] = await Promise.all([
        window.API.students(),
        window.API.dashboard(),
        window.API.req('/api/schedule?day='+dow),
        window.API.invoices().catch(()=>[]),   // finance is role-gated → teachers get [] instead of failing hydrate
        window.API.teachers().catch(()=>[]),
        window.API.revenue(7).catch(()=>null),
        window.API.homework().catch(()=>[]),
        window.API.referrals().catch(()=>[]),
        window.API.schedule().catch(()=>[]),   // full weekly schedule
        window.API.packages().catch(()=>[]),   // course packages
        // guard against a stale cached api.js that predates this function
        (window.API.scheduleExceptions ? window.API.scheduleExceptions() : Promise.resolve([])).catch(()=>[]),
      ]);

      // pending enrollment requests — owner/admin only; silently ignored for other roles
      const canManage = ['owner','admin'].includes((user&&user.role)||'');
      DATA.ENROLLMENTS = canManage
        ? await window.API.enrollments('pending').catch(()=>[])
        : [];

      /* -- store raw school & user for Settings screen -- */
      DATA._schoolRaw = { ...school };
      DATA._userRaw   = { ...user };
      DATA._isPlatformAdmin = !!(user && user.is_platform_admin);
      // effective access control (resolved server-side): { scope, pages:{ pageId: none|view|manage } }
      DATA._perms = (user && user.permissions && typeof user.permissions==='object')
        ? user.permissions
        : { scope:'all', pages:{} }; // fallback: full access (owner) until /me provides perms
      DATA.NAME_DISPLAY = ['nick','both'].includes(school.name_display) ? school.name_display : 'full';
      // development-assessment rubric + parent-visibility toggle
      try{ DATA.ASSESS_CRITERIA = school.assessment_criteria_json
            ? (typeof school.assessment_criteria_json==='string' ? JSON.parse(school.assessment_criteria_json) : school.assessment_criteria_json)
            : {}; }catch(e){ DATA.ASSESS_CRITERIA = {}; }
      DATA.SHOW_ASSESS_PARENTS = !!school.show_assessments_to_parents;
      DATA.SHOW_COURSE_NO_PARENTS = !!school.show_course_no_to_parents;
      DATA.PAYMENT_QR_IMAGE = school.payment_qr_image || null;
      DATA.SCHOOL_LOGO = school.logo_image || null;
      // business hours → drive the schedule grid + time pickers
      if(school.hours_start!=null && school.hours_end!=null && school.hours_end>school.hours_start){
        DATA.DAY_START = school.hours_start;
        DATA.DAY_END   = school.hours_end;
        const _st=[]; for(let m=DATA.DAY_START; m<=DATA.DAY_END; m+=30){ _st.push(String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0')); }
        DATA.SLOT_TIMES = _st;
      }

      /* -- override DATA.CATS from school's custom categories (if set) -- */
      if(school.categories_json){
        try{
          const raw = typeof school.categories_json==='string'
            ? JSON.parse(school.categories_json) : school.categories_json;
          if(Array.isArray(raw) && raw.length){
            const built = {};
            raw.forEach(function(c){
              built[c.key] = { key:c.key, label:c.label, color:c.color,
                soft: c.color+'22', icon:c.icon||'📚', room:c.room||(c.label+'ห้อง') };
            });
            DATA.CATS = built;
          }
        }catch(e){}
      }

      /* -- wire saveCategories → PATCH /api/schools -- */
      DATA.saveCategories = async function(catsArray){
        const updated = await window.API.updateSchool({ categories_json: catsArray });
        if(updated.categories_json){
          try{
            const raw = typeof updated.categories_json==='string'
              ? JSON.parse(updated.categories_json) : updated.categories_json;
            const built = {};
            raw.forEach(function(c){
              built[c.key] = { key:c.key, label:c.label, color:c.color,
                soft:c.color+'22', icon:c.icon||'📚', room:c.room||(c.label+'ห้อง') };
            });
            DATA.CATS = built;
          }catch(e){}
        }
        bumpData();
      };

      /* -- override DATA.SCHOOL -- */
      DATA.SCHOOL = {
        name: school.name,
        sub: school.category||'โรงเรียนกวดวิชา',
        mark: (school.name||'S')[0].toUpperCase(),
        owner: user.name||user.email,
        ownerRole: ({owner:'เจ้าของ',admin:'ผู้ดูแล',teacher:'ครูผู้สอน',finance:'การเงิน'})[user.role]||'ผู้ใช้งาน',
      };

      /* -- override DATA.STUDENTS -- */
      DATA.STUDENTS = students.map(mapStudent);
      DATA.reloadStudents = async function(){
        const fresh = await window.API.students();
        DATA.STUDENTS = fresh.map(mapStudent);
        bumpData();
      };

      /* -- override DATA.TEACHERS (always in live mode, empty array for new schools) -- */
      DATA.TEACHERS = (Array.isArray(teachers)?teachers:[]).map(t=>({
        id:t.id, _dbId:t.id, nick:t.name, name:t.name,
        cats:(function(){ try{ if(t.categories_json){ var a=JSON.parse(t.categories_json); if(Array.isArray(a)&&a.length) return a; } }catch(e){} return t.category?[t.category]:[]; })(),
        rate:t.hourly_rate||0, hours:0,
        phone:t.phone||'-', color:'#009488',
        students:DATA.STUDENTS.filter(s=>s.teacher===t.name).length,
      }));

      /* -- override DATA.TODAY with today's real schedule -- */
      const now = new Date();
      const thaiDayName = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
      const thaiMon     = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
      const todayStr  = now.toISOString().slice(0,10);
      DATA.TODAY_KEY   = todayStr;
      DATA.TODAY_LABEL = `${thaiDayName[now.getDay()]} ${now.getDate()} ${thaiMon[now.getMonth()]} ${now.getFullYear()+543}`;
      DATA.TODAY = (Array.isArray(todaySlots) ? todaySlots : []).map(mapApiSlot);

      /* -- store day-of-week (Mon=0) and week start date for Schedule screen -- */
      DATA._todayDow = dow;
      const _wkStart = new Date(now); _wkStart.setDate(now.getDate() - dow); _wkStart.setHours(0,0,0,0);
      DATA._weekStart = _wkStart;

      /* -- override DATA.SCHEDULE with full weekly schedule from API -- */
      DATA.SCHEDULE = (Array.isArray(weekSlots)?weekSlots:[]).map(mapApiWeekSlot);

      /* -- date-specific schedule exceptions (cancel / makeup) -- */
      const _hhmm = (m)=> m==null ? null : String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
      const mapExc = (e)=>({
        id:e.id, _dbId:e.id, slot_id:e.slot_id, date:e.date, type:e.type,
        student_id:e.student_id, teacher_id:e.teacher_id, cat:e.category,
        start_min:e.start_min, end_min:e.end_min,
        start: e.start!=null?e.start:_hhmm(e.start_min), end: e.end!=null?e.end:_hhmm(e.end_min),
        note:e.note,
        student: e.student_nick||e.student_name||(DATA.STUDENTS.find(s=>s._dbId===e.student_id)||{}).name||'-',
        teacher: e.teacher_name||(DATA.TEACHERS.find(t=>t._dbId===e.teacher_id)||{}).nick||'-',
      });
      DATA.EXCEPTIONS = (Array.isArray(exceptionRows)?exceptionRows:[]).map(mapExc);
      DATA.addException = async function(payload){
        const e = await window.API.addException(payload);
        DATA.EXCEPTIONS.push(mapExc(e));
        bumpData(); return e;
      };
      DATA.deleteException = async function(id){
        const ex = DATA.EXCEPTIONS.find(x=>x._dbId===id||x.id===id);
        if(ex&&ex._dbId) await window.API.deleteException(ex._dbId);
        DATA.EXCEPTIONS = DATA.EXCEPTIONS.filter(x=>x!==ex);
        bumpData();
      };

      /* -- calculate teacher hours from weekly schedule (4 weeks/month estimate) -- */
      const WEEKS_PER_MONTH = 4;
      DATA.TEACHERS.forEach(function(t){
        var tSlots = DATA.SCHEDULE.filter(function(s){ return s.teacher===t.name||s.teacher===t.nick; });
        var weeklyMin = tSlots.reduce(function(sum,s){ return sum+(s._durationMin||0); }, 0);
        t.hours = parseFloat((weeklyMin * WEEKS_PER_MONTH / 60).toFixed(1));
      });

      /* -- override DATA.PACKAGES with real packages from API -- */
      DATA.PACKAGES = (Array.isArray(packagesData)?packagesData:[]).map(function(p){
        return {
          _dbId: p.id, id: 'pkg'+p.id,
          name: p.name||('คอร์ส '+p.sessions+' ครั้ง'),
          sessions: p.sessions||10,
          duration_min: p.duration_min||60,
          dur: p.duration_min||60,
          price: p.price||0,
          is_default: !!p.is_default,
          sort: p.sort||0,
        };
      });

      /* -- override DATA.INVOICES with real invoices -- */
      DATA.INVOICES = (Array.isArray(invoices)?invoices:[]).map(inv=>({
        id: 'INV-'+String(inv.id).padStart(4,'0'),
        _dbId: inv.id,
        _studentDbId: inv.student_id||null,
        _packageDbId: inv.package_id||null,
        student: inv.student_name||'-',
        course: inv.package_name||inv.note||'คอร์สเรียน',
        amount: inv.amount,
        subtotal: inv.subtotal!=null?inv.subtotal:inv.amount,
        discount_type: inv.discount_type||null,
        discount_value: inv.discount_value||0,
        payment_method: inv.payment_method||'transfer',
        has_slip: !!inv.has_slip,
        date: (inv.issued_at||'').slice(0,10),
        paid_at: (inv.paid_at||'').slice(0,10)||null,
        category: inv.category||null,
        method: { transfer:'โอนเงิน', cash:'เงินสด', qr:'QR Code', card:'บัตรเครดิต' }[inv.payment_method]||inv.payment_method||'-',
        status: inv.status==='paid'?'paid' : inv.status==='unpaid'?'pending' : inv.status,
      }));

      /* -- override DATA.HOMEWORK with real homework from API -- */
      DATA.HOMEWORK = (Array.isArray(homeworkRows)?homeworkRows:[]).map(mapApiHomework);

      /* -- override DATA.REFERRALS with real referrals from API -- */
      DATA.REFERRALS = (Array.isArray(referralRows)?referralRows:[]).map(mapApiReferral);

      /* -- update revenue history (7-month bar chart) -- */
      if(Array.isArray(revenueHistory) && revenueHistory.length){
        DATA.REVENUE = revenueHistory.map(r=>({ m:r.label, v:r.revenue }));
      } else if(dashboard.kpis && dashboard.kpis.revenue_month!=null){
        DATA.REVENUE[DATA.REVENUE.length-1].v = dashboard.kpis.revenue_month;
        DATA.REVENUE[DATA.REVENUE.length-1].m = thaiMon[now.getMonth()];
      }

      /* -- wire updateStudent → API -- */
      DATA.updateStudent = async function(id, patch){
        const s = DATA.STUDENTS.find(x=>x.id===id); if(!s) return;
        Object.assign(s, patch);
        if('categories' in patch){ s.cats = patch.categories.slice(); s.category = patch.categories[0]||null; }
        const ap = {};
        if('remaining' in patch) ap.sessions_remaining = patch.remaining;
        if('status'    in patch) ap.status    = patch.status;
        if('balance'   in patch) ap.balance_due = patch.balance;
        if('points'    in patch) ap.points    = patch.points;
        if('age'       in patch) ap.age       = patch.age;
        if('birthday'  in patch) ap.birthday  = patch.birthday;
        if('phone'     in patch) ap.parent_phone = patch.phone;
        if('guardian'  in patch) ap.parent_name  = patch.guardian==='-'?null:patch.guardian;
        if('pkg'       in patch) ap.sessions_total = patch.pkg;
        if('categories' in patch) ap.categories = patch.categories;
        if('name'      in patch) ap.name      = patch.name;
        if('nickname'  in patch) ap.nickname  = patch.nickname;
        if('goal'      in patch) ap.goal      = patch.goal;
        if('email'     in patch) ap.email     = patch.email;
        if('recipient' in patch) ap.recipient_type = patch.recipient;
        if('packages'  in patch){ ap.packages = patch.packages;
          s.packages = patch.packages.slice();
          s.remaining = patch.packages.reduce((a,p)=>a+(Number(p.sessions_remaining)||0),0);
          s.pkg = patch.packages.reduce((a,p)=>a+(Number(p.sessions_total)||0),0);
        }
        if(Object.keys(ap).length) window.API.patchStudent(s._dbId, ap).catch(console.warn);
        bumpData();
      };

      /* -- wire addStudent → API -- */
      DATA.addStudent = async function(payload){
        const newS = await window.API.createStudent(payload);
        DATA.STUDENTS.push(mapStudent(newS));
        bumpData();
        return newS;
      };

      /* -- wire importStudents → POST /api/students/bulk -- */
      DATA.importStudents = async function(rows){
        const res = await window.API.bulkStudents({ students: rows });
        (res.students||[]).forEach(s=>DATA.STUDENTS.push(mapStudent(s)));
        bumpData();
        return res.created||0;
      };

      /* -- wire deleteStudent → DELETE /api/students/:id -- */
      DATA.deleteStudent = async function(id){
        const stu = DATA.STUDENTS.find(function(x){ return x.id===id; });
        if(!stu) return;
        await window.API.deleteStudent(stu._dbId);
        DATA.STUDENTS = DATA.STUDENTS.filter(function(x){ return x.id!==id; });
        bumpData();
      };

      /* -- wire givePoints → POST /api/points (manual reward / deduct) -- */
      DATA.givePoints = async function(id, delta, reason){
        const stu = DATA.STUDENTS.find(function(x){ return x.id===id; });
        if(!stu) return;
        const updated = await window.API.givePoints({ student_id: stu._dbId, delta: delta, reason: reason });
        stu.points = updated.points;            // server is source of truth (floored at 0, clamped)
        bumpData();
        return updated;
      };

      /* -- development assessments (skill scores) → /api/assessments. all keyed by
            the student's FRONTEND id; we resolve _dbId here so the UI stays uniform -- */
      DATA.listAssessments = function(studentId){
        const stu = DATA.STUDENTS.find(function(x){ return x.id===studentId; });
        return stu && stu._dbId ? window.API.assessments(stu._dbId) : Promise.resolve([]);
      };
      DATA.addAssessment = async function(studentId, payload){
        const stu = DATA.STUDENTS.find(function(x){ return x.id===studentId; });
        if(!stu) return;
        return window.API.addAssessment({ student_id: stu._dbId, ...payload });
      };
      DATA.deleteAssessment = function(_studentId, id){ return window.API.deleteAssessment(id); };

      /* -- staff (teacher) evaluations → /api/staff-evaluations. templates are school-wide;
            evaluation records are keyed by the teacher's FRONTEND id, resolved to _dbId here -- */
      DATA.evalTemplates = function(){ return window.API.evalTemplates(); };
      DATA.addEvalTemplate = function(payload){ return window.API.addEvalTemplate(payload); };
      DATA.patchEvalTemplate = function(id, payload){ return window.API.patchEvalTemplate(id, payload); };
      DATA.deleteEvalTemplate = function(id){ return window.API.deleteEvalTemplate(id); };
      DATA.listEvaluations = function(teacherId){
        const t = DATA.TEACHERS.find(function(x){ return x.id===teacherId; });
        return t && t._dbId ? window.API.staffEvaluations(t._dbId) : Promise.resolve([]);
      };
      DATA.submitEvaluation = function(teacherId, templateId, payload){
        const t = DATA.TEACHERS.find(function(x){ return x.id===teacherId; });
        if(!t) return Promise.resolve(null);
        return window.API.submitEvaluation(templateId, { teacher_id: t._dbId, ...payload });
      };
      DATA.deleteEvaluation = function(_teacherId, id){ return window.API.deleteEvaluation(id); };
      /* -- save rubric / parent-visibility via PATCH /api/schools -- */
      DATA.saveCriteria = async function(critObj){
        await DATA.updateSchool({ assessment_criteria_json: critObj });
        DATA.ASSESS_CRITERIA = critObj || {};
        bumpData();
      };
      DATA.setShowAssessParents = async function(on){
        await DATA.updateSchool({ show_assessments_to_parents: !!on });
        DATA.SHOW_ASSESS_PARENTS = !!on;
        bumpData();
      };
      DATA.setShowCourseNoParents = async function(on){
        await DATA.updateSchool({ show_course_no_to_parents: !!on });
        DATA.SHOW_COURSE_NO_PARENTS = !!on;
        bumpData();
      };

      /* -- wire attendance → API (fire-and-forget, localStorage still works as cache) -- */
      DATA._isLiveMode = true;
      DATA._todayStr   = todayStr;

      /* -- wire refreshToday: re-fetch today's schedule -- */
      DATA.refreshToday = async function(){
        const d2 = (new Date().getDay()+6)%7;
        const slots = await window.API.req('/api/schedule?day='+d2);
        DATA.TODAY = (Array.isArray(slots)?slots:[]).map(mapApiSlot);
        bumpData();
      };

      /* -- wire deleteScheduleSlot → DELETE /api/schedule/:id -- */
      DATA.deleteScheduleSlot = async function(slotId){
        await window.API.req('/api/schedule/'+slotId, {method:'DELETE'});
        DATA.SCHEDULE = DATA.SCHEDULE.filter(function(s){ return s._slotId!==slotId; });
        DATA.TODAY    = DATA.TODAY.filter(function(s){ return s._slotId!==slotId; });
        bumpData();
      };

      /* -- wire updateScheduleSlot → PATCH /api/schedule/:id (drag-to-reschedule, permanent) -- */
      DATA.updateScheduleSlot = async function(slotId, patch){
        const updated = await window.API.req('/api/schedule/'+slotId, {method:'PATCH', body:JSON.stringify(patch)});
        const mapped = mapApiWeekSlot(updated);
        DATA.SCHEDULE = DATA.SCHEDULE.map(function(s){ return s._slotId===slotId ? mapped : s; });
        const todayDow = (new Date().getDay()+6)%7;
        if(mapped.day===todayDow || patch.day_of_week===todayDow) await DATA.refreshToday();
        else bumpData();
        return updated;
      };

      /* -- wire addScheduleSlot → POST /api/schedule -- */
      DATA.addScheduleSlot = async function(payload){
        const newSlot = await window.API.req('/api/schedule',{method:'POST',body:JSON.stringify(payload)});
        // push into weekly schedule immediately
        DATA.SCHEDULE.push(mapApiWeekSlot(newSlot));
        const todayDow = (new Date().getDay()+6)%7;
        if(payload.day_of_week===todayDow) await DATA.refreshToday();
        else bumpData();
        return newSlot;
      };

      /* -- wire addTeacher / patchTeacher / deleteTeacher -- */
      DATA.addTeacher = async function(payload){
        const t = await window.API.addTeacher(payload);
        DATA.TEACHERS.push({ id:t.id, _dbId:t.id, nick:t.name, name:t.name,
          cats:(function(){ try{ if(t.categories_json){ var a=JSON.parse(t.categories_json); if(Array.isArray(a)&&a.length) return a; } }catch(e){} return t.category?[t.category]:[]; })(),
          rate:t.hourly_rate||0, hours:0,
          phone:t.phone||'-', color:'#009488', students:0 });
        bumpData(); return t;
      };
      DATA.patchTeacher = async function(dbId, apiPatch, localPatch){
        await window.API.patchTeacher(dbId, apiPatch);
        const t = DATA.TEACHERS.find(x=>x._dbId===dbId||x.id===dbId);
        if(t) Object.assign(t, localPatch||{});
        bumpData();
      };
      DATA.deleteTeacher = async function(dbId){
        await window.API.deleteTeacher(dbId);
        DATA.TEACHERS = DATA.TEACHERS.filter(x=>x._dbId!==dbId&&x.id!==dbId);
        bumpData();
      };

      /* -- wire createInvoice → POST /api/finance/invoices -- */
      DATA.createInvoice = async function(payload){
        const inv = await window.API.createInvoice(payload);
        DATA.INVOICES.unshift({
          id:'INV-'+String(inv.id).padStart(4,'0'), _dbId:inv.id,
          _studentDbId: payload.student_id||null,
          _packageDbId: payload.package_id||null,
          student:payload._studentName||'-',
          course:payload.note||'คอร์สเรียน',
          amount:inv.amount,
          subtotal:inv.subtotal!=null?inv.subtotal:inv.amount,
          discount_type:inv.discount_type||null,
          discount_value:inv.discount_value||0,
          payment_method:inv.payment_method||payload.payment_method||'transfer',
          date:new Date().toISOString().slice(0,10),
          method:{ transfer:'โอนเงิน', cash:'เงินสด', qr:'QR Code', card:'บัตรเครดิต' }[inv.payment_method||payload.payment_method]||'-',
          status:'pending',
        });
        bumpData();
        return inv;
      };

      /* -- wire deleteInvoice → DELETE /api/finance/invoices/:id -- */
      DATA.deleteInvoice = async function(localInv){
        if(localInv._dbId) await window.API.deleteInvoice(localInv._dbId);
        DATA.INVOICES = DATA.INVOICES.filter(x=>x!==localInv && x._dbId!==localInv._dbId);
        bumpData();
      };

      /* -- wire updateInvoice → PATCH /api/finance/invoices/:id -- */
      DATA.updateInvoice = async function(localInv, payload){
        const inv = await window.API.patchInvoice(localInv._dbId, payload);
        const row = DATA.INVOICES.find(x=>x._dbId===localInv._dbId);
        if(row){
          Object.assign(row, {
            _studentDbId: inv.student_id||row._studentDbId,
            _packageDbId: inv.package_id||null,
            student: payload._studentName||row.student,
            course: inv.note||row.course,
            amount: inv.amount,
            subtotal: inv.subtotal!=null?inv.subtotal:inv.amount,
            discount_type: inv.discount_type||null,
            discount_value: inv.discount_value||0,
            payment_method: inv.payment_method||row.payment_method,
            method:{ transfer:'โอนเงิน', cash:'เงินสด', qr:'QR Code', card:'บัตรเครดิต' }[inv.payment_method]||inv.payment_method||'-',
          });
        }
        bumpData();
        return inv;
      };

      /* -- wire addHomework / updateHomework → /api/homework -- */
      DATA.addHomework = async function(payload){
        // Optimistic insert so the UI updates before API responds
        const tempId = 'h'+Date.now();
        const temp = {
          id:tempId, _dbId:null, _studentDbId:payload._studentDbId,
          student:payload.student||'-', cat:payload.cat||'piano',
          teacher:payload.teacher||'-', title:payload.title||'-',
          detail:payload.detail||'-', due:payload.due||new Date().toISOString().slice(0,10),
          status:'pending', notified:payload.notified||false,
          assigned:new Date().toISOString().slice(0,10),
        };
        DATA.HOMEWORK.unshift(temp);
        try{
          const hw = await window.API.addHomework({
            student_id: payload._studentDbId,
            title: payload.title,
            detail: payload.detail && payload.detail!=='-' ? payload.detail : null,
            due_date: payload.due||null,
            notify: payload.notified||false,
          });
          const idx = DATA.HOMEWORK.findIndex(x=>x.id===tempId);
          if(idx>=0) DATA.HOMEWORK[idx] = mapApiHomework({...hw, student_name:payload.student});
          bumpData();
        }catch(ex){
          DATA.HOMEWORK = DATA.HOMEWORK.filter(x=>x.id!==tempId);
          bumpData(); console.error('[addHomework]', ex);
        }
      };

      DATA.updateHomework = function(id, patch){
        const hw = DATA.HOMEWORK.find(x=>x.id===id); if(!hw) return;
        Object.assign(hw, patch);
        if(hw._dbId){
          const ap = {};
          if('status' in patch) ap.status = patch.status;
          if('notified' in patch) ap.notified = patch.notified ? 1 : 0;
          if(Object.keys(ap).length) window.API.patchHomework(hw._dbId, ap).catch(console.warn);
        }
      };

      DATA.deleteHomework = async function(id){
        const hw = DATA.HOMEWORK.find(x=>x.id===id); if(!hw) return;
        DATA.HOMEWORK = DATA.HOMEWORK.filter(x=>x.id!==id);
        bumpData();
        if(hw._dbId) window.API.deleteHomework(hw._dbId).catch(console.warn);
      };

      /* -- wire addReferral / setReferralStatus → /api/referrals -- */
      DATA.addReferral = async function(payload){
        const tempId = 'r'+Date.now();
        const temp = {
          id:tempId, _dbId:null, _referrerDbId:payload._referrerDbId,
          referrer:payload.referrer||'-', friend:payload.friend||'-',
          phone:payload.phone||'-', cat:payload.cat||'piano',
          date:new Date().toISOString().slice(0,10),
          status:'invited', rewarded:false,
        };
        DATA.REFERRALS.unshift(temp);
        try{
          const r = await window.API.addReferral({
            referrer_student_id: payload._referrerDbId,
            friend_name: payload.friend,
            friend_phone: payload.phone||null,
          });
          const idx = DATA.REFERRALS.findIndex(x=>x.id===tempId);
          if(idx>=0) DATA.REFERRALS[idx] = mapApiReferral({...r, referrer_name:payload.referrer});
          bumpData();
        }catch(ex){
          DATA.REFERRALS = DATA.REFERRALS.filter(x=>x.id!==tempId);
          bumpData(); console.error('[addReferral]', ex);
        }
      };

      DATA.setReferralStatus = function(id, nextStatus){
        const ref = DATA.REFERRALS.find(x=>x.id===id); if(!ref) return;
        ref.status = nextStatus;
        if(nextStatus==='joined'){
          ref.rewarded = true;
          const stu = DATA.STUDENTS.find(s=>s.name===ref.referrer);
          if(stu) stu.points = (stu.points||0) + DATA.REF_REWARD;
        }
        if(ref._dbId){
          const apiStatus = nextStatus==='joined' ? 'subscribed' : nextStatus;
          window.API.patchReferral(ref._dbId, {status:apiStatus}).catch(console.warn);
        }
      };

      /* -- wire package CRUD → /api/packages -- */
      DATA.addPackage = async function(payload){
        const p = await window.API.addPackage(payload);
        DATA.PACKAGES.push({
          _dbId:p.id, id:'pkg'+p.id,
          name:p.name||('คอร์ส '+p.sessions+' ครั้ง'),
          sessions:p.sessions||10, duration_min:p.duration_min||60,
          dur:p.duration_min||60, price:p.price||0,
          is_default:!!p.is_default, sort:p.sort||0,
        });
        bumpData();
      };
      DATA.updatePackage = async function(dbId, patch){
        const updated = await window.API.patchPackage(dbId, patch);
        const p = DATA.PACKAGES.find(function(x){ return x._dbId===dbId; });
        if(p) Object.assign(p, {
          price: updated.price!=null ? updated.price : (patch.price||p.price),
          name:  updated.name  ||patch.name  ||p.name,
        });
        bumpData();
      };
      DATA.deletePackage = async function(dbId){
        await window.API.deletePackage(dbId);
        DATA.PACKAGES = DATA.PACKAGES.filter(function(x){ return x._dbId!==dbId; });
        bumpData();
      };

      /* -- wire updateSchool → PATCH /api/schools -- */
      DATA.updateSchool = async function(patch){
        const updated = await window.API.updateSchool(patch);
        DATA._schoolRaw = { ...DATA._schoolRaw, ...updated };
        if(updated.name){
          DATA.SCHOOL.name = updated.name;
          DATA.SCHOOL.mark = updated.name[0].toUpperCase();
        }
        if(updated.category!==undefined)
          DATA.SCHOOL.sub = updated.category||'โรงเรียนกวดวิชา';
        if(updated.near_limit_threshold)
          DATA.setNearLimit(updated.near_limit_threshold);
        bumpData();
        return updated;
      };

      /* -- wire updateProfile → PATCH /api/auth/profile -- */
      DATA.updateProfile = async function(patch){
        await window.API.updateProfile(patch);
        if(patch.name){
          DATA._userRaw.name = patch.name;
          DATA.SCHOOL.owner = patch.name;
        }
        if('phone' in patch) DATA._userRaw.phone = patch.phone || null;
        bumpData();
      };

      const origSaveAtt = DATA.saveAttendance;
      DATA.saveAttendance = function(map){
        origSaveAtt(map); // keep localStorage backup
        const dayMap = (map||{})[todayStr]||{};
        Object.entries(dayMap).forEach(([idx,status])=>{
          const slot = DATA.TODAY[idx]; if(!slot||!slot._studentDbIds) return;
          slot._studentDbIds.forEach(dbId=>{
            window.API.req('/api/attendance',{
              method:'POST',
              body:JSON.stringify({student_id:dbId,status,slot_id:slot._slotId,date:todayStr})
            }).catch(()=>{});
          });
        });
      };

      /* -- sync near-limit threshold -- */
      if(school.near_limit_threshold) DATA.setNearLimit(school.near_limit_threshold);

      bumpData();
      setPhase('ready');
    } catch(ex){
      console.error('hydrate error', ex);
      setPhase('error');
    }
  }

  if(phase==='reset')                      return <ResetPasswordScreen token={resetToken} onDone={()=>{ window.history.replaceState({},'',window.location.pathname); setPhase('login'); }}/>;
  if(phase==='login')                      return <LoginScreen onLogin={verify}/>;
  if(phase==='check'||phase==='loading')   return <AppLoader msg={msg}/>;
  if(phase==='error')  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
                  flexDirection:'column', gap:16, background:'var(--surface-2)' }}>
      <div style={{ color:'var(--text-2)', fontSize:14 }}>เกิดข้อผิดพลาด กรุณาลองใหม่</div>
      <button className="btn" onClick={()=>{ window.API.clearToken(); setPhase('login'); }}>กลับหน้าเข้าสู่ระบบ</button>
    </div>
  );
  return <App liveLogout={()=>window.API.logout()}/>;
}

/* ============ App shell & routing ============ */
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
  { id:"settings",  label:"ตั้งค่า",       m:"ตั้งค่า", icon:"settings" },
  { id:"superadmin",label:"Platform",      m:"Platform", icon:"chart", _adminOnly:true },
];
// Page access is driven by the logged-in user's resolved permissions (DATA._perms).
// 'settings' stays owner/admin only (staff & permission management is sensitive).
// A page with level 'none' is hidden; 'view'/'manage' make it visible.
const PERM_LEVELS = { none:0, view:1, manage:2 };
function pageLevel(pageId){
  const p = (DATA._perms && DATA._perms.pages) || {};
  // pages not in the grid (settings, dashboard fallback) default to visible for owner/admin scope
  if(pageId in p) return p[pageId] || 'none';
  return (DATA._perms && DATA._perms.scope==='all') ? 'manage' : 'view';
}
function canAccess(pageId, role){
  if(pageId==='settings') return role==='owner' || role==='admin';
  if(pageId==='superadmin') return !!(DATA._isPlatformAdmin);
  return PERM_LEVELS[pageLevel(pageId)] >= 1;
}
// default to full access until a live login resolves real perms (covers demo mode too)
if(!DATA._perms) DATA._perms = { scope:'all', pages:{} };
// component-level helper: may the current user MANAGE (write) this page?
DATA.can = function(pageId, level){ return PERM_LEVELS[pageLevel(pageId)] >= PERM_LEVELS[level||'view']; };
const TITLES = {
  dashboard:  { t:"ภาพรวม", s:"สรุปกิจกรรมโรงเรียนวันนี้" },
  schedule:   { t:"ตารางเรียน", s:"จองและจัดการคาบเรียนรายสัปดาห์" },
  attendance: { t:"เช็คชื่อเข้าเรียน", s:"บันทึกการเข้าเรียนรายวัน" },
  homework:   { t:"การบ้าน", s:"มอบหมายและแจ้งการบ้านผ่าน LINE" },
  students:   { t:"นักเรียน", s:"ข้อมูลนักเรียนและความคืบหน้า" },
  teachers:   { t:"ครูผู้สอน", s:"ครูและการคำนวณค่าสอน" },
  finance:    { t:"การเงิน & คอร์ส", s:"ใบเสร็จ การชำระเงิน และแพ็กเกจ" },
  referrals:  { t:"แนะนำเพื่อน", s:"ระบบแนะนำเพื่อนรับแต้มสะสม" },
  reports:    { t:"รายงานสรุป", s:"ภาพรวมผลการดำเนินงานรายเดือน" },
  settings:   { t:"ตั้งค่า", s:"ข้อมูลโรงเรียนและบัญชีผู้ใช้" },
  superadmin: { t:"Platform Dashboard", s:"ภาพรวมโรงเรียนทั้งหมดบน skooldee" },
};

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "primary": "#009488",
  "fontBody": "Work Sans",
  "fontHead": "Work Sans",
  "nearLimit": 2,
  "radius": 12
}/*EDITMODE-END*/;

/* ---- Notification Bell Panel ---- */
function NotifPanel({ nearStudents, overdueHW, onClose, go }){
  React.useEffect(()=>{
    const h = ()=>onClose();
    document.addEventListener('mousedown', h);
    return ()=>document.removeEventListener('mousedown', h);
  },[]);
  const total = nearStudents.length + overdueHW.length;
  return (
    <div onMouseDown={e=>e.stopPropagation()}
      style={{ position:'absolute', top:'calc(100% + 8px)', right:0, width:320, maxHeight:460,
        background:'var(--surface)', border:'1px solid var(--border)',
        borderRadius:'var(--radius-lg)', boxShadow:'var(--shadow-lg)',
        zIndex:500, overflow:'hidden', display:'flex', flexDirection:'column' }}>
      {/* header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'13px 16px 11px', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
        <div style={{ fontWeight:700, fontSize:14 }}>การแจ้งเตือน{total>0?' ('+total+')':''}</div>
        <button className="icon-btn" style={{ width:28, height:28, border:0 }} onClick={onClose}><Icon n="x" size={14}/></button>
      </div>
      {/* body */}
      <div style={{ overflow:'auto', flex:1 }}>
        {total===0 && (
          <div style={{ padding:'32px 20px', textAlign:'center', color:'var(--text-3)', fontSize:13 }}>
            <div style={{ fontSize:26, marginBottom:8 }}>✓</div>ไม่มีการแจ้งเตือนใหม่
          </div>
        )}
        {nearStudents.length>0 && <>
          <div style={{ padding:'10px 16px 4px', fontSize:11, fontWeight:700, color:'var(--danger)', textTransform:'uppercase', letterSpacing:'.06em' }}>
            คอร์สใกล้หมด ({nearStudents.length})
          </div>
          {nearStudents.slice(0,6).map(s=>(
            <div key={s.id}
              onMouseDown={()=>{ go('students'); onClose(); }}
              style={{ display:'flex', alignItems:'center', gap:11, padding:'9px 16px', cursor:'pointer',
                borderBottom:'1px solid var(--border)' }}
              onMouseEnter={e=>e.currentTarget.style.background='var(--surface-2)'}
              onMouseLeave={e=>e.currentTarget.style.background=''}>
              <Avatar name={s.name} size={32}/>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:600, fontSize:13 }}>{s.name}</div>
                <div style={{ fontSize:11.5, color:'var(--danger)' }}>เหลือ {s.remaining} ครั้ง · ควรต่อคอร์ส</div>
              </div>
              <Icon n="chevron-right" size={14} style={{ color:'var(--text-3)' }}/>
            </div>
          ))}
        </>}
        {overdueHW.length>0 && <>
          <div style={{ padding:'10px 16px 4px', fontSize:11, fontWeight:700, color:'#B45309', textTransform:'uppercase', letterSpacing:'.06em' }}>
            การบ้านค้างส่ง ({overdueHW.length})
          </div>
          {overdueHW.slice(0,5).map(h=>(
            <div key={h.id}
              onMouseDown={()=>{ go('homework'); onClose(); }}
              style={{ display:'flex', alignItems:'center', gap:11, padding:'9px 16px', cursor:'pointer',
                borderBottom:'1px solid var(--border)' }}
              onMouseEnter={e=>e.currentTarget.style.background='var(--surface-2)'}
              onMouseLeave={e=>e.currentTarget.style.background=''}>
              <div style={{ width:32, height:32, borderRadius:'var(--radius-sm)', display:'grid', placeItems:'center',
                background:'#FEF3C7', color:'#B45309', flexShrink:0 }}><Icon n="book" size={14}/></div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:600, fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{h.student}</div>
                <div style={{ fontSize:11.5, color:'#B45309', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>ค้าง: {h.title}</div>
              </div>
              <Icon n="chevron-right" size={14} style={{ color:'var(--text-3)' }}/>
            </div>
          ))}
        </>}
      </div>
    </div>
  );
}

function App({ liveLogout }){
  useDataVersion();
  const [tw, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [page, setPage] = useState(()=> localStorage.getItem("bm-page") || "dashboard");
  const [changingPw, setChangingPw] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [checkoutOk, setCheckoutOk] = useState(false);

  React.useEffect(()=>{
    const p = new URLSearchParams(window.location.search);
    if(p.get('checkout') === 'success'){
      setCheckoutOk(true);
      history.replaceState({}, '', window.location.pathname);
      setTimeout(()=>setCheckoutOk(false), 10000);
    }
  }, []);

  const doUpgrade = async (plan, cycle)=>{
    setUpgrading(true);
    try{
      const r = await window.API.stripeCheckout(plan||'pro', cycle||'mo');
      window.location.href = r.url;
    } catch(e){ alert(e.message||'เกิดข้อผิดพลาด กรุณาลองใหม่'); setUpgrading(false); }
  };

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
  const nearStudents = DATA.STUDENTS.filter(DATA.isNearEnding);
  const overdueHW = (DATA.HOMEWORK||[]).filter(h=>h.status!=='done' && DATA.isOverdue&&DATA.isOverdue(h));
  const [searchQ, setSearchQ] = useState('');
  const go = (p)=>{ setPage(p); localStorage.setItem("bm-page", p); window.scrollTo(0,0); };
  const onSearch = (q)=>{
    setSearchQ(q);
    if(q.trim().length>0 && page!=='students') go('students');
  };
  // expose search query so Students screen can read it
  DATA._searchQ = searchQ;

  const role = (DATA._userRaw && DATA._userRaw.role) || 'owner';
  const visibleNav = NAV.filter(n=>canAccess(n.id, role));
  const mobNav = visibleNav.filter(n=>!n._adminOnly);
  const allowed = canAccess(page, role);
  const Screen = { dashboard:Dashboard, schedule:Schedule, attendance:Attendance, homework:Homework, students:Students, teachers:Teachers, finance:Finance, referrals:Referrals, reports:Reports, settings:Settings, superadmin:SuperAdmin }[page];
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
        {visibleNav.map((n,i)=>(
          <React.Fragment key={n.id}>
            {n._adminOnly && <div style={{ height:1, background:'var(--border)', margin:'8px 0 6px', opacity:.6 }}/>}
            <button className={"nav-item"+(page===n.id?" active":"")} onClick={()=>go(n.id)}>
              <Icon n={n.icon} size={20}/>
              <span>{n.label}</span>
              {n.badge && <span className="nav-badge">{n.badge}</span>}
            </button>
          </React.Fragment>
        ))}

        <div className="side-foot">
          {(()=>{
            const sch = DATA._schoolRaw || {};
            const planType = sch.plan || 'trial';
            const planExpires = sch.plan_expires;
            const isPaid = ['starter','pro','premium'].includes(planType);
            if(!DATA._isLiveMode || isPaid) return null;
            const daysLeft = planExpires ? Math.max(0, Math.ceil((new Date(planExpires)-Date.now())/86400_000)) : null;
            const expired = planType==='cancelled' || (daysLeft!==null && daysLeft<=0);
            return (
              <div style={{ marginBottom:10, padding:'12px 14px', borderRadius:'var(--radius)',
                background: expired?'var(--danger-soft)':'var(--primary-soft)',
                border:'1px solid '+(expired?'color-mix(in oklch,var(--danger) 25%,white)':'color-mix(in oklch,var(--primary) 20%,white)') }}>
                <div style={{ fontSize:12.5, fontWeight:700, marginBottom:5,
                  color: expired?'color-mix(in oklch,var(--danger) 80%,black)':'var(--primary-ink)' }}>
                  {expired ? '❌ ทดลองใช้หมดอายุ' : daysLeft!==null ? `⏱ ทดลองใช้: เหลือ ${daysLeft} วัน` : '⏱ ทดลองใช้ฟรี'}
                </div>
                {!expired && daysLeft!==null && daysLeft<=3 &&
                  <div style={{ fontSize:11.5, color:'var(--text-2)', marginBottom:8 }}>อัปเกรดเพื่อใช้งานต่อไม่ขาดตอน</div>}
                <button disabled={upgrading} onClick={()=>doUpgrade('academy','mo')}
                  className="btn btn-primary" style={{ width:'100%', fontSize:12.5, padding:'7px 10px' }}>
                  {upgrading ? 'กำลังโหลด…' : 'อัปเกรด ฿1,990/เดือน'}
                </button>
              </div>
            );
          })()}
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
            {liveLogout && <button className="icon-btn" style={{ width:32, height:32, border:0 }}
              onClick={()=>setChangingPw(true)} title="เปลี่ยนรหัสผ่าน">
              <Icon n="key" size={16}/>
            </button>}
            <button className="icon-btn" style={{ width:32, height:32, border:0 }}
              onClick={liveLogout||undefined} title={liveLogout?"ออกจากระบบ":undefined}>
              <Icon n="logout" size={17}/>
            </button>
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
            <input placeholder="ค้นหานักเรียน ครู หรือคอร์ส..."
              value={searchQ}
              onChange={e=>onSearch(e.target.value)}
              onKeyDown={e=>e.key==='Escape'&&(setSearchQ(''),go('dashboard'))}/>
          </div>
          <div style={{ position:'relative' }}>
            <button className="icon-btn" onMouseDown={e=>{ e.stopPropagation(); setNotifOpen(v=>!v); }}>
              <Icon n="bell" size={19}/>
              {(nearStudents.length>0||overdueHW.length>0) && <span className="dot"></span>}
            </button>
            {notifOpen && <NotifPanel nearStudents={nearStudents} overdueHW={overdueHW} onClose={()=>setNotifOpen(false)} go={go}/>}
          </div>
        </header>

        {checkoutOk && (
          <div style={{ background:'#d1fae5', borderBottom:'1px solid #6ee7b7', padding:'11px 20px',
            fontSize:14, fontWeight:600, color:'#065f46', display:'flex', alignItems:'center', gap:8 }}>
            <span>✅</span> ชำระเงินสำเร็จ! แผนของคุณจะเปิดใช้งานภายในไม่กี่นาที
            <button onClick={()=>setCheckoutOk(false)} style={{ marginLeft:'auto', background:'none', border:'none', cursor:'pointer', fontSize:16, color:'#065f46' }}>×</button>
          </div>
        )}
        <main className="content">
          {allowed
            ? <Screen go={go}/>
            : <div style={{ textAlign:'center', padding:'72px 24px', color:'var(--text-3)' }}>
                <div style={{ fontSize:42, marginBottom:12 }}>🔒</div>
                <div style={{ fontWeight:700, fontSize:16, color:'var(--text)' }}>ไม่มีสิทธิ์เข้าถึงหน้านี้</div>
                <div style={{ fontSize:13.5, marginTop:6 }}>บัญชีของคุณไม่สามารถดูส่วนนี้ได้ — ติดต่อเจ้าของโรงเรียน</div>
                <button className="btn btn-primary" style={{ marginTop:18 }} onClick={()=>go('dashboard')}>กลับหน้าภาพรวม</button>
              </div>}
        </main>
      </div>

      {/* ---- mobile bottom nav ---- */}
      <nav className="mobnav">
        {mobNav.map(n=>(
          <button key={n.id} className={page===n.id?"active":""} onClick={()=>go(n.id)}>
            <Icon n={n.icon} size={20}/>
            <span>{n.m}</span>
          </button>
        ))}
      </nav>

      {changingPw && <ChangePasswordModal onClose={()=>setChangingPw(false)}/>}
      {/* ---- Tweaks ---- */}
      <TweaksPanel>
        <TweakSection label="สีแบรนด์"/>
        <TweakColor label="สีหลัก" value={tw.primary}
          options={["#009488","#7C3AED","#0EA5E9","#059669","#E11D48"]}
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

/* ---- Change Password Modal ---- */
function ChangePasswordModal({ onClose }){
  const [f,setF]   = useState({cur:'',nxt:'',cfm:''});
  const [busy,setBusy] = useState(false);
  const [err,setErr]   = useState('');
  const [ok,setOk]     = useState(false);
  const set = (k,v)=>setF(p=>({...p,[k]:v}));

  const submit = async(e)=>{
    e.preventDefault();
    if(f.nxt!==f.cfm){ setErr('รหัสผ่านใหม่ไม่ตรงกัน'); return; }
    if(f.nxt.length<6){ setErr('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร'); return; }
    setBusy(true); setErr('');
    try{
      await window.API.changePassword(f.cur, f.nxt);
      setOk(true); setTimeout(onClose, 1800);
    }catch(ex){ setErr(ex.message||'เปลี่ยนรหัสผ่านไม่สำเร็จ'); setBusy(false); }
  };

  const inp = { width:'100%', padding:'9px 13px', borderRadius:9, border:'1.5px solid var(--border)',
                fontSize:14, background:'var(--surface)', color:'var(--text)', boxSizing:'border-box', outline:'none' };
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', display:'flex',
                  alignItems:'center', justifyContent:'center', zIndex:999, padding:20 }}
      onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div style={{ background:'var(--surface)', borderRadius:20, padding:'32px 28px', width:'100%', maxWidth:380, boxShadow:'var(--shadow-lg)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div style={{ fontWeight:700, fontSize:17 }}>เปลี่ยนรหัสผ่าน</div>
          <button className="icon-btn" style={{ border:0 }} onClick={onClose}><Icon n="x" size={18}/></button>
        </div>
        {ok ? (
          <div style={{ textAlign:'center', padding:'20px 0', color:'var(--ok)', fontWeight:600, fontSize:15 }}>✓ เปลี่ยนรหัสผ่านสำเร็จแล้ว</div>
        ) : (
          <form onSubmit={submit}>
            {err && <div style={{ background:'var(--danger-soft)', color:'var(--danger)', borderRadius:8, padding:'9px 13px', fontSize:13, marginBottom:14 }}>{err}</div>}
            <div style={{ marginBottom:12 }}>
              <label style={{ display:'block', fontWeight:600, fontSize:13, marginBottom:6 }}>รหัสผ่านปัจจุบัน</label>
              <input type="password" required value={f.cur} onChange={e=>set('cur',e.target.value)} autoComplete="current-password" style={inp}/>
            </div>
            <div style={{ marginBottom:12 }}>
              <label style={{ display:'block', fontWeight:600, fontSize:13, marginBottom:6 }}>รหัสผ่านใหม่ (≥ 6 ตัวอักษร)</label>
              <input type="password" required value={f.nxt} onChange={e=>set('nxt',e.target.value)} autoComplete="new-password" style={inp}/>
            </div>
            <div style={{ marginBottom:20 }}>
              <label style={{ display:'block', fontWeight:600, fontSize:13, marginBottom:6 }}>ยืนยันรหัสผ่านใหม่</label>
              <input type="password" required value={f.cfm} onChange={e=>set('cfm',e.target.value)} autoComplete="new-password" style={inp}/>
            </div>
            <button type="submit" className="btn btn-primary" style={{ width:'100%', padding:'11px', fontSize:14.5 }} disabled={busy}>
              {busy?'กำลังบันทึก…':'บันทึกรหัสผ่านใหม่'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

/* ---- Reset Password Screen (accessed via ?reset=TOKEN link in email) ---- */
function ResetPasswordScreen({ token, onDone }){
  const [nxt,setNxt]   = useState('');
  const [cfm,setCfm]   = useState('');
  const [busy,setBusy] = useState(false);
  const [err,setErr]   = useState('');
  const [ok,setOk]     = useState(false);

  const inp = { width:'100%', padding:'10px 14px', borderRadius:10,
                border:'1.5px solid var(--border)', fontSize:14,
                background:'var(--surface)', color:'var(--text)',
                boxSizing:'border-box', outline:'none' };

  const card = { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:20,
                 padding:'36px 32px', width:'100%', maxWidth:400, boxShadow:'var(--shadow-lg)' };

  const submit = async(e)=>{
    e.preventDefault();
    if(nxt!==cfm){ setErr('รหัสผ่านไม่ตรงกัน'); return; }
    if(nxt.length<6){ setErr('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'); return; }
    setBusy(true); setErr('');
    try{
      await window.API.resetPassword(token, nxt);
      setOk(true);
      setTimeout(onDone, 1800);
    }catch(ex){
      setErr(ex.message==='reset link is invalid or expired' ? 'ลิงก์หมดอายุแล้ว กรุณาขอรีเซ็ตใหม่' : 'เกิดข้อผิดพลาด กรุณาลองใหม่');
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
                  background:'var(--surface-2)', padding:20 }}>
      <div style={card}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:28 }}>
          <img src="/assets/logo-icon.svg" width="38" height="38" alt="skooldee"/>
          <div>
            <div style={{ fontWeight:700, fontSize:18, fontFamily:'var(--ff-display)' }}>skooldee</div>
            <div style={{ fontSize:11.5, color:'var(--text-3)' }}>ตั้งรหัสผ่านใหม่</div>
          </div>
        </div>
        {ok ? (
          <div style={{ textAlign:'center', padding:'20px 0' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>✅</div>
            <div style={{ fontWeight:700, fontSize:17, marginBottom:8 }}>เปลี่ยนรหัสผ่านสำเร็จ!</div>
            <div style={{ color:'var(--text-2)', fontSize:13.5 }}>กำลังพาไปหน้าเข้าสู่ระบบ…</div>
          </div>
        ) : (
          <form onSubmit={submit}>
            <div style={{ fontWeight:700, fontSize:19, marginBottom:5 }}>ตั้งรหัสผ่านใหม่</div>
            <div style={{ color:'var(--text-2)', fontSize:13.5, marginBottom:22 }}>กรอกรหัสผ่านใหม่ที่ต้องการใช้งาน</div>
            {err && <div style={{ background:'var(--danger-soft)', color:'var(--danger)', borderRadius:8, padding:'9px 13px', fontSize:13, marginBottom:14 }}>{err}</div>}
            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontWeight:600, fontSize:13, marginBottom:6 }}>รหัสผ่านใหม่ (≥ 6 ตัวอักษร)</label>
              <input type="password" required value={nxt} onChange={e=>setNxt(e.target.value)}
                autoFocus autoComplete="new-password" style={inp}/>
            </div>
            <div style={{ marginBottom:20 }}>
              <label style={{ display:'block', fontWeight:600, fontSize:13, marginBottom:6 }}>ยืนยันรหัสผ่านใหม่</label>
              <input type="password" required value={cfm} onChange={e=>setCfm(e.target.value)}
                autoComplete="new-password" style={inp}/>
            </div>
            <button type="submit" disabled={busy} className="btn btn-primary"
              style={{ width:'100%', padding:'12px', fontSize:15, fontWeight:700 }}>
              {busy ? 'กำลังบันทึก…' : 'บันทึกรหัสผ่านใหม่'}
            </button>
          </form>
        )}
        <div style={{ textAlign:'center', marginTop:16, fontSize:13 }}>
          <button style={{ border:0, background:'none', color:'var(--primary)', cursor:'pointer', fontWeight:600 }}
            onClick={onDone}>← กลับหน้าเข้าสู่ระบบ</button>
        </div>
      </div>
    </div>
  );
}

/* ---- Entry point: demo mode skips auth, live mode requires login ---- */
if(window.__DEMO_MODE){
  ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
} else {
  ReactDOM.createRoot(document.getElementById("root")).render(<AuthRoot/>);
}
