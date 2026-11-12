# MemoCraft

A browser-based **U.S. Coast Guard memorandum generator** for USCGA cadets. Fill in
the form and download a correctly formatted memo as **Word (.docx)** or **PDF** —
ready to sign via CAC in Adobe Acrobat.

Everything runs client-side in the browser (no backend, no data leaves your
machine), so it can be hosted as a static site on GitHub Pages.

## Features

- USCG memo format per COMDTINST 5216.4E (letterhead, From/To/Thru/Subj/Ref,
  hierarchical numbering `1. / a. / (1) / (a) / (i) / (aa.) / (aaa)`, bullets,
  continuation-page headers, centered page numbers, closing `#`).
- Word and PDF export that match each other.
- Live preview with soft format reminders (subject in caps ≤10 words, SSIC,
  From/To, the two-subparagraph rule).
- Auto-labeling of references `(a)…` and enclosures `(1)…`, and email
  title-casing (`firstname.m.lastname@uscga.edu`).
- Save/load memos locally and import/export as JSON.
- Mobile-friendly layout.

## Running locally

It's a static site — serve the folder with any static file server, e.g.:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

## Deploying

Hosted via GitHub Pages. Bump `APP_VERSION` in `index.html` on each deploy — it
cache-busts every module and the stylesheet in one place.

## Credits

Originally created by **Max Eisenbeiser** and the MemoCraft SAD group. Now
managed and updated by **Alejandro Ortiz** (USCGA Class of 2030, Cyber Systems).

## Disclaimer

This project is **unofficial** and is not affiliated with or endorsed by the
Department of Homeland Security or the U.S. Coast Guard.
