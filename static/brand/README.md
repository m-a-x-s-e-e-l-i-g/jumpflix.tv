# Brand assets

Place your brand source images here (not committed if large):

- app-icon.(png|webp|jpg) — square or rounded-square icon on brand background (used for PWA icons & favicons)
- mascot.(png|webp|jpg) — transparent mascot/character (optional)
- logo.(png|webp|jpg) — full logo with text (optional for social cards)

Then run:

  npm run generate:icons
  npm run generate:favicon

Outputs will be written to:

- static/icons/icon-192.png, icon-512.png, apple-touch-icon.png
- static/favicon-16x16.png, favicon-32x32.png, favicon.ico
