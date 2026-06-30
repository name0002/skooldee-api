// Single source of truth for subscription plan limits + feature gates.
// Plan key is stored in schools.plan. Trial gives FULL access so the school can
// experience every feature; it's gated by plan_expires (time), not by features.
// Feature flags per plan. `students` is the ACTIVE-student cap (see assertStudentCap).
// Enforcement status (2026-06):
//   ENFORCED  → line (line-push.js/notify.js/richmenu.js), students cap (students.js)
//   DEFINED but not yet wired → homework, points, booking, autobill, reports, branches
//   (wire these in their routes before relying on them for differentiation)
export const PLANS = {
  // 14-day free trial — everything unlocked
  trial:      { label: 'ทดลองใช้',  students: Infinity, line: true,  homework: true,  points: true,  booking: true,  autobill: true,  reports: true,  branches: 1 },
  // STUDIO — small studios / solo teachers. LINE included (basic: attendance + bills),
  // but the automation/growth tools (homework push, points/referral, booking, auto-billing, forecast) are reserved for ACADEMY.
  studio:     { label: 'STUDIO',     students: 60,       line: true,  homework: false, points: false, booking: false, autobill: false, reports: false, branches: 1 },
  // ACADEMY — growing schools. Full automation + growth toolkit, capped at 250 active students.
  academy:    { label: 'ACADEMY',    students: 250,      line: true,  homework: true,  points: true,  booking: true,  autobill: true,  reports: true,  branches: 1 },
  // ENTERPRISE — large / multi-branch. Unlimited students + multi-branch.
  enterprise: { label: 'ENTERPRISE', students: Infinity, line: true,  homework: true,  points: true,  booking: true,  autobill: true,  reports: true,  branches: Infinity },
  // trial ended / subscription cancelled — read-only-ish: blocks new students + LINE
  cancelled:  { label: 'หมดอายุ',    students: 0,        line: false, homework: false, points: false, booking: false, autobill: false, reports: false, branches: 1 },
};

// Resolve the EFFECTIVE plan for a school row, accounting for an expired trial.
// A trial whose plan_expires has passed behaves like 'cancelled'.
export function effectivePlan(school) {
  if (!school) return PLANS.cancelled;
  const key = school.plan || 'trial';
  if (key === 'trial' && school.plan_expires && new Date(school.plan_expires) < new Date()) {
    return PLANS.cancelled;
  }
  return PLANS[key] || PLANS.trial;
}

// Convenience: does this school's plan allow a feature right now?
export const planAllows = (school, feature) => !!effectivePlan(school)[feature];
