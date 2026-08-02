# Self-hosting

Dashpod is built as a static web application and does not require a backend API process.

## Build

To compile the static files, run:

```bash
npm run build
```

This generates the static assets in the `dist/` directory.

## Deploy

`deploy.sh` (run on the VPS, or via the GitHub Actions workflow in `.github/workflows/deploy.yml`) does the following:

1. Loads nvm and selects the default Node version (non-interactive SSH sessions don't source `~/.bashrc`, so `npm` isn't on `PATH` otherwise).
2. Installs dependencies and builds the app (`expo export` → `dist/`).
3. Copies the **landing page** (`docs/`) to the site root.
4. Copies the **app** (`dist/`) to the `/app` subpath.

## Auto-deploy on push to main

`.github/workflows/deploy.yml` SSHes into the server and runs `deploy.sh` (pull latest, `npm ci`, rebuild, copy the landing page to the site root and the app to `/app`) after every push to `main`. To use it:

1. On the server, clone this repo somewhere and get it running once manually (matches the path `deploy.sh`/the workflow expect — `~/projects/dashpod` by default, edit the workflow's `script:` line if yours differs).
2. In the GitHub repo's Settings → Secrets and variables → Actions, add three repository secrets: `SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY` (a private key whose matching public key is authorized on the server — dedicated deploy key recommended over reusing a personal one). This has to be done through GitHub's own UI/CLI, not by anyone else on your behalf.
3. `deploy.sh` copies `docs/` into `/var/snap/caddy/common/sites/dashpod/` (this deployment's snap-installed Caddy) and the app's `dist/` into `/var/snap/caddy/common/sites/dashpod/app/` — edit the paths if your static site directory differs.

## Reverse Proxy

To host Dashpod, configure your reverse proxy (e.g., Caddy) to serve the static files.

Example Caddy block:

```caddy
http://dashpod.yankvasya.dev {
    root * /var/snap/caddy/common/sites/dashpod
    file_server
    encode gzip
    try_files {path} /index.html

    handle_path /app/* {
        root * /var/snap/caddy/common/sites/dashpod/app
        file_server
        encode gzip
        try_files {path} /app/index.html
    }
}
```
