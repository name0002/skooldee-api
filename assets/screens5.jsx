/* ============ skooldee — Settings screen ============ */

/* ===================== SETTINGS ===================== */
function Settings({ go }){
  useDataVersion();
  const [toast, showToast] = useToast();
  const [section, setSection] = useState('school'); // 'school' | 'categories' | 'profile' | 'account'

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
        {tab('categories', '🎨 ประเภทวิชา')}
        {tab('assess',     '📊 เกณฑ์ประเมิน')}
        {tab('rooms',      '🚪 ห้องเรียน')}
        {tab('payment',    '💳 ชำระเงิน')}
        {tab('staff',      '👥 บัญชีพนักงาน')}
        {tab('line',       '🔔 LINE แจ้งเตือน')}
        {tab('profile',    '👤 ข้อมูลผู้ใช้')}
        {tab('account',    '🔐 บัญชีและความปลอดภัย')}
      </div>

      {section==='school'      && <SchoolSettingsSection showToast={showToast}/>}
      {section==='categories'  && <CategoriesSettingsSection showToast={showToast}/>}
      {section==='assess'      && <AssessmentSettingsSection showToast={showToast}/>}
      {section==='rooms'       && <RoomsSettingsSection showToast={showToast}/>}
      {section==='payment'     && <PaymentSettingsSection showToast={showToast}/>}
      {section==='staff'       && <StaffSettingsSection showToast={showToast}/>}
      {section==='line'        && <LineSettingsSection showToast={showToast}/>}
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
    { v:'piano',       l:'เปียโน' },
    { v:'guitar',      l:'กีตาร์' },
    { v:'violin',      l:'ไวโอลิน' },
    { v:'singing',     l:'ร้องเพลง' },
    { v:'dance',       l:'เต้น' },
    { v:'drums',       l:'กลอง' },
    { v:'art',         l:'ศิลปะ' },
    { v:'english',     l:'ภาษาอังกฤษ' },
    { v:'math',        l:'คณิตศาสตร์' },
    { v:'science',     l:'วิทยาศาสตร์' },
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
  const [busy, setBusy] = useState(false);
  const syncedRef = React.useRef(null);
  const schoolId = (DATA._schoolRaw||{}).id;
  if(schoolId && schoolId !== syncedRef.current){
    syncedRef.current = schoolId;
    setQrImg((DATA._schoolRaw||{}).payment_qr_image||null);
  }

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
      </SettingsCard>
    </div>
  );
}

/* ===================== Profile Settings ===================== */
function ProfileSettingsSection({ showToast }){
  const user = DATA._userRaw || {};
  const [name, setName] = useState(user.name || DATA.SCHOOL.owner || '');
  const [busy, setBusy] = useState(false);
  const inp = useInpStyle();

  const save = async(e)=>{
    e.preventDefault();
    if(!name.trim()){ showToast('กรุณากรอกชื่อ','error'); return; }
    setBusy(true);
    try{
      if(DATA.updateProfile){
        await DATA.updateProfile({ name: name.trim() });
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
              เมื่อตั้งค่า <code style={{ background:'var(--surface-2)', padding:'1px 5px', borderRadius:4 }}>RESEND_API_KEY</code> บน Railway
              ระบบจะส่งอีเมลยืนยัน รีเซ็ตรหัสผ่าน และแจ้งเตือนอื่นๆ โดยอัตโนมัติ
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'flex-start', paddingTop:4 }}>
            <div style={{
              padding:'4px 12px', borderRadius:20, fontSize:12, fontWeight:700,
              background: 'var(--surface-2)',
              color: 'var(--text-3)',
            }}>
              ⏳ รอตั้งค่า
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
  '#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6',
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

  const togglePref = async(key)=>{
    const next = { ...prefs, [key]: !prefs[key] };
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
  const INVITE_PRESETS = {
    warm: "สวัสดีค่ะ คุณพ่อคุณแม่ของน้อง{ชื่อ} 💖\nเพื่อให้คุณพ่อคุณแม่เช็กตารางเรียน ดูการบ้าน และรับแจ้งเตือนของน้องผ่าน LINE ได้สะดวก ทางโรงเรียนเตรียมระบบไว้ให้แล้วค่ะ\nแค่กดลิงก์ด้านล่างนี้ก็เชื่อมต่อได้ทันที ไม่ต้องพิมพ์รหัสเลยนะคะ 👇\n{ลิงก์}\nยินดีต้อนรับเข้าสู่ครอบครัวเรานะคะ 🌸",
    pro: "เรียนผู้ปกครองของน้อง{ชื่อ}\nเพื่อให้คุณพ่อคุณแม่ติดตามการเข้าเรียน ตารางเรียน และใบเสร็จของน้องได้อย่างใกล้ชิด ทางสถาบันได้เปิดระบบแจ้งเตือนผ่าน LINE เรียบร้อยแล้วค่ะ\nรบกวนกดลิงก์ด้านล่างเพื่อเชื่อมต่อ (ใช้เวลาไม่เกิน 30 วินาที) 👇\n{ลิงก์}\nขอบพระคุณสำหรับความไว้วางใจค่ะ",
    quick: "คุณแม่น้อง{ชื่อ}คะ 🥰\nรบกวนกดลิงก์นี้เพื่อเชื่อมระบบรับแจ้งเตือนตารางเรียน/การบ้านของน้องกับทางโรงเรียนนะคะ กดปุ่มเดียวเสร็จเลย ไม่ต้องกรอกรหัสค่ะ 👇\n{ลิงก์}\nขอบคุณมากค่ะ",
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

            {/* channel secret (optional, for signature verification) */}
            <label style={{ display:'block', fontWeight:600, fontSize:13, margin:'16px 0 6px' }}>
              Channel Secret <span style={{ fontWeight:400, color:'var(--text-3)', fontSize:12 }}>({secretCfg?'ตั้งค่าแล้ว — ใส่ใหม่เพื่อเปลี่ยน':'ไม่บังคับ แต่แนะนำ เพื่อความปลอดภัย'})</span>
            </label>
            <div style={{ display:'flex', gap:8 }}>
              <input style={{ ...inp, flex:1 }} type="password" value={secret} onChange={e=>setSecret(e.target.value)}
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
        <SettingsCard title="แจ้งเตือนถึงผู้ปกครอง" sub="เลือกเหตุการณ์ที่อยากให้ระบบส่ง LINE ถึงผู้ปกครองโดยอัตโนมัติ (ค่าเริ่มต้นปิดทั้งหมด)">
          {[
            { key:'absent',     label:'เมื่อนักเรียนขาด/ลาเรียน', hint:'ส่งทันทีที่เช็คชื่อเป็นขาดหรือลา (ไม่ส่งตอนมาเรียนปกติ)' },
            { key:'invoice',    label:'เมื่อออกใบแจ้งหนี้ใหม่',   hint:'แจ้งยอดที่ต้องชำระให้ผู้ปกครองทราบ' },
            { key:'near_limit', label:'เมื่อคอร์สใกล้หมด',         hint:'เตือนให้ต่อคอร์สเมื่อจำนวนคาบเหลือน้อย' },
            { key:'confirm_1d', label:'เตือนคอนเฟิมคลาส (ก่อนเรียน 1 วัน)', hint:'ส่งเตือนผู้ปกครองทุกเช้าว่าพรุ่งนี้น้องมีเรียน ให้ยืนยันหรือแจ้งลาล่วงหน้า — ช่วยลดการขาดเรียน' },
            { key:'birthday',   label:'อวยพรวันเกิดนักเรียน',      hint:'ส่งคำอวยพรถึงผู้ปกครองในวันเกิดของน้อง (เช้าวันเกิด)', exp:true },
          ].map(o=>(
            <PrefRow key={o.key} o={o} on={!!prefs[o.key]} toggle={()=>togglePref(o.key)}/>
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
            placeholder={"เว้นว่างไว้ = คัดลอกเฉพาะลิงก์ (เหมือนเดิม)\n\nหรือพิมพ์ข้อความเอง ใช้ {ชื่อ} แทนชื่อน้อง และ {ลิงก์} แทนลิงก์เชื่อมต่อ"}/>
          <div style={{ fontSize:12, color:'var(--text-3)', marginTop:8, lineHeight:1.6 }}>
            ตัวแทนที่ใช้ได้: <code style={codeBox}>{'{ชื่อ}'}</code> = ชื่อเล่นน้อง · <code style={codeBox}>{'{ลิงก์}'}</code> = ลิงก์เชื่อมอัตโนมัติ
            {inviteTpl.length>0 && !inviteTpl.includes('{ลิงก์}') && <span style={{ color:'var(--danger)', display:'block', marginTop:4 }}>⚠️ ยังไม่มี {'{ลิงก์}'} ในข้อความ — ระบบจะต่อลิงก์ท้ายข้อความให้</span>}
          </div>
          <button className="btn btn-primary" style={{ alignSelf:'flex-start', marginTop:12, padding:'9px 22px', fontWeight:700 }}
            disabled={savingTpl} onClick={saveInviteTpl}>{savingTpl?'กำลังบันทึก…':'บันทึกข้อความ'}</button>
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
