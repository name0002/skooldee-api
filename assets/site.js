/* ============ skooldee — shared site config, analytics, form handling ============ */

/* ----------------------------------------------------------------------------
 * CONFIG — fill these in before going live.
 * Leave a value as its "PLACEHOLDER..." default to keep that integration OFF.
 * -------------------------------------------------------------------------- */
window.CLASSDEE = {
  // Backend API base URL (used by assets/api.js for all authenticated calls)
  API_URL: "https://skooldee-api-production.up.railway.app",

  // Lead-capture endpoint that accepts a POST (JSON).
  FORM_ENDPOINT: "https://skooldee-api-production.up.railway.app/api/leads",

  // Fallback when no FORM_ENDPOINT is set: the form opens the user's mail client.
  SALES_EMAIL: "sales@skooldee.com",

  // LINE Official Account link (button on contact/signup pages).
  LINE_OA_URL: "https://line.me/R/ti/p/@skooldee",

  // Phone shown on contact page.
  PHONE: "PLACEHOLDER_PHONE",

  // Google Analytics 4 Measurement ID. Leave as placeholder to disable analytics.
  GA_ID: "PLACEHOLDER_GA_ID"
};

/* ---------------- Google Analytics 4 (loads only if GA_ID is real) ---------------- */
(function loadGA() {
  var id = window.CLASSDEE.GA_ID;
  if (!id || id.indexOf("PLACEHOLDER") === 0) return;
  var s = document.createElement("script");
  s.async = true;
  s.src = "https://www.googletagmanager.com/gtag/js?id=" + id;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", id);
})();

/* ============ Form handling ============ */
document.addEventListener("DOMContentLoaded", function () {

  /* ---- pre-select plan from URL (?plan=pro) ---- */
  var params = new URLSearchParams(location.search);
  var plan = params.get("plan");
  var planSelect = document.querySelector("[name=plan]");
  if (plan && planSelect) {
    var opt = [].find.call(planSelect.options, function (o) { return o.value === plan; });
    if (opt) planSelect.value = plan;
  }

  /* ---- wire every [data-lead] form ---- */
  document.querySelectorAll("form[data-lead]").forEach(function (form) {
    var isRegister = form.hasAttribute("data-register");

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      /* -- validation -- */
      var ok = true;
      form.querySelectorAll("[required]").forEach(function (el) {
        var field = el.closest(".field");
        var valid = el.value.trim() !== "" && el.checkValidity();
        if (field) field.classList.toggle("invalid", !valid);
        if (!valid) ok = false;
      });

      /* -- password match check (register forms only) -- */
      if (isRegister) {
        var pw  = form.querySelector("[name=password]");
        var cpw = form.querySelector("[name=confirm_password]");
        if (pw && cpw && pw.value !== cpw.value) {
          var cpwField = cpw.closest(".field");
          if (cpwField) cpwField.classList.add("invalid");
          ok = false;
        }
      }

      var consent = form.querySelector("[name=consent]");
      if (consent && !consent.checked) { ok = false; consent.focus(); }
      if (!ok) return;

      var data = Object.fromEntries(new FormData(form).entries());
      var btn  = form.querySelector("[type=submit]");
      if (btn) { btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = isRegister ? "กำลังสร้างบัญชี…" : "กำลังส่ง…"; }

      function resetBtn() {
        if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label || btn.textContent; }
      }
      function showRegError(msg) {
        var el = document.getElementById("reg-error");
        if (el) { el.innerHTML = msg; el.style.display = "block"; }
        resetBtn();
      }
      function done() {
        var el = document.getElementById("reg-error");
        if (el) el.style.display = "none";
        form.classList.add("sent");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      function fail() {
        resetBtn();
        alert("ส่งไม่สำเร็จ กรุณาลองใหม่ หรือติดต่อเราผ่าน LINE");
      }

      /* ====================================================
       * REGISTRATION FLOW (form[data-register])
       * 1) POST /api/auth/register  → get JWT
       * 2) POST /api/leads          → save full lead (fire-and-forget)
       * 3) Store JWT → show success → redirect to /app
       * ==================================================== */
      if (isRegister) {
        var base = window.CLASSDEE.API_URL || "https://skooldee-api-production.up.railway.app";

        fetch(base + "/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            school:    data.school,
            name:      data.name,
            email:     data.email,
            password:  data.password,
            category:  data.category || null
          })
        })
        .then(function (res) {
          return res.json().then(function (json) {
            if (!res.ok) throw Object.assign(new Error(json.error || "register failed"), { status: res.status, body: json });
            return json;
          });
        })
        .then(function (regData) {
          /* store JWT so app.html skips the login screen */
          localStorage.setItem("sk-token", regData.token);

          /* save full lead info in background */
          fetch(base + "/api/leads", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              /* send the fresh JWT so the lead is scoped to the school just created */
              "Authorization": "Bearer " + regData.token
            },
            body: JSON.stringify({
              school: data.school, name: data.name, phone: data.phone,
              email: data.email, category: data.category, size: data.size,
              plan: data.plan, message: data.message, source: "signup"
            })
          }).catch(function () {});

          /* show success state, then redirect */
          done();
          setTimeout(function () { window.location.href = "app.html"; }, 2200);
        })
        .catch(function (err) {
          if (err.status === 409) {
            showRegError('อีเมลนี้มีบัญชีอยู่แล้ว — <a href="app.html" style="color:inherit;font-weight:600;text-decoration:underline">เข้าสู่ระบบ</a>');
          } else if (err.status === 400 && err.body && err.body.error) {
            showRegError(err.body.error);
          } else {
            showRegError("สมัครไม่สำเร็จ กรุณาลองใหม่");
          }
        });
        return;
      }

      /* ====================================================
       * LEAD-ONLY FLOW (contact / other forms without data-register)
       * ==================================================== */
      var endpoint = window.CLASSDEE.FORM_ENDPOINT;
      if (endpoint && endpoint.indexOf("PLACEHOLDER") !== 0) {
        fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(data)
        }).then(function (r) { r.ok ? done() : fail(); }).catch(fail);
      } else {
        var subject = encodeURIComponent("[skooldee] ขอทดลองใช้ / ติดต่อ: " + (data.school || data.name || ""));
        var body = encodeURIComponent(
          Object.keys(data).map(function (k) { return k + ": " + data[k]; }).join("\n")
        );
        window.location.href = "mailto:" + window.CLASSDEE.SALES_EMAIL + "?subject=" + subject + "&body=" + body;
        setTimeout(done, 400);
      }
    });
  });
});
