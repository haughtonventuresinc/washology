/* Express server to serve static GarageUp site with clean routes */
const express = require('express');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const session = require('express-session');
const bcrypt = require('bcryptjs');

// Load environment variables from .env if present
try { require('dotenv').config(); } catch (_) {}

function loadContact() {
  try {
    const raw = fs.readFileSync(CONTACT_DB_PATH, 'utf8');
    const obj = JSON.parse(raw);
    return obj && typeof obj === 'object' ? obj : {};
  } catch (e) {
    return {};
  }
}

function saveContact(payload) {
  try {
    const current = loadContact();
    const next = { ...current, ...payload };
    fs.writeFileSync(CONTACT_DB_PATH, JSON.stringify(next, null, 2), 'utf8');
    return next;
  } catch (e) {
    return null;
  }
}

function loadBlog() {
  try {
    const raw = fs.readFileSync(BLOG_DB_PATH, 'utf8');
    const obj = JSON.parse(raw);
    return obj && typeof obj === 'object' ? obj : {};
  } catch (e) {
    return {};
  }
}

function saveBlog(payload) {
  try {
    const current = loadBlog();
    const next = { ...current, ...payload };
    fs.writeFileSync(BLOG_DB_PATH, JSON.stringify(next, null, 2), 'utf8');
    return next;
  } catch (e) {
    return null;
  }
}

function loadHomepage() {
  try {
    const raw = fs.readFileSync(HOMEPAGE_DB_PATH, 'utf8');
    const obj = JSON.parse(raw);
    return obj && typeof obj === 'object' ? obj : {};
  } catch (e) {
    return {};
  }
}

function saveHomepage(payload) {
  try {
    const current = loadHomepage();
    const next = { ...current, ...payload };
    fs.writeFileSync(HOMEPAGE_DB_PATH, JSON.stringify(next, null, 2), 'utf8');
    return next;
  } catch (e) {
    return null;
  }
}

function loadAbout() {
  try {
    const raw = fs.readFileSync(ABOUT_DB_PATH, 'utf8');
    const obj = JSON.parse(raw);
    return obj && typeof obj === 'object' ? obj : {};
  } catch (e) {
    return {};
  }
}

function saveAbout(payload) {
  try {
    const current = loadAbout();
    const next = { ...current, ...payload };
    fs.writeFileSync(ABOUT_DB_PATH, JSON.stringify(next, null, 2), 'utf8');
    return next;
  } catch (e) {
    return null;
  }
}

const app = express();
const PORT = process.env.PORT || 3000;

// Root directory of the static site
const siteRoot = __dirname; // /garageup.com
// Views (EJS)
app.set('views', path.join(siteRoot, 'views'));
app.set('view engine', 'ejs');

// Body & cookies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cookieParser());

// Sessions (in-memory store; replace with Redis for production)
app.use(session({
  name: 'sid',
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: !!process.env.SSL, // set true behind HTTPS/Proxy
    maxAge: 1000 * 60 * 60 * 24 // 1 day
  }
}));

// Local JSON user database
const USERS_DB_PATH = path.join(siteRoot, 'data', 'users.json');
const HOMEPAGE_DB_PATH = path.join(siteRoot, 'data', 'homepage.json');
const ABOUT_DB_PATH = path.join(siteRoot, 'data', 'about.json');
const BLOG_DB_PATH = path.join(siteRoot, 'data', 'blog.json');
const CONTACT_DB_PATH = path.join(siteRoot, 'data', 'contact.json');
const LEADS_DB_PATH = path.join(siteRoot, 'data', 'leads.json');

function loadLeads() {
  try {
    const raw = fs.readFileSync(LEADS_DB_PATH, 'utf8');
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

function saveLead(entry) {
  try {
    const list = loadLeads();
    list.push(entry);
    fs.writeFileSync(LEADS_DB_PATH, JSON.stringify(list, null, 2), 'utf8');
    return entry;
  } catch (e) {
    return null;
  }
}

function loadUsers() {
  try {
    const raw = fs.readFileSync(USERS_DB_PATH, 'utf8');
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

function findUserByIdentifier(identifier) {
  const users = loadUsers();
  const q = String(identifier || '').toLowerCase();
  return users.find(u =>
    (u.email && String(u.email).toLowerCase() === q) ||
    (u.username && String(u.username).toLowerCase() === q)
  );
}

function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  // For API requests, return 401 JSON; for others, redirect to login
  const isApi = req.path && req.path.startsWith('/api/');
  try {
    const hasCookie = !!(req.headers && req.headers.cookie);
    console.warn('[auth] unauthorized access', {
      path: req.path,
      isApi,
      hasCookie,
      sessionExists: !!req.session,
      sessionUserId: req.session && req.session.userId ? 'present' : 'absent'
    });
  } catch (_) {}
  if (isApi) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return res.redirect('/admin-login');
}

// Utility to send an HTML file if it exists
function sendHtml(res, relativePath) {
  const fullPath = path.join(siteRoot, relativePath);
  if (fs.existsSync(fullPath)) {
    res.sendFile(fullPath);
    return true; // explicitly return boolean so callers don't fall through
  }
  return false;
}

// Simple request logger (useful for debugging)
app.use((req, res, next) => {
  // eslint-disable-next-line no-console
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Public lead capture endpoint (replaces insecure mailto forms)
app.post('/api/leads', (req, res) => {
  try {
    const b = req.body || {};
    const firstName = (b.firstName || '').toString().trim();
    const lastName = (b.lastName || '').toString().trim();
    const phone = (b.phone || '').toString().trim();
    const email = (b.email || '').toString().trim();
    const zip = (b.zip || '').toString().trim();
    const city = (b.city || '').toString().trim();
    const state = (b.state || '').toString().trim();
    const message = (b.message || '').toString().trim();
    const source = (b.source || '').toString().trim();

    // Minimal validation: require name and at least one contact method
    if (!firstName || !lastName || (!phone && !email)) {
      return res.status(400).json({ error: 'Please provide first name, last name, and phone or email.' });
    }

    const entry = {
      firstName, lastName, phone, email, zip, city, state, message, source,
      userAgent: (req.headers['user-agent'] || ''),
      ip: (req.headers['x-forwarded-for'] || req.socket.remoteAddress || ''),
      createdAt: new Date().toISOString()
    };
    const saved = saveLead(entry);
    if (!saved) return res.status(500).json({ error: 'Failed to save lead' });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'Exception while saving lead' });
  }
});

// Clean routes for top-level pages
app.get('/', (req, res) => {
  // Server-side render home page via EJS
  const homepage = loadHomepage();
  return res.render('home', { homepage });
});

app.get('/about-us', (req, res) => {
  // SSR only
  const about = loadAbout();
  const homepage = loadHomepage();
  return res.render('about-us', { about, homepage });
});

app.get('/contact-us', (req, res) => {
  // SSR only; set bodyClass so styles match original contact page
  const bodyClass = 'wp-singular page-template page-template-templates page-template-contact-us page-template-templatescontact-us-php page page-id-63 wp-theme-resi-franchise wp-child-theme-garageup';
  const contact = loadContact();
  return res.render('contact-us', { bodyClass, contact });
});


// Redirect shorthand /contact -> /contact-us
app.get('/contact', (req, res) => {
  return res.redirect(301, '/contact-us');
});

app.get('/privacy-policy', (req, res) => {
  // Prefer EJS view if available
  const viewA = path.join(app.get('views'), 'privacy-policy.ejs');
  const viewB = path.join(app.get('views'), 'privacy-policy', 'index.ejs');
  if (fs.existsSync(viewA)) return res.render('privacy-policy');
  if (fs.existsSync(viewB)) return res.render('privacy-policy/index');
  if (sendHtml(res, path.join('privacy-policy', 'index.html'))) return;
  if (sendHtml(res, 'privacy-policy.html')) return;
  res.status(404).send('Not Found');
});

app.get('/terms-and-conditions', (req, res) => {
  // Prefer EJS view if available
  const viewA = path.join(app.get('views'), 'terms-and-conditions.ejs');
  const viewB = path.join(app.get('views'), 'terms-and-conditions', 'index.ejs');
  if (fs.existsSync(viewA)) return res.render('terms-and-conditions');
  if (fs.existsSync(viewB)) return res.render('terms-and-conditions/index');
  if (sendHtml(res, path.join('terms-and-conditions', 'index.html'))) return;
  if (sendHtml(res, 'terms-and-conditions.html')) return;
  res.status(404).send('Not Found');
});

app.get('/design-studio', (req, res) => {
  // Prefer EJS view if available
  const viewA = path.join(app.get('views'), 'design-studio.ejs');
  const viewB = path.join(app.get('views'), 'design-studio', 'index.ejs');
  if (fs.existsSync(viewA)) return res.render('design-studio');
  if (fs.existsSync(viewB)) return res.render('design-studio/index');
  if (sendHtml(res, path.join('design-studio', 'index.html'))) return;
  res.status(404).send('Not Found');
});

app.get('/warranty', (req, res) => {
  // Prefer EJS view if available
  const viewA = path.join(app.get('views'), 'warranty.ejs');
  const viewB = path.join(app.get('views'), 'warranty', 'index.ejs');
  if (fs.existsSync(viewA)) return res.render('warranty');
  if (fs.existsSync(viewB)) return res.render('warranty/index');
  if (sendHtml(res, path.join('warranty', 'index.html'))) return;
  res.status(404).send('Not Found');
});

// Services routes
app.get('/services', (req, res) => {
  // Prefer EJS view if available
  const viewA = path.join(app.get('views'), 'services.ejs');
  const viewB = path.join(app.get('views'), 'services', 'index.ejs');
  if (fs.existsSync(viewA)) return res.render('services');
  if (fs.existsSync(viewB)) return res.render('services/index');
  // If there is a services landing, try index.html under services/
  if (sendHtml(res, path.join('services', 'index.html'))) return;
  res.status(404).send('Not Found');
});

// Generic service route to serve any service folder by slug
app.get('/services/:slug', (req, res) => {
  const { slug } = req.params;
  // Prefer EJS view if available
  const viewA = path.join(app.get('views'), 'services', `${slug}.ejs`);
  const viewB = path.join(app.get('views'), 'services', slug, 'index.ejs');
  if (fs.existsSync(viewA)) return res.render(`services/${slug}`);
  if (fs.existsSync(viewB)) return res.render(`services/${slug}/index`);
  if (sendHtml(res, path.join('services', slug, 'index.html'))) return;
  res.status(404).send('Not Found');
});


app.get('/blog', (req, res) => {
  // Prefer EJS SSR for blog archive if view exists
  const blogView = path.join(app.get('views'), 'blog.ejs');
  if (fs.existsSync(blogView)) {
    const bodyClass = 'blog wp-theme-resi-franchise wp-child-theme-garageup';
    const blog = loadBlog();
    return res.render('blog', { bodyClass, blog });
  }
  if (sendHtml(res, path.join('blog', 'index.html'))) return;
  res.status(404).send('Not Found');
});
// Blog and other nested pages will be served via the smart fallback + static

// Blog post detail by slug (derived from title)
app.get('/blog/:slug', (req, res) => {
  const { slug } = req.params;
  const blog = loadBlog();
  const toSlug = (s) => String(s || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 120);

  // Build posts array from blog.json keys post1..post12
  const posts = [];
  for (let i = 1; i <= 12; i++) {
    const title = blog[`post${i}Title`];
    const url = blog[`post${i}Url`];
    const category = blog[`post${i}Category`];
    const readMin = blog[`post${i}ReadMin`];
    const image = blog[`post${i}Image`];
    const excerpt = blog[`post${i}Excerpt`];
    const body = blog[`post${i}Body`]; // optional full content
    if (title && image) {
      posts.push({
        id: i,
        title, url, category, readMin, image, excerpt, body,
        slug: toSlug(title)
      });
    }
  }

  const post = posts.find(p => p.slug === slug);
  if (!post) {
    // Not found: redirect to blog archive
    return res.redirect(302, '/blog');
  }

  const bodyClass = 'single single-post wp-theme-resi-franchise wp-child-theme-garageup';
  return res.render('blog-post', { bodyClass, post });
});

// --- Admin Login page (SSR) ---
app.get('/admin-login', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect('/dashboard');
  }
  const bodyClass = 'login-page wp-theme-resi-franchise wp-child-theme-garageup';
  return res.render('admin-login', { bodyClass });
});

// --- Auth API ---
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, username, identifier, password } = req.body || {};
    const key = (identifier || email || username || '').toString().trim();
    const pwd = (password || '').toString();
    if (!key || !pwd) return res.status(400).json({ error: 'Email/username and password required' });
    // Temporary debug logging (identifier only)
    console.log('[auth] login attempt for identifier:', key);
    // 1) Environment-based admin auth (if configured)
    const envUser = (process.env.ADMIN_USER || '').toString().trim().toLowerCase();
    const envEmail = (process.env.ADMIN_EMAIL || '').toString().trim().toLowerCase();
    const envPass = (process.env.ADMIN_PASS || '').toString().trim();
    const envPassHash = (process.env.ADMIN_PASSWORD_HASH || '').toString();

    const matchesEnvIdentity = (!!envUser && key.toLowerCase() === envUser) || (!!envEmail && key.toLowerCase() === envEmail);
    if (matchesEnvIdentity) {
      console.log('[auth] using ENV credentials for', key);
      if (envPass) {
        console.log('[auth] ENV method: plain password');
        if (pwd !== envPass) {
          const msg = process.env.NODE_ENV === 'production' ? 'Invalid credentials' : 'Invalid credentials: wrong password (env)';
          return res.status(401).json({ error: msg });
        }
        req.session.userId = 'env-admin';
        return res.json({ id: 'env-admin', email: process.env.ADMIN_EMAIL || null, name: 'Admin' });
      } else if (envPassHash) {
        console.log('[auth] ENV method: bcrypt hash');
        const okEnv = await bcrypt.compare(pwd, envPassHash);
        if (!okEnv) {
          const msg = process.env.NODE_ENV === 'production' ? 'Invalid credentials' : 'Invalid credentials: wrong password (env hash)';
          return res.status(401).json({ error: msg });
        }
        req.session.userId = 'env-admin';
        return res.json({ id: 'env-admin', email: process.env.ADMIN_EMAIL || null, name: 'Admin' });
      } else {
        return res.status(500).json({ error: 'Server auth is misconfigured: set ADMIN_PASS or ADMIN_PASSWORD_HASH' });
      }
    }

    // 2) Fallback to local users.json
    const user = findUserByIdentifier(key);
    if (!user) {
      const msg = process.env.NODE_ENV === 'production' ? 'Invalid credentials' : 'Invalid credentials: user not found';
      return res.status(401).json({ error: msg });
    }
    const ok = await bcrypt.compare(pwd, user.passwordHash);
    if (!ok) {
      const msg = process.env.NODE_ENV === 'production' ? 'Invalid credentials' : 'Invalid credentials: wrong password';
      return res.status(401).json({ error: msg });
    }
    req.session.userId = user.id;
    return res.json({ id: user.id, email: user.email, name: user.name });
  } catch (e) {
    return res.status(500).json({ error: 'Login failed' });
  }
});

// --- Contact Page Editor API (protected) ---
app.get('/api/contact-page', requireAuth, (req, res) => {
  const data = loadContact();
  return res.json(data);
});

app.post('/api/contact-page', requireAuth, (req, res) => {
  try { console.log('[api/contact-page] incoming keys:', Object.keys(req.body || {})); } catch(_) {}
  const allowed = [
    // Hero
    'heroTitle', 'heroSubtitle', 'heroBg',
    // Left column
    'leftTitle', 'leftSubtitle', 'leftBg',
    'bullet1', 'bullet2', 'bullet3', 'bullet4', 'bullet5', 'bullet6',
    // Right column
    'rightTitle',
    // Bottom form
    'bottomTitle',
    // Reviews
    'reviewsTitle',
    'review1Text', 'review1Author',
    'review2Text', 'review2Author',
    'review3Text', 'review3Author',
    // CTA
    'ctaTitle', 'ctaBody', 'ctaLabel', 'ctaUrl'
  ];
  const payload = {};
  for (const k of allowed) {
    if (typeof req.body[k] !== 'undefined') {
      const v = (req.body[k] == null) ? '' : String(req.body[k]);
      if (v.trim().length > 0) payload[k] = v;
    }
  }
  try {
    const saved = saveContact(payload);
    if (!saved) {
      console.error('[api/contact-page] saveContact returned null');
      return res.status(500).json({ error: 'Failed to save contact page' });
    }
    console.log('[api/contact-page] saved keys:', Object.keys(payload));
    return res.json(saved);
  } catch (e) {
    console.error('[api/contact-page] exception while saving:', e);
    return res.status(500).json({ error: 'Exception while saving contact page' });
  }
});


// --- About Page Editor API (protected) ---
app.get('/api/about', requireAuth, (req, res) => {
  const data = loadAbout();
  return res.json(data);
});

app.post('/api/about', requireAuth, (req, res) => {
  try { console.log('[api/about] incoming keys:', Object.keys(req.body || {})); } catch(_) {}
  const allowed = [
    'heroTitle', 'heroBg',
    'introTitle', 'introBody', 'introImage1', 'introImage2',
    'coreValuesTitle',
    'coreValue1Icon', 'coreValue1Title', 'coreValue1Body',
    'coreValue2Icon', 'coreValue2Title', 'coreValue2Body',
    'coreValue3Icon', 'coreValue3Title', 'coreValue3Body',
    'coreRightImage1', 'coreRightImage2',
    'wayTitle', 'wayBody',
    'promise1Title', 'promise1Body',
    'promise2Title', 'promise2Body',
    'promise3Title', 'promise3Body',
    'promise4Title', 'promise4Body',
    'ctaTitle', 'ctaBody', 'ctaLabel', 'ctaUrl'
  ];
  const payload = {};
  for (const k of allowed) {
    if (typeof req.body[k] !== 'undefined') {
      const v = (req.body[k] == null) ? '' : String(req.body[k]);
      if (v.trim().length > 0) {
        payload[k] = v;
      }
    }
  }
  try {
    const saved = saveAbout(payload);
    if (!saved) {
      console.error('[api/about] saveAbout returned null');
      return res.status(500).json({ error: 'Failed to save about' });
    }
    console.log('[api/about] saved keys:', Object.keys(payload));
    return res.json(saved);
  } catch (e) {
    console.error('[api/about] exception while saving:', e);
    return res.status(500).json({ error: 'Exception while saving about' });
  }
});

// --- Blog Editor API (protected) ---
app.get('/api/blog', requireAuth, (req, res) => {
  const data = loadBlog();
  return res.json(data);
});

app.post('/api/blog', requireAuth, (req, res) => {
  try { console.log('[api/blog] incoming keys:', Object.keys(req.body || {})); } catch(_) {}
  const allowed = [
    'heroTitle', 'heroBg',
    'ctaTitle', 'ctaBody', 'ctaLabel', 'ctaUrl'
  ];
  for (let i = 1; i <= 12; i++) {
    allowed.push(
      `post${i}Title`, `post${i}Url`, `post${i}Category`, `post${i}ReadMin`, `post${i}Image`, `post${i}Excerpt`, `post${i}Body`
    );
  }
  const payload = {};
  for (const k of allowed) {
    if (typeof req.body[k] !== 'undefined') {
      const v = (req.body[k] == null) ? '' : String(req.body[k]);
      if (v.trim().length > 0) {
        payload[k] = v;
      }
    }
  }
  try {
    const saved = saveBlog(payload);
    if (!saved) {
      console.error('[api/blog] saveBlog returned null');
      return res.status(500).json({ error: 'Failed to save blog' });
    }
    console.log('[api/blog] saved keys:', Object.keys(payload));
    return res.json(saved);
  } catch (e) {
    console.error('[api/blog] exception while saving:', e);
    return res.status(500).json({ error: 'Exception while saving blog' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  if (!req.session) return res.json({ ok: true });
  req.session.destroy(() => {
    res.clearCookie('sid');
    return res.json({ ok: true });
  });
});

app.get('/api/auth/me', (req, res) => {
  const uid = req.session && req.session.userId;
  const users = loadUsers();
  const user = uid && users.find(u => u.id === uid);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  return res.json({ id: user.id, email: user.email, name: user.name });
});

app.get('/api/util/hash', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).send('Not Found');
  }
  const pw = (req.query.pw || '').toString();
  if (!pw) return res.status(400).json({ error: 'Provide ?pw=' });
  const hash = bcrypt.hashSync(pw, 10);
  return res.json({ hash });
});

// Dev-only: report current auth status (no secrets)
app.get('/api/util/auth-status', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).send('Not Found');
  }
  const envUser = (process.env.ADMIN_USER || '').toString().trim();
  const envEmail = (process.env.ADMIN_EMAIL || '').toString().trim();
  const hasPlain = !!process.env.ADMIN_PASS;
  const hasHash = !!process.env.ADMIN_PASSWORD_HASH;
  return res.json({ envConfigured: !!(envUser || envEmail), envUser: !!envUser, envEmail: !!envEmail, method: hasPlain ? 'plain' : (hasHash ? 'hash' : 'none') });
});

// --- Dashboard (protected) ---
app.get('/dashboard', requireAuth, (req, res) => {
  return res.render('dashboard', { section: 'home' });
});

app.get('/dashboard/:section', requireAuth, (req, res) => {
  const section = req.params.section || 'home';
  if (section === 'homepage') {
    const homepage = loadHomepage();
    return res.render('dashboard', { section, homepage });
  }
  if (section === 'about') {
    const about = loadAbout();
    return res.render('dashboard', { section, about });
  }
  if (section === 'blog') {
    const blog = loadBlog();
    return res.render('dashboard', { section, blog });
  }
  if (section === 'contact') {
    const contact = loadContact();
    return res.render('dashboard', { section, contact });
  }
  return res.render('dashboard', { section });
});

// --- Homepage Editor API (protected) ---
app.get('/api/homepage', requireAuth, (req, res) => {
  const data = loadHomepage();
  return res.json(data);
});

app.post('/api/homepage', requireAuth, (req, res) => {
  // Debug: log incoming body keys (do not log full content in prod)
  try { console.log('[api/homepage] incoming keys:', Object.keys(req.body || {})); } catch(_) {}
  const allowed = [
    'heroTitle', 'heroSubtitle', 'heroBg',
    'whoWeAreTitle', 'whoWeAreBody',
    'ctaLabel', 'ctaUrl',
    'servicesTitle',
    // New fields
    'scrollerText',
    'whoWeAreImage',
    'featuredService1Title', 'featuredService1Url', 'featuredService1Image',
    'featuredService2Title', 'featuredService2Url', 'featuredService2Image',
    'featuredService3Title', 'featuredService3Url', 'featuredService3Image',
    'featuredService4Title', 'featuredService4Url', 'featuredService4Image',
    'quickLocations', 'quickJobs', 'quickStates', 'quickReviews', 'quickEstimates', 'quickPossibilities',
    // Quick Facts labels
    'quickLocationsLabel', 'quickJobsLabel', 'quickStatesLabel', 'quickReviewsLabel', 'quickEstimatesLabel', 'quickPossibilitiesLabel',
    'blogKicker', 'blogTitle',
    'warrantyTitle', 'warrantyBody',
    'getStartedTitle', 'getStartedBody', 'getStartedCtaLabel', 'getStartedCtaUrl'
  ];
  // Extend with service pills (1..6), featured posts (1..3), and reviews (1..3)
  for (let i = 1; i <= 6; i++) {
    allowed.push(`servicesBtn${i}Label`, `servicesBtn${i}Url`);
  }
  for (let i = 1; i <= 3; i++) {
    allowed.push(
      `blogFeat${i}Title`, `blogFeat${i}Url`, `blogFeat${i}Image`, `blogFeat${i}Excerpt`
    );
  }
  for (let i = 1; i <= 3; i++) {
    allowed.push(`review${i}Text`, `review${i}Author`);
  }
  const payload = {};
  for (const k of allowed) {
    if (typeof req.body[k] !== 'undefined') {
      const v = (req.body[k] == null) ? '' : String(req.body[k]);
      // Ignore empty-string values to avoid wiping existing content unintentionally
      if (v.trim().length > 0) {
        payload[k] = v;
      }
    }
  }
  try {
    const saved = saveHomepage(payload);
    if (!saved) {
      console.error('[api/homepage] saveHomepage returned null');
      return res.status(500).json({ error: 'Failed to save homepage' });
    }
    console.log('[api/homepage] saved keys:', Object.keys(payload));
    return res.json(saved);
  } catch (e) {
    console.error('[api/homepage] exception while saving:', e);
    return res.status(500).json({ error: 'Exception while saving homepage' });
  }
});

// --- Upload API (protected) ---
// Store uploads under /wp-content/uploads/YYYY/MM
function ensureUploadDir() {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const rel = path.join('wp-content', 'uploads', yyyy, mm);
  const abs = path.join(siteRoot, rel);
  fs.mkdirSync(abs, { recursive: true });
  return { abs, rel };
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const { abs } = ensureUploadDir();
    cb(null, abs);
  },
  filename: function (req, file, cb) {
    const ts = Date.now();
    const safe = String(file.originalname || 'upload').replace(/[^a-z0-9._-]+/gi, '-');
    cb(null, ts + '-' + safe);
  }
});
const upload = multer({ storage });

app.post('/api/upload', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  // Build public URL path
  const fullPath = req.file.path; // absolute
  const relIndex = fullPath.indexOf(path.join('wp-content', 'uploads'));
  let urlPath;
  if (relIndex !== -1) {
    urlPath = '/' + fullPath.substring(relIndex).replace(/\\/g, '/');
  } else {
    urlPath = '/wp-content/uploads/' + path.basename(fullPath);
  }
  return res.json({ url: urlPath });
});

// Smart clean-URL fallback: try to map 
// 1) /path/ -> /path/index.html
// 2) /path -> /path.html
// 3) otherwise hand off to static middleware
app.get('*', (req, res, next) => {
  try {
    const reqPath = decodeURIComponent(req.path);

    // ignore obvious assets (let static handle these)
    if (path.extname(reqPath)) return next();

    // normalize: strip leading '/'
    const rel = reqPath.replace(/^\/+/, '');

    // 0) Prefer EJS views if present (SSR)
    if (rel.length > 0) {
      // Try views/rel.ejs
      const candidateView = path.join(app.get('views'), `${rel}.ejs`);
      if (fs.existsSync(candidateView)) {
        const viewName = rel.replace(/\\/g, '/');
        return res.render(viewName);
      }
      // Try views/rel/index.ejs
      const candidateIndexView = path.join(app.get('views'), rel, 'index.ejs');
      if (fs.existsSync(candidateIndexView)) {
        const viewName = path.join(rel, 'index').replace(/\\/g, '/');
        return res.render(viewName);
      }
    }

    // 1) directory index
    if (rel.length === 0) return next();
    const tryDirIndex = path.join(rel, 'index.html');
    if (fs.existsSync(path.join(siteRoot, tryDirIndex))) {
      return res.sendFile(path.join(siteRoot, tryDirIndex));
    }

    // 2) html file with same name
    const tryHtml = `${rel}.html`;
    if (fs.existsSync(path.join(siteRoot, tryHtml))) {
      return res.sendFile(path.join(siteRoot, tryHtml));
    }

    return next();
  } catch (e) {
    return next();
  }
});

// Static middleware to serve everything else (css, js, images, and any remaining html)
app.use(express.static(siteRoot, {
  extensions: ['html'], // allows clean URLs to map to .html as a last resort
  fallthrough: true,
  maxAge: process.env.NODE_ENV === 'production' ? '7d' : 0,
}));

// 404 for anything not found
app.use((req, res) => {
  const view404 = path.join(app.get('views'), '404.ejs');
  if (fs.existsSync(view404)) {
    return res.status(404).render('404');
  }
  return res.status(404).send('Not Found');
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Swimstuds site server running on http://localhost:${PORT}`);
});
