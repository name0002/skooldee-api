import { Router } from 'express';
import { get, run } from '../db.js';
import { wrap, bad } from '../util.js';
import { requireAuth } from '../auth.js';
import Stripe from 'stripe';

const r = Router();

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key.startsWith('PLACEHOLDER')) throw bad('Stripe ยังไม่ได้ตั้งค่า', 503);
  return new Stripe(key, { apiVersion: '2024-12-18.acacia' });
}

// plan key → { plan label, env var holding the Stripe Price ID }
// ENTERPRISE is sales-led (contact form), so no self-serve checkout price here.
const PLAN_PRICES = {
  studio_mo:  { plan: 'studio',  env: 'STRIPE_PRICE_STUDIO_MO' },
  studio_yr:  { plan: 'studio',  env: 'STRIPE_PRICE_STUDIO_YR' },
  academy_mo: { plan: 'academy', env: 'STRIPE_PRICE_ACADEMY_MO' },
  academy_yr: { plan: 'academy', env: 'STRIPE_PRICE_ACADEMY_YR' },
};

function getPriceId(planKey) {
  const cfg = PLAN_PRICES[planKey];
  if (!cfg) throw bad(`ไม่รู้จัก plan: ${planKey}`);
  const id = process.env[cfg.env];
  if (!id || id.startsWith('PLACEHOLDER')) throw bad(`Stripe Price ยังไม่ได้ตั้งค่าสำหรับ ${planKey}`, 503);
  return { priceId: id, plan: cfg.plan };
}

// POST /api/stripe/create-checkout
// Body: { plan: 'starter'|'pro', cycle: 'mo'|'yr' }
// Returns: { url } — redirect the browser to this URL
r.post('/create-checkout', requireAuth, wrap(async (req, res) => {
  const { plan = 'pro', cycle = 'mo' } = req.body;
  const { priceId, plan: planName } = getPriceId(`${plan}_${cycle}`);

  const s = getStripe();
  const school = get('SELECT id, name, stripe_customer_id FROM schools WHERE id = ?', req.schoolId);
  const owner  = get('SELECT email, name FROM users WHERE id = ? AND school_id = ?', req.user.uid, req.schoolId);
  const APP_URL = process.env.APP_URL || 'https://skooldee.com';

  // reuse existing Stripe customer or create one
  let customerId = school.stripe_customer_id;
  if (!customerId) {
    const customer = await s.customers.create({
      email: owner.email,
      name:  school.name,
      metadata: { school_id: String(req.schoolId) },
    });
    customerId = customer.id;
    run('UPDATE schools SET stripe_customer_id = ? WHERE id = ?', customerId, req.schoolId);
  }

  const session = await s.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: { school_id: String(req.schoolId), plan: planName, cycle },
    success_url: `${APP_URL}/app.html?checkout=success&plan=${planName}`,
    cancel_url:  `${APP_URL}/app.html?checkout=cancel`,
    allow_promotion_codes: true,
    subscription_data: { metadata: { school_id: String(req.schoolId), plan: planName } },
  });

  res.json({ url: session.url });
}));

// GET /api/stripe/portal — redirect to Stripe Customer Portal (manage/cancel)
r.get('/portal', requireAuth, wrap(async (req, res) => {
  const school = get('SELECT stripe_customer_id FROM schools WHERE id = ?', req.schoolId);
  if (!school?.stripe_customer_id) throw bad('ยังไม่มีการสมัครสมาชิก Stripe', 400);
  const s = getStripe();
  const APP_URL = process.env.APP_URL || 'https://skooldee.com';
  const session = await s.billingPortal.sessions.create({
    customer: school.stripe_customer_id,
    return_url: `${APP_URL}/app.html`,
  });
  res.json({ url: session.url });
}));

// POST /api/stripe/webhook — public, Stripe calls this directly
// Raw body must be intact (set up in app.js: express.json verify → req.rawBody)
r.post('/webhook', wrap(async (req, res) => {
  const sig    = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || secret.startsWith('PLACEHOLDER')) {
    // Webhook not configured yet — accept and ignore (safe during setup)
    return res.json({ received: true });
  }

  const s = getStripe();
  let event;
  try {
    event = s.webhooks.constructEvent(req.rawBody, sig, secret);
  } catch (err) {
    return res.status(400).json({ error: `Webhook signature: ${err.message}` });
  }

  const obj = event.data.object;

  if (event.type === 'checkout.session.completed') {
    const schoolId = Number(obj.metadata?.school_id);
    const plan     = obj.metadata?.plan || 'pro';
    const subId    = obj.subscription;
    if (schoolId) {
      let expires = new Date(Date.now() + 31 * 86400_000).toISOString();
      if (subId) {
        const sub = await s.subscriptions.retrieve(subId);
        if (sub.current_period_end) expires = new Date(sub.current_period_end * 1000).toISOString();
      }
      run('UPDATE schools SET plan = ?, plan_expires = ?, stripe_subscription_id = ? WHERE id = ?',
        plan, expires, subId || null, schoolId);
    }
  }

  if (event.type === 'customer.subscription.updated') {
    const school = get('SELECT id FROM schools WHERE stripe_customer_id = ?', obj.customer);
    if (school) {
      const plan    = obj.metadata?.plan || 'pro';
      const expires = new Date(obj.current_period_end * 1000).toISOString();
      const active  = ['active', 'trialing'].includes(obj.status);
      run('UPDATE schools SET plan = ?, plan_expires = ? WHERE id = ?',
        active ? plan : 'cancelled', expires, school.id);
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const school = get('SELECT id FROM schools WHERE stripe_customer_id = ?', obj.customer);
    if (school) {
      run("UPDATE schools SET plan = 'cancelled', stripe_subscription_id = NULL WHERE id = ?", school.id);
    }
  }

  if (event.type === 'invoice.payment_succeeded') {
    const school = get('SELECT id FROM schools WHERE stripe_customer_id = ?', obj.customer);
    if (school && obj.period_end) {
      run('UPDATE schools SET plan_expires = ? WHERE id = ?',
        new Date(obj.period_end * 1000).toISOString(), school.id);
    }
  }

  res.json({ received: true });
}));

export default r;
