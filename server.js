/* Express server to serve static GarageUp site with clean routes */
const express = require('express');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;

// Root directory of the static site
const siteRoot = __dirname; // /garageup.com

// View engine: EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

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

// Simple in-memory user store (replace with DB)
// Password: "password123" (hashed)
const USERS = [
  {
    id: 'u1',
    email: process.env.ADMIN_EMAIL || 'admin@example.com',
    passwordHash: process.env.ADMIN_PASSWORD_HASH || '$2a$10$Z5z5v6qrlc8cVZrIYv8i1OcUEnOQ3in7R9l9gB6qgV3YyFShd0p5m',
    name: 'Admin'
  }
];

function findUserByEmail(email) {
  return USERS.find(u => u.email.toLowerCase() === String(email || '').toLowerCase());
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
  return res.render('home');
});

app.get('/about-us', (req, res) => {
  return res.render('about-us');
});

app.get('/contact-us', (req, res) => {
  if (sendHtml(res, path.join('contact-us', 'index.html'))) return;
  if (sendHtml(res, 'contact-us.html')) return;
  res.status(404).send('Not Found');
});

// Redirect shorthand /contact -> /contact-us
app.get('/contact', (req, res) => {
  return res.redirect(301, '/contact-us');
});

app.get('/privacy-policy', (req, res) => {
  if (sendHtml(res, path.join('privacy-policy', 'index.html'))) return;
  if (sendHtml(res, 'privacy-policy.html')) return;
  res.status(404).send('Not Found');
});

app.get('/terms-and-conditions', (req, res) => {
  if (sendHtml(res, path.join('terms-and-conditions', 'index.html'))) return;
  if (sendHtml(res, 'terms-and-conditions.html')) return;
  res.status(404).send('Not Found');
});

app.get('/design-studio', (req, res) => {
  if (sendHtml(res, path.join('design-studio', 'index.html'))) return;
  res.status(404).send('Not Found');
});

app.get('/warranty', (req, res) => {
  if (sendHtml(res, path.join('warranty', 'index.html'))) return;
  res.status(404).send('Not Found');
});

// Services routes
app.get('/services', (req, res) => {
  // If there is a services landing, try index.html under services/
  if (sendHtml(res, path.join('services', 'index.html'))) return;
  res.status(404).send('Not Found');
});

// Specific SSR route for Weekly Service (EJS)
app.get('/services/weekly-service', (req, res) => {
  return res.render('services/weekly-service');
});

// Generic service route to serve any service folder by slug
app.get('/services/:slug', (req, res) => {
  const { slug } = req.params;
  if (sendHtml(res, path.join('services', slug, 'index.html'))) return;
  res.status(404).send('Not Found');
});


app.get('/blog', (req, res) => {
  if (sendHtml(res, path.join('blog', 'index.html'))) return;
  res.status(404).send('Not Found');
});
// Blog and other nested pages will be served via the smart fallback + static

// --- Auth API ---
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const user = findUserByEmail(email);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
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
  const user = uid && USERS.find(u => u.id === uid);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  return res.json({ id: user.id, email: user.email, name: user.name });
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
