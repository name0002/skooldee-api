/* ============ skooldee — shared site config, analytics, form handling ============ */

/* ----------------------------------------------------------------------------
 * CONFIG — fill these in before going live.
 * Leave a value as its "PLACEHOLDER..." default to keep that integration OFF.
 * -------------------------------------------------------------------------- */
window.CLASSDEE = {
  // Lead-capture endpoint that accepts a POST (JSON). e.g. Formspree, your own API.
  // Example: "https://formspree.io/f/xxxxxxx"
  FORM_ENDPOINT: "PLACEHOLDER_FORM_ENDPOINT",

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
  if (!id || id.indexOf("PLACEHOLDER") === 0) return; // disabled until configured
  var s = document.createElement("script");
  s.async = true;
  s.src = "https://www.googletagmanager.com/gtag/js?id=" + id;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", id);
})();

/* ---------------- Lead form handling ---------------- */
document.addEventListener("DOMContentLoaded", function () {
  // Pre-select plan / mode from URL (?plan=pro&type=sales)
  var params = new URLSearchParams(location.search);
  var plan = params.get("plan");
  var planSelect = document.querySelector("[name=plan]");
  if (plan && planSelect) {
    var opt = [].find.call(planSelect.options, function (o) { return o.value === plan; });
    if (opt) planSelect.value = plan;
  }

  document.querySelectorAll("form[data-lead]").forEach(function (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();

      // validate required fields
      var ok = true;
      form.querySelectorAll("[required]").forEach(function (el) {
        var field = el.closest(".field");
        var valid = el.value.trim() !== "" && el.checkValidity();
        if (field) field.classList.toggle("invalid", !valid);
        if (!valid) ok = false;
      });
      var consent = form.querySelector("[name=consent]");
      if (consent && !consent.checked) { ok = false; consent.focus(); }
      if (!ok) return;

      var data = Object.fromEntries(new FormData(form).entries());
      var endpoint = window.CLASSDEE.FORM_ENDPOINT;
      var btn = form.querySelector("[type=submit]");
      if (btn) { btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = "กำลังส่ง…"; }

      function done() { form.classList.add("sent"); window.scrollTo({ top: 0, behavior: "smooth" }); }
      function fail() {
        if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label; }
        alert("ส่งไม่สำเร็จ กรุณาลองใหม่ หรือติดต่อเราผ่าน LINE");
      }

      if (endpoint && endpoint.indexOf("PLACEHOLDER") !== 0) {
        fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(data)
        }).then(function (r) { r.ok ? done() : fail(); }).catch(fail);
      } else {
        // No endpoint configured → fall back to opening an email draft, then show success.
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
