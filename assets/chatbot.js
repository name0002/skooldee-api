// skooldee chat widget — vanilla JS, no build step. Reused on the landing page
// (public FAQ) and inside the app shell (authed "how to use" help).
// Configure before this script loads, e.g.:
//   <script>window.SKOOLDEE_CHAT = { mode: 'landing' };</script>
//   <script src="assets/chatbot.js"></script>
(function () {
  var cfg = Object.assign({
    mode: 'landing', // 'landing' | 'app'
  }, window.SKOOLDEE_CHAT || {});

  var isApp = cfg.mode === 'app';
  var apiBase = (window.CLASSDEE && window.CLASSDEE.API_URL) || '';
  var endpoint = apiBase + (isApp ? '/api/chat/help' : '/api/chat/public');

  var copy = isApp
    ? {
        title: '💬 ผู้ช่วยใช้งาน skooldee',
        greeting: 'สวัสดีค่ะ ถามวิธีใช้งานระบบได้เลย เช่น "วิธีเพิ่มนักเรียน" หรือ "ตั้งค่า LINE ยังไง"',
        placeholder: 'พิมพ์คำถามวิธีใช้งาน...',
        quick: ['วิธีเพิ่มนักเรียน', 'วิธีออก Invoice', 'ตั้งค่า LINE ยังไง', 'วิธีมอบหมายการบ้าน'],
      }
    : {
        title: '💬 สอบถามข้อมูล skooldee',
        greeting: 'สวัสดีค่ะ สนใจอะไรเกี่ยวกับ skooldee ถามได้เลยนะคะ 😊',
        placeholder: 'พิมพ์คำถาม...',
        quick: ['ราคาแพ็กเกจ', 'มีฟีเจอร์อะไรบ้าง', 'วิธีสมัครทดลองใช้', 'ติดต่อฝ่ายขาย'],
      };

  var sessionId = (window.crypto && window.crypto.randomUUID)
    ? window.crypto.randomUUID()
    : 'sk-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  var history = []; // { role, content } — capped client-side, sent as-is each request
  var MAX_HISTORY = 8;
  var sending = false;

  function el(tag, className, html) {
    var e = document.createElement(tag);
    if (className) e.className = className;
    if (html != null) e.innerHTML = html;
    return e;
  }

  var btn = el('button', 'sk-chat-btn', '💬');
  btn.setAttribute('aria-label', 'เปิดแชท');
  var panel = el('div', 'sk-chat-panel');
  var head = el('div', 'sk-chat-head');
  head.innerHTML = '<span>' + copy.title + '</span>';
  var closeBtn = el('button', '', '✕');
  closeBtn.setAttribute('aria-label', 'ปิดแชท');
  head.appendChild(closeBtn);

  var body = el('div', 'sk-chat-body');
  var quick = el('div', 'sk-quick');
  copy.quick.forEach(function (q) {
    var qb = el('button', '', q);
    qb.addEventListener('click', function () { sendMessage(q); });
    quick.appendChild(qb);
  });

  var inputWrap = el('div', 'sk-chat-input');
  var input = document.createElement('input');
  input.type = 'text';
  input.placeholder = copy.placeholder;
  var sendBtn = el('button', '', '➤');
  inputWrap.appendChild(input);
  inputWrap.appendChild(sendBtn);

  panel.appendChild(head);
  panel.appendChild(body);
  panel.appendChild(quick);
  panel.appendChild(inputWrap);

  document.body.appendChild(btn);
  document.body.appendChild(panel);

  // ---- draggable button (mobile users reported it covering page UI) ----
  var POS_KEY = 'sk_chat_pos';
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function defaultPos() {
    // In the app, a fixed bottom tab bar (.mobnav, 62px tall) shows at <=880px.
    // Sit the button above it by default so it doesn't cover the settings tab;
    // the user can still drag it anywhere. Landing page has no nav bar.
    var overNav = isApp && window.innerWidth <= 880;
    return { right: 20, bottom: overNav ? 80 : 20 };
  }
  function loadPos() {
    try { var raw = localStorage.getItem(POS_KEY); if (raw) return JSON.parse(raw); } catch (e) {}
    return defaultPos();
  }
  function applyBtnPos(pos) {
    var w = btn.offsetWidth || 56, h = btn.offsetHeight || 56;
    btn.style.right = clamp(pos.right, 8, window.innerWidth - w - 8) + 'px';
    btn.style.bottom = clamp(pos.bottom, 8, window.innerHeight - h - 8) + 'px';
  }
  var pos = loadPos();
  applyBtnPos(pos);
  window.addEventListener('resize', function () { applyBtnPos(pos); });

  // Distinguish a tap from a drag by distance: a tap can wobble a few px (touch
  // imprecision, or a browser's own hover/actionability probing) without crossing
  // the slop threshold, while a real drag moves well past it.
  var DRAG_DIST = 10;
  var dragging = false, moved = false, activePointerId = null;
  var startX, startY, startRight, startBottom, suppressClick = false;
  btn.addEventListener('pointerdown', function (e) {
    if (dragging) return; // ignore a re-entrant press while one is already active
    dragging = true; moved = false; activePointerId = e.pointerId;
    startX = e.clientX; startY = e.clientY;
    var rect = btn.getBoundingClientRect();
    startRight = window.innerWidth - rect.right;
    startBottom = window.innerHeight - rect.bottom;
    try { btn.setPointerCapture(e.pointerId); } catch (err) {}
  });
  btn.addEventListener('pointermove', function (e) {
    if (!dragging || e.pointerId !== activePointerId) return;
    var dx = e.clientX - startX, dy = e.clientY - startY;
    if (!moved) {
      // Start dragging once the finger has clearly moved past the slop threshold.
      // Distance alone distinguishes a drag from a tap; we no longer require a
      // hold first, so a quick flick to reposition isn't misread as a tap (the
      // old hold requirement was the main reason dragging felt broken on mobile).
      if (Math.sqrt(dx * dx + dy * dy) < DRAG_DIST) return;
      moved = true;
    }
    e.preventDefault();
    pos = { right: startRight - dx, bottom: startBottom - dy };
    applyBtnPos(pos);
  });
  // Shared teardown: pointerup ends a drag normally; pointercancel/lostpointercapture
  // fire when the OS steals the gesture (common at the screen's bottom edge on
  // mobile). Without resetting here, `dragging` would stay true forever and every
  // later press would be ignored — leaving the button stuck (can't drag or tap).
  function endDrag(committed) {
    if (!dragging) return;
    dragging = false; activePointerId = null;
    if (moved) {
      suppressClick = true;
      if (committed) {
        try { localStorage.setItem(POS_KEY, JSON.stringify(pos)); } catch (err) {}
      }
    }
  }
  btn.addEventListener('pointerup', function (e) {
    if (!dragging || e.pointerId !== activePointerId) return;
    endDrag(true);
  });
  btn.addEventListener('pointercancel', function (e) {
    if (!dragging || e.pointerId !== activePointerId) return;
    // Keep wherever the button ended up so an interrupted drag isn't lost.
    endDrag(true);
  });
  btn.addEventListener('lostpointercapture', function () { endDrag(true); });

  function positionPanel() {
    if (window.innerWidth <= 420) return; // mobile CSS pins the panel full-width
    var rect = btn.getBoundingClientRect();
    var panelWidth = panel.offsetWidth || 336;
    var right = clamp(window.innerWidth - rect.right, 8, window.innerWidth - panelWidth - 8);
    var bottom = (window.innerHeight - rect.top) + 14;
    panel.style.right = right + 'px';
    panel.style.bottom = bottom + 'px';
  }

  function addMsg(role, text, pending) {
    var m = el('div', 'sk-msg ' + role + (pending ? ' pending' : ''), null);
    m.textContent = text;
    body.appendChild(m);
    body.scrollTop = body.scrollHeight;
    return m;
  }

  function open() {
    positionPanel();
    panel.classList.add('is-open');
    btn.classList.add('is-open');
    if (!history.length) addMsg('assistant', copy.greeting);
    input.focus();
  }
  function close() {
    panel.classList.remove('is-open');
    btn.classList.remove('is-open');
  }
  btn.addEventListener('click', function () {
    if (suppressClick) { suppressClick = false; return; } // was a drag, not a tap
    panel.classList.contains('is-open') ? close() : open();
  });
  closeBtn.addEventListener('click', close);
  window.addEventListener('resize', function () {
    if (panel.classList.contains('is-open')) positionPanel();
  });

  function authHeaders() {
    if (!isApp) return {};
    var token = window.localStorage.getItem('sk-token');
    return token ? { Authorization: 'Bearer ' + token } : {};
  }

  function sendMessage(text) {
    text = (text || input.value).trim();
    if (!text || sending) return;
    input.value = '';
    quick.style.display = 'none';
    addMsg('user', text);
    history.push({ role: 'user', content: text });
    if (history.length > MAX_HISTORY) history = history.slice(-MAX_HISTORY);

    sending = true;
    sendBtn.disabled = true;
    var pendingMsg = addMsg('assistant', 'กำลังพิมพ์...', true);

    fetch(endpoint, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
      body: JSON.stringify({ sessionId: sessionId, messages: history }),
    })
      .then(function (res) {
        return res.json().then(function (data) { return { ok: res.ok, data: data }; });
      })
      .then(function (r) {
        pendingMsg.remove();
        if (!r.ok) {
          addMsg('assistant', (r.data && r.data.error) || 'ขออภัยค่ะ ระบบแชทไม่พร้อมใช้งานขณะนี้');
          history.pop(); // don't keep the failed turn in context
          return;
        }
        addMsg('assistant', r.data.reply);
        history.push({ role: 'assistant', content: r.data.reply });
        if (history.length > MAX_HISTORY) history = history.slice(-MAX_HISTORY);
      })
      .catch(function () {
        pendingMsg.remove();
        addMsg('assistant', 'เชื่อมต่อไม่ได้ ลองใหม่อีกครั้งนะคะ');
        history.pop();
      })
      .finally(function () {
        sending = false;
        sendBtn.disabled = false;
      });
  }

  sendBtn.addEventListener('click', function () { sendMessage(); });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') sendMessage();
  });
})();
