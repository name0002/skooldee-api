/* ============ skooldee — Settings screen ============ */

/* ===================== SETTINGS ===================== */
function Settings({ go }){
  useDataVersion();
  const [toast, showToast] = useToast();
  // jump straight to a tab when navigated here with a hint (e.g. upgrade button → 'account')
  const [section, setSection] = useState(()=>{ const j=DATA._settingsJump; DATA._settingsJump=null; return j||'school'; });
  // also honour the hint when already mounted on Settings (bumpData re-renders us)
  React.useEffect(()=>{ if(DATA._settingsJump){ setSection(DATA._settingsJump); DATA._settingsJump=null; window.scrollTo(0,0); } });

  const tab = (id, label)=>(
    <button
      onClick={()=>setSection(id)}
      style={{
        padding:'8px 18px', borderRadius:8, border:'none', cursor:'pointer',
        fontWeight:600, fontSize:13.5,
        background: section===id ? 'var(--primary)' : 'var(--surface)',
        color: section===id ? '#fff' : 'var(--text-2)',
        transition:'background .15s',
      }}>
      {label}
    </button>
  );

  return (
    <div style={{ maxWidth:700, margin:'0 auto', padding:'4px 0 40px' }}>
      {/* tabs */}
      <div style={{ display:'flex', gap:8, marginBottom:28, flexWrap:'wrap' }}>
        {tab('school',     '🏫 ข้อมูลโรงเรียน')}
        {tab('goals',      '🎯 เป้าหมายธุรกิจ')}
        {tab('categories', '🎨 ประเภทวิชา')}
        {tab('assess',     '📊 เกณฑ์ประเมิน')}
        {tab('staffeval',  '📋 ประเมินบุคลากร')}
        {tab('rooms',      '🚪 ห้องเรียน')}
        {tab('payment',    '💳 ชำระเงิน')}
        {tab('staff',      '👥 บัญชีพนักงาน')}
        {tab('line',       '🔔 LINE แจ้งเตือน')}
        {tab('richmenu',   '🎛️ เมนู LINE')}
        {tab('profile',    '👤 ข้อมูลผู้ใช้')}
        {tab('account',    '🔐 บัญชีและความปลอดภัย')}
      </div>

      {section==='school'      && <SchoolSettingsSection showToast={showToast}/>}
      {section==='goals'       && <GoalsSettingsSection showToast={showToast}/>}
      {section==='categories'  && <CategoriesSettingsSection showToast={showToast}/>}
      {section==='assess'      && <AssessmentSettingsSection showToast={showToast}/>}
      {section==='staffeval'   && <StaffEvalSettingsSection showToast={showToast}/>}
      {section==='rooms'       && <RoomsSettingsSection showToast={showToast}/>}
      {section==='payment'     && <PaymentSettingsSection showToast={showToast}/>}
      {section==='staff'       && <StaffSettingsSection showToast={showToast}/>}
      {section==='line'        && <LineSettingsSection showToast={showToast}/>}
      {section==='richmenu'    && <RichMenuSettingsSection showToast={showToast}/>}
      {section==='profile'     && <ProfileSettingsSection showToast={showToast}/>}
      {section==='account'     && <AccountSettingsSection showToast={showToast} go={go}/>}

      {toast}
    </div>
  );
}

/* ---- reusable card wrapper ---- */
function SettingsCard({ title, sub, children }){
  return (
    <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'26px 28px', marginBottom:20 }}>
      <div style={{ fontWeight:700, fontSize:16, marginBottom:sub?4:18 }}>{title}</div>
      {sub && <div style={{ color:'var(--text-2)', fontSize:13, marginBottom:18 }}>{sub}</div>}
      {children}
    </div>
  );
}

/* ---- shared input style hook ---- */
function useInpStyle(){
  return { width:'100%', padding:'10px 13px', borderRadius:9,
           border:'1.5px solid var(--border)', fontSize:14,
           background:'var(--surface)', color:'var(--text)',
           boxSizing:'border-box', outline:'none' };
}

/* ── Logo upload card (used inside SchoolSettingsSection) ── */
function LogoUploadCard({ showToast }){
  useDataVersion();
  const [logoImg, setLogoImg] = useState(()=> DATA._schoolRaw ? (DATA._schoolRaw.logo_image||null) : null);
  const [busy, setBusy] = useState(false);
  const syncRef = React.useRef(null);
  const schoolId = (DATA._schoolRaw||{}).id;
  if(schoolId && schoolId !== syncRef.current){
    syncRef.current = schoolId;
    setLogoImg((DATA._schoolRaw||{}).logo_image||null);
  }
  const fileRef = React.useRef();

  const onFile = async(e)=>{
    const file = e.target.files && e.target.files[0]; if(!file) return;
    setBusy(true);
    try{
      const dataUrl = await compressLogoImage(file);
      if(dataUrl.length > 3_000_000){ showToast('รูปใหญ่เกินไป ลองใช้รูปที่เล็กกว่า','error'); setBusy(false); return; }
      if(DATA._isLiveMode && window.API){
        await window.API.updateSchool({ logo_image: dataUrl });
        DATA.SCHOOL_LOGO = dataUrl;
        if(DATA._schoolRaw) DATA._schoolRaw.logo_image = dataUrl;
        setLogoImg(dataUrl);
        showToast('บันทึกโลโก้แล้ว ✓');
      } else { showToast('ใช้ได้เฉพาะ Live mode','error'); }
    }catch(ex){ showToast('อัปโหลดไม่สำเร็จ','error'); }
    setBusy(false);
    if(e.target) e.target.value='';
  };

  const removeLogo = async()=>{
    if(!confirm('ลบโลโก้โรงเรียนออก?')) return;
    setBusy(true);
    try{
      if(DATA._isLiveMode && window.API){
        await window.API.updateSchool({ logo_image: null });
        DATA.SCHOOL_LOGO = null;
        if(DATA._schoolRaw) DATA._schoolRaw.logo_image = null;
        setLogoImg(null);
        showToast('ลบโลโก้แล้ว');
      }
    }catch(ex){ showToast('เกิดข้อผิดพลาด','error'); }
    setBusy(false);
  };

  return (
    <SettingsCard title="โลโก้โรงเรียน" sub="แสดงบน PDF ใบเสร็จ / ใบแจ้งหนี้">
      <div style={{ display:'flex', alignItems:'flex-start', gap:20, flexWrap:'wrap' }}>
        {logoImg ? (
          <div style={{ position:'relative' }}>
            <img src={logoImg} alt="โลโก้" style={{ width:80, height:80, objectFit:'contain', borderRadius:12, border:'1px solid var(--border)', background:'var(--surface-2)' }}/>
          </div>
        ) : (
          <div style={{ width:80, height:80, borderRadius:12, background:'var(--surface-2)', border:'1.5px dashed var(--border)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-3)', fontSize:28 }}>
            🏫
          </div>
        )}
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display:'none' }} onChange={onFile}/>
          <button type="button" className="btn btn-soft btn-sm" disabled={busy}
            onClick={()=>fileRef.current && fileRef.current.click()}>
            {busy ? 'กำลังอัปโหลด…' : logoImg ? '🔄 เปลี่ยนโลโก้' : '📷 อัปโหลดโลโก้'}
          </button>
          {logoImg && (
            <button type="button" className="btn btn-sm"
              style={{ background:'transparent', color:'var(--danger)', border:'1px solid var(--danger)' }}
              disabled={busy} onClick={removeLogo}>ลบโลโก้</button>
          )}
          <div style={{ fontSize:12, color:'var(--text-3)' }}>PNG, JPG (สูงสุด 3 MB) · ขนาดแนะนำ 400×400</div>
        </div>
      </div>
    </SettingsCard>
  );
}

/* ===================== School Settings ===================== */
function SchoolSettingsSection({ showToast }){
  useDataVersion(); // re-render whenever bumpData() fires (e.g. after initial data load)
  const CATS = [
    { v:'',            l:'ไม่ระบุ' },
    { v:'music',       l:'🎵 ดนตรี' },
    { v:'art',         l:'🎨 ศิลปะ / วาดรูป' },
    { v:'performance', l:'🎭 การแสดง / เต้นรำ' },
    { v:'language',    l:'🗣️ ภาษา' },
    { v:'academic',    l:'📚 วิชาการ / กวดวิชา' },
    { v:'sports',      l:'⚽ กีฬา' },
    { v:'other',       l:'อื่นๆ' },
  ];

  const _m2t = (m)=> m==null ? '' : String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
  const _t2m = (t)=>{ if(!t) return null; const [h,mm]=t.split(':').map(Number); return h*60+(mm||0); };

  const fromSchool = ()=>{
    const s = DATA._schoolRaw || {};
    return {
      name: s.name || '',
      category: s.category || '',
      near_limit_threshold: s.near_limit_threshold ?? DATA.NEAR_LIMIT ?? 2,
      name_display: ['nick','both'].includes(s.name_display) ? s.name_display : 'full',
      hours_start: _m2t(s.hours_start!=null ? s.hours_start : 600),
      hours_end:   _m2t(s.hours_end!=null   ? s.hours_end   : 1170),
    };
  };

  const [f, setF] = useState(fromSchool);
  const [busy, setBusy] = useState(false);
  // track which school ID we last synced from, so we sync once when data loads
  const syncedRef = React.useRef(null);
  const schoolId = (DATA._schoolRaw || {}).id;
  if(schoolId && schoolId !== syncedRef.current){
    syncedRef.current = schoolId;
    // first time this school's data appears — push it into form state
    // (setF during render is safe in React when guarded by a ref check)
    const next = fromSchool();
    // only overwrite fields the user hasn't typed in (check name as proxy)
    if(!f.name) setF(next);
  }

  const set = (k, v)=>setF(p=>({...p, [k]:v}));
  const inp = useInpStyle();

  const save = async(e)=>{
    e.preventDefault();
    if(!f.name.trim()){ showToast('กรุณากรอกชื่อโรงเรียน','error'); return; }
    setBusy(true);
    try{
      if(DATA.updateSchool){
        const hs=_t2m(f.hours_start), he=_t2m(f.hours_end);
        if(hs!=null && he!=null && he<=hs){ showToast('เวลาปิดต้องหลังเวลาเปิด','error'); setBusy(false); return; }
        await DATA.updateSchool({
          name: f.name.trim(),
          category: f.category || null,
          near_limit_threshold: Number(f.near_limit_threshold),
          name_display: f.name_display,
          hours_start: hs, hours_end: he,
        });
        DATA.NAME_DISPLAY = f.name_display; if(DATA.setNameDisplay) DATA.setNameDisplay(f.name_display);
        if(hs!=null && he!=null && he>hs){
          DATA.DAY_START=hs; DATA.DAY_END=he;
          const st=[]; for(let m=hs;m<=he;m+=30){ st.push(String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0')); } DATA.SLOT_TIMES=st;
        }
        // sync form to exactly what was persisted (handles rounding/edge cases)
        setF(fromSchool());
        bumpData();
        showToast('บันทึกข้อมูลโรงเรียนแล้ว ✓');
      } else {
        showToast('ใช้ได้เฉพาะ Live mode','error');
      }
    } catch(ex){ showToast(ex.message||'เกิดข้อผิดพลาด','error'); }
    setBusy(false);
  };

  return (
    <form onSubmit={save}>
      <SettingsCard title="โปรไฟล์โรงเรียน" sub="ชื่อและประเภทของโรงเรียนที่แสดงในระบบ">
        <div style={{ display:'grid', gap:16 }}>
          <div>
            <label style={{ display:'block', fontWeight:600, fontSize:13, marginBottom:6 }}>ชื่อโรงเรียน *</label>
            <input style={inp} value={f.name} onChange={e=>set('name',e.target.value)} placeholder="เช่น บ้านมาริ มิวสิค"/>
          </div>
          <div>
            <label style={{ display:'block', fontWeight:600, fontSize:13, marginBottom:8 }}>ประเภทโรงเรียน</label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
              {CATS.map(c=>(
                <button key={c.v} type="button"
                  onClick={()=>set('category', c.v)}
                  style={{
                    padding:'6px 14px', borderRadius:20, border:'1.5px solid',
                    borderColor: f.category===c.v ? 'var(--primary)' : 'var(--border)',
                    background: f.category===c.v ? 'var(--primary-soft)' : 'transparent',
                    color: f.category===c.v ? 'var(--primary-ink)' : 'var(--text-2)',
                    fontSize:13, cursor:'pointer', fontWeight: f.category===c.v ? 600 : 400,
                  }}>
                  {c.l}
                </button>
              ))}
            </div>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard title="การแจ้งเตือน" sub="เงื่อนไขการแสดงคำเตือน 'คอร์สใกล้หมด'">
        <div style={{ display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
          <label style={{ fontWeight:600, fontSize:13 }}>แจ้งเตือนเมื่อคอร์สเหลือ ≤</label>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <input
              type="number" min={1} max={10} step={1}
              value={f.near_limit_threshold}
              onChange={e=>set('near_limit_threshold', Math.max(1,Math.min(10,parseInt(e.target.value)||1)))}
              style={{ ...inp, width:80, textAlign:'center' }}
            />
            <span style={{ fontSize:13, color:'var(--text-2)' }}>ครั้ง</span>
          </div>
          <div style={{ fontSize:12.5, color:'var(--text-3)' }}>ค่าที่อนุญาต: 1–10</div>
        </div>
      </SettingsCard>

      <SettingsCard title="เวลาทำการ" sub="ช่วงเวลาที่แสดงในตารางเรียนและตัวเลือกเวลาจองคาบ">
        <div style={{ display:'flex', alignItems:'center', gap:14, flexWrap:'wrap' }}>
          <div>
            <label style={{ display:'block', fontWeight:600, fontSize:13, marginBottom:6 }}>เปิด</label>
            <input type="time" style={{ ...inp, width:130 }} value={f.hours_start} onChange={e=>set('hours_start', e.target.value)}/>
          </div>
          <span style={{ color:'var(--text-3)', alignSelf:'flex-end', paddingBottom:10 }}>ถึง</span>
          <div>
            <label style={{ display:'block', fontWeight:600, fontSize:13, marginBottom:6 }}>ปิด</label>
            <input type="time" style={{ ...inp, width:130 }} value={f.hours_end} onChange={e=>set('hours_end', e.target.value)}/>
          </div>
        </div>
        <div style={{ fontSize:12.5, color:'var(--text-3)', marginTop:10 }}>ตารางเรียนจะแสดงเฉพาะช่วงนี้ และเวลาเริ่มคาบจะเลือกได้ในช่วงนี้</div>
      </SettingsCard>

      <SettingsCard title="การแสดงชื่อนักเรียน" sub="เลือกว่าจะแสดงชื่อจริงหรือชื่อเล่นทั่วทั้งระบบ">
        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          {[['full','ชื่อจริง','น้องอินดี้ สมมติ'],['nick','ชื่อเล่น','อินดี้'],['both','ชื่อจริง (ชื่อเล่น)','น้องอินดี้ สมมติ (อินดี้)']].map(([v,l,hint])=>(
            <button key={v} type="button" onClick={()=>set('name_display', v)} style={{
              flex:'1 1 140px', padding:'12px 10px', borderRadius:10, cursor:'pointer', textAlign:'left',
              border:'1.5px solid '+(f.name_display===v?'var(--primary)':'var(--border)'),
              background: f.name_display===v?'var(--primary-soft)':'transparent' }}>
              <div style={{ fontWeight:700, fontSize:14, color: f.name_display===v?'var(--primary-ink)':'var(--text)' }}>{l}</div>
              <div style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>{hint}</div>
            </button>
          ))}
        </div>
        <div style={{ fontSize:12.5, color:'var(--text-3)', marginTop:10 }}>หมายเหตุ: ถ้าเลือก "ชื่อเล่น" แต่นักเรียนไม่มีชื่อเล่น จะแสดงชื่อจริงแทน</div>
      </SettingsCard>

      <LogoUploadCard showToast={showToast}/>

      {/* School slug (read-only) */}
      {DATA._schoolRaw && DATA._schoolRaw.slug && (
        <SettingsCard title="URL โรงเรียน" sub="ไม่สามารถเปลี่ยนได้หลังสมัคร">
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ ...inp, width:'auto', flex:1, background:'var(--surface-2)',
                          color:'var(--text-3)', userSelect:'all', fontFamily:'monospace', fontSize:13 }}>
              skooldee.com/{DATA._schoolRaw.slug}
            </div>
          </div>
        </SettingsCard>
      )}

      <div style={{ display:'flex', justifyContent:'flex-end' }}>
        <button type="submit" className="btn btn-primary" disabled={busy}
          style={{ padding:'11px 28px', fontSize:14.5, fontWeight:700 }}>
          {busy ? 'กำลังบันทึก…' : 'บันทึกการเปลี่ยนแปลง'}
        </button>
      </div>
    </form>
  );
}

/* ===================== Business Goals Settings ===================== */
function GoalsSettingsSection({ showToast }){
  useDataVersion();
  const inp = useInpStyle();
  const fromSchool = ()=>{
    const g = (DATA._schoolRaw || {}).goals || {};
    return {
      revenue_monthly:      g.revenue_monthly || '',
      new_students_monthly: g.new_students_monthly || '',
      active_students:      g.active_students || '',
    };
  };
  const [f, setF] = useState(fromSchool);
  const [busy, setBusy] = useState(false);
  const syncedRef = React.useRef(null);
  const schoolId = (DATA._schoolRaw || {}).id;
  if(schoolId && schoolId !== syncedRef.current){ syncedRef.current = schoolId; setF(fromSchool()); }

  const set = (k, v)=> setF(p=>({ ...p, [k]: v.replace(/[^0-9]/g,'') }));

  const save = async(e)=>{
    e.preventDefault();
    if(!DATA.updateSchool){ showToast('ใช้ได้เฉพาะ Live mode','error'); return; }
    setBusy(true);
    try{
      const updated = await DATA.updateSchool({ goals: {
        revenue_monthly:      Number(f.revenue_monthly) || 0,
        new_students_monthly: Number(f.new_students_monthly) || 0,
        active_students:      Number(f.active_students) || 0,
      }});
      if(updated && updated.goals) DATA._schoolRaw = { ...DATA._schoolRaw, goals: updated.goals };
      bumpData();
      showToast('บันทึกเป้าหมายแล้ว ✓');
    } catch(ex){ showToast(ex.message||'เกิดข้อผิดพลาด','error'); }
    setBusy(false);
  };

  const field = (k, label, unit, placeholder)=>(
    <div>
      <label style={{ display:'block', fontWeight:600, fontSize:13, marginBottom:6 }}>{label}</label>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <input style={{ ...inp, width:160, textAlign:'right' }} inputMode="numeric"
          value={f[k]} onChange={e=>set(k, e.target.value)} placeholder={placeholder}/>
        <span style={{ fontSize:13, color:'var(--text-2)' }}>{unit}</span>
      </div>
    </div>
  );

  return (
    <form onSubmit={save}>
      <SettingsCard title="เป้าหมายธุรกิจ" sub="ตั้งเป้าของคุณเอง แล้วระบบจะแสดงความคืบหน้าเทียบเป้า + คาดการณ์ว่าจะถึงเป้าไหม ในหน้ารายงาน (เว้นว่างหรือใส่ 0 = ไม่ตั้งเป้า)">
        <div style={{ display:'grid', gap:18 }}>
          {field('revenue_monthly',      'เป้ารายได้ต่อเดือน',        'บาท/เดือน', 'เช่น 40000')}
          {field('new_students_monthly', 'เป้านักเรียนใหม่ต่อเดือน',   'คน/เดือน',  'เช่น 8')}
          {field('active_students',      'เป้าจำนวนนักเรียนรวม (active)', 'คน',        'เช่น 60')}
        </div>
      </SettingsCard>
      <div style={{ display:'flex', justifyContent:'flex-end' }}>
        <button type="submit" className="btn btn-primary" disabled={busy}
          style={{ padding:'11px 28px', fontSize:14.5, fontWeight:700 }}>
          {busy ? 'กำลังบันทึก…' : 'บันทึกเป้าหมาย'}
        </button>
      </div>
    </form>
  );
}

/* ===================== Payment Settings ===================== */
function compressLogoImage(file){
  return new Promise((resolve, reject)=>{
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = ()=>{
      URL.revokeObjectURL(url);
      const maxW = 400, maxH = 400;
      let w = img.width, h = img.height;
      if(w > maxW){ h = Math.round(h * maxW/w); w = maxW; }
      if(h > maxH){ w = Math.round(w * maxH/h); h = maxH; }
      const cv = document.createElement('canvas'); cv.width=Math.max(1,w); cv.height=Math.max(1,h);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      try{ resolve(cv.toDataURL('image/jpeg', 0.88)); }catch(e){ reject(e); }
    };
    img.onerror = reject; img.src = url;
  });
}

function compressQrImage(file){
  return new Promise((resolve, reject)=>{
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = ()=>{
      URL.revokeObjectURL(url);
      const maxW = 800;
      const scale = Math.min(1, maxW/(img.width||maxW));
      const cw = Math.max(1, Math.round(img.width*scale));
      const ch = Math.max(1, Math.round(img.height*scale));
      const cv = document.createElement('canvas'); cv.width=cw; cv.height=ch;
      cv.getContext('2d').drawImage(img, 0, 0, cw, ch);
      try{ resolve(cv.toDataURL('image/png')); }catch(e){ reject(e); }
    };
    img.onerror = reject;
    img.src = url;
  });
}

function PaymentSettingsSection({ showToast }){
  useDataVersion();
  const [qrImg, setQrImg] = useState(()=> DATA._schoolRaw ? (DATA._schoolRaw.payment_qr_image||null) : null);
  const [slipEnabled, setSlipEnabled] = useState(()=> DATA._schoolRaw ? (DATA._schoolRaw.slip_enabled!==false) : true);
  const [paysoLink, setPaysoLink] = useState(()=> DATA._schoolRaw ? (DATA._schoolRaw.payso_link||'') : '');
  const [paysoBusy, setPaysoBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const inp = useInpStyle();
  const syncedRef = React.useRef(null);
  const schoolId = (DATA._schoolRaw||{}).id;
  if(schoolId && schoolId !== syncedRef.current){
    syncedRef.current = schoolId;
    setQrImg((DATA._schoolRaw||{}).payment_qr_image||null);
    setSlipEnabled((DATA._schoolRaw||{}).slip_enabled!==false);
    setPaysoLink((DATA._schoolRaw||{}).payso_link||'');
  }

  const toggleSlip = async(checked)=>{
    setSlipEnabled(checked);
    try{
      if(DATA._isLiveMode && window.API){
        await window.API.updateSchool({ slip_enabled: checked });
        if(DATA._schoolRaw) DATA._schoolRaw.slip_enabled = checked;
        showToast(checked?'เปิดให้แนบสลิปแล้ว ✓':'ปิดการแนบสลิปแล้ว — ผู้ปกครองต้องแจ้งโรงเรียนเองหลังโอน');
      }
    }catch(ex){ setSlipEnabled(!checked); showToast('บันทึกไม่สำเร็จ','error'); }
  };

  const savePayso = async()=>{
    setPaysoBusy(true);
    try{
      const v = paysoLink.trim();
      if(DATA._isLiveMode && window.API){
        await window.API.updateSchool({ payso_link: v });
        if(DATA._schoolRaw) DATA._schoolRaw.payso_link = v||null;
        showToast(v?'บันทึกลิงก์ Payso แล้ว ✓':'ลบลิงก์ Payso แล้ว');
      } else {
        showToast('ใช้ได้เฉพาะ Live mode','error');
      }
    }catch(ex){ showToast(ex.message||'บันทึกไม่สำเร็จ','error'); }
    setPaysoBusy(false);
  };

  const onQrFile = async(e)=>{
    const file = e.target.files && e.target.files[0]; if(!file) return;
    setBusy(true);
    try{
      const dataUrl = await compressQrImage(file);
      if(dataUrl.length > 3_000_000){ showToast('รูป QR ใหญ่เกินไป ลองถ่ายใหม่','error'); setBusy(false); return; }
      if(DATA._isLiveMode && window.API){
        await window.API.updateSchool({ payment_qr_image: dataUrl });
        DATA.PAYMENT_QR_IMAGE = dataUrl;
        if(DATA._schoolRaw) DATA._schoolRaw.payment_qr_image = dataUrl;
        setQrImg(dataUrl);
        showToast('บันทึก QR Code แล้ว ✓');
      } else {
        showToast('ใช้ได้เฉพาะ Live mode','error');
      }
    }catch(ex){ showToast('อัปโหลดไม่สำเร็จ','error'); }
    setBusy(false);
    if(e.target) e.target.value='';
  };

  const removeQr = async()=>{
    if(!confirm('ลบ QR Code รับเงินออก?')) return;
    setBusy(true);
    try{
      if(DATA._isLiveMode && window.API){
        await window.API.updateSchool({ payment_qr_image: null });
        DATA.PAYMENT_QR_IMAGE = null;
        if(DATA._schoolRaw) DATA._schoolRaw.payment_qr_image = null;
        setQrImg(null);
        showToast('ลบ QR Code แล้ว');
      }
    }catch(ex){ showToast('ลบไม่สำเร็จ','error'); }
    setBusy(false);
  };

  return (
    <div>
      <SettingsCard title="QR Code รับเงิน"
        sub="รูป QR Code PromptPay หรือบัญชีธนาคาร — แสดงให้ผู้ปกครองสแกนเมื่อมียอดค้างชำระในพอร์ทัล">
        {qrImg ? (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', gap:16 }}>
            <div style={{ border:'1.5px solid var(--border)', borderRadius:12, padding:12, background:'#fafafa', display:'inline-block' }}>
              <img src={qrImg} alt="QR Code" style={{ maxWidth:200, maxHeight:250, display:'block', borderRadius:8 }}/>
            </div>
            <div style={{ fontSize:13, color:'var(--text-2)' }}>
              ✓ มี QR Code แล้ว — ผู้ปกครองจะเห็นในหน้าพอร์ทัลเมื่อมียอดค้างชำระ
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <label className="btn btn-ghost" style={{ cursor:'pointer', display:'inline-flex', alignItems:'center', gap:6 }}>
                {busy ? 'กำลังบันทึก…' : '🔄 เปลี่ยน QR Code'}
                <input type="file" accept="image/*" style={{ display:'none' }} onChange={onQrFile} disabled={busy}/>
              </label>
              <button className="btn btn-ghost" style={{ color:'var(--danger)' }} onClick={removeQr} disabled={busy}>ลบ</button>
            </div>
          </div>
        ) : (
          <div>
            <label className="btn btn-primary" style={{ cursor:'pointer', display:'inline-flex', alignItems:'center', gap:8, marginBottom:14 }}>
              {busy ? 'กำลังบันทึก…' : '📤 อัปโหลด QR Code'}
              <input type="file" accept="image/*" style={{ display:'none' }} onChange={onQrFile} disabled={busy}/>
            </label>
            <div style={{ fontSize:13, color:'var(--text-3)', lineHeight:1.7 }}>
              รองรับรูปจาก PromptPay, K Plus, SCB Easy, หรือแอปธนาคารอื่น ๆ<br/>
              ✓ ผู้ปกครองจะเห็น QR พร้อมปุ่มแนบสลิปโอนเงิน<br/>
              ✓ เมื่อส่งสลิปแล้ว สถานะบิลจะเปลี่ยนเป็น "รอตรวจสลิป"<br/>
              ✓ แอดมินอนุมัติ/ปฏิเสธได้ในหน้าการเงิน
            </div>
          </div>
        )}
        {qrImg && (
          <label style={{ display:'flex', alignItems:'center', gap:12, cursor:'pointer', marginTop:18, paddingTop:18, borderTop:'1px solid var(--border)' }}>
            <input type="checkbox" checked={slipEnabled} onChange={e=>toggleSlip(e.target.checked)}
              style={{ width:20, height:20, accentColor:'var(--primary)' }}/>
            <div>
              <div style={{ fontWeight:600, fontSize:14 }}>เปิดให้ผู้ปกครองแนบสลิป</div>
              <div style={{ fontSize:12.5, color:'var(--text-3)' }}>
                {slipEnabled ? 'เปิด — ผู้ปกครองกดแนบสลิปได้ทันทีในพอร์ทัล' : 'ปิด — แสดง QR แต่ผู้ปกครองต้องแจ้งโรงเรียนเองหลังโอน (เช่น ทาง LINE)'}
              </div>
            </div>
          </label>
        )}
      </SettingsCard>

      <SettingsCard title="Payso" sub="หากโรงเรียนสมัครใช้ Payso แล้ว ใส่ลิงก์ชำระเงินที่นี่ — ผู้ปกครองจะเห็นปุ่ม “ชำระผ่าน Payso” ในพอร์ทัล">
        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          <input value={paysoLink} onChange={e=>setPaysoLink(e.target.value)} placeholder="https://payso.io/your-link"
            style={{ ...inp, flex:1, minWidth:220 }} disabled={paysoBusy}/>
          <button className="btn btn-primary" onClick={savePayso} disabled={paysoBusy}>{paysoBusy?'กำลังบันทึก…':'บันทึก'}</button>
        </div>
      </SettingsCard>
    </div>
  );
}

/* ===================== Profile Settings ===================== */
function ProfileSettingsSection({ showToast }){
  const user = DATA._userRaw || {};
  const [name, setName] = useState(user.name || DATA.SCHOOL.owner || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [busy, setBusy] = useState(false);
  const inp = useInpStyle();

  const save = async(e)=>{
    e.preventDefault();
    if(!name.trim()){ showToast('กรุณากรอกชื่อ','error'); return; }
    setBusy(true);
    try{
      if(DATA.updateProfile){
        await DATA.updateProfile({ name: name.trim(), phone: phone.trim() });
        showToast('บันทึกข้อมูลผู้ใช้แล้ว ✓');
      } else {
        showToast('ใช้ได้เฉพาะ Live mode','error');
      }
    } catch(ex){ showToast(ex.message||'เกิดข้อผิดพลาด','error'); }
    setBusy(false);
  };

  return (
    <form onSubmit={save}>
      <SettingsCard title="ข้อมูลส่วนตัว" sub="ชื่อที่แสดงในระบบสำหรับบัญชีของคุณ">
        <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:20, flexWrap:'wrap' }}>
          <Avatar name={name||'?'} size={64} color="var(--primary)"/>
          <div>
            <div style={{ fontWeight:700, fontSize:15 }}>{name || '-'}</div>
            <div style={{ fontSize:12.5, color:'var(--text-3)', marginTop:3 }}>
              {DATA.SCHOOL.ownerRole} · {user.email || ''}
            </div>
          </div>
        </div>

        <div style={{ display:'grid', gap:16 }}>
          <div>
            <label style={{ display:'block', fontWeight:600, fontSize:13, marginBottom:6 }}>ชื่อ-นามสกุล</label>
            <input style={inp} value={name} onChange={e=>setName(e.target.value)} placeholder="ชื่อที่ต้องการแสดง"/>
          </div>
          <div>
            <label style={{ display:'block', fontWeight:600, fontSize:13, marginBottom:6 }}>เบอร์โทร</label>
            <input style={inp} value={phone} onChange={e=>setPhone(e.target.value)} placeholder="0812345678"/>
          </div>
          <div>
            <label style={{ display:'block', fontWeight:600, fontSize:13, marginBottom:6 }}>อีเมล (เปลี่ยนไม่ได้)</label>
            <input style={{ ...inp, background:'var(--surface-2)', color:'var(--text-3)', cursor:'not-allowed' }}
              value={user.email || ''} readOnly/>
          </div>
          <div>
            <label style={{ display:'block', fontWeight:600, fontSize:13, marginBottom:6 }}>บทบาท</label>
            <input style={{ ...inp, background:'var(--surface-2)', color:'var(--text-3)', cursor:'not-allowed' }}
              value={DATA.SCHOOL.ownerRole} readOnly/>
          </div>
        </div>
      </SettingsCard>

      <div style={{ display:'flex', justifyContent:'flex-end' }}>
        <button type="submit" className="btn btn-primary" disabled={busy}
          style={{ padding:'11px 28px', fontSize:14.5, fontWeight:700 }}>
          {busy ? 'กำลังบันทึก…' : 'บันทึกการเปลี่ยนแปลง'}
        </button>
      </div>
    </form>
  );
}

/* ===================== Account & Security Settings ===================== */
// Subscription plans offered for self-serve checkout (mirrors index.html pricing + plans.js gates).
// ENTERPRISE is sales-led (contact form) — no Stripe price, so it's not a selectable card here.
const SUB_PLANS = [
  { key:'studio',  label:'STUDIO',  sub:'สตูดิโอเล็ก / ครูฉายเดี่ยว', mo:890,  yr:712,  yrTotal:8544,
    feats:['นักเรียนที่กำลังเรียนสูงสุด 60 คน','ตารางเรียน · เช็คชื่อ · ปฏิทินวันหยุด','การเงิน · QR/Payso · แนบสลิป','แจ้งเตือน LINE (เช็คชื่อ & บิล) + พอร์ทัลผู้ปกครอง'] },
  { key:'academy', label:'ACADEMY', sub:'โรงเรียนกำลังเติบโต', mo:1990, yr:1592, yrTotal:19104, popular:true,
    feats:['นักเรียนที่กำลังเรียนสูงสุด 250 คน','ทุกอย่างใน STUDIO + บัญชีครู','LINE อัตโนมัติเต็ม + การบ้าน · แต้ม · แนะนำเพื่อน','จองคลาสออนไลน์ · วางบิลอัตโนมัติ','รายงาน & พยากรณ์รายได้ · ผู้ช่วย AI'] },
];
const PLAN_LABELS = { trial:'ทดลองใช้ฟรี', studio:'STUDIO', academy:'ACADEMY', enterprise:'ENTERPRISE', cancelled:'หมดอายุ' };

function SubscriptionCard({ showToast }){
  const school   = DATA._schoolRaw || {};
  const curPlan  = school.plan || 'trial';
  const isPaid   = ['studio','academy','enterprise'].includes(curPlan);
  const expires  = school.plan_expires ? new Date(school.plan_expires) : null;
  const daysLeft = expires ? Math.max(0, Math.ceil((expires - Date.now())/86400_000)) : null;
  const expired  = curPlan==='cancelled' || (curPlan==='trial' && daysLeft!==null && daysLeft<=0);

  const [cycle, setCycle] = useState('mo');           // 'mo' | 'yr'
  const [busy,  setBusy]  = useState('');             // plan key being processed, or 'portal'

  const checkout = async (planKey)=>{
    if(!window.API || !window.API.stripeCheckout){ showToast('ระบบสมัครสมาชิกยังไม่พร้อมใช้งาน','error'); return; }
    setBusy(planKey);
    try{
      const r = await window.API.stripeCheckout(planKey, cycle);
      window.location.href = r.url;
    } catch(e){ showToast(e.message||'เปิดหน้าชำระเงินไม่สำเร็จ กรุณาลองใหม่','error'); setBusy(''); }
  };
  const manageBilling = async ()=>{
    if(!window.API || !window.API.stripePortal){ showToast('ระบบจัดการสมาชิกยังไม่พร้อมใช้งาน','error'); return; }
    setBusy('portal');
    try{
      const r = await window.API.stripePortal();
      window.location.href = r.url;
    } catch(e){ showToast(e.message||'เปิดหน้าจัดการสมาชิกไม่สำเร็จ','error'); setBusy(''); }
  };

  return (
    <SettingsCard title="แพ็กเกจสมาชิก" sub="เลือกแพ็กเกจที่เหมาะกับโรงเรียนของคุณ — เปลี่ยน อัปเกรด หรือยกเลิกได้ทุกเมื่อ">
      {/* current status */}
      <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap',
        padding:'12px 14px', borderRadius:12, marginBottom:18,
        background: expired ? 'var(--danger-soft)' : 'var(--primary-soft)' }}>
        <div style={{ flex:1, minWidth:200 }}>
          <div style={{ fontSize:12.5, color:'var(--text-3)' }}>แพ็กเกจปัจจุบัน</div>
          <div style={{ fontWeight:700, fontSize:15.5, color: expired?'var(--danger)':'var(--primary-ink)' }}>
            {PLAN_LABELS[curPlan] || curPlan}
            {!expired && daysLeft!==null && curPlan==='trial' && <span style={{ fontWeight:500, fontSize:12.5, color:'var(--text-3)' }}> · เหลือ {daysLeft} วัน</span>}
            {isPaid && expires && <span style={{ fontWeight:500, fontSize:12.5, color:'var(--text-3)' }}> · ต่ออายุ {expires.toISOString().slice(0,10)}</span>}
          </div>
        </div>
        {isPaid && (
          <button className="btn" disabled={busy==='portal'} onClick={manageBilling}
            style={{ fontSize:13, padding:'7px 16px', whiteSpace:'nowrap' }}>
            {busy==='portal' ? 'กำลังเปิด…' : 'จัดการการชำระเงิน'}
          </button>
        )}
      </div>

      {/* billing-cycle toggle */}
      <div style={{ display:'flex', gap:6, background:'var(--surface-2)', borderRadius:10, padding:4, width:'fit-content', marginBottom:18 }}>
        {[['mo','รายเดือน'],['yr','รายปี · ประหยัด 20%']].map(([c,lbl])=>(
          <button key={c} onClick={()=>setCycle(c)} style={{
            padding:'7px 16px', borderRadius:7, border:'none', cursor:'pointer', fontSize:13, fontWeight:600,
            background: cycle===c ? 'var(--surface)' : 'transparent',
            color: cycle===c ? 'var(--primary-ink)' : 'var(--text-3)',
            boxShadow: cycle===c ? '0 1px 3px rgba(0,0,0,.08)' : 'none' }}>{lbl}</button>
        ))}
      </div>

      {/* plan cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', gap:14 }}>
        {SUB_PLANS.map(p=>{
          const isCurrent = curPlan===p.key;
          const price = cycle==='yr' ? p.yr : p.mo;
          return (
            <div key={p.key} style={{
              position:'relative', borderRadius:14, padding:'20px 20px 22px',
              border:'1.5px solid '+(p.popular?'var(--primary)':'var(--border)'),
              background: p.popular ? 'var(--primary-soft)' : 'var(--surface)' }}>
              {p.popular && <span style={{ position:'absolute', top:-11, right:16, background:'var(--primary)', color:'#fff',
                fontSize:11, fontWeight:700, padding:'2px 10px', borderRadius:20 }}>🔥 แนะนำ</span>}
              <div style={{ fontWeight:800, fontSize:17 }}>{p.label}</div>
              <div style={{ fontSize:12.5, color:'var(--text-3)', marginTop:2, minHeight:32 }}>{p.sub}</div>
              <div style={{ margin:'10px 0 2px', display:'flex', alignItems:'baseline', gap:3 }}>
                <span style={{ fontSize:15, fontWeight:600 }}>฿</span>
                <span style={{ fontSize:30, fontWeight:800, lineHeight:1 }}>{price.toLocaleString()}</span>
                <span style={{ fontSize:13, color:'var(--text-3)' }}>/เดือน</span>
              </div>
              <div style={{ fontSize:11.5, color:'var(--text-3)', minHeight:18 }}>
                {cycle==='yr' ? `เรียกเก็บ ฿${p.yrTotal.toLocaleString()}/ปี` : ''}
              </div>
              <ul style={{ listStyle:'none', padding:0, margin:'14px 0 18px', display:'flex', flexDirection:'column', gap:8 }}>
                {p.feats.map((f,i)=>(
                  <li key={i} style={{ display:'flex', gap:8, fontSize:12.5, lineHeight:1.5, color:'var(--text-2)' }}>
                    <span style={{ color:'var(--primary)', flexShrink:0, fontWeight:800 }}>✓</span>{f}
                  </li>
                ))}
              </ul>
              {isCurrent ? (
                <button className="btn" disabled style={{ width:'100%', fontSize:13.5, padding:'10px', opacity:.7, cursor:'default' }}>
                  ✓ แพ็กเกจปัจจุบัน
                </button>
              ) : (
                <button className={"btn "+(p.popular?'btn-primary':'')} disabled={!!busy}
                  onClick={()=>checkout(p.key)} style={{ width:'100%', fontSize:13.5, padding:'10px', fontWeight:600 }}>
                  {busy===p.key ? 'กำลังเปิดหน้าชำระเงิน…' : (isPaid ? `เปลี่ยนเป็น ${p.label}` : `เลือก ${p.label}`)}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* enterprise / contact */}
      <div style={{ marginTop:16, fontSize:12.5, color:'var(--text-3)', textAlign:'center' }}>
        ต้องการหลายสาขาหรือนักเรียนไม่จำกัด? <a href="/contact.html?type=sales&plan=enterprise" target="_blank" rel="noopener"
          style={{ color:'var(--primary-ink)', fontWeight:600 }}>ติดต่อฝ่ายขาย (ENTERPRISE)</a>
      </div>
    </SettingsCard>
  );
}

function AccountSettingsSection({ showToast, go }){
  const [changingPw, setChangingPw] = useState(false);

  const school = DATA._schoolRaw || {};
  const joined = school.created_at ? school.created_at.slice(0,10) : '-';

  const Row = ({ icon, label, value, action })=>(
    <div style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 0',
                  borderBottom:'1px solid var(--border)' }}>
      <div style={{ width:36, height:36, borderRadius:10, background:'var(--primary-soft)',
                    display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
        <Icon n={icon} size={18} style={{ color:'var(--primary)' }}/>
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontWeight:600, fontSize:13.5 }}>{label}</div>
        <div style={{ fontSize:12.5, color:'var(--text-3)', marginTop:2 }}>{value}</div>
      </div>
      {action}
    </div>
  );

  return (
    <>
      {DATA._isLiveMode && <SubscriptionCard showToast={showToast}/>}

      <SettingsCard title="ความปลอดภัย">
        <Row
          icon="key"
          label="รหัสผ่าน"
          value="เปลี่ยนรหัสผ่านบัญชีของคุณ"
          action={
            <button className="btn" style={{ fontSize:13, padding:'7px 16px', whiteSpace:'nowrap' }}
              onClick={()=>setChangingPw(true)}>
              เปลี่ยนรหัสผ่าน
            </button>
          }
        />
        <Row
          icon="logout"
          label="ออกจากระบบ"
          value="ออกจากระบบในเบราว์เซอร์นี้"
          action={
            <button className="btn" style={{ fontSize:13, padding:'7px 16px', color:'var(--danger)',
                                             borderColor:'var(--danger)', whiteSpace:'nowrap' }}
              onClick={()=>window.API && window.API.logout()}>
              ออกจากระบบ
            </button>
          }
        />
      </SettingsCard>

      <SettingsCard title="ข้อมูลบัญชี">
        <div style={{ display:'grid', gap:12 }}>
          {[
            ['อีเมล', DATA._userRaw?.email || '-'],
            ['วันที่สมัคร', joined],
            ['รหัสโรงเรียน', school.id ? '#'+school.id : '-'],
            ['ช่วงทดลองใช้', '14 วันฟรี หลังสมัคร'],
          ].map(([k,v])=>(
            <div key={k} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                                  padding:'10px 0', borderBottom:'1px solid var(--border)', gap:12 }}>
              <span style={{ fontSize:13.5, color:'var(--text-2)', fontWeight:500 }}>{k}</span>
              <span style={{ fontSize:13.5, fontWeight:600 }}>{v}</span>
            </div>
          ))}
        </div>
      </SettingsCard>

      <SettingsCard title="การแจ้งเตือนอีเมล">
        <div style={{ display:'flex', gap:12, padding:'4px 0', flexWrap:'wrap' }}>
          <div style={{ flex:1, minWidth:200 }}>
            <div style={{ fontWeight:600, fontSize:13.5, marginBottom:4 }}>Resend Integration</div>
            <div style={{ fontSize:12.5, color:'var(--text-3)', lineHeight:1.6 }}>
              {DATA._userRaw?.email_configured
                ? 'เชื่อมต่อแล้ว — ระบบส่งอีเมลยืนยัน รีเซ็ตรหัสผ่าน และแจ้งเตือนอื่นๆ โดยอัตโนมัติ'
                : (<>เมื่อตั้งค่า <code style={{ background:'var(--surface-2)', padding:'1px 5px', borderRadius:4 }}>RESEND_API_KEY</code> บน Railway
                   ระบบจะส่งอีเมลยืนยัน รีเซ็ตรหัสผ่าน และแจ้งเตือนอื่นๆ โดยอัตโนมัติ</>)}
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'flex-start', paddingTop:4 }}>
            <div style={{
              padding:'4px 12px', borderRadius:20, fontSize:12, fontWeight:700,
              background: DATA._userRaw?.email_configured ? '#06c75522' : 'var(--surface-2)',
              color: DATA._userRaw?.email_configured ? '#06a046' : 'var(--text-3)',
            }}>
              {DATA._userRaw?.email_configured ? '✓ ใช้งานอยู่' : '⏳ รอตั้งค่า'}
            </div>
          </div>
        </div>
      </SettingsCard>

      {changingPw && <ChangePasswordModal onClose={()=>setChangingPw(false)}/>}
    </>
  );
}

/* ===================== Categories Settings ===================== */
const CAT_PALETTE = [
  '#3B82F6','#10B981','#F97316','#EF4444','#8B5CF6',
  '#EC4899','#06B6D4','#84CC16','#F97316','#6366F1',
  '#0EA5E9','#14B8A6','#A855F7','#F43F5E','#78716C',
];

function catsToArray(catsObj){
  return Object.values(catsObj||{}).map(c=>({
    key:c.key, label:c.label, icon:c.icon||'📚', color:c.color, room:c.room||''
  }));
}

function CategoriesSettingsSection({ showToast }){
  const [cats, setCats] = useState(()=> catsToArray(DATA.CATS));
  const [adding, setAdding] = useState(false);
  const [editIdx, setEditIdx] = useState(null);
  const [newLabel, setNewLabel] = useState('');
  const [newIcon,  setNewIcon]  = useState('📚');
  const [newRoom,  setNewRoom]  = useState('');
  const [busy, setBusy] = useState(false);

  const usedColors = cats.map(c=>c.color);
  const nextColor = CAT_PALETTE.find(c=>!usedColors.includes(c)) || CAT_PALETTE[cats.length % CAT_PALETTE.length];

  const save = async(list)=>{
    setBusy(true);
    try{
      if(DATA.saveCategories){
        await DATA.saveCategories(list);
        showToast('บันทึกประเภทวิชาแล้ว ✓');
      } else {
        DATA.CATS = {};
        list.forEach(c=>{ DATA.CATS[c.key] = { key:c.key, label:c.label, color:c.color, soft:c.color+'22', icon:c.icon, room:c.room||c.label }; });
        bumpData();
        showToast('บันทึกแล้ว (demo)');
      }
      setCats(list);
    } catch(ex){ showToast(ex.message||'เกิดข้อผิดพลาด','error'); }
    setBusy(false);
  };

  const addCat = ()=>{
    const label = newLabel.trim();
    if(!label){ showToast('กรุณาใส่ชื่อวิชา','error'); return; }
    const key = label.toLowerCase().replace(/\s+/g,'_').replace(/[^\w_]/g,'') || ('cat'+Date.now());
    if(cats.find(c=>c.key===key)){ showToast('มีวิชานี้อยู่แล้ว','error'); return; }
    const list = [...cats, { key, label, icon:newIcon, color:nextColor, room:newRoom.trim()||label }];
    save(list);
    setNewLabel(''); setNewIcon('📚'); setNewRoom(''); setAdding(false);
  };

  const updateCat = (idx)=>{
    const label = newLabel.trim();
    if(!label){ showToast('กรุณาใส่ชื่อวิชา','error'); return; }
    const list = cats.map((c,i)=> i===idx ? { ...c, label, icon:newIcon, room:newRoom.trim()||label } : c);
    save(list);
    setEditIdx(null); setNewLabel(''); setNewIcon('📚'); setNewRoom('');
  };

  const deleteCat = (idx)=>{
    if(!confirm(`ลบวิชา "${cats[idx].label}"? นักเรียนที่มีวิชานี้จะยังอยู่ในระบบ`)) return;
    save(cats.filter((_,i)=>i!==idx));
  };

  const startEdit = (idx)=>{
    setEditIdx(idx); setAdding(false);
    setNewLabel(cats[idx].label); setNewIcon(cats[idx].icon||'📚'); setNewRoom(cats[idx].room||'');
  };

  const inp = useInpStyle();
  const emojiOpts = ['🎹','🎸','🎤','💃','🎨','🥁','🎷','🎺','🎻','🎵','📖','➕','🎯','✏️','🌟'];

  return (
    <SettingsCard title="ประเภทวิชา" sub="เพิ่ม แก้ไข หรือลบวิชาที่โรงเรียนของคุณเปิดสอน">
      {/* list */}
      <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
        {cats.length===0 && (
          <div style={{ padding:'20px', textAlign:'center', color:'var(--text-3)', fontSize:13.5 }}>
            ยังไม่มีวิชา กด "+ เพิ่มวิชา" เพื่อเริ่มต้น
          </div>
        )}
        {cats.map((c,idx)=>(
          <div key={c.key} style={{
            display:'flex', alignItems:'center', gap:12, padding:'12px 14px',
            background:'var(--surface-2)', borderRadius:10,
            border: editIdx===idx ? '1.5px solid var(--primary)' : '1.5px solid transparent',
          }}>
            {/* colour swatch */}
            <div style={{ width:14, height:14, borderRadius:'50%', background:c.color, flexShrink:0 }}/>
            <span style={{ fontSize:20, lineHeight:1, flexShrink:0 }}>{c.icon}</span>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontWeight:600, fontSize:14 }}>{c.label}</div>
              <div style={{ fontSize:12, color:'var(--text-3)' }}>🚪 ห้องประจำ: {c.room||c.label}</div>
            </div>

            {editIdx===idx ? (
              /* inline edit form */
              <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', justifyContent:'flex-end' }}>
                {/* emoji picker */}
                <select value={newIcon} onChange={e=>setNewIcon(e.target.value)}
                  style={{ ...inp, width:72, padding:'6px 8px', fontSize:18, textAlign:'center' }}>
                  {emojiOpts.map(em=><option key={em} value={em}>{em}</option>)}
                </select>
                <input value={newLabel} onChange={e=>setNewLabel(e.target.value)}
                  placeholder="ชื่อวิชา" onKeyDown={e=>e.key==='Enter'&&updateCat(idx)}
                  style={{ ...inp, width:120, padding:'7px 10px' }} autoFocus/>
                <input value={newRoom} onChange={e=>setNewRoom(e.target.value)}
                  placeholder="ห้องประจำ" onKeyDown={e=>e.key==='Enter'&&updateCat(idx)}
                  style={{ ...inp, width:120, padding:'7px 10px' }}/>
                <button className="btn btn-primary" disabled={busy}
                  style={{ padding:'7px 14px', fontSize:13 }}
                  onClick={()=>updateCat(idx)}>บันทึก</button>
                <button className="btn" style={{ padding:'7px 12px', fontSize:13 }}
                  onClick={()=>setEditIdx(null)}>ยกเลิก</button>
              </div>
            ) : (
              <div style={{ display:'flex', gap:8 }}>
                <button className="btn" style={{ padding:'5px 12px', fontSize:12.5 }}
                  onClick={()=>startEdit(idx)}>แก้ไข</button>
                <button className="btn" style={{ padding:'5px 12px', fontSize:12.5,
                  color:'var(--danger)', borderColor:'var(--danger)' }}
                  onClick={()=>deleteCat(idx)}>ลบ</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* add form */}
      {adding ? (
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap',
                      padding:'14px', background:'var(--surface-2)', borderRadius:10,
                      border:'1.5px dashed var(--primary)' }}>
          <div style={{ width:14, height:14, borderRadius:'50%', background:nextColor, flexShrink:0 }}/>
          <select value={newIcon} onChange={e=>setNewIcon(e.target.value)}
            style={{ ...inp, width:72, padding:'6px 8px', fontSize:18, textAlign:'center' }}>
            {emojiOpts.map(em=><option key={em} value={em}>{em}</option>)}
          </select>
          <input value={newLabel} onChange={e=>setNewLabel(e.target.value)}
            placeholder="ชื่อวิชาใหม่ เช่น ไวโอลิน"
            onKeyDown={e=>e.key==='Enter'&&addCat()}
            style={{ ...inp, flex:1, minWidth:120, padding:'7px 10px' }} autoFocus/>
          <input value={newRoom} onChange={e=>setNewRoom(e.target.value)}
            placeholder="ห้องประจำ (ไม่ใส่ = ใช้ชื่อวิชา)"
            onKeyDown={e=>e.key==='Enter'&&addCat()}
            style={{ ...inp, width:160, padding:'7px 10px' }}/>
          <button className="btn btn-primary" disabled={busy}
            style={{ padding:'7px 14px', fontSize:13 }}
            onClick={addCat}>{busy?'กำลังบันทึก…':'เพิ่มวิชา'}</button>
          <button className="btn" style={{ padding:'7px 12px', fontSize:13 }}
            onClick={()=>{ setAdding(false); setNewLabel(''); setNewIcon('📚'); setNewRoom(''); }}>ยกเลิก</button>
        </div>
      ) : (
        <button className="btn btn-primary" style={{ fontSize:13.5 }}
          onClick={()=>{ setAdding(true); setEditIdx(null); }}>
          + เพิ่มวิชา
        </button>
      )}
    </SettingsCard>
  );
}

/* ===================== Assessment rubric (criteria per subject) ===================== */
function AssessmentSettingsSection({ showToast }){
  useDataVersion();
  const cats = Object.values(DATA.CATS||{});
  // effective criteria per subject (custom if set, else sensible default)
  const initCrit = ()=>{ const o={}; cats.forEach(c=>{ o[c.key] = (window.criteriaFor?criteriaFor(c.key):[]).slice(); }); return o; };
  const [crit, setCrit] = useState(initCrit);
  const [draft, setDraft] = useState({});   // per-subject "add criterion" text
  const [parentsOn, setParentsOn] = useState(!!DATA.SHOW_ASSESS_PARENTS);
  const [courseNoOn, setCourseNoOn] = useState(!!DATA.SHOW_COURSE_NO_PARENTS);
  const [expiryOn, setExpiryOn] = useState(!!DATA.COURSE_EXPIRY_ENABLED);
  const [busy, setBusy] = useState(false);
  const inp = useInpStyle();

  const addCrit = (key)=>{
    const name = (draft[key]||'').trim().slice(0,60);
    if(!name) return;
    setCrit(p=>{ const cur=p[key]||[]; if(cur.includes(name)) return p; if(cur.length>=12){ showToast('ได้สูงสุด 12 เกณฑ์ต่อวิชา','error'); return p; } return { ...p, [key]:[...cur, name] }; });
    setDraft(p=>({ ...p, [key]:'' }));
  };
  const removeCrit = (key, idx)=> setCrit(p=>({ ...p, [key]:(p[key]||[]).filter((_,i)=>i!==idx) }));

  const saveCrit = async()=>{
    setBusy(true);
    try{
      // only persist subjects that actually have criteria
      const out = {}; Object.keys(crit).forEach(k=>{ if((crit[k]||[]).length) out[k]=crit[k]; });
      if(DATA.saveCriteria){ await DATA.saveCriteria(out); showToast('บันทึกเกณฑ์ประเมินแล้ว ✓'); }
      else { DATA.ASSESS_CRITERIA = out; bumpData(); showToast('บันทึกแล้ว (demo)'); }
    }catch(ex){ showToast(ex.message||'เกิดข้อผิดพลาด','error'); }
    setBusy(false);
  };

  const toggleParents = async(on)=>{
    setParentsOn(on);
    try{
      if(DATA.setShowAssessParents){ await DATA.setShowAssessParents(on); }
      else { DATA.SHOW_ASSESS_PARENTS = on; bumpData(); }
    }catch(ex){ setParentsOn(!on); showToast(ex.message||'บันทึกไม่สำเร็จ','error'); }
  };

  const toggleCourseNo = async(on)=>{
    setCourseNoOn(on);
    try{
      if(DATA.setShowCourseNoParents){ await DATA.setShowCourseNoParents(on); }
      else { DATA.SHOW_COURSE_NO_PARENTS = on; bumpData(); }
    }catch(ex){ setCourseNoOn(!on); showToast(ex.message||'บันทึกไม่สำเร็จ','error'); }
  };

  const toggleExpiry = async(on)=>{
    setExpiryOn(on);
    try{
      if(DATA.setCourseExpiryEnabled){ await DATA.setCourseExpiryEnabled(on); }
      else { DATA.COURSE_EXPIRY_ENABLED = on; bumpData(); }
    }catch(ex){ setExpiryOn(!on); showToast(ex.message||'บันทึกไม่สำเร็จ','error'); }
  };

  return (
    <>
      <SettingsCard title="การมองเห็นของผู้ปกครอง" sub="เลือกว่าจะให้ผู้ปกครองเห็นคะแนนพัฒนาการในหน้า parent หรือไม่">
        <label style={{ display:'flex', alignItems:'center', gap:12, cursor:'pointer' }}>
          <input type="checkbox" checked={parentsOn} onChange={e=>toggleParents(e.target.checked)}
            style={{ width:20, height:20, accentColor:'var(--primary)' }}/>
          <div>
            <div style={{ fontWeight:600, fontSize:14 }}>ให้ผู้ปกครองเห็นคะแนนพัฒนาการ</div>
            <div style={{ fontSize:12.5, color:'var(--text-3)' }}>{parentsOn ? 'เปิด — แสดงผลประเมินล่าสุดในหน้าผู้ปกครอง' : 'ปิด — เก็บไว้ให้ครู/โรงเรียนดูภายในเท่านั้น'}</div>
          </div>
        </label>
        <label style={{ display:'flex', alignItems:'center', gap:12, cursor:'pointer', marginTop:14, paddingTop:14, borderTop:'1px solid var(--border)' }}>
          <input type="checkbox" checked={courseNoOn} onChange={e=>toggleCourseNo(e.target.checked)}
            style={{ width:20, height:20, accentColor:'var(--primary)' }}/>
          <div>
            <div style={{ fontWeight:600, fontSize:14 }}>ให้ผู้ปกครองเห็น "คอร์สที่เท่าไหร่"</div>
            <div style={{ fontSize:12.5, color:'var(--text-3)' }}>{courseNoOn ? 'เปิด — แสดงรอบคอร์สรายวิชาในหน้าผู้ปกครอง' : 'ปิด — เจ้าของ/ครูเห็นเท่านั้น (ค่าเริ่มต้น)'}</div>
          </div>
        </label>
      </SettingsCard>

      <SettingsCard title="วันหมดอายุคอร์ส" sub="บางโรงเรียนกำหนดให้คอร์สมีอายุการใช้งาน เช่น 90 วันนับจากวันที่ซื้อ — เปิดเพื่อกำหนดอายุต่อแพ็กเกจและต่อนักเรียน">
        <label style={{ display:'flex', alignItems:'center', gap:12, cursor:'pointer' }}>
          <input type="checkbox" checked={expiryOn} onChange={e=>toggleExpiry(e.target.checked)}
            style={{ width:20, height:20, accentColor:'var(--primary)' }}/>
          <div>
            <div style={{ fontWeight:600, fontSize:14 }}>ใช้วันหมดอายุคอร์ส</div>
            <div style={{ fontSize:12.5, color:'var(--text-3)' }}>{expiryOn
              ? 'เปิด — ตั้ง "อายุ (วัน)" ต่อแพ็กเกจ ระบบคำนวณวันหมดอายุให้ตอนลงทะเบียน/ต่อคอร์ส และเตือนเมื่อใกล้หมด (ไม่ลบเซสชัน)'
              : 'ปิด — คอร์สไม่มีกำหนดหมดอายุ (ค่าเริ่มต้น)'}</div>
          </div>
        </label>
      </SettingsCard>

      <SettingsCard title="เกณฑ์ประเมินแต่ละวิชา" sub="แต่ละวิชาวัดทักษะต่างกัน — กำหนดเกณฑ์เองได้ ครูจะให้ดาว 1–5 ต่อเกณฑ์เวลาประเมิน">
        {cats.length===0 && <div style={{ padding:20, textAlign:'center', color:'var(--text-3)', fontSize:13.5 }}>ยังไม่มีวิชา — เพิ่มที่แท็บ "ประเภทวิชา" ก่อน</div>}
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {cats.map(c=>(
            <div key={c.key} style={{ padding:'14px', background:'var(--surface-2)', borderRadius:10 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                <span style={{ fontSize:18 }}>{c.icon||'📚'}</span>
                <span style={{ fontWeight:700, fontSize:14 }}>{c.label}</span>
                <span style={{ fontSize:12, color:'var(--text-3)' }}>· {(crit[c.key]||[]).length} เกณฑ์</span>
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:10 }}>
                {(crit[c.key]||[]).map((name,idx)=>(
                  <span key={idx} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'5px 10px', borderRadius:20, background:'var(--surface)', border:'1.5px solid var(--border)', fontSize:13 }}>
                    {name}
                    <span onClick={()=>removeCrit(c.key,idx)} style={{ cursor:'pointer', color:'var(--text-3)', fontWeight:700 }}>×</span>
                  </span>
                ))}
                {!(crit[c.key]||[]).length && <span style={{ fontSize:12.5, color:'var(--text-3)' }}>ยังไม่มีเกณฑ์</span>}
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <input value={draft[c.key]||''} onChange={e=>setDraft(p=>({ ...p, [c.key]:e.target.value }))}
                  onKeyDown={e=>e.key==='Enter'&&addCrit(c.key)} placeholder="เพิ่มเกณฑ์ใหม่ เช่น เทคนิค"
                  style={{ ...inp, flex:1, padding:'7px 11px' }}/>
                <button className="btn" style={{ padding:'7px 14px', fontSize:13 }} onClick={()=>addCrit(c.key)}>+ เพิ่ม</button>
              </div>
            </div>
          ))}
        </div>
        {cats.length>0 && (
          <div style={{ marginTop:16 }}>
            <button className="btn btn-primary" disabled={busy} onClick={saveCrit}>
              <Icon n="check" size={16}/> {busy?'กำลังบันทึก…':'บันทึกเกณฑ์ประเมิน'}
            </button>
          </div>
        )}
      </SettingsCard>
    </>
  );
}

/* ===================== Staff evaluation templates (forms + criteria rubric) ===================== */
function StaffEvalSettingsSection({ showToast }){
  const inp = useInpStyle();
  const [templates, setTemplates] = useState(null);   // null = loading
  const [draft, setDraft] = useState({});             // per-template "add criterion" input text
  const [busy, setBusy] = useState({});                // per-template id -> saving bool
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const reload = React.useCallback(()=>{
    if(!DATA.evalTemplates){ setTemplates([]); return; }
    Promise.resolve(DATA.evalTemplates()).then(list=>setTemplates(list||[])).catch(()=>setTemplates([]));
  },[]);
  React.useEffect(()=>{ reload(); },[]);

  const createTemplate = async()=>{
    const name = newName.trim().slice(0,100);
    if(!name) return;
    try{
      await DATA.addEvalTemplate({ name, criteria:[] });
      setNewName(''); setCreating(false); reload();
      showToast('เพิ่มแบบประเมินแล้ว ✓');
    }catch(ex){ showToast(ex.message||'เกิดข้อผิดพลาด','error'); }
  };

  const updateLocal = (id, patch)=> setTemplates(ts=>ts.map(t=> t.id===id ? { ...t, ...patch } : t));

  const addCrit = (tpl)=>{
    const name = (draft[tpl.id]||'').trim().slice(0,60);
    if(!name) return;
    if((tpl.criteria||[]).includes(name)){ setDraft(p=>({ ...p, [tpl.id]:'' })); return; }
    if((tpl.criteria||[]).length>=20){ showToast('ได้สูงสุด 20 เกณฑ์ต่อแบบประเมิน','error'); return; }
    updateLocal(tpl.id, { criteria:[...(tpl.criteria||[]), name] });
    setDraft(p=>({ ...p, [tpl.id]:'' }));
  };
  const removeCrit = (tpl, idx)=> updateLocal(tpl.id, { criteria:(tpl.criteria||[]).filter((_,i)=>i!==idx) });

  const saveTemplate = async(tpl)=>{
    setBusy(p=>({ ...p, [tpl.id]:true }));
    try{
      await DATA.patchEvalTemplate(tpl.id, { name: tpl.name, criteria: tpl.criteria||[] });
      showToast('บันทึกแบบประเมินแล้ว ✓');
    }catch(ex){ showToast(ex.message||'บันทึกไม่สำเร็จ','error'); }
    setBusy(p=>({ ...p, [tpl.id]:false }));
  };

  const deleteTemplate = async(tpl)=>{
    if(!confirm(`ลบแบบประเมิน "${tpl.name}"? ผลประเมินที่บันทึกไว้ก่อนหน้าจะยังเก็บไว้`)) return;
    try{
      await DATA.deleteEvalTemplate(tpl.id);
      setTemplates(ts=>ts.filter(t=>t.id!==tpl.id));
      showToast('ลบแบบประเมินแล้ว');
    }catch(ex){ showToast(ex.message||'ลบไม่สำเร็จ','error'); }
  };

  return (
    <SettingsCard title="แบบประเมินบุคลากร" sub="สร้างฟอร์มประเมินครู/พนักงาน กำหนดเกณฑ์เอง — ให้คะแนนดาว 1–5 ต่อเกณฑ์เวลาประเมิน">
      {templates===null && <div style={{ padding:20, textAlign:'center', color:'var(--text-3)', fontSize:13.5 }}>กำลังโหลด…</div>}
      {templates && !templates.length && !creating && (
        <div style={{ padding:20, textAlign:'center', color:'var(--text-3)', fontSize:13.5 }}>ยังไม่มีแบบประเมิน — สร้างแบบแรกได้เลย</div>
      )}
      {templates && templates.length>0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {templates.map(tpl=>(
            <div key={tpl.id} style={{ padding:'14px', background:'var(--surface-2)', borderRadius:10 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                <input value={tpl.name} onChange={e=>updateLocal(tpl.id,{ name:e.target.value })}
                  style={{ ...inp, flex:1, fontWeight:700, padding:'7px 11px' }}/>
                <button className="icon-btn" style={{ width:30, height:30, border:0, color:'var(--text-3)' }} title="ลบแบบประเมิน"
                  onClick={()=>deleteTemplate(tpl)}><Icon n="x" size={14}/></button>
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:10 }}>
                {(tpl.criteria||[]).map((name,idx)=>(
                  <span key={idx} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'5px 10px', borderRadius:20, background:'var(--surface)', border:'1.5px solid var(--border)', fontSize:13 }}>
                    {name}
                    <span onClick={()=>removeCrit(tpl,idx)} style={{ cursor:'pointer', color:'var(--text-3)', fontWeight:700 }}>×</span>
                  </span>
                ))}
                {!(tpl.criteria||[]).length && <span style={{ fontSize:12.5, color:'var(--text-3)' }}>ยังไม่มีเกณฑ์</span>}
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <input value={draft[tpl.id]||''} onChange={e=>setDraft(p=>({ ...p, [tpl.id]:e.target.value }))}
                  onKeyDown={e=>e.key==='Enter'&&addCrit(tpl)} placeholder="เพิ่มเกณฑ์ใหม่ เช่น ความตรงต่อเวลา"
                  style={{ ...inp, flex:1, padding:'7px 11px' }}/>
                <button className="btn" style={{ padding:'7px 14px', fontSize:13 }} onClick={()=>addCrit(tpl)}>+ เพิ่ม</button>
              </div>
              <div style={{ marginTop:12 }}>
                <button className="btn btn-primary" style={{ fontSize:13 }} disabled={busy[tpl.id]} onClick={()=>saveTemplate(tpl)}>
                  <Icon n="check" size={14}/> {busy[tpl.id]?'กำลังบันทึก…':'บันทึก'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop:18, paddingTop:18, borderTop: (templates&&templates.length) ? '1px solid var(--border)' : 'none' }}>
        {!creating ? (
          <button className="btn" onClick={()=>setCreating(true)}><Icon n="plus" size={16}/> เพิ่มแบบประเมินใหม่</button>
        ) : (
          <div style={{ display:'flex', gap:8 }}>
            <input autoFocus value={newName} onChange={e=>setNewName(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&createTemplate()} placeholder="ชื่อแบบประเมิน เช่น ประเมินครูประจำเดือน"
              style={{ ...inp, flex:1, padding:'9px 12px' }}/>
            <button className="btn btn-primary" onClick={createTemplate} disabled={!newName.trim()}>สร้าง</button>
            <button className="btn btn-ghost" onClick={()=>{ setCreating(false); setNewName(''); }}>ยกเลิก</button>
          </div>
        )}
      </div>
    </SettingsCard>
  );
}

/* ===================== Rooms (central management) ===================== */
function RoomsSettingsSection({ showToast }){
  useDataVersion();
  const [adding, setAdding]   = useState(false);
  const [newName, setNewName] = useState('');
  const [editIdx, setEditIdx] = useState(null);
  const [editName, setEditName] = useState('');
  const [busy, setBusy] = useState(false);
  const inp = useInpStyle();

  // union of managed + category-default + in-use rooms, each with a usage count
  const rooms = (window.allRooms ? allRooms() : []).map(name=>({
    name,
    count: (DATA.SCHEDULE||[]).filter(s=> (s.room||'') === name).length,
  })).sort((a,b)=> b.count-a.count || a.name.localeCompare(b.name,'th'));

  const managed = ()=> (DATA._schoolRaw && Array.isArray(DATA._schoolRaw.rooms)) ? DATA._schoolRaw.rooms.slice() : [];
  const setManaged = (list)=>{ if(DATA._schoolRaw) DATA._schoolRaw.rooms = list; };

  const addRoom = async()=>{
    const nm = newName.trim().slice(0,60);
    if(!nm){ showToast('ใส่ชื่อห้องก่อน','error'); return; }
    if(rooms.find(r=>r.name===nm)){ showToast('มีห้องนี้อยู่แล้ว','error'); return; }
    setBusy(true);
    try{
      const list = [...new Set([...managed(), nm])];
      if(DATA._isLiveMode && window.API) await window.API.updateSchool({ rooms_json:list });
      setManaged(list); bumpData();
      setNewName(''); setAdding(false); showToast('เพิ่มห้องแล้ว ✓');
    }catch(ex){ showToast(ex.message||'บันทึกไม่สำเร็จ','error'); }
    setBusy(false);
  };

  const renameRoom = async(from)=>{
    const to = editName.trim().slice(0,60);
    if(!to){ showToast('ใส่ชื่อห้องใหม่','error'); return; }
    if(to===from){ setEditIdx(null); return; }
    setBusy(true);
    try{
      if(DATA._isLiveMode && window.API && window.API.req){
        await window.API.req('/api/schools/rooms/rename', { method:'POST', body:JSON.stringify({ from, to }) });
      }
      // reflect everywhere locally so the UI updates without a full reload
      DATA.SCHEDULE = (DATA.SCHEDULE||[]).map(s=> (s.room===from? { ...s, room:to } : s));
      DATA.TODAY    = (DATA.TODAY||[]).map(s=> (s.room===from? { ...s, room:to } : s));
      Object.values(DATA.CATS||{}).forEach(c=>{ if(c && c.room===from) c.room=to; });
      setManaged([...new Set(managed().map(r=> r===from?to:r).concat(to))]);
      bumpData(); setEditIdx(null); showToast(`เปลี่ยนชื่อเป็น "${to}" ทุกคาบแล้ว ✓`);
    }catch(ex){ showToast(ex.message||'เปลี่ยนชื่อไม่สำเร็จ','error'); }
    setBusy(false);
  };

  const removeRoom = async(name, count)=>{
    if(count>0){ if(!confirm(`ห้อง "${name}" ยังมี ${count} คาบใช้อยู่ — ลบออกจากรายการ? (คาบเดิมยังคงชื่อห้องไว้)`)) return; }
    setBusy(true);
    try{
      const list = managed().filter(r=>r!==name);
      if(DATA._isLiveMode && window.API) await window.API.updateSchool({ rooms_json:list });
      setManaged(list); bumpData(); showToast('ลบห้องออกจากรายการแล้ว');
    }catch(ex){ showToast(ex.message||'ลบไม่สำเร็จ','error'); }
    setBusy(false);
  };

  return (
    <SettingsCard title="ห้องเรียน" sub="จัดการห้องเรียนทั้งหมด — เปลี่ยนชื่อทีเดียวมีผลกับทุกคาบ และใช้เป็นตัวเลือกตอนจองคาบ">
      <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
        {rooms.length===0 && (
          <div style={{ padding:'20px', textAlign:'center', color:'var(--text-3)', fontSize:13.5 }}>
            ยังไม่มีห้องเรียน — เพิ่มห้อง หรือกำหนดห้องตอนจองคาบ
          </div>
        )}
        {rooms.map((rm,idx)=>(
          <div key={rm.name} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px',
            background:'var(--surface-2)', borderRadius:10,
            border: editIdx===idx ? '1.5px solid var(--primary)' : '1.5px solid transparent' }}>
            <span style={{ fontSize:18, flexShrink:0 }}>🚪</span>
            {editIdx===idx ? (
              <input value={editName} onChange={e=>setEditName(e.target.value)} autoFocus maxLength={60}
                onKeyDown={e=>e.key==='Enter'&&renameRoom(rm.name)}
                style={{ ...inp, flex:1, padding:'7px 10px' }}/>
            ) : (
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:600, fontSize:14 }}>{rm.name}</div>
                <div style={{ fontSize:12, color:'var(--text-3)' }}>{rm.count>0? `${rm.count} คาบใช้ห้องนี้` : 'ยังไม่มีคาบใช้'}</div>
              </div>
            )}
            {editIdx===idx ? (
              <div style={{ display:'flex', gap:8 }}>
                <button className="btn btn-primary" disabled={busy} style={{ padding:'7px 14px', fontSize:13 }} onClick={()=>renameRoom(rm.name)}>{busy?'…':'บันทึก'}</button>
                <button className="btn" style={{ padding:'7px 12px', fontSize:13 }} onClick={()=>setEditIdx(null)}>ยกเลิก</button>
              </div>
            ) : (
              <div style={{ display:'flex', gap:8 }}>
                <button className="btn" style={{ padding:'5px 12px', fontSize:12.5 }} onClick={()=>{ setEditIdx(idx); setEditName(rm.name); setAdding(false); }}>เปลี่ยนชื่อ</button>
                <button className="btn" style={{ padding:'5px 12px', fontSize:12.5, color:'var(--danger)', borderColor:'var(--danger)' }} onClick={()=>removeRoom(rm.name, rm.count)}>ลบ</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {adding ? (
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', padding:'14px', background:'var(--surface-2)', borderRadius:10, border:'1.5px dashed var(--primary)' }}>
          <span style={{ fontSize:18 }}>🚪</span>
          <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="ชื่อห้องใหม่ เช่น ห้องเปียโน 1"
            onKeyDown={e=>e.key==='Enter'&&addRoom()} style={{ ...inp, flex:1, minWidth:160, padding:'7px 10px' }} autoFocus/>
          <button className="btn btn-primary" disabled={busy} style={{ padding:'7px 14px', fontSize:13 }} onClick={addRoom}>{busy?'กำลังบันทึก…':'เพิ่มห้อง'}</button>
          <button className="btn" style={{ padding:'7px 12px', fontSize:13 }} onClick={()=>{ setAdding(false); setNewName(''); }}>ยกเลิก</button>
        </div>
      ) : (
        <button className="btn btn-primary" style={{ fontSize:13.5 }} onClick={()=>{ setAdding(true); setEditIdx(null); }}>+ เพิ่มห้อง</button>
      )}

      <div style={{ marginTop:14, fontSize:12.5, color:'var(--text-3)', lineHeight:1.55 }}>
        💡 "เปลี่ยนชื่อ" จะแก้ชื่อห้องในทุกคาบที่ใช้ห้องนั้นพร้อมกัน · รายการนี้รวมห้องประจำวิชาและห้องที่ใช้ในตารางโดยอัตโนมัติ
      </div>
    </SettingsCard>
  );
}

/* ===================== Staff Accounts ===================== */
const ROLE_LABEL = { owner:'เจ้าของ', admin:'ผู้ดูแล', finance:'การเงิน', teacher:'ครูผู้สอน' };
const ROLE_DESC  = {
  teacher:'เห็นเฉพาะนักเรียน/คาบของตัวเอง — ปรับสิทธิ์รายหน้าได้ด้านล่าง',
  finance:'เห็นการเงินและรายงาน เพิ่มเติมจากครู',
  admin:'เห็นทุกอย่างเหมือนเจ้าของ (ยกเว้นลบเจ้าของ)',
};

// pages a teacher's access can be tuned per-page (must match server PAGES)
const PERM_PAGE_META = [
  { key:'dashboard',  label:'ภาพรวม' },
  { key:'schedule',   label:'ตารางเรียน' },
  { key:'attendance', label:'เช็คชื่อ' },
  { key:'homework',   label:'การบ้าน' },
  { key:'students',   label:'นักเรียน' },
  { key:'teachers',   label:'ครูผู้สอน' },
  { key:'finance',    label:'การเงิน' },
  { key:'reports',    label:'รายงาน' },
  { key:'referrals',  label:'แนะนำเพื่อน' },
];
const LEVEL_OPTS = [['none','ไม่เห็น'],['view','ดูได้'],['manage','แก้ไขได้']];
// defaults mirror the server's DEFAULT_TEACHER_PERMS so the editor starts where the backend does
const DEFAULT_TEACHER_PAGES = { dashboard:'view', schedule:'view', attendance:'manage', homework:'manage', students:'view', teachers:'none', finance:'none', reports:'none', referrals:'none' };

// editor row for one staff account's access (role=teacher gets the full per-page grid)
function StaffPermsEditor({ user, onSaved, showToast }){
  const inp = useInpStyle();
  const teachers = DATA.TEACHERS||[];
  const [role, setRole] = useState(user.role);
  const [teacherId, setTeacherId] = useState(user.teacher_id||'');
  const init = (user.permissions||{});
  const [scope, setScope] = useState(init.scope||'own');
  const [pages, setPages] = useState(()=>({ ...DEFAULT_TEACHER_PAGES, ...(init.pages||{}) }));
  const [busy, setBusy] = useState(false);

  const setPage = (k,v)=> setPages(p=>({ ...p, [k]:v }));
  const save = async()=>{
    setBusy(true);
    try{
      const body = { role };
      if(role==='teacher'){
        body.teacher_id = teacherId||null;
        body.permissions = { scope, pages };
      } else {
        // admin/finance use role defaults; clear teacher-specific overrides
        body.permissions = null; body.teacher_id = null;
      }
      await window.API.updateUser(user.id, body);
      showToast('บันทึกสิทธิ์แล้ว ✓'); onSaved && onSaved();
    }catch(ex){ showToast((ex.body&&ex.body.error)||ex.message||'บันทึกไม่สำเร็จ','error'); }
    setBusy(false);
  };

  return (
    <div style={{ marginTop:10, padding:'14px 16px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, display:'grid', gap:12 }}>
      <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
        <div style={{ flex:1, minWidth:130 }}>
          <label style={{ display:'block', fontWeight:600, fontSize:12.5, marginBottom:5 }}>บทบาท</label>
          <select style={inp} value={role} onChange={e=>setRole(e.target.value)}>
            <option value="teacher">ครูผู้สอน</option>
            <option value="finance">การเงิน</option>
            <option value="admin">ผู้ดูแล (เห็นทุกอย่าง)</option>
          </select>
        </div>
        {role==='teacher' && (
          <div style={{ flex:1, minWidth:130 }}>
            <label style={{ display:'block', fontWeight:600, fontSize:12.5, marginBottom:5 }}>ผูกกับครู (ข้อมูลของใคร)</label>
            <select style={inp} value={teacherId} onChange={e=>setTeacherId(e.target.value)}>
              <option value="">— เลือกครู —</option>
              {teachers.map(t=> <option key={t._dbId||t.id} value={t._dbId||t.id}>{t.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {role==='teacher' && (
        <>
          {!teacherId && <div style={{ fontSize:12, color:'var(--danger)' }}>⚠️ ยังไม่ได้ผูกกับครู — ต้องเลือกครูเพื่อให้ระบบรู้ว่าเป็นนักเรียน/คาบของใคร</div>}
          <div>
            <label style={{ display:'block', fontWeight:600, fontSize:12.5, marginBottom:6 }}>ขอบเขตข้อมูลนักเรียน</label>
            <div style={{ display:'flex', gap:8 }}>
              {[['own','เฉพาะของตัวเอง'],['all','เห็นทุกคน']].map(([v,l])=>(
                <button key={v} type="button" onClick={()=>setScope(v)}
                  style={{ flex:1, padding:'8px', borderRadius:9, fontSize:12.5, fontWeight:600, cursor:'pointer',
                    border:'1.5px solid '+(scope===v?'var(--primary)':'var(--border)'),
                    background: scope===v?'var(--primary)':'transparent', color: scope===v?'#fff':'var(--text-2)' }}>{l}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ display:'block', fontWeight:600, fontSize:12.5, marginBottom:6 }}>สิทธิ์รายหน้า</label>
            <div style={{ display:'grid', gap:6 }}>
              {PERM_PAGE_META.map(pg=>(
                <div key={pg.key} style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ flex:1, fontSize:13 }}>{pg.label}</span>
                  <div style={{ display:'flex', border:'1.5px solid var(--border)', borderRadius:8, overflow:'hidden' }}>
                    {LEVEL_OPTS.map(([v,l])=>(
                      <button key={v} type="button" onClick={()=>setPage(pg.key,v)}
                        style={{ padding:'5px 11px', fontSize:12, fontWeight:600, border:0, cursor:'pointer',
                          background: pages[pg.key]===v?'var(--primary)':'transparent', color: pages[pg.key]===v?'#fff':'var(--text-3)' }}>{l}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
      {role!=='teacher' && <div style={{ fontSize:12.5, color:'var(--text-3)' }}>{ROLE_DESC[role]}</div>}

      <div><button className="btn btn-primary" disabled={busy} onClick={save}>{busy?'กำลังบันทึก…':'บันทึกสิทธิ์'}</button></div>
    </div>
  );
}

function StaffSettingsSection({ showToast }){
  const [users, setUsers] = useState(null);
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ name:'', email:'', password:'', role:'teacher', teacher_id:'' });
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState(null);
  const inp = useInpStyle();
  const myId = DATA._userRaw && DATA._userRaw.id;
  const teachers = DATA.TEACHERS||[];

  const load = ()=>{
    if(!(DATA._isLiveMode && window.API && window.API.listUsers)){ setUsers([]); return; }
    window.API.listUsers().then(setUsers).catch(()=>setUsers([]));
  };
  React.useEffect(load, []);

  const create = async()=>{
    if(!f.name.trim()||!f.email.trim()||!f.password){ showToast('กรอกข้อมูลให้ครบ','error'); return; }
    setBusy(true);
    try{
      const payload = { name:f.name.trim(), email:f.email.trim().toLowerCase(), password:f.password, role:f.role };
      if(f.role==='teacher' && f.teacher_id) payload.teacher_id = f.teacher_id;
      await window.API.createUser(payload);
      setF({ name:'', email:'', password:'', role:'teacher', teacher_id:'' }); setAdding(false);
      showToast('สร้างบัญชีพนักงานแล้ว ✓'); load();
    }catch(ex){ showToast(ex.body&&ex.body.error||ex.message||'สร้างไม่สำเร็จ','error'); }
    setBusy(false);
  };

  const del = async(u)=>{
    if(!confirm(`ลบบัญชี "${u.name}" (${u.email})?`)) return;
    try{ await window.API.deleteUser(u.id); showToast('ลบบัญชีแล้ว'); load(); }
    catch(ex){ showToast(ex.body&&ex.body.error||'ลบไม่สำเร็จ','error'); }
  };

  return (
    <>
      <SettingsCard title="บัญชีพนักงาน" sub="สร้าง login แยกให้ครู/พนักงาน — ครูเห็นเฉพาะนักเรียน/คาบของตัวเอง กดปุ่ม 'สิทธิ์' เพื่อปรับว่าให้เข้าถึง/แก้ไขหน้าไหนได้บ้าง">
        {users===null ? (
          <div style={{ color:'var(--text-3)', fontSize:13.5 }}>กำลังโหลด…</div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {users.map(u=>{
              const linkedTeacher = u.teacher_id ? (teachers.find(t=>(t._dbId||t.id)===u.teacher_id)||{}).name : null;
              return (
              <div key={u.id} style={{ background:'var(--surface-2)', borderRadius:10, padding:'12px 14px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <Avatar name={u.name} size={36}/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:600, fontSize:14 }}>{u.name}{u.id===myId && <span style={{ fontSize:11.5, color:'var(--text-3)', fontWeight:400 }}> · คุณ</span>}</div>
                    <div style={{ fontSize:12.5, color:'var(--text-3)' }}>{u.email}{linkedTeacher?` · ผูกกับ ${linkedTeacher}`:''}</div>
                  </div>
                  <span style={{ fontSize:12, fontWeight:700, padding:'3px 10px', borderRadius:99,
                    background: u.role==='owner'?'var(--primary-soft)':'var(--surface)', color:'var(--primary-ink)' }}>
                    {ROLE_LABEL[u.role]||u.role}
                  </span>
                  {u.role!=='owner' && (
                    <button className="btn btn-sm" style={{ fontSize:12.5 }} onClick={()=>setEditId(editId===u.id?null:u.id)}>
                      {editId===u.id?'ปิด':'สิทธิ์'}
                    </button>
                  )}
                  {u.role!=='owner' && u.id!==myId &&
                    <button className="icon-btn" style={{ border:0, color:'var(--danger)' }} title="ลบบัญชี" onClick={()=>del(u)}><Icon n="x" size={15}/></button>}
                </div>
                {editId===u.id && <StaffPermsEditor user={u} showToast={showToast} onSaved={()=>{ setEditId(null); load(); }}/>}
              </div>
            );})}
          </div>
        )}

        {adding ? (
          <div style={{ marginTop:14, padding:'16px', border:'1.5px dashed var(--primary)', borderRadius:12, display:'grid', gap:12 }}>
            <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
              <div style={{ flex:1, minWidth:140 }}>
                <label style={{ display:'block', fontWeight:600, fontSize:13, marginBottom:6 }}>ชื่อ</label>
                <input style={inp} value={f.name} onChange={e=>setF(p=>({...p,name:e.target.value}))} placeholder="เช่น ครูฟ้า"/>
              </div>
              <div style={{ flex:1, minWidth:140 }}>
                <label style={{ display:'block', fontWeight:600, fontSize:13, marginBottom:6 }}>บทบาท</label>
                <select style={inp} value={f.role} onChange={e=>setF(p=>({...p,role:e.target.value}))}>
                  <option value="teacher">ครูผู้สอน</option>
                  <option value="finance">การเงิน</option>
                  <option value="admin">ผู้ดูแล</option>
                </select>
              </div>
            </div>
            <div style={{ fontSize:12.5, color:'var(--text-3)', marginTop:-4 }}>{ROLE_DESC[f.role]}</div>
            {f.role==='teacher' && (
              <div>
                <label style={{ display:'block', fontWeight:600, fontSize:13, marginBottom:6 }}>ผูกกับครู <span style={{fontWeight:400,color:'var(--text-3)',fontSize:12}}>(เพื่อให้เห็นเฉพาะนักเรียน/คาบของครูคนนี้)</span></label>
                <select style={inp} value={f.teacher_id} onChange={e=>setF(p=>({...p,teacher_id:e.target.value}))}>
                  <option value="">— เลือกครู —</option>
                  {teachers.map(t=> <option key={t._dbId||t.id} value={t._dbId||t.id}>{t.name}</option>)}
                </select>
                {!f.teacher_id && <div style={{ fontSize:12, color:'var(--text-3)', marginTop:4 }}>เลือกภายหลังได้ที่ปุ่ม "สิทธิ์"</div>}
              </div>
            )}
            <div>
              <label style={{ display:'block', fontWeight:600, fontSize:13, marginBottom:6 }}>อีเมล (ใช้ login)</label>
              <input style={inp} type="email" value={f.email} onChange={e=>setF(p=>({...p,email:e.target.value}))} placeholder="teacher@email.com"/>
            </div>
            <div>
              <label style={{ display:'block', fontWeight:600, fontSize:13, marginBottom:6 }}>รหัสผ่านเริ่มต้น <span style={{fontWeight:400,color:'var(--text-3)',fontSize:12}}>(อย่างน้อย 6 ตัว)</span></label>
              <input style={inp} value={f.password} onChange={e=>setF(p=>({...p,password:e.target.value}))} placeholder="ตั้งรหัสให้พนักงาน"/>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button className="btn btn-primary" disabled={busy} onClick={create}>{busy?'กำลังสร้าง…':'สร้างบัญชี'}</button>
              <button className="btn" onClick={()=>setAdding(false)}>ยกเลิก</button>
            </div>
          </div>
        ) : (
          <button className="btn btn-primary" style={{ marginTop:14 }} onClick={()=>setAdding(true)}>
            <Icon n="plus" size={15}/> เพิ่มบัญชีพนักงาน
          </button>
        )}
      </SettingsCard>
    </>
  );
}

/* ===================== LINE Settings ===================== */
function PrefRow({ o, on, toggle }){
  return (
    <label style={{ display:'flex', alignItems:'center', gap:13, padding:'12px 2px', borderBottom:'1px solid var(--border)', cursor:'pointer' }}>
      <input type="checkbox" checked={on} onChange={toggle} style={{ width:18, height:18, accentColor:'var(--primary)', flexShrink:0 }}/>
      <div style={{ flex:1 }}>
        <div style={{ fontWeight:600, fontSize:13.5, display:'flex', alignItems:'center', gap:7, flexWrap:'wrap' }}>
          {o.label}
          {o.exp && <span style={{ fontSize:10.5, fontWeight:700, color:'#9333ea', background:'#9333ea18', padding:'1px 7px', borderRadius:99 }}>ทดลอง</span>}
        </div>
        <div style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>{o.hint}</div>
      </div>
      <span style={{ fontSize:12.5, fontWeight:700, color: on?'#06a046':'var(--text-3)' }}>{on?'เปิด':'ปิด'}</span>
    </label>
  );
}

function LineSettingsSection({ showToast }){
  const [configured, setConfigured] = useState(null); // null=loading
  const [secretCfg, setSecretCfg]   = useState(false);
  const [schoolId, setSchoolId]     = useState(DATA._schoolRaw?.id||null);
  const [token, setToken]   = useState('');
  const [secret, setSecret] = useState('');
  const [busy, setBusy]     = useState(false);
  const [testing, setTesting] = useState(false);
  const [bot, setBot]       = useState(null);
  const [prefs, setPrefs]   = useState({});
  const [teachers, setTeachers] = useState([]);
  const [contactPhone, setContactPhone] = useState('');
  const [oaUrl, setOaUrl]   = useState('');
  const [savingContact, setSavingContact] = useState(false);
  const [liffId, setLiffId] = useState('');
  const [savingLiff, setSavingLiff] = useState(false);
  const [inviteTpl, setInviteTpl] = useState('');
  const [savingTpl, setSavingTpl] = useState(false);
  const [hwTpl, setHwTpl] = useState('');
  const [savingHwTpl, setSavingHwTpl] = useState(false);
  const [welcomeEnabled, setWelcomeEnabled] = useState(true);
  const [welcomeMsg, setWelcomeMsg] = useState('');
  const [savingWelcome, setSavingWelcome] = useState(false);
  const inp = useInpStyle();
  const slug = DATA._schoolRaw && DATA._schoolRaw.slug ? DATA._schoolRaw.slug : '';

  const webhookUrl = schoolId ? `${(window.API&&window.API.base)||''}/api/line/webhook/${schoolId}` : '';
  const basicId   = bot && bot.basicId ? bot.basicId : '';
  const addUrl    = basicId ? `https://line.me/R/ti/p/${basicId}` : '';
  // QR generated entirely in-browser (no external service) → self-contained data URL
  let qrSrc = '';
  if(addUrl && window.qrcode){
    try{ const q = window.qrcode(0,'M'); q.addData(addUrl); q.make(); qrSrc = q.createDataURL(6, 2); }catch(e){}
  }

  // load current connection status (+ bot info for QR when connected)
  React.useEffect(()=>{
    if(!(DATA._isLiveMode && window.API && window.API.school)){ setConfigured(false); return; }
    window.API.school()
      .then(s=>{
        setConfigured(!!s.line_configured); setSecretCfg(!!s.line_secret_configured);
        if(s.id) setSchoolId(s.id);
        if(s.notify_prefs && typeof s.notify_prefs==='object') setPrefs(s.notify_prefs);
        setContactPhone(s.contact_phone||''); setOaUrl(s.line_oa_url||''); setLiffId(s.liff_id||'');
        setInviteTpl(s.invite_message_template||'');
        setHwTpl(s.homework_message_template||'');
        setWelcomeEnabled(s.line_welcome_enabled!==false);
        setWelcomeMsg(s.line_welcome_message||'');
        if(s.line_configured && window.API.testLine){
          window.API.testLine().then(r=>{ if(r.ok) setBot(r.bot); }).catch(()=>{});
        }
      })
      .catch(()=> setConfigured(false));
    if(window.API && window.API.teachers){
      window.API.teachers().then(t=>{ if(Array.isArray(t)) setTeachers(t); }).catch(()=>{});
    }
  }, []);

  const copy = (text)=>{ try{ navigator.clipboard.writeText(text); showToast('คัดลอกแล้ว ✓'); }catch(e){} };

  const togglePref = async(key, onByDefault)=>{
    // for default-on prefs (e.g. homework) an absent key counts as ON, so flip off that
    const cur = onByDefault ? (prefs[key]!==false) : !!prefs[key];
    const next = { ...prefs, [key]: !cur };
    setPrefs(next);
    try{ await window.API.updateSchool({ notify_prefs: next }); }
    catch(ex){ setPrefs(prefs); showToast('บันทึกไม่สำเร็จ','error'); }
  };

  const saveContact = async()=>{
    setSavingContact(true);
    try{
      await window.API.updateSchool({ contact_phone: contactPhone.trim(), line_oa_url: oaUrl.trim() });
      showToast('บันทึกข้อมูลติดต่อแล้ว ✓');
    }catch(ex){ showToast(ex.message||'บันทึกไม่สำเร็จ','error'); }
    setSavingContact(false);
  };

  // preset invite-message styles (placeholders {ชื่อ} {ลิงก์} filled in when copying)
  // {ผู้รับ} auto-fills the right greeting per student (พ่อแม่ / เรียนเอง / พี่ / ญาติ)
  const INVITE_PRESETS = {
    warm: "สวัสดีค่ะ {ผู้รับ} 💖\nเพื่อให้เช็กตารางเรียน ดูการบ้าน และรับแจ้งเตือนผ่าน LINE ได้สะดวก ทางโรงเรียนเตรียมระบบไว้ให้แล้วค่ะ\nแค่กดลิงก์ด้านล่างนี้ก็เชื่อมต่อได้ทันที ไม่ต้องพิมพ์รหัสเลยนะคะ 👇\n{ลิงก์}\nยินดีต้อนรับเข้าสู่ครอบครัวเรานะคะ 🌸",
    pro: "เรียน {ผู้รับ}\nเพื่อให้ติดตามการเข้าเรียน ตารางเรียน และใบเสร็จได้อย่างใกล้ชิด ทางสถาบันได้เปิดระบบแจ้งเตือนผ่าน LINE เรียบร้อยแล้วค่ะ\nรบกวนกดลิงก์ด้านล่างเพื่อเชื่อมต่อ (ใช้เวลาไม่เกิน 30 วินาที) 👇\n{ลิงก์}\nขอบพระคุณสำหรับความไว้วางใจค่ะ",
    quick: "สวัสดีค่ะ {ผู้รับ} 🥰\nรบกวนกดลิงก์นี้เพื่อเชื่อมระบบรับแจ้งเตือนตารางเรียน/การบ้านกับทางโรงเรียนนะคะ กดปุ่มเดียวเสร็จเลย ไม่ต้องกรอกรหัสค่ะ 👇\n{ลิงก์}\nขอบคุณมากค่ะ",
  };
  const saveInviteTpl = async()=>{
    setSavingTpl(true);
    try{
      const v = inviteTpl.trim();
      await window.API.updateSchool({ invite_message_template: v });
      DATA._schoolRaw = { ...(DATA._schoolRaw||{}), invite_message_template: v||null };
      showToast(v?'บันทึกข้อความเชิญแล้ว ✓ — ปุ่มคัดลอกในโปรไฟล์นักเรียนจะใช้ข้อความนี้':'ล้างข้อความแล้ว — ปุ่มคัดลอกจะคัดลอกเฉพาะลิงก์');
    }catch(ex){ showToast(ex.message||'บันทึกไม่สำเร็จ','error'); }
    setSavingTpl(false);
  };

  // default homework message (shown as the placeholder so owners see the built-in text)
  const HW_DEFAULT = "📚 แจ้งการบ้านของน้อง{ชื่อ}\n\n📝 {หัวข้อ}\n{รายละเอียด}\n⏰ ส่งภายใน {กำหนดส่ง}\n\nรบกวนช่วยดูแลน้องฝึกด้วยนะคะ 😊";
  const HW_PRESETS = {
    warm: "สวัสดีค่ะ {ผู้รับ} 💕\n\n📚 แจ้งการบ้าน: {หัวข้อ}\n{รายละเอียด}\n⏰ ส่งภายใน {กำหนดส่ง}\n\nฝากช่วยฝึกซ้อมด้วยนะคะ ขอบคุณค่ะ 😊",
    pro: "เรียน {ผู้รับ}\n\nการบ้านครั้งนี้: {หัวข้อ}\nรายละเอียด: {รายละเอียด}\nกำหนดส่ง: {กำหนดส่ง}\n\nรบกวนกำกับดูแลการฝึกซ้อมด้วยค่ะ ขอบพระคุณค่ะ",
    quick: "📝 {ผู้รับ}: การบ้าน {หัวข้อ}\n{รายละเอียด}\nส่งภายใน {กำหนดส่ง} ค่ะ",
  };
  const saveHwTpl = async()=>{
    setSavingHwTpl(true);
    try{
      const v = hwTpl.trim();
      await window.API.updateSchool({ homework_message_template: v });
      DATA._schoolRaw = { ...(DATA._schoolRaw||{}), homework_message_template: v||null };
      showToast(v?'บันทึกข้อความแจ้งการบ้านแล้ว ✓':'ล้างข้อความแล้ว — จะใช้ข้อความมาตรฐานของระบบ');
    }catch(ex){ showToast(ex.message||'บันทึกไม่สำเร็จ','error'); }
    setSavingHwTpl(false);
  };

  const saveWelcome = async()=>{
    setSavingWelcome(true);
    try{
      const v = welcomeMsg.trim();
      await window.API.updateSchool({ line_welcome_enabled: welcomeEnabled, line_welcome_message: v });
      DATA._schoolRaw = { ...(DATA._schoolRaw||{}), line_welcome_enabled: welcomeEnabled, line_welcome_message: v||null };
      showToast(v?'บันทึกข้อความต้อนรับแล้ว ✓':'ล้างข้อความแล้ว — จะใช้ข้อความมาตรฐานของระบบ');
    }catch(ex){ showToast(ex.message||'บันทึกไม่สำเร็จ','error'); }
    setSavingWelcome(false);
  };

  const saveLiff = async()=>{
    setSavingLiff(true);
    try{
      const v = liffId.trim();
      await window.API.updateSchool({ liff_id: v });
      DATA._schoolRaw = { ...(DATA._schoolRaw||{}), liff_id: v||null };
      showToast(v?'บันทึก LIFF ID แล้ว ✓ — เปิดลิงก์เชื่อมอัตโนมัติได้แล้ว':'ลบ LIFF ID แล้ว');
    }catch(ex){ showToast(ex.message||'บันทึกไม่สำเร็จ','error'); }
    setSavingLiff(false);
  };

  const saveToken = async()=>{
    if(!token.trim()){ showToast('กรุณาวาง Channel Access Token','error'); return; }
    setBusy(true);
    try{
      await window.API.updateSchool({ line_token: token.trim() });
      setConfigured(true); setToken('');
      showToast('เชื่อมต่อ LINE แล้ว ✓');
    }catch(ex){ showToast(ex.message||'บันทึกไม่สำเร็จ','error'); }
    setBusy(false);
  };

  const saveSecret = async()=>{
    setBusy(true);
    try{
      await window.API.updateSchool({ line_secret: secret.trim() });
      setSecretCfg(!!secret.trim()); setSecret('');
      showToast(secret.trim()?'บันทึก Channel Secret แล้ว ✓':'ลบ Channel Secret แล้ว');
    }catch(ex){ showToast(ex.message||'บันทึกไม่สำเร็จ','error'); }
    setBusy(false);
  };

  const disconnect = async()=>{
    if(!confirm('ยกเลิกการเชื่อมต่อ LINE? ระบบจะหยุดส่งข้อความผ่าน LINE')) return;
    setBusy(true);
    try{
      await window.API.updateSchool({ line_token: '', line_secret: '' });
      setConfigured(false); setSecretCfg(false); setBot(null);
      showToast('ยกเลิกการเชื่อมต่อแล้ว');
    }catch(ex){ showToast(ex.message||'ทำรายการไม่สำเร็จ','error'); }
    setBusy(false);
  };

  const testConn = async()=>{
    setTesting(true); setBot(null);
    try{
      const r = await window.API.testLine();
      if(r.ok){ setBot(r.bot); showToast('เชื่อมต่อสำเร็จ ✓'); }
      else showToast(r.note||'Token ใช้งานไม่ได้','error');
    }catch(ex){ showToast('ทดสอบไม่สำเร็จ','error'); }
    setTesting(false);
  };

  const Step = ({ n, children })=>(
    <div style={{ display:'flex', gap:12, marginBottom:12 }}>
      <div style={{ width:24, height:24, borderRadius:'50%', background:'var(--primary)', color:'#fff',
        display:'flex', alignItems:'center', justifyContent:'center', fontSize:12.5, fontWeight:700, flexShrink:0 }}>{n}</div>
      <div style={{ fontSize:13.5, lineHeight:1.65, color:'var(--text-2)', paddingTop:2 }}>{children}</div>
    </div>
  );

  const codeBox = { background:'var(--surface-2)', padding:'1px 6px', borderRadius:4, fontFamily:'monospace', fontSize:12.5 };

  return (
    <>
      {/* status card */}
      <SettingsCard title="สถานะการเชื่อมต่อ LINE">
        {configured===null ? (
          <div style={{ color:'var(--text-3)', fontSize:13.5 }}>กำลังตรวจสอบ…</div>
        ) : configured ? (
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14, flexWrap:'wrap' }}>
              <span style={{ padding:'4px 14px', borderRadius:20, fontSize:13, fontWeight:700,
                background:'#06c75522', color:'#06a046' }}>● เชื่อมต่อแล้ว</span>
              {bot && <span style={{ fontSize:13.5, fontWeight:600 }}>{bot.displayName} {bot.basicId?`(${bot.basicId})`:''}</span>}
            </div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16 }}>
              <button className="btn" style={{ fontSize:13 }} disabled={testing} onClick={testConn}>
                {testing?'กำลังทดสอบ…':'🔍 ทดสอบการเชื่อมต่อ'}
              </button>
              <button className="btn" style={{ fontSize:13, color:'var(--danger)', borderColor:'var(--danger)' }}
                disabled={busy} onClick={disconnect}>ยกเลิกการเชื่อมต่อ</button>
            </div>

            {/* webhook URL — needed for auto-linking parents */}
            <label style={{ display:'block', fontWeight:600, fontSize:13, marginBottom:6 }}>Webhook URL ของโรงเรียนคุณ</label>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <div style={{ ...inp, flex:1, fontFamily:'monospace', fontSize:12, background:'var(--surface-2)',
                color:'var(--text-2)', overflowX:'auto', whiteSpace:'nowrap', userSelect:'all' }}>{webhookUrl||'—'}</div>
              <button className="btn" style={{ fontSize:13, whiteSpace:'nowrap' }} onClick={()=>copy(webhookUrl)}>คัดลอก</button>
            </div>
            <div style={{ fontSize:12.5, color:'var(--text-3)', marginTop:6, lineHeight:1.55 }}>
              นำไปวางใน LINE Developers Console → Messaging API → <b>Webhook URL</b> แล้วเปิด <b>Use webhook</b>
            </div>

            {/* channel secret — REQUIRED: the webhook verifies every event's signature with it,
                so without it LINE events are all rejected (rich-menu buttons, auto-linking and
                class confirmations silently stop working). */}
            <label style={{ display:'block', fontWeight:600, fontSize:13, margin:'16px 0 6px' }}>
              Channel Secret <span style={{ fontWeight:400, color: secretCfg?'var(--text-3)':'var(--danger)', fontSize:12 }}>({secretCfg?'ตั้งค่าแล้ว — ใส่ใหม่เพื่อเปลี่ยน':'จำเป็น — ปุ่มเมนูและการเชื่อมอัตโนมัติจะไม่ทำงานถ้าไม่ใส่'})</span>
            </label>
            {!secretCfg && (
              <div style={{ background:'#DC262611', border:'1px solid var(--danger)', borderRadius:8,
                padding:'10px 12px', marginBottom:10, fontSize:12.5, lineHeight:1.6, color:'var(--text-2)' }}>
                ⚠️ ยังไม่ได้ใส่ Channel Secret — ตอนนี้เมื่อผู้ปกครองกดปุ่มในเมนู (เช่น "ข้อมูลของฉัน", "คอร์สคงเหลือ")
                หรือกดยืนยัน/แจ้งลา <b>ระบบจะไม่ตอบกลับ</b> เพราะตรวจสอบความปลอดภัยไม่ผ่าน<br/>
                วิธีแก้: LINE Developers Console → channel → แท็บ <b>Basic settings</b> → คัดลอก <b>Channel secret</b> มาวางด้านล่าง
              </div>
            )}
            <div style={{ display:'flex', gap:8 }}>
              <input style={{ ...inp, flex:1, ...(secretCfg?{}:{ borderColor:'var(--danger)' }) }} type="password" value={secret} onChange={e=>setSecret(e.target.value)}
                placeholder={secretCfg?'••••••••••••':'วาง Channel Secret'}/>
              <button className="btn" style={{ fontSize:13, whiteSpace:'nowrap' }} disabled={busy} onClick={saveSecret}>บันทึก</button>
            </div>

            {/* LIFF id — enables the one-tap auto-link flow for parents (no typing a code) */}
            <label style={{ display:'block', fontWeight:600, fontSize:13, margin:'16px 0 6px' }}>
              LIFF ID <span style={{ fontWeight:400, color:'var(--text-3)', fontSize:12 }}>(สำหรับลิงก์เชื่อมอัตโนมัติ — {liffId?'ตั้งค่าแล้ว':'ไม่บังคับ แต่แนะนำ'})</span>
            </label>
            <div style={{ display:'flex', gap:8 }}>
              <input style={{ ...inp, flex:1, fontFamily:'monospace', fontSize:12.5 }} value={liffId}
                onChange={e=>setLiffId(e.target.value)} placeholder="เช่น 1656879xxx-AbCdEfGh"/>
              <button className="btn" style={{ fontSize:13, whiteSpace:'nowrap' }} disabled={savingLiff} onClick={saveLiff}>บันทึก</button>
            </div>
            <div style={{ fontSize:12.5, color:'var(--text-3)', marginTop:6, lineHeight:1.55 }}>
              สร้างได้ใน LINE Developers Console → แท็บ <b>LIFF</b> → <b>Add</b> → ตั้ง Endpoint URL เป็น <code style={codeBox}>https://skooldee.com/link.html</code> → Size: <b>Compact</b> → Scope: <b>profile</b> → คัดลอก <b>LIFF ID</b> มาวาง<br/>
              เมื่อตั้งค่าแล้ว ปุ่ม "ลิงก์เชื่อมอัตโนมัติ" ในโปรไฟล์นักเรียนจะใช้งานได้ — ผู้ปกครองแตะลิงก์เดียวก็เชื่อมเสร็จ ไม่ต้องพิมพ์รหัส
            </div>

            {/* OA QR code for parents to scan */}
            {qrSrc && (
              <div style={{ marginTop:18, padding:'16px', background:'var(--surface-2)', borderRadius:12,
                display:'flex', gap:16, alignItems:'center', flexWrap:'wrap' }}>
                <img src={qrSrc} alt="LINE OA QR" width={120} height={120}
                  style={{ borderRadius:10, background:'#fff', padding:6, flexShrink:0 }}/>
                <div style={{ flex:1, minWidth:180 }}>
                  <div style={{ fontWeight:700, fontSize:14, marginBottom:4 }}>QR เพิ่มเพื่อน Official Account</div>
                  <div style={{ fontSize:12.5, color:'var(--text-2)', lineHeight:1.55, marginBottom:10 }}>
                    ให้ผู้ปกครองสแกน QR นี้เพื่อแอด {bot?.displayName||'OA'} เป็นเพื่อน แล้วส่ง "รหัสเชื่อมต่อ" ของบุตรหลาน
                  </div>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    <a className="btn btn-sm" href={qrSrc} download="line-oa-qr.gif" style={{ fontSize:12.5, textDecoration:'none' }}>⬇️ ดาวน์โหลด QR</a>
                    <button className="btn btn-sm" style={{ fontSize:12.5 }} onClick={()=>copy(addUrl)}>คัดลอกลิงก์แอด</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
              <span style={{ padding:'4px 14px', borderRadius:20, fontSize:13, fontWeight:700,
                background:'var(--surface-2)', color:'var(--text-3)' }}>○ ยังไม่เชื่อมต่อ</span>
            </div>
            <div style={{ display:'grid', gap:10 }}>
              <label style={{ fontWeight:600, fontSize:13 }}>Channel Access Token</label>
              <input style={inp} type="password" value={token} onChange={e=>setToken(e.target.value)}
                placeholder="วาง token ที่ได้จาก LINE Developers Console"/>
              <button className="btn btn-primary" style={{ alignSelf:'flex-start', padding:'10px 24px', fontWeight:700 }}
                disabled={busy} onClick={saveToken}>{busy?'กำลังบันทึก…':'เชื่อมต่อ LINE'}</button>
            </div>
          </div>
        )}
      </SettingsCard>

      {/* auto-notification preferences — to PARENTS (opt-in) */}
      {configured && (
        <SettingsCard title="แจ้งเตือนถึงผู้ปกครอง" sub="เลือกเหตุการณ์ที่อยากให้ระบบส่ง LINE ถึงผู้ปกครองโดยอัตโนมัติ (การบ้านเปิดไว้ให้ ส่วนอื่นปิดเริ่มต้น)">
          {[
            { key:'absent',     label:'เมื่อนักเรียนขาด/ลาเรียน', hint:'ส่งทันทีที่เช็คชื่อเป็นขาดหรือลา (ไม่ส่งตอนมาเรียนปกติ)' },
            { key:'homework',   label:'เมื่อมอบหมายการบ้าน',      hint:'ตั้งค่าให้ช่อง "แจ้งผู้ปกครองผ่าน LINE" ถูกติ๊กไว้อัตโนมัติตอนมอบหมายการบ้าน (ยังกดยกเลิกรายครั้งได้)', onByDefault:true },
            { key:'invoice',    label:'เมื่อออกใบแจ้งหนี้ใหม่',   hint:'แจ้งยอดที่ต้องชำระให้ผู้ปกครองทราบ' },
            { key:'near_limit', label:'เมื่อคอร์สใกล้หมด',         hint:'เตือนให้ต่อคอร์สเมื่อจำนวนคาบเหลือน้อย' },
            { key:'confirm_1d', label:'เตือนคอนเฟิมคลาส (ก่อนเรียน 1 วัน)', hint:'ส่งเตือนผู้ปกครองทุกเช้าว่าพรุ่งนี้น้องมีเรียน ให้ยืนยันหรือแจ้งลาล่วงหน้า — ช่วยลดการขาดเรียน' },
            { key:'birthday',   label:'อวยพรวันเกิดนักเรียน',      hint:'ส่งคำอวยพรถึงผู้ปกครองในวันเกิดของน้อง (เช้าวันเกิด)', exp:true },
          ].map(o=>(
            <PrefRow key={o.key} o={o} on={o.onByDefault ? prefs[o.key]!==false : !!prefs[o.key]} toggle={()=>togglePref(o.key, o.onByDefault)}/>
          ))}
          <div style={{ marginTop:12, fontSize:12.5, color:'var(--text-3)', lineHeight:1.55 }}>
            📌 ส่งได้เฉพาะนักเรียนที่ผู้ปกครอง<b>เชื่อม LINE แล้ว</b> (มีเครื่องหมาย ✓ ในโปรไฟล์นักเรียน)
          </div>
        </SettingsCard>
      )}

      {/* customizable invite message — used by the "copy link" button in a student's profile */}
      {configured && (
        <SettingsCard title="ข้อความเชิญผู้ปกครองเชื่อม LINE" sub="ข้อความที่จะถูกคัดลอกพร้อมลิงก์ เมื่อกด 'คัดลอกลิงก์เชื่อมอัตโนมัติ' ในโปรไฟล์นักเรียน — ส่งให้ผู้ปกครองทางแชตได้เลย">
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:10 }}>
            <span style={{ fontSize:12.5, color:'var(--text-3)', alignSelf:'center' }}>เลือกสไตล์สำเร็จรูป:</span>
            <button className="btn btn-sm" style={{ fontSize:12.5 }} onClick={()=>setInviteTpl(INVITE_PRESETS.warm)}>🌸 อบอุ่น กันเอง</button>
            <button className="btn btn-sm" style={{ fontSize:12.5 }} onClick={()=>setInviteTpl(INVITE_PRESETS.pro)}>🎓 มืออาชีพ</button>
            <button className="btn btn-sm" style={{ fontSize:12.5 }} onClick={()=>setInviteTpl(INVITE_PRESETS.quick)}>⚡ กระชับ</button>
          </div>
          <textarea style={{ ...inp, minHeight:140, lineHeight:1.6, resize:'vertical', fontFamily:'inherit' }}
            value={inviteTpl} onChange={e=>setInviteTpl(e.target.value)}
            placeholder={"เว้นว่างไว้ = คัดลอกเฉพาะลิงก์ (เหมือนเดิม)\n\nหรือพิมพ์ข้อความเอง ใช้ {ผู้รับ} แทนคำขึ้นต้น {ชื่อ} แทนชื่อน้อง และ {ลิงก์} แทนลิงก์เชื่อมต่อ"}/>
          <div style={{ fontSize:12, color:'var(--text-3)', marginTop:8, lineHeight:1.6 }}>
            ตัวแทนที่ใช้ได้: <code style={codeBox}>{'{ผู้รับ}'}</code> = คำขึ้นต้นตามผู้รับ (เช่น "คุณพ่อคุณแม่ของน้องเอย") · <code style={codeBox}>{'{ชื่อ}'}</code> = ชื่อเล่นน้อง · <code style={codeBox}>{'{ลิงก์}'}</code> = ลิงก์เชื่อมอัตโนมัติ
            {inviteTpl.length>0 && !inviteTpl.includes('{ลิงก์}') && <span style={{ color:'var(--danger)', display:'block', marginTop:4 }}>⚠️ ยังไม่มี {'{ลิงก์}'} ในข้อความ — ระบบจะต่อลิงก์ท้ายข้อความให้</span>}
          </div>
          <button className="btn btn-primary" style={{ alignSelf:'flex-start', marginTop:12, padding:'9px 22px', fontWeight:700 }}
            disabled={savingTpl} onClick={saveInviteTpl}>{savingTpl?'กำลังบันทึก…':'บันทึกข้อความ'}</button>
        </SettingsCard>
      )}

      {/* customizable homework-notification message — sent to parents when "notify" is ticked on assign */}
      {configured && (
        <SettingsCard title="ข้อความแจ้งการบ้านผ่าน LINE" sub="ข้อความที่ส่งหาผู้รับเมื่อมอบหมายการบ้านพร้อมติ๊กแจ้ง LINE — {ผู้รับ} จะปรับคำให้อัตโนมัติตาม 'ผู้รับแจ้งเตือน' ของนักเรียนแต่ละคน">
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:10 }}>
            <span style={{ fontSize:12.5, color:'var(--text-3)', alignSelf:'center' }}>เลือกสไตล์สำเร็จรูป:</span>
            <button className="btn btn-sm" style={{ fontSize:12.5 }} onClick={()=>setHwTpl(HW_PRESETS.warm)}>🌸 อบอุ่น กันเอง</button>
            <button className="btn btn-sm" style={{ fontSize:12.5 }} onClick={()=>setHwTpl(HW_PRESETS.pro)}>🎓 มืออาชีพ</button>
            <button className="btn btn-sm" style={{ fontSize:12.5 }} onClick={()=>setHwTpl(HW_PRESETS.quick)}>⚡ กระชับ</button>
          </div>
          <textarea style={{ ...inp, minHeight:130, lineHeight:1.6, resize:'vertical', fontFamily:'inherit' }}
            value={hwTpl} onChange={e=>setHwTpl(e.target.value)}
            placeholder={"เว้นว่างไว้ = ใช้ข้อความมาตรฐานของระบบ:\n\n"+HW_DEFAULT}/>
          <div style={{ fontSize:12, color:'var(--text-3)', marginTop:8, lineHeight:1.7 }}>
            ตัวแทนที่ใช้ได้: <code style={codeBox}>{'{ผู้รับ}'}</code> คำขึ้นต้นตามผู้รับ · <code style={codeBox}>{'{ชื่อ}'}</code> ชื่อเล่นน้อง · <code style={codeBox}>{'{หัวข้อ}'}</code> หัวข้อการบ้าน · <code style={codeBox}>{'{รายละเอียด}'}</code> · <code style={codeBox}>{'{กำหนดส่ง}'}</code>
          </div>
          <button className="btn btn-primary" style={{ alignSelf:'flex-start', marginTop:12, padding:'9px 22px', fontWeight:700 }}
            disabled={savingHwTpl} onClick={saveHwTpl}>{savingHwTpl?'กำลังบันทึก…':'บันทึกข้อความ'}</button>
        </SettingsCard>
      )}

      {/* customizable welcome message — sent when parent/student links their LINE account */}
      {configured && (
        <SettingsCard title="ข้อความต้อนรับ LINE" sub="ข้อความที่ส่งเมื่อผู้ปกครองหรือนักเรียนเชื่อมบัญชี LINE สำเร็จ (หรือเปิด/ปิดการส่งข้อความต้อนรับ)">
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
            <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:14, fontWeight:600 }}>
              <input type="checkbox" checked={welcomeEnabled} onChange={e=>setWelcomeEnabled(e.target.checked)}
                style={{ width:18, height:18, cursor:'pointer', accentColor:'var(--primary)' }}/>
              <span>เปิดใช้งานการส่งข้อความต้อนรับ</span>
            </label>
          </div>
          {welcomeEnabled && (
            <>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:10 }}>
                <span style={{ fontSize:12.5, color:'var(--text-3)', alignSelf:'center' }}>เลือกสไตล์สำเร็จรูป:</span>
                <button className="btn btn-sm" style={{ fontSize:12.5 }}
                  onClick={()=>setWelcomeMsg('เชื่อมต่อสำเร็จ ✓\n\nคุณจะได้รับแจ้งเตือนตารางเรียนและข่าวสารผ่าน LINE นี้แล้วค่ะ 🎉')}>
                  🌸 อบอุ่น กันเอง
                </button>
                <button className="btn btn-sm" style={{ fontSize:12.5 }}
                  onClick={()=>setWelcomeMsg('เชื่อมต่อสำเร็จ ✓\n\nระบบแจ้งเตือนถูกเปิดใช้งาน คุณจะได้รับข้อมูลการเรียนและข่าวสารต่างๆ ผ่านช่องทางนี้')}>
                  🎓 มืออาชีพ
                </button>
                <button className="btn btn-sm" style={{ fontSize:12.5 }}
                  onClick={()=>setWelcomeMsg('เชื่อมเสร็จแล้ว ✓ พร้อมรับข้อมูลติดตามผ่าน LINE')}>
                  ⚡ กระชับ
                </button>
              </div>
              <textarea style={{ ...inp, minHeight:100, lineHeight:1.6, resize:'vertical', fontFamily:'inherit' }}
                value={welcomeMsg} onChange={e=>setWelcomeMsg(e.target.value)}
                placeholder={"เว้นว่างไว้ = ใช้ข้อความมาตรฐานของระบบ\n\nข้อความมาตรฐาน:\n- สำหรับผู้ปกครอง: 'เชื่อมต่อสำเร็จ ✓\\n\\nคุณจะได้รับแจ้งเตือนของ [ชื่อน้อง] ผ่าน LINE นี้แล้วค่ะ 🎉'\n- สำหรับครู: 'เชื่อมต่อสำเร็จ ✓\\n\\n[ชื่อครู] จะได้รับแจ้งเตือนตารางสอนและข่าวสารผ่าน LINE นี้แล้วค่ะ 🎉'"}/>
              <div style={{ fontSize:12.5, color:'var(--text-3)', marginTop:8, lineHeight:1.6 }}>
                💡 เว้นว่างไว้เพื่อใช้ข้อความมาตรฐานของระบบแทน หากต้องการปิดการส่งข้อความต้อนรับให้ปิดการใช้งานด้านบน
              </div>
            </>
          )}
          <button className="btn btn-primary" style={{ alignSelf:'flex-start', marginTop:12, padding:'9px 22px', fontWeight:700 }}
            disabled={savingWelcome} onClick={saveWelcome}>{savingWelcome?'กำลังบันทึก…':'บันทึกการตั้งค่า'}</button>
        </SettingsCard>
      )}

      {/* auto-notification preferences — to TEACHERS (opt-in) */}
      {configured && (
        <SettingsCard title="แจ้งเตือนถึงครูผู้สอน" sub="ส่ง LINE ถึงครูที่เชื่อมบัญชีแล้ว (ครูต้องแอด OA และส่งรหัสครูของตัวเอง — ดูด้านล่าง)">
          {[
            { key:'t_daily',   label:'ตารางสอนรายวัน (ทุกเช้า)', hint:'สรุปคาบสอนของวันนั้นส่งให้ครูทุกเช้า' },
            { key:'t_change',  label:'เมื่อคาบถูกยกเลิก/เพิ่มคาบชดเชย', hint:'แจ้งครูทันทีที่มีการยกเลิกหรือเพิ่มคาบชดเชยในตารางของเขา' },
            { key:'t_absent',  label:'เมื่อนักเรียนในคาบขาด/ลา',  hint:'แจ้งครูเมื่อมีนักเรียนในคาบของเขาถูกเช็คเป็นขาด/ลา' },
            { key:'t_monthly', label:'สรุปค่าสอนรายเดือน',        hint:'ส่งสรุปชั่วโมงสอน + ค่าสอนให้ครูต้นเดือน' },
          ].map(o=>(
            <PrefRow key={o.key} o={o} on={!!prefs[o.key]} toggle={()=>togglePref(o.key)}/>
          ))}
        </SettingsCard>
      )}

      {/* teacher link codes — each teacher sends this to the OA to connect */}
      {configured && (
        <SettingsCard title="รหัสเชื่อม LINE ของครู" sub="ให้ครูแต่ละคนแอด Official Account แล้วส่ง 'รหัสครู' ของตัวเองในแชต เพื่อเริ่มรับแจ้งเตือน">
          {teachers.length===0 ? (
            <div style={{ fontSize:13, color:'var(--text-3)', padding:'6px 0' }}>ยังไม่มีครูในระบบ</div>
          ) : teachers.map(t=>(
            <div key={t.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 2px', borderBottom:'1px solid var(--border)' }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:600, fontSize:13.5 }}>{t.name}</div>
                <div style={{ fontSize:12, color: t.line_linked?'#06a046':'var(--text-3)', marginTop:2 }}>
                  {t.line_linked ? '✓ เชื่อม LINE แล้ว' : 'ยังไม่ได้เชื่อม'}
                </div>
              </div>
              {t.link_code && <>
                <code style={{ ...codeBox, fontSize:13, fontWeight:700, letterSpacing:'.04em' }}>{t.link_code}</code>
                <button className="btn btn-sm" style={{ fontSize:12.5 }} onClick={()=>copy(t.link_code)}>คัดลอก</button>
              </>}
            </div>
          ))}
          <div style={{ marginTop:12, fontSize:12.5, color:'var(--text-3)', lineHeight:1.55 }}>
            💡 ครูใช้ QR เพิ่มเพื่อน OA (ด้านบน) เหมือนผู้ปกครอง แล้วพิมพ์รหัสครูของตัวเองส่งในแชต
          </div>
        </SettingsCard>
      )}

      {/* renew landing page contact (link sent to parents via LINE) */}
      {configured && (
        <SettingsCard title="หน้า 'ต่อคอร์ส' (ลิงก์ใน LINE)" sub="ข้อมูลติดต่อที่แสดงในหน้าต่อคอร์สที่ส่งให้ผู้ปกครองทาง LINE">
          {slug && (
            <div style={{ fontSize:12.5, color:'var(--text-2)', marginBottom:14 }}>
              ลิงก์หน้าต่อคอร์ส: <code style={codeBox}>skooldee.com/{slug}/renew</code>
            </div>
          )}
          <label style={{ display:'block', fontWeight:600, fontSize:13, marginBottom:6 }}>เบอร์โทรโรงเรียน</label>
          <input style={{ ...inp, marginBottom:14 }} value={contactPhone} onChange={e=>setContactPhone(e.target.value)} placeholder="เช่น 0812345678"/>
          <label style={{ display:'block', fontWeight:600, fontSize:13, marginBottom:6 }}>ลิงก์แชต LINE OA <span style={{ fontWeight:400, color:'var(--text-3)', fontSize:12 }}>(ไม่บังคับ)</span></label>
          <input style={{ ...inp, marginBottom:14 }} value={oaUrl} onChange={e=>setOaUrl(e.target.value)} placeholder={addUrl||'https://line.me/R/ti/p/@youroa'}/>
          <button className="btn btn-primary" style={{ padding:'9px 22px', fontWeight:700 }} disabled={savingContact} onClick={saveContact}>
            {savingContact?'กำลังบันทึก…':'บันทึก'}
          </button>
        </SettingsCard>
      )}

      {/* setup guide */}
      <SettingsCard title="วิธีเชื่อมต่อ (ทำครั้งเดียว ~10 นาที)"
        sub="ทำตามขั้นตอนนี้เพื่อให้ระบบส่งแจ้งเตือนถึงผู้ปกครองผ่าน LINE ได้อัตโนมัติ">
        <Step n={1}>สมัคร <b>LINE Official Account</b> ที่ <code style={codeBox}>business.line.me</code> (ฟรี)</Step>
        <Step n={2}>เข้า <b>LINE Developers Console</b> (<code style={codeBox}>developers.line.biz</code>) → สร้าง <b>Messaging API channel</b> ผูกกับ OA ของคุณ</Step>
        <Step n={3}>แท็บ <b>Messaging API</b> → หา <b>Channel access token</b> → กด <b>Issue</b> → คัดลอกมาวางด้านบน แล้วกด "เชื่อมต่อ LINE"</Step>
        <Step n={4}>หลังเชื่อมต่อ → คัดลอก <b>Webhook URL</b> (ด้านบน) ไปวางในช่อง <b>Webhook URL</b> ของ console → เปิด <b>Use webhook</b></Step>
        <Step n={5}>คัดลอก <b>Channel Secret</b> (แท็บ Basic settings) มาใส่ในช่องด้านบน เพื่อยืนยันความปลอดภัยของ webhook</Step>
        <Step n={6}>ให้ผู้ปกครอง <b>แอด Official Account เป็นเพื่อน</b> แล้ว <b>พิมพ์ "รหัสเชื่อมต่อ"</b> ของบุตรหลาน (ดูได้ในโปรไฟล์นักเรียนแต่ละคน) — ระบบจะจับคู่ให้อัตโนมัติ ✓</Step>
        <div style={{ marginTop:6, padding:'11px 14px', background:'var(--primary-soft)', borderRadius:10,
          fontSize:12.5, color:'var(--primary-ink)', lineHeight:1.6 }}>
          💡 Token และ Secret เก็บไว้ในระบบแบบไม่แสดงซ้ำ — ถ้าต้องเปลี่ยนให้ใส่ค่าใหม่ทับได้เลย
        </div>
      </SettingsCard>
    </>
  );
}

/* ===================== LINE Rich Menu builder ===================== */
/* The tappable menu pinned under the OA chat. Two equal modes:
 *   • template — pick a grid, label/colour each button; we render the PNG in-browser
 *   • upload   — bring a finished 2500×1686 / 2500×843 image; the grid defines tap areas
 * Both produce { size, areas[{bounds,action}], image } that POST /api/rich-menu/publish
 * sends to LINE (create → upload image → set as default for all followers).            */

const RM_SIZES   = { large: { width: 2500, height: 1686 }, compact: { width: 2500, height: 843 } };
const RM_PRESETS = [
  { key:'c3', label:'3 ปุ่ม',            size:'compact', rows:[{cols:3}] },
  { key:'c2', label:'2 ปุ่ม',            size:'compact', rows:[{cols:2}] },
  { key:'l4', label:'4 ปุ่ม (2×2)',      size:'large',   rows:[{cols:2},{cols:2}] },
  { key:'l6', label:'6 ปุ่ม (3×2)',      size:'large',   rows:[{cols:3},{cols:3}] },
  { key:'b3', label:'แบนเนอร์ + 3 ปุ่ม', size:'large',   rows:[{cols:1},{cols:3}] },
  { key:'b2', label:'แบนเนอร์ + 2 ปุ่ม', size:'large',   rows:[{cols:1},{cols:2}] },
];
const RM_DESTS = [
  { key:'booking',  label:'จองคลาส',     icon:'📅', needsUrl:false },
  { key:'portal',   label:'ข้อมูลของฉัน', icon:'👤', needsUrl:false },
  { key:'packages', label:'คอร์สคงเหลือ', icon:'📦', needsUrl:false },
  { key:'website',  label:'เว็บไซต์',     icon:'🌐', needsUrl:true  },
  { key:'custom',   label:'ลิงก์อื่น',    icon:'🔗', needsUrl:true  },
];
const RM_PALETTE = ['#FDE2E4','#E2ECE9','#E4E9FD','#FFF1D6','#E8E4FD','#D6F0FF'];
const rmDest = (k)=> RM_DESTS.find(d=>d.key===k) || null;
const rmCellCount = (rows)=> rows.reduce((s,r)=>s+(r.cols||0), 0);
const rmDefaultButton = (i)=>({ dest:'', label:'', icon:'', url:'', color:RM_PALETTE[i%RM_PALETTE.length] });
function rmResizeButtons(rows, prev){
  const n = rmCellCount(rows); const out=[];
  for(let i=0;i<n;i++) out.push(prev[i] || rmDefaultButton(i));
  return out;
}
// Row-major pixel bounds for every cell — cumulative rounding guarantees full, gap-free
// coverage that stays inside the menu size (what LINE requires).
function rmBounds(sz, rows){
  const out=[]; const R=rows.length;
  for(let i=0;i<R;i++){
    const y=Math.round(i*sz.height/R), y2=Math.round((i+1)*sz.height/R), cols=rows[i].cols;
    for(let j=0;j<cols;j++){
      const x=Math.round(j*sz.width/cols), x2=Math.round((j+1)*sz.width/cols);
      out.push({ x, y, width:x2-x, height:y2-y });
    }
  }
  return out;
}
// Draw the menu image at full resolution. Flat colours keep PNG tiny; fall back to JPEG
// only if it would exceed LINE's 1 MB limit.
function rmRenderImage(sz, rows, buttons, bg){
  const c=document.createElement('canvas'); c.width=sz.width; c.height=sz.height;
  const x=c.getContext('2d');
  x.fillStyle=bg||'#ffffff'; x.fillRect(0,0,sz.width,sz.height);
  const bnds=rmBounds(sz, rows);
  bnds.forEach((b,i)=>{
    const btn=buttons[i]||{};
    if(btn.color){ x.fillStyle=btn.color; x.fillRect(b.x,b.y,b.width,b.height); }
    x.strokeStyle='rgba(0,0,0,0.10)'; x.lineWidth=3; x.strokeRect(b.x+1.5,b.y+1.5,b.width-3,b.height-3);
    const cx=b.x+b.width/2, cy=b.y+b.height/2;
    const hasLabel=btn.label && btn.label.trim();
    x.textAlign='center'; x.textBaseline='middle';
    if(btn.icon){
      const isz=Math.min(b.width,b.height)*0.34;
      x.font=isz+'px "Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",sans-serif';
      x.fillText(btn.icon, cx, hasLabel ? cy-isz*0.42 : cy);
    }
    if(hasLabel){
      const fs=Math.min(b.width*0.13, b.height*0.20, 70);
      x.fillStyle='#2b2b2b';
      x.font='600 '+fs+'px "IBM Plex Sans Thai","Sarabun","Noto Sans Thai",sans-serif';
      x.fillText(btn.label.trim(), cx, btn.icon ? cy+Math.min(b.width,b.height)*0.16 : cy);
    }
  });
  let url=c.toDataURL('image/png');
  if(url.length>1300000) url=c.toDataURL('image/jpeg',0.85);
  return url;
}

function RichMenuSettingsSection({ showToast }){
  const inp = useInpStyle();
  const slug   = (DATA._schoolRaw && DATA._schoolRaw.slug) || '';
  const oaUrl  = (DATA._schoolRaw && DATA._schoolRaw.line_oa_url) || '';
  const bookUrl = slug ? `https://skooldee.com/book?school=${encodeURIComponent(slug)}` : 'https://skooldee.com/book';

  const [loading, setLoading]   = useState(true);
  const [lineCfg, setLineCfg]   = useState(false);
  const [published, setPublished] = useState(false);
  const [activeOnLine, setActiveOnLine] = useState(null);
  const [savedImage, setSavedImage] = useState(null);

  const [mode, setMode]         = useState('template'); // 'template' | 'upload'
  const [sizeKey, setSizeKey]   = useState('compact');
  const [rows, setRows]         = useState([{cols:3}]);
  const [buttons, setButtons]   = useState(()=>rmResizeButtons([{cols:3}], []));
  const [chatBarText, setChatBarText] = useState('เมนู');
  const [bgColor, setBgColor]   = useState('#ffffff');
  const [uploadImage, setUploadImage] = useState(null);
  const [uploadErr, setUploadErr] = useState('');
  const [busy, setBusy]         = useState(false);
  const fileRef = React.useRef();

  const sz = RM_SIZES[sizeKey];

  React.useEffect(()=>{
    if(!(DATA._isLiveMode && window.API && window.API.richMenu)){ setLoading(false); return; }
    window.API.richMenu().then(r=>{
      setLineCfg(!!r.line_configured);
      setPublished(!!r.published);
      setActiveOnLine(r.active_on_line);
      setSavedImage(r.image||null);
      const cfg=r.config;
      if(cfg && typeof cfg==='object'){
        if(cfg.mode) setMode(cfg.mode);
        if(cfg.size && RM_SIZES[cfg.size]) setSizeKey(cfg.size);
        if(Array.isArray(cfg.rows) && cfg.rows.length){ setRows(cfg.rows); setButtons(rmResizeButtons(cfg.rows, cfg.buttons||[])); }
        if(cfg.chatBarText) setChatBarText(cfg.chatBarText);
        if(cfg.bgColor) setBgColor(cfg.bgColor);
        if(cfg.mode==='upload' && r.image) setUploadImage(r.image);
      }
    }).catch(()=>{}).finally(()=>setLoading(false));
  }, []);

  // ---- layout editing (keeps the buttons array in lockstep with the grid) ----
  const applyPreset = (p)=>{
    setSizeKey(p.size);
    const r = p.rows.map(x=>({cols:x.cols}));
    setRows(r); setButtons(b=>rmResizeButtons(r, b));
  };
  const setRowCols = (i, cols)=>{
    cols=Math.max(1, Math.min(4, cols));
    const r = rows.map((x,idx)=> idx===i ? {cols} : x);
    if(rmCellCount(r)>20){ showToast('Rich Menu มีได้สูงสุด 20 ปุ่ม','error'); return; }
    setRows(r); setButtons(b=>rmResizeButtons(r, b));
  };
  const addRow = ()=>{
    const r=[...rows,{cols:2}];
    if(rmCellCount(r)>20){ showToast('Rich Menu มีได้สูงสุด 20 ปุ่ม','error'); return; }
    setRows(r); setButtons(b=>rmResizeButtons(r, b));
  };
  const removeRow = (i)=>{
    if(rows.length<=1) return;
    const r=rows.filter((_,idx)=>idx!==i);
    setRows(r); setButtons(b=>rmResizeButtons(r, b));
  };
  const setBtn = (i, patch)=> setButtons(bs=> bs.map((b,idx)=> idx===i ? {...b, ...patch} : b));
  const onDest = (i, key)=>{
    const d=rmDest(key); const b=buttons[i]||{};
    setBtn(i, { dest:key, label:b.label||(d?d.label:''), icon:b.icon||(d?d.icon:'') });
  };

  const onUpload = (e)=>{
    const f=e.target.files && e.target.files[0]; if(!f){ return; }
    const rd=new FileReader();
    rd.onload=()=>{
      const img=new Image();
      img.onload=()=>{
        const match=Object.entries(RM_SIZES).find(([,v])=>v.width===img.naturalWidth && v.height===img.naturalHeight);
        if(!match){ setUploadErr(`ขนาดรูปต้องเป็น 2500×1686 หรือ 2500×843 — ได้รับ ${img.naturalWidth}×${img.naturalHeight}`); return; }
        let url=rd.result;
        if(typeof url==='string' && url.length>1300000){
          const c=document.createElement('canvas'); c.width=img.naturalWidth; c.height=img.naturalHeight;
          c.getContext('2d').drawImage(img,0,0); url=c.toDataURL('image/jpeg',0.85);
        }
        setUploadErr(''); setSizeKey(match[0]); setUploadImage(url);
      };
      img.onerror=()=> setUploadErr('อ่านรูปไม่สำเร็จ');
      img.src=rd.result;
    };
    rd.readAsDataURL(f);
    if(e.target) e.target.value='';
  };

  const rmActionFor = (b)=>{
    switch(b.dest){
      case 'booking':  return { type:'postback', data:'action=booking', displayText:b.label||'จองคลาส' };
      case 'portal':   return { type:'postback', data:'action=parent_portal', displayText:b.label||'ข้อมูลของฉัน' };
      case 'packages': return { type:'postback', data:'action=packages', displayText:b.label||'คอร์สคงเหลือ' };
      case 'website':  return { type:'uri', uri:(b.url||oaUrl||'https://skooldee.com').trim(), label:(b.label||'เว็บไซต์').slice(0,20) };
      case 'custom':   return { type:'uri', uri:(b.url||'').trim(), label:(b.label||'ลิงก์').slice(0,20) };
      default: return null;
    }
  };

  const publish = async()=>{
    if(!lineCfg){ showToast('เชื่อมต่อ LINE ก่อน (แท็บ 🔔 LINE แจ้งเตือน)','error'); return; }
    for(let i=0;i<buttons.length;i++){
      const b=buttons[i], d=rmDest(b.dest);
      if(!d){ showToast(`ปุ่มที่ ${i+1}: ยังไม่ได้เลือกปลายทาง`,'error'); return; }
      if(d.needsUrl && !((b.url||(b.dest==='website'&&oaUrl)||'')).trim()){ showToast(`ปุ่มที่ ${i+1}: ใส่ลิงก์ก่อน`,'error'); return; }
    }
    let image;
    if(mode==='upload'){
      if(!uploadImage){ showToast('อัปโหลดรูปเมนูก่อน','error'); return; }
      image=uploadImage;
    } else {
      image=rmRenderImage(sz, rows, buttons, bgColor);
    }
    const areas=rmBounds(sz, rows).map((bnds,i)=>({ bounds:bnds, action:rmActionFor(buttons[i]) }));
    const config={ mode, size:sizeKey, rows, buttons, chatBarText, bgColor };
    setBusy(true);
    try{
      await window.API.publishRichMenu({ size:sz, chatBarText:chatBarText||'เมนู', name:'skooldee:'+(slug||'menu'), areas, image, config });
      setPublished(true); setActiveOnLine(true); setSavedImage(image);
      showToast('เผยแพร่เมนูไปยัง LINE แล้ว ✓ — ผู้ที่แอด OA จะเห็นเมนูนี้');
    }catch(ex){ showToast(ex.message||'เผยแพร่ไม่สำเร็จ','error'); }
    setBusy(false);
  };

  const remove = async()=>{
    if(!confirm('ลบ Rich Menu ออกจาก LINE? ผู้ใช้จะไม่เห็นเมนูนี้อีก')) return;
    setBusy(true);
    try{
      await window.API.deleteRichMenu();
      setPublished(false); setActiveOnLine(null); setSavedImage(null);
      showToast('ลบเมนูแล้ว');
    }catch(ex){ showToast(ex.message||'ลบไม่สำเร็จ','error'); }
    setBusy(false);
  };

  if(loading) return <SettingsCard title="เมนู LINE (Rich Menu)"><div style={{ color:'var(--text-3)', fontSize:13.5 }}>กำลังโหลด…</div></SettingsCard>;

  // ---- live preview (scaled): colours+icon+label in template mode, image+overlay in upload ----
  const pct=(b)=>({ left:`${b.x/sz.width*100}%`, top:`${b.y/sz.height*100}%`, width:`${b.width/sz.width*100}%`, height:`${b.height/sz.height*100}%` });
  const previewBnds=rmBounds(sz, rows);
  const Preview=()=>(
    <div style={{ position:'relative', width:'100%', maxWidth:480, aspectRatio:`${sz.width} / ${sz.height}`,
      margin:'0 auto', borderRadius:12, overflow:'hidden', border:'1px solid var(--border)',
      background: mode==='upload' ? 'var(--surface-2)' : bgColor }}>
      {mode==='upload' && uploadImage && <img src={uploadImage} alt="เมนู" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover' }}/>}
      {previewBnds.map((b,i)=>{
        const btn=buttons[i]||{};
        return (
          <div key={i} style={{ position:'absolute', ...pct(b),
            background: mode==='template' ? (btn.color||'transparent') : 'rgba(0,0,0,0.04)',
            border:'1px solid rgba(0,0,0,0.10)', display:'flex', flexDirection:'column',
            alignItems:'center', justifyContent:'center', gap:2, boxSizing:'border-box', overflow:'hidden' }}>
            {mode==='template' && btn.icon && <span style={{ fontSize:22, lineHeight:1 }}>{btn.icon}</span>}
            {btn.label
              ? <span style={{ fontSize:12, fontWeight:600, color: mode==='upload'?'#fff':'#2b2b2b',
                  textShadow: mode==='upload'?'0 1px 3px rgba(0,0,0,.6)':'none', textAlign:'center', padding:'0 4px' }}>{btn.label}</span>
              : <span style={{ fontSize:11, color:'var(--text-3)' }}>ปุ่ม {i+1}</span>}
          </div>
        );
      })}
    </div>
  );

  return (
    <>
      <SettingsCard title="เมนู LINE (Rich Menu)"
        sub="เมนูปุ่มกดที่ปักอยู่ใต้ห้องแชต Official Account — ให้ผู้ปกครองกดเข้าจองคลาส ดูข้อมูล หรือเปิดเว็บไซต์ได้ทันที">
        {!lineCfg && (
          <div style={{ padding:'11px 14px', background:'#fff4e5', border:'1px solid #ffd596', borderRadius:10, fontSize:13, color:'#8a5a00', lineHeight:1.6 }}>
            ⚠️ ยังไม่ได้เชื่อมต่อ LINE — ไปที่แท็บ <b>🔔 LINE แจ้งเตือน</b> เพื่อใส่ Channel Access Token ก่อน แล้วจึงเผยแพร่เมนูได้
          </div>
        )}
        {published && (
          <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', marginTop: !lineCfg?14:0 }}>
            <span style={{ padding:'4px 14px', borderRadius:20, fontSize:13, fontWeight:700, background:'#06c75522', color:'#06a046' }}>● เผยแพร่แล้ว</span>
            {activeOnLine===false && <span style={{ fontSize:12.5, color:'var(--danger)' }}>(เมนูถูกเปลี่ยน/ลบบน LINE — เผยแพร่ใหม่เพื่อแก้)</span>}
            <button className="btn btn-sm" style={{ color:'var(--danger)', borderColor:'var(--danger)' }} disabled={busy} onClick={remove}>ลบเมนูออกจาก LINE</button>
          </div>
        )}
      </SettingsCard>

      {/* mode switch */}
      <SettingsCard title="รูปแบบเมนู">
        <div style={{ display:'flex', gap:8, marginBottom:6, flexWrap:'wrap' }}>
          {[['template','🎨 สร้างจากเทมเพลต'],['upload','🖼️ อัปโหลดรูปเอง']].map(([k,lbl])=>(
            <button key={k} onClick={()=>setMode(k)} style={{ padding:'8px 16px', borderRadius:8, cursor:'pointer',
              border:'1.5px solid '+(mode===k?'var(--primary)':'var(--border)'), fontWeight:600, fontSize:13,
              background: mode===k?'var(--primary-soft)':'var(--surface)', color: mode===k?'var(--primary-ink)':'var(--text-2)' }}>{lbl}</button>
          ))}
        </div>
        <div style={{ fontSize:12.5, color:'var(--text-3)', lineHeight:1.55 }}>
          {mode==='template'
            ? 'เลือกตาราง ใส่ไอคอน/ข้อความ/สีให้แต่ละปุ่ม — ระบบสร้างรูปเมนูให้อัตโนมัติ ไม่ต้องใช้โปรแกรมออกแบบ'
            : 'อัปโหลดรูปที่ออกแบบเองขนาด 2500×1686 (เต็ม) หรือ 2500×843 (เตี้ย) แล้วกำหนดพื้นที่กดด้วยตารางด้านล่าง'}
        </div>
      </SettingsCard>

      {/* layout / image source */}
      <SettingsCard title={mode==='upload' ? 'รูปเมนู + พื้นที่กด' : 'เลือกเลย์เอาต์'}>
        {mode==='upload' && (
          <div style={{ marginBottom:18 }}>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg" style={{ display:'none' }} onChange={onUpload}/>
            <button className="btn btn-soft btn-sm" onClick={()=>fileRef.current && fileRef.current.click()}>
              {uploadImage ? '🔄 เปลี่ยนรูป' : '📷 อัปโหลดรูปเมนู'}
            </button>
            <span style={{ fontSize:12, color:'var(--text-3)', marginLeft:10 }}>PNG/JPEG · 2500×1686 หรือ 2500×843 · ≤ 1 MB</span>
            {uploadErr && <div style={{ fontSize:12.5, color:'var(--danger)', marginTop:8 }}>{uploadErr}</div>}
          </div>
        )}
        {mode==='template' && (
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16 }}>
            {RM_PRESETS.map(p=>(
              <button key={p.key} onClick={()=>applyPreset(p)} className="btn btn-sm"
                style={{ fontSize:12.5 }}>{p.label}</button>
            ))}
          </div>
        )}

        {/* per-row column editor (defines the tap-area grid for BOTH modes) */}
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {rows.map((r,i)=>(
            <div key={i} style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
              <span style={{ fontSize:12.5, color:'var(--text-3)', width:54 }}>แถว {i+1}</span>
              <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                <button className="btn btn-sm" style={{ padding:'4px 10px' }} onClick={()=>setRowCols(i, r.cols-1)} disabled={r.cols<=1}>−</button>
                <span style={{ fontSize:13, fontWeight:600, minWidth:64, textAlign:'center' }}>{r.cols} ปุ่ม</span>
                <button className="btn btn-sm" style={{ padding:'4px 10px' }} onClick={()=>setRowCols(i, r.cols+1)} disabled={r.cols>=4}>+</button>
              </div>
              {rows.length>1 && <button className="btn btn-sm" style={{ color:'var(--danger)', fontSize:12 }} onClick={()=>removeRow(i)}>ลบแถว</button>}
            </div>
          ))}
          <div><button className="btn btn-sm btn-soft" onClick={addRow}>+ เพิ่มแถว</button></div>
        </div>

        {mode==='template' && (
          <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:16 }}>
            <label style={{ fontSize:13, fontWeight:600 }}>สีพื้นหลัง</label>
            <input type="color" value={bgColor} onChange={e=>setBgColor(e.target.value)} style={{ width:44, height:32, border:'1px solid var(--border)', borderRadius:6, cursor:'pointer', background:'none' }}/>
          </div>
        )}
      </SettingsCard>

      {/* per-button settings */}
      <SettingsCard title="ตั้งค่าปุ่ม" sub="กำหนดปลายทางของแต่ละปุ่ม (เรียงซ้าย→ขวา บน→ล่าง)">
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {buttons.map((b,i)=>{
            const d=rmDest(b.dest);
            return (
              <div key={i} style={{ border:'1px solid var(--border)', borderRadius:10, padding:'14px 16px' }}>
                <div style={{ fontWeight:700, fontSize:13.5, marginBottom:10 }}>ปุ่มที่ {i+1}</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <div>
                    <label style={{ display:'block', fontSize:12, fontWeight:600, marginBottom:4 }}>ปลายทาง</label>
                    <select style={{ ...inp, padding:'8px 10px' }} value={b.dest} onChange={e=>onDest(i, e.target.value)}>
                      <option value="">— เลือก —</option>
                      {RM_DESTS.map(o=><option key={o.key} value={o.key}>{o.icon} {o.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display:'block', fontSize:12, fontWeight:600, marginBottom:4 }}>ข้อความบนปุ่ม{mode==='upload'?' (ไม่บังคับ)':''}</label>
                    <input style={{ ...inp, padding:'8px 10px' }} value={b.label} onChange={e=>setBtn(i,{label:e.target.value})} placeholder={d?d.label:'เช่น จองคลาส'}/>
                  </div>
                  {mode==='template' && (
                    <div>
                      <label style={{ display:'block', fontSize:12, fontWeight:600, marginBottom:4 }}>ไอคอน (อีโมจิ)</label>
                      <input style={{ ...inp, padding:'8px 10px' }} value={b.icon} maxLength={2} onChange={e=>setBtn(i,{icon:e.target.value})} placeholder="📅"/>
                    </div>
                  )}
                  {mode==='template' && (
                    <div>
                      <label style={{ display:'block', fontSize:12, fontWeight:600, marginBottom:4 }}>สีปุ่ม</label>
                      <input type="color" value={b.color||'#ffffff'} onChange={e=>setBtn(i,{color:e.target.value})} style={{ width:'100%', height:38, border:'1px solid var(--border)', borderRadius:8, cursor:'pointer', background:'none' }}/>
                    </div>
                  )}
                  {d && d.needsUrl && (
                    <div style={{ gridColumn:'1 / -1' }}>
                      <label style={{ display:'block', fontSize:12, fontWeight:600, marginBottom:4 }}>ลิงก์ (https://…)</label>
                      <input style={{ ...inp, padding:'8px 10px' }} value={b.url} onChange={e=>setBtn(i,{url:e.target.value})} placeholder={b.dest==='website'&&oaUrl?oaUrl:'https://example.com'}/>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </SettingsCard>

      {/* preview + publish */}
      <SettingsCard title="ตัวอย่าง & เผยแพร่">
        <Preview/>
        <div style={{ marginTop:16 }}>
          <label style={{ display:'block', fontSize:13, fontWeight:600, marginBottom:6 }}>ข้อความบนแถบเมนู <span style={{ fontWeight:400, color:'var(--text-3)', fontSize:12 }}>(สูงสุด 14 ตัวอักษร)</span></label>
          <input style={{ ...inp, maxWidth:260 }} value={chatBarText} maxLength={14} onChange={e=>setChatBarText(e.target.value)} placeholder="เมนู"/>
        </div>
        <div style={{ marginTop:18, display:'flex', gap:10, flexWrap:'wrap' }}>
          <button className="btn btn-primary" style={{ padding:'10px 26px', fontWeight:700 }} disabled={busy||!lineCfg} onClick={publish}>
            {busy ? 'กำลังเผยแพร่…' : published ? '🔄 อัปเดตเมนูบน LINE' : '🚀 เผยแพร่ไปยัง LINE'}
          </button>
        </div>
        <div style={{ marginTop:12, fontSize:12.5, color:'var(--text-3)', lineHeight:1.6 }}>
          เมื่อเผยแพร่ ระบบจะตั้งเมนูนี้เป็นค่าเริ่มต้นให้ทุกคนที่แอด OA โดยอัตโนมัติ · ปุ่ม "จองคลาส" จะตอบลิงก์จองให้ตามผู้ใช้ — นักเรียนที่เชื่อม LINE แล้วได้ลิงก์ส่วนตัว (เห็นตารางเรียนประจำ + แจ้งจองชดเชยได้) ส่วนคนอื่นได้ลิงก์จองคลาสทั่วไปของโรงเรียน
        </div>
      </SettingsCard>
    </>
  );
}
