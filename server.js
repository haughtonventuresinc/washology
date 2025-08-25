/* eslint-disable no-console */
require('dotenv').config();
const path = require('path');
const express = require('express');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse form-encoded and JSON bodies
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve static files from project root
app.use(express.static(__dirname));

// Basic healthcheck
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Contact endpoint replacing PHP mailer
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body || {};

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    // Minimal email validation
    const emailRegex = /.+@.+\..+/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email.' });
    }

    const to = process.env.MAIL_TO || 'info@example.com';

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || 'false') === 'true',
      auth: process.env.SMTP_USER && process.env.SMTP_PASS ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      } : undefined,
    });

    const text = [
      'You have received a new message from your website contact form.',
      '',
      `Name: ${name}`,
      `Email: ${email}`,
      `Subject: ${subject}`,
      'Message:',
      message,
    ].join('\n');

    await transporter.sendMail({
      from: email, // use submitter's email as from
      to,
      subject: `${subject}: ${name}`,
      text,
      replyTo: email,
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Contact send error:', err);
    return res.status(500).json({ error: 'Failed to send message.' });
  }
});

// --------- Page Routes (serve HTML via routes instead of direct .html) ---------
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/about', (_req, res) => {
  res.sendFile(path.join(__dirname, 'about.html'));
});

app.get('/contact', (_req, res) => {
  res.sendFile(path.join(__dirname, 'contact.html'));
});

app.get('/services', (_req, res) => {
  res.sendFile(path.join(__dirname, 'service.html'));
});

app.get('/pricing', (_req, res) => {
  res.sendFile(path.join(__dirname, 'pricing.html'));
});

app.get('/blog', (_req, res) => {
  res.sendFile(path.join(__dirname, 'blog.html'));
});

app.get('/blog/:slug', (_req, res) => {
  // Serve a generic single post template
  res.sendFile(path.join(__dirname, 'single.html'));
});

// Optional route for direct /single
app.get('/single', (_req, res) => {
  res.sendFile(path.join(__dirname, 'single.html'));
});

// --------- Redirect legacy .html paths to clean routes ---------
app.get('/index.html', (_req, res) => res.redirect(301, '/'));
app.get('/about.html', (_req, res) => res.redirect(301, '/about'));
app.get('/contact.html', (_req, res) => res.redirect(301, '/contact'));
app.get('/service.html', (_req, res) => res.redirect(301, '/services'));
app.get('/pricing.html', (_req, res) => res.redirect(301, '/pricing'));
app.get('/blog.html', (_req, res) => res.redirect(301, '/blog'));
app.get('/single.html', (_req, res) => res.redirect(301, '/blog/sample'));

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
