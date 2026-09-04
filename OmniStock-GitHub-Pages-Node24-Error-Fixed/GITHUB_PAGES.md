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

## If GitHub shows 404

1. Open the repository on GitHub.
2. Go to **Settings → Pages**.
3. Under **Build and deployment → Source**, select **GitHub Actions**.
4. Go to **Actions** and run **Deploy OmniStock to GitHub Pages** using **Run workflow**, or push a new commit to `main`.
5. Wait until the deployment job has a green check.
6. Open the URL shown in the deployment job under **environment → github-pages**. For a project repository it normally has the repository name after `.github.io/`.

Do not select **Deploy from a branch** for this workflow; it uses the GitHub Pages Actions deployment method.
