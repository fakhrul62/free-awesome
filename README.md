# Free Awesome Icon Shelf

A fast, browser-based icon picker for browsing, recoloring, previewing, and exporting more than 30,000 icons.

## Live site

Visit [free-awesome.vercel.app](https://free-awesome.vercel.app).

## How to use

1. Search for an icon by name or browse the style tabs.
2. Select an icon to open it in the editor.
3. Choose the icon color, canvas size, and padding.
4. Export it using one of the available options:
   - **SVG** downloads the edited vector file.
   - **PNG** downloads a transparent PNG image.
   - **WebP** downloads a transparent WebP image.
   - **Copy SVG** copies the edited SVG markup to your clipboard.

## Run locally

This is a static site, so no package installation or build step is required.

### Windows

Double-click `start-icon-shelf.bat`.

### macOS or Linux

From the project directory, run:

```bash
python3 -m http.server 5177 --bind 127.0.0.1
```

Then open [http://127.0.0.1:5177](http://127.0.0.1:5177).

Opening `index.html` directly supports basic previews, but running the local server is required for color editing and exports.

## Project files

- `index.html` — page structure
- `styles.css` — layout and responsive styling
- `app.js` — search, preview, editing, and export behavior
- `icon-manifest.js` — icon index used by the browser
- `freeawesome/` — SVG icon library
- `vercel.json` — Vercel headers and deployment configuration

## Deployment

The site is deployed on Vercel. Pushing changes to the connected GitHub repository automatically triggers a new production deployment.
