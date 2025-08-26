# GarageUp Node.js Server

This converts the static website in this folder into a Node.js Express app with clean routes. It serves all existing HTML and assets as-is.

## Prereqs
- Node.js 18+ recommended

## Install
```bash
npm install
```

## Run (dev)
```bash
npm run dev
```

## Run (prod)
```bash
npm start
```

App will start at:
- http://localhost:3000/

## Clean routes mapped
- `/` -> `index.html`
- `/about-us` -> `about-us/index.html` (fallback `about-us.html`)
- `/contact-us` -> `contact-us/index.html` (fallback `contact-us.html`)
- `/privacy-policy` -> `privacy-policy/index.html` (fallback `privacy-policy.html`)
- `/terms-and-conditions` -> `terms-and-conditions/index.html` (fallback `terms-and-conditions.html`)
- `/design-studio` -> `design-studio/index.html`
- `/warranty` -> `warranty/index.html`
- `/services/*` -> respective `services/<slug>/index.html`

### Smart fallback
For any other path without an extension:
1. Try `<path>/index.html`
2. Try `<path>.html`
3. Otherwise let Express static middleware handle it or 404

All assets (CSS/JS/images under `wp-content/`, `wp-includes/`, etc.) are served statically from this folder.
# swim-studs
