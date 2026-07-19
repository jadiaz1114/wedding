# Michelle & Jose — Wedding Invitation Website

A single-page wedding invitation site: hero, countdown, ceremony & reception
details, timeline, entourage, principal sponsors, invitation message, love
story, attire/color motif, photo gallery + video + guest photo slideshow,
love messages wall, RSVP with guest tracking, and a gift guide (GCash/bank).

Everything works locally by just opening `index.html`. RSVP + Love Messages
submissions and the deploy step below need Netlify.

## 1. Edit your details

Open `index.html` in any text editor and search for the word **EDIT** —
every spot with real content to personalize (names, date, venue, entourage,
love story, GCash/bank info, etc.) is marked with an `<!-- EDIT: ... -->`
comment right above it.

Key things to change:
- Couple names — appears in `<title>`, hero, nav, footer
- Wedding date — in the hero text **and** in `#countdown`'s
  `data-wedding-date="2027-02-21T15:00:00+08:00"` attribute (use ISO format,
  include your timezone offset, e.g. `+08:00` for Philippine time)
- Venue names/addresses, and the two `Google Maps` links (search your venue
  on Google Maps, click Share, and paste that URL in place of
  `https://maps.google.com`)
- Entourage, principal sponsors, love story dates/text
- GCash number and bank account details (the `data-copy="..."` attributes
  hold the text the Copy buttons copy — update those too)
- RSVP deadline text

## 2. Add your own photos

Put your images in the `images/` folder, then:
- **Hero photo**: in `style.css`, find `.hero-photo` and uncomment/add
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
private photo-booth per guest, not a shared album across all visitors. If
you want everyone's uploads to appear in one shared gallery for all guests,
that requires a small backend or a storage service (e.g. Cloudinary,
Supabase) — ask if you'd like that added.

## 3. RSVP & Love Messages — how responses reach you

Both forms use **Netlify Forms**, which needs zero backend code — Netlify
detects the `data-netlify="true"` forms automatically when you deploy.
Once live:
1. Go to your site in the Netlify dashboard → **Forms** tab.
2. You'll see two forms: `rsvp` and `love-messages`, with every submission
   (name, attending, guest count, meal choice, notes, etc.).
3. You can export responses as CSV, or set up **Forms → Settings → email
   notifications** so each RSVP emails you the moment it arrives.

Forms only work after deploying to Netlify — they will not submit anywhere
useful while you're just opening the file locally (that's expected).

## 4. Deploy to Netlify

**Easiest — drag & drop:**
1. Go to [app.netlify.com/drop](https://app.netlify.com/drop)
2. Drag the whole `wedding-invite` folder onto the page
3. Netlify gives you a live URL immediately (you can rename it in
   Site settings → Change site name)

**Alternative — Git-based:**
1. Push this folder to a GitHub repo
2. In Netlify: **Add new site → Import an existing project**
3. Connect the repo — leave build command blank and publish directory as `/`
   (or wherever `index.html` lives)
4. Deploy

Either way, Netlify Forms activates automatically the first time it crawls
the deployed HTML, since the `data-netlify="true"` forms are already in
`index.html`.

## 5. Custom domain (optional)

In Netlify: **Domain settings → Add a custom domain**, then follow the DNS
instructions Netlify gives you.

## File structure
```
wedding-invite/
├── index.html      ← all content and sections
├── style.css        ← all styling
├── script.js         ← countdown, nav, slideshow, forms, lightbox
├── images/           ← put your photos here
└── README.md
```
