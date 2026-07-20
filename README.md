# Michelle & Jose — Wedding Invitation Website

A single-page wedding invitation site: hero, countdown, ceremony & reception
details, timeline, entourage, principal sponsors, invitation message, love
story, attire/color motif, photo gallery + video + guest photo slideshow,
love messages wall, RSVP with guest tracking, and a gift guide (GCash/bank).

The static site (`index.html`, `style.css`, `script.js`) works locally by
just opening `index.html`. The RSVP form and Love Messages wall talk to a
small self-hosted API in `server/` — see **Part B** below to deploy the
whole thing on an Ubuntu VM.

## File structure
```
wedding/
├── index.html         ← all content and sections
├── style.css           ← all styling
├── script.js            ← countdown, nav, slideshow, forms, lightbox
├── images/               ← put your photos here
├── song.mp3               ← background music
├── server/                 ← self-hosted RSVP/wishes API (Node + SQLite)
│   ├── server.js
│   ├── package.json
│   └── .env.example
├── deploy/                  ← Ubuntu deployment configs
│   ├── nginx-wedding.conf
│   └── wedding-api.service
└── README.md
```

---

# Part A — Edit your content

## 1. Edit your details

Open `index.html` in any text editor and search for the word **EDIT** —
every spot with real content to personalize (names, date, venue, entourage,
love story, GCash/bank info, etc.) is marked with an `<!-- EDIT: ... -->`
comment right above it.

Key things to change:
- Couple names — appears in `<title>`, hero, nav, footer
- Wedding date — in the hero text **and** in `#countdown`'s
  `data-wedding-date="2027-01-30T15:00:00+08:00"` attribute (use ISO format,
  include your timezone offset, e.g. `+08:00` for Philippine time)
- Venue names/addresses, and the two `Google Maps` links (search your venue
  on Google Maps, click Share, and paste that URL in place of the existing
  link)
- Entourage, principal sponsors, love story dates/text
- GCash number and bank account details (the `data-copy="..."` attributes
  hold the text the Copy buttons copy — update those too)
- RSVP deadline text

## 2. Add your own photos

Right now the hero background is a **sample illustration** (`images/hero-sample.svg`) — a
simple line-art couple/arch graphic standing in for a real photo, so the page isn't just a
plain dark rectangle out of the box. Swap it for your actual photo whenever you're ready:
- **Hero photo**: put your image in `images/` (e.g. `hero.jpg`), then in `style.css` find
  `.hero-photo` and replace the `background:` line with
  `background-image:url('images/hero.jpg'); background-size:cover; background-position:center;`
- **Gallery**: in `index.html`, find `#galleryGrid` and replace each
  `<div class="gallery-placeholder">Photo N</div>` with
  `<img src="images/your-photo.jpg" alt="...">`
- **Video**: replace the `iframe src` in the Gallery section with your own
  YouTube/Vimeo embed URL
- **GCash QR**: replace the `.gift-qr-placeholder` div with
  `<img src="images/gcash-qr.png" alt="GCash QR Code">`

Keep photos reasonably sized (under ~500KB each) so the page loads quickly.

### Guest photo slideshow (the interactive "upload a photo" feature)
Under the gallery, guests can click **Upload Photos** to add pictures from
their own device, which instantly play as a slideshow. These photos are
stored only in that visitor's browser (`localStorage`) — they are a fun,
private photo-booth per guest, not a shared album across all visitors.

## 3. How RSVP & Love Messages work now

Both forms POST as JSON to a small API in `server/` (`/api/rsvp` and
`/api/wishes`), which validates the input and stores it in a local SQLite
database (`server/data/wedding.db`). The Love Messages wall also fetches
recent submissions from `/api/wishes` on page load, so messages guests leave
are visible to every visitor, not just the one who submitted them.

This only works once the API is running — see Part B. While just opening
`index.html` locally (no server), the forms will show a friendly "couldn't
send that" error, which is expected.

To read RSVPs, either:
- SSH into the VM and query the SQLite file directly (`sqlite3
  server/data/wedding.db "select * from rsvps;"`), or
- Use the built-in CSV export (see **Exporting responses** below).

---

# Part B — Deploy on an Ubuntu VM

This deploys the static site behind Nginx (with TLS + security headers) and
runs the API as a systemd service on `127.0.0.1:3000`, reachable only
through Nginx at `/api/*`.

Tested against Ubuntu 22.04/24.04. You'll need: a VM with a public IP, a
domain name pointed at that IP (an A record), and `sudo` access.

## 1. Point your domain at the VM

In your domain's DNS settings, add an A record (and optionally a `www` CNAME
or second A record) pointing at the VM's public IP. Wait for it to
propagate (`dig yourdomain.com`) before requesting a TLS certificate later.

## 2. Install system packages

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx git curl ufw

# Node.js 20 LTS via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # should print v20.x
```

## 3. Firewall

Only allow SSH, HTTP, and HTTPS from the outside. The API itself is never
exposed — it only listens on `127.0.0.1`.

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'   # opens 80 + 443
sudo ufw enable
sudo ufw status
```

## 4. Get the code onto the VM

```bash
sudo mkdir -p /var/www/wedding
sudo chown "$USER":"$USER" /var/www/wedding
git clone <your-repo-url> /var/www/wedding
cd /var/www/wedding
```

(No repo? `scp -r` the folder from your machine instead:
`scp -r ./wedding user@your-vm-ip:/var/www/wedding`.)

## 5. Create a dedicated, unprivileged user for the API

Never run the Node process as root. This user owns only the app directory.

```bash
sudo useradd --system --home /var/www/wedding --shell /usr/sbin/nologin wedding
sudo chown -R wedding:wedding /var/www/wedding/server
```

## 6. Install and configure the API

```bash
cd /var/www/wedding/server
sudo -u wedding npm install --omit=dev

sudo -u wedding cp .env.example .env
sudo -u wedding nano .env
```

In `.env`, set:
- `ADMIN_TOKEN` — generate one with `openssl rand -hex 32`; this protects
  the CSV export endpoints, so keep it secret.
- `ALLOWED_ORIGIN` — your site's full URL, e.g. `https://yourdomain.com`
  (rejects cross-site POSTs that don't claim to come from your own page).
- Leave `HOST=127.0.0.1` and `PORT=3000` as-is unless you have a reason to
  change them.

Lock down the `.env` file and the data directory (they hold your admin
token and guests' personal info):

```bash
sudo chmod 600 /var/www/wedding/server/.env
sudo chmod 700 /var/www/wedding/server/data
```

## 7. Run the API as a systemd service

```bash
sudo cp deploy/wedding-api.service /etc/systemd/system/wedding-api.service
sudo systemctl daemon-reload
sudo systemctl enable --now wedding-api
sudo systemctl status wedding-api      # should show "active (running)"
curl http://127.0.0.1:3000/api/health  # should print {"ok":true}
```

Logs: `sudo journalctl -u wedding-api -f`

## 8. Configure Nginx

```bash
sudo cp deploy/nginx-wedding.conf /etc/nginx/sites-available/wedding
sudo sed -i 's/YOUR_DOMAIN/yourdomain.com/g' /etc/nginx/sites-available/wedding
sudo ln -s /etc/nginx/sites-available/wedding /etc/nginx/sites-enabled/wedding
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

At this point `http://yourdomain.com` should already serve the site over
plain HTTP.

## 9. Enable HTTPS (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Certbot edits the Nginx config to add the certificate paths and a
redirect from HTTP to HTTPS, and sets up automatic renewal
(`sudo systemctl status certbot.timer` to confirm).

Visit `https://yourdomain.com` and confirm:
- The padlock shows a valid certificate
- Submitting the RSVP form and Love Messages form both succeed
- `https://yourdomain.com/api/health` returns `{"ok":true}`

## 10. Exporting responses

With `ADMIN_TOKEN` set in `.env`, download CSVs of everything guests have
submitted:

```
https://yourdomain.com/api/admin/rsvps.csv?token=YOUR_ADMIN_TOKEN
https://yourdomain.com/api/admin/wishes.csv?token=YOUR_ADMIN_TOKEN
```

Treat that URL like a password — anyone with it can read your guest list
(names, attendance, meal choices). Don't post it publicly or commit it anywhere.

## 11. Deploying updates later

```bash
cd /var/www/wedding
git pull
cd server && sudo -u wedding npm install --omit=dev   # only if dependencies changed
sudo systemctl restart wedding-api
```

Static file changes (`index.html`, `style.css`, `script.js`) take effect
immediately — no restart needed, just `git pull`.

## 12. Backing up the guest data

The SQLite database is the only stateful thing on the server. Back it up
periodically, e.g. with a cron job:

```bash
sudo -u wedding sqlite3 /var/www/wedding/server/data/wedding.db ".backup '/var/backups/wedding-$(date +%F).db'"
```

## Security notes

- The API binds to `127.0.0.1` only — it's never directly reachable from
  the internet, only through the Nginx reverse proxy.
- Both `/api/rsvp` and `/api/wishes` are rate-limited twice: once by Nginx
  (`limit_req`) and once inside the Node app (`express-rate-limit`), and
  reject a hidden honeypot field to cut down on bot spam.
- All inputs are length-capped and validated server-side (allowed
  `attending`/`meal` values) before being stored with parameterized SQL
  queries — never string-concatenated into SQL.
- Guest-submitted text is inserted into the page with `textContent`, never
  `innerHTML`, so a message like `<script>...</script>` is displayed as
  literal text rather than executed.
- Security headers (CSP, HSTS, X-Frame-Options, Referrer-Policy,
  Permissions-Policy) are set by Nginx for the whole site; Nginx also
  blocks any request for a dotfile (`.env`, `.git`, etc.).
- `server/.env` and `server/data/` are excluded from git via `.gitignore`
  — never commit your admin token or guests' data.
- Keep the VM patched: `sudo apt update && sudo apt upgrade -y`
  periodically, and consider `sudo apt install unattended-upgrades` for
  automatic security patches.
