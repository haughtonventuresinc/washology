/* Express server to serve static GarageUp site with clean routes */
const express = require('express');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const bcrypt = require('bcryptjs');

// Load environment variables from .env if present
try { require('dotenv').config(); } catch (_) {}

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
  return res.status(401).json({ error: 'Unauthorized' });
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

// Clean routes for top-level pages
app.get('/', (req, res) => {
  // Server-side render home page via EJS
  return res.render('home');
});

app.get('/about-us', (req, res) => {
  // SSR only
  return res.render('about-us');
});

app.get('/contact-us', (req, res) => {
  // SSR only; set bodyClass so styles match original contact page
  const bodyClass = 'wp-singular page-template page-template-templates page-template-contact-us page-template-templatescontact-us-php page page-id-63 wp-theme-resi-franchise wp-child-theme-garageup';
  return res.render('contact-us', { bodyClass });
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
    return res.render('blog', { bodyClass });
  }
  if (sendHtml(res, path.join('blog', 'index.html'))) return;
  res.status(404).send('Not Found');
});
// Blog and other nested pages will be served via the smart fallback + static

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

// Protect dashboard assets (create a /dashboard/ directory with index.html)
app.use('/dashboard', requireAuth, (req, res, next) => {
  // serve static if exists, else simple placeholder
  const dashDir = path.join(siteRoot, 'dashboard');
  if (fs.existsSync(dashDir)) {
    return express.static(dashDir, { extensions: ['html'] })(req, res, next);
  }
  res.type('html').send('<h1>Dashboard</h1><p>Protected area. Add dashboard/index.html to customize.</p>');
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
  res.status(404).send('Not Found');
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`GarageUp site server running on http://localhost:${PORT}`);
});
