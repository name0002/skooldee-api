// Single source of truth for subscription plan limits + feature gates.
// Plan key is stored in schools.plan. Trial gives FULL access so the school can
// experience every feature; it's gated by plan_expires (time), not by features.
export const PLANS = {
  // 14-day free trial — everything unlocked
  trial:      { label: 'ทดลองใช้', students: Infinity, line: true,  homework: true,  points: true,  branches: 1 },
  studio:     { label: 'STUDIO',    students: 50,       line: false, homework: false, points: false, branches: 1 },
  academy:    { label: 'ACADEMY',   students: Infinity, line: true,  homework: true,  points: true,  branches: 1 },
  enterprise: { label: 'ENTERPRISE',students: Infinity, line: true,  homework: true,  points: true,  branches: Infinity },
  // trial ended / subscription cancelled — read-only-ish: blocks new students + LINE
  cancelled:  { label: 'หมดอายุ',   students: 0,        line: false, homework: false, points: false, branches: 1 },
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
