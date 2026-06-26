/* ============ skooldee · API client (plain JS, no build step) ============
 * Loaded BEFORE the JSX files. Exposes window.API with all fetch helpers.
 * Token is stored in localStorage under TOKEN_KEY.
 * ======================================================================= */
(function () {
  var BASE = (window.CLASSDEE && window.CLASSDEE.API_URL)
    || 'https://skooldee-api-production.up.railway.app';
  var TOKEN_KEY = 'sk-token';

  function req(path, opts) {
    opts = opts || {};
    var token = localStorage.getItem(TOKEN_KEY);
    return fetch(BASE + path, Object.assign({}, opts, {
      headers: Object.assign(
        { 'Content-Type': 'application/json' },
        token ? { Authorization: 'Bearer ' + token } : {},
        opts.headers || {}
      )
    })).then(function (res) {
      if (res.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        var e = new Error('unauthorized'); e.status = 401; throw e;
      }
      return res.json().catch(function () { return { error: 'parse error' }; }).then(function (json) {
        if (!res.ok) { var e2 = new Error(json.error || 'request failed'); e2.status = res.status; e2.body = json; throw e2; }
        return json;
      });
    });
  }

  window.API = {
    base: BASE,
    req: req,   // expose for direct calls (e.g. schedule?day=N, attendance POST)

    getToken: function () { return localStorage.getItem(TOKEN_KEY); },
    setToken: function (t) { localStorage.setItem(TOKEN_KEY, t); },
    clearToken: function () { localStorage.removeItem(TOKEN_KEY); },

    /* ---- Auth ---- */
    login: function (email, password) {
      return req('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: email, password: password })
      }).then(function (d) { localStorage.setItem(TOKEN_KEY, d.token); return d; });
    },
    register: function (school, name, email, password, category) {
      return req('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ school: school, name: name, email: email, password: password, category: category })
      }).then(function (d) { localStorage.setItem(TOKEN_KEY, d.token); return d; });
    },
    me: function () { return req('/api/auth/me'); },
    logout: function () { localStorage.removeItem(TOKEN_KEY); window.location.href = 'app.html'; },

    /* ---- Read ---- */
    dashboard: function ()     { return req('/api/dashboard'); },
    students:  function (q)    { return req('/api/students'  + (q ? '?' + new URLSearchParams(q) : '')); },
    teachers:  function ()     { return req('/api/teachers'); },
    packages:  function ()     { return req('/api/packages'); },
    schedule:  function ()     { return req('/api/schedule'); },
    scheduleExceptions: function (from,to) { return req('/api/schedule/exceptions' + (from?('?from='+from+(to?'&to='+to:'')):'')); },
    classConfirmations: function (date)    { return req('/api/schedule/confirmations?date=' + encodeURIComponent(date)); },
    addException:       function (d)       { return req('/api/schedule/exceptions',    { method:'POST', body: JSON.stringify(d) }); },
    deleteException:    function (id)      { return req('/api/schedule/exceptions/'+id, { method:'DELETE' }); },
    /* ---- Self-service bookable sessions ---- */
    bookableSessions:  function (q)        { return req('/api/schedule/sessions' + (q ? '?' + new URLSearchParams(q) : '')); },
    createSession:     function (d)        { return req('/api/schedule/sessions',       { method:'POST',  body: JSON.stringify(d) }); },
    patchSession:      function (id, d)    { return req('/api/schedule/sessions/'+id,    { method:'PATCH', body: JSON.stringify(d) }); },
    deleteSession:     function (id)       { return req('/api/schedule/sessions/'+id,    { method:'DELETE' }); },
    sessionBookings:   function (id)       { return req('/api/schedule/sessions/'+id+'/bookings'); },
    patchBooking:      function (id, d)    { return req('/api/schedule/bookings/'+id,     { method:'PATCH', body: JSON.stringify(d) }); },
    attendance: function (dt)  { return req('/api/attendance' + (dt ? '?date=' + dt : '')); },
    invoices:  function ()     { return req('/api/finance/invoices'); },
    homework:  function ()     { return req('/api/homework'); },
    referrals: function ()     { return req('/api/referrals'); },
    points:       function (sid) { return req('/api/points/' + sid); },                              // balance + ledger for one student
    leaderboard:  function ()    { return req('/api/points/leaderboard'); },
    givePoints:   function (d)   { return req('/api/points', { method: 'POST', body: JSON.stringify(d) }); }, // { student_id, delta, reason }
    assessments:    function (sid) { return req('/api/assessments?student_id=' + sid); },              // development-score history
    addAssessment:  function (d)   { return req('/api/assessments', { method: 'POST', body: JSON.stringify(d) }); },
    deleteAssessment: function (id){ return req('/api/assessments/' + id, { method: 'DELETE' }); },

    /* ---- Write ---- */
    createStudent:  function (d)     { return req('/api/students',                   { method: 'POST',   body: JSON.stringify(d) }); },
    bulkStudents:   function (d)     { return req('/api/students/bulk',              { method: 'POST',   body: JSON.stringify(d) }); },
    patchStudent:   function (id, d) { return req('/api/students/' + id,             { method: 'PATCH',  body: JSON.stringify(d) }); },
    deleteStudent:  function (id)    { return req('/api/students/' + id,             { method: 'DELETE' }); },
    unlinkStudentLine: function (id) { return req('/api/students/' + id + '/unlink-line', { method: 'POST' }); },
    markAttendance: function (d)     { return req('/api/attendance',                 { method: 'POST',   body: JSON.stringify(d) }); },
    createInvoice:  function (d)     { return req('/api/finance/invoices',           { method: 'POST',   body: JSON.stringify(d) }); },
    patchInvoice:   function (id, d) { return req('/api/finance/invoices/'+id,        { method: 'PATCH',  body: JSON.stringify(d) }); },
    payInvoice:     function (id)    { return req('/api/finance/invoices/'+id+'/pay',{ method: 'POST' }); },
    deleteInvoice:  function (id)    { return req('/api/finance/invoices/'+id,        { method: 'DELETE' }); },
    invoiceSlip:    function (id)    { return req('/api/finance/invoices/'+id+'/slip'); },
    uploadInvoiceSlip: function (id, image) { return req('/api/finance/invoices/'+id+'/slip', { method:'POST', body: JSON.stringify({ image }) }); },
    approveSlip:    function (id)    { return req('/api/finance/invoices/'+id+'/approve-slip', { method:'POST' }); },
    rejectSlip:     function (id)    { return req('/api/finance/invoices/'+id+'/reject-slip',  { method:'POST' }); },
    revenue:        function (m)     { return req('/api/finance/revenue'+(m?'?months='+m:'')); },
    changePassword: function (cp,np) { return req('/api/auth/password',{method:'PATCH',body:JSON.stringify({current_password:cp,new_password:np})}); },
    forgotPassword: function (email) { return req('/api/auth/forgot-password',{method:'POST',body:JSON.stringify({email:email})}); },
    resetPassword:  function (tok,np){ return req('/api/auth/reset-password',{method:'POST',body:JSON.stringify({token:tok,new_password:np})}); },
    addHomework:    function (d)     { return req('/api/homework',                   { method: 'POST',   body: JSON.stringify(d) }); },
    patchHomework:  function (id, d) { return req('/api/homework/' + id,             { method: 'PATCH',  body: JSON.stringify(d) }); },
    deleteHomework: function (id)    { return req('/api/homework/' + id,             { method: 'DELETE' }); },
    notifyLine:     function (d)     { return req('/api/notify/line',                { method: 'POST',   body: JSON.stringify(d) }); },
    addReferral:    function (d)     { return req('/api/referrals',                  { method: 'POST',   body: JSON.stringify(d) }); },
    patchReferral:  function (id, d) { return req('/api/referrals/' + id,            { method: 'PATCH',  body: JSON.stringify(d) }); },
    addTeacher:     function (d)     { return req('/api/teachers',                   { method: 'POST',   body: JSON.stringify(d) }); },
    patchTeacher:   function (id, d) { return req('/api/teachers/' + id,             { method: 'PATCH',  body: JSON.stringify(d) }); },
    deleteTeacher:  function (id)    { return req('/api/teachers/' + id,             { method: 'DELETE' }); },
    teacherPayslip: function (id, m) { return req('/api/teachers/' + id + '/payslip' + (m?('?month='+m):'')); },
    school:         function ()      { return req('/api/schools'); },
    updateSchool:   function (d)     { return req('/api/schools',                    { method: 'PATCH',  body: JSON.stringify(d) }); },
    updateProfile:  function (d)     { return req('/api/auth/profile',               { method: 'PATCH',  body: JSON.stringify(d) }); },
    addPackage:     function (d)     { return req('/api/packages',                   { method: 'POST',   body: JSON.stringify(d) }); },
    patchPackage:   function (id, d) { return req('/api/packages/' + id,             { method: 'PATCH',  body: JSON.stringify(d) }); },
    deletePackage:  function (id)    { return req('/api/packages/' + id,             { method: 'DELETE' }); },
    testLine:       function ()      { return req('/api/notify/line/test',           { method: 'POST',   body: '{}' }); },
    listUsers:      function ()      { return req('/api/users'); },
    createUser:     function (d)     { return req('/api/users',                       { method: 'POST',   body: JSON.stringify(d) }); },
    updateUser:     function (id, d) { return req('/api/users/' + id,                 { method: 'PATCH',  body: JSON.stringify(d) }); },
    deleteUser:     function (id)    { return req('/api/users/' + id,                 { method: 'DELETE' }); },
    enrollments:        function (s)  { return req('/api/enrollments' + (s ? '?status=' + s : '')); },
    acceptEnrollment:   function (id) { return req('/api/enrollments/' + id + '/accept', { method: 'POST' }); },
    rejectEnrollment:   function (id) { return req('/api/enrollments/' + id + '/reject', { method: 'POST' }); },
    deleteEnrollment:   function (id) { return req('/api/enrollments/' + id,             { method: 'DELETE' }); },

    /* ---- Stripe billing ---- */
    stripeCheckout: function (plan, cycle) {
      return req('/api/stripe/create-checkout', { method: 'POST', body: JSON.stringify({ plan: plan, cycle: cycle }) });
    },
    stripePortal: function () { return req('/api/stripe/portal'); },

    /* ---- Platform super-admin ---- */
    adminSchools: function () { return req('/api/admin/schools'); },
    ownerLineStatus: function () { return req('/api/admin/owner-line'); },
    ownerLineGenCode: function () { return req('/api/admin/owner-line/code', { method: 'POST' }); },
    ownerLineUnlink: function () { return req('/api/admin/owner-line/unlink', { method: 'POST' }); },
  };
})();
