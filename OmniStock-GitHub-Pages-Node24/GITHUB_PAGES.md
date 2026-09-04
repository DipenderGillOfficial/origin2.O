# GitHub Pages deployment

This version includes a browser-side mock API backed by the warehouse data exported from `warehouse.sqlite`. GitHub Pages cannot run the Express/SQLite backend, so the frontend intercepts the `/api/*` calls and serves the same data in the browser.

## Local preview

```bash
npm install
npm run build
npm run preview
```

## GitHub Pages

Push the repository to the `main` branch. The included `.github/workflows/deploy.yml` builds the Vite app and deploys `dist/` to GitHub Pages automatically.
