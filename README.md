# The Black Sheep Shop — Static Website

## What this is
A static shop website built for GitHub Pages.

## Pages
- `index.html`
- `shop.html`
- `product.html`
- `about.html`
- `contact.html`
- `admin.html`

## How admin works
This is not a server admin panel.
It saves product edits in the browser using `localStorage`.

### To publish changes to GitHub Pages
1. Open `admin.html`
2. Add or edit products
3. Click **Export JSON**
4. Replace the root `products.json` file in the project with the exported file
5. Commit and push to GitHub

## Images
You can use:
- image URLs
- local paths like `assets/img/my-product.jpg`
- uploaded preview images in admin for local browser use

## Important limit
Uploaded preview images from admin are stored only in the browser unless you place the real image file inside the repo and reference it from `assets/img/...`.

## Best next upgrade
If you want live admin editing without GitHub uploads, connect the same frontend to Firebase or Supabase.
