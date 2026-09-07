# Fieldframe Capture Ops

Fieldframe Capture Ops is a full-stack platform for managing egocentric video operators, daily capture tasks, high-resolution submissions, and administrator review decisions.

The application provides two authenticated workspaces:

| Workspace | Capabilities |
| --- | --- |
| **Operator** | View assigned date-specific tasks, upload recordings, see the current review state, and read admin feedback. |
| **Administrator** | Assign daily tasks, filter the review queue, preview submissions, verify metadata, approve recordings, or reject them with actionable comments. |

Video submissions are required to meet a minimum **1920×1080 resolution**. The production upload endpoint uses multipart transport and runs `ffprobe` on the uploaded file before the submission is persisted. Video bytes are stored in object storage; the application database retains the durable storage reference and operational metadata.

> This guide is written for deploying the application on an Ubuntu 22.04 or Ubuntu 24.04 server. The recommended deployment path is Docker with the included `Dockerfile`, because the image installs the required `ffmpeg` package and therefore makes `ffprobe` available at runtime.

## 1. Deployment architecture

A typical production installation has the following components:

```text
Browser
  │ HTTPS
  ▼
Nginx or another reverse proxy
  │ HTTP on localhost:3000
  ▼
Fieldframe Node/Express container
  ├── React production bundle
  ├── tRPC API
  ├── multipart video upload endpoint
  └── ffprobe metadata verification
       │
       ├── MySQL or TiDB: users, tasks, submissions, reviews
       └── Forge-compatible object storage: video files
```

The Node application is not intended to be the public TLS endpoint. Put Nginx, Caddy, or a managed load balancer in front of it and restrict the application port to localhost or the private server network.

## 2. Server prerequisites

Use a dedicated Ubuntu user for the deployment instead of running the application as `root`.

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y ca-certificates curl git ufw nginx
```

For the Docker deployment path, install Docker Engine and the Compose plugin using Docker’s official Ubuntu instructions. Confirm that Docker is available before continuing:

```bash
docker --version
docker compose version
```

If Docker is not appropriate for your environment, the non-Docker systemd deployment is documented in [Section 11](#11-non-docker-systemd-deployment).

Create a deployment directory and clone the repository:

```bash
sudo mkdir -p /opt/fieldframe
sudo chown -R "$USER":"$USER" /opt/fieldframe
cd /opt/fieldframe
git clone https://github.com/MugishaEinstein/egocentric-video-manager.git app
cd /opt/fieldframe/app
```

For production, use a release tag or a reviewed commit rather than deploying an arbitrary development branch:

```bash
git checkout main
git pull --ff-only origin main
```

## 3. Required external services

The application requires three external capabilities. They may be hosted separately from the Ubuntu server.

| Service | Purpose | Required configuration |
| --- | --- | --- |
| MySQL-compatible database | Users, daily tasks, submissions, review decisions, and review history | `DATABASE_URL` |
| Manus OAuth-compatible service | Authenticated operator and administrator sign-in | OAuth and application ID variables |
| Forge-compatible object storage API | Secure video object storage and signed retrieval | `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY` |

The application does not store video bytes in MySQL. If the storage API is unavailable or incorrectly configured, users will be able to load the application but video uploads will fail.

Create the database and a least-privilege database user before the first migration. A typical MySQL setup is:

```sql
CREATE DATABASE fieldframe CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'fieldframe_app'@'10.%' IDENTIFIED BY 'REPLACE_WITH_A_LONG_RANDOM_PASSWORD';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES
  ON fieldframe.* TO 'fieldframe_app'@'10.%';
FLUSH PRIVILEGES;
```

Use a narrower host restriction than `10.%` when the database and application run on the same machine or a known private subnet.

## 4. Environment configuration

Create a production environment file outside the Git working tree. Do not commit this file.

```bash
sudo install -d -m 750 /etc/fieldframe
sudo nano /etc/fieldframe/fieldframe.env
sudo chmod 600 /etc/fieldframe/fieldframe.env
```

Use the following template and replace every placeholder:

```dotenv
NODE_ENV=production
PORT=3000

# MySQL or TiDB connection string. URL-encode special characters in the password.
DATABASE_URL=mysql://fieldframe_app:REPLACE_WITH_PASSWORD@127.0.0.1:3306/fieldframe

# Session and OAuth configuration.
JWT_SECRET=REPLACE_WITH_AT_LEAST_32_RANDOM_CHARACTERS
VITE_APP_ID=REPLACE_WITH_OAUTH_APPLICATION_ID
OAUTH_SERVER_URL=https://REPLACE_WITH_OAUTH_SERVER
VITE_OAUTH_PORTAL_URL=https://REPLACE_WITH_OAUTH_LOGIN_PORTAL

# The platform owner is promoted to administrator by open ID.
OWNER_OPEN_ID=REPLACE_WITH_OWNER_OPEN_ID
OWNER_NAME=Mugisha Jean

# Server-side object storage credentials.
BUILT_IN_FORGE_API_URL=https://REPLACE_WITH_FORGE_API
BUILT_IN_FORGE_API_KEY=REPLACE_WITH_SERVER_STORAGE_API_KEY

# Frontend Forge variables used by the application platform integrations.
VITE_FRONTEND_FORGE_API_URL=https://REPLACE_WITH_FORGE_API
VITE_FRONTEND_FORGE_API_KEY=REPLACE_WITH_FRONTEND_API_KEY

# Optional analytics settings. Remove these if analytics is not enabled.
VITE_ANALYTICS_ENDPOINT=https://REPLACE_WITH_ANALYTICS_ENDPOINT
VITE_ANALYTICS_WEBSITE_ID=REPLACE_WITH_ANALYTICS_WEBSITE_ID

# Optional application branding values.
VITE_APP_TITLE=Fieldframe Capture Ops
VITE_APP_LOGO=
```

Generate a session secret instead of inventing one manually:

```bash
openssl rand -base64 48
```

The OAuth application must allow the public callback URL used by the deployment. The callback path handled by this application is:

```text
https://YOUR_DOMAIN.example.com/api/oauth/callback
```

If the OAuth provider requires a separate allowed origin, add:

```text
https://YOUR_DOMAIN.example.com
```

Do not place server-only credentials such as `JWT_SECRET`, `DATABASE_URL`, or `BUILT_IN_FORGE_API_KEY` in frontend source files. The application reads server configuration from `server/_core/env.ts`; the environment file must be present when the container or systemd service starts.

## 5. Recommended Docker deployment

The included `Dockerfile` is intentionally used because it installs `ffmpeg`, which provides the `ffprobe` binary required for server-side video metadata inspection. It also installs Node.js 22, enables Corepack, installs the pinned pnpm version, builds the frontend, and starts the compiled Express server.

Build the image:

```bash
cd /opt/fieldframe/app
docker build -t fieldframe-capture-ops:latest .
```

Run the database migration. The migration command needs the database environment variable, but it does not need the application container to be running:

```bash
docker run --rm \
  --env-file /etc/fieldframe/fieldframe.env \
  -v /opt/fieldframe/app:/app \
  -w /app \
  fieldframe-capture-ops:latest \
  sh -lc 'corepack pnpm db:push'
```

For a cleaner long-running installation, create `/opt/fieldframe/docker-compose.yml`:

```yaml
services:
  fieldframe:
    image: fieldframe-capture-ops:latest
    container_name: fieldframe
    restart: unless-stopped
    env_file:
      - /etc/fieldframe/fieldframe.env
    ports:
      - "127.0.0.1:3000:3000"
    volumes:
      - fieldframe-tmp:/tmp
    security_opt:
      - no-new-privileges:true

volumes:
  fieldframe-tmp:
```

Start the service:

```bash
cd /opt/fieldframe
sudo docker compose up -d
sudo docker compose ps
sudo docker compose logs --tail=100 fieldframe
```

Confirm the application is reachable locally before configuring Nginx:

```bash
curl -I http://127.0.0.1:3000/
```

The application listens on `PORT`, defaulting to `3000` when no port is supplied. The Compose file binds that port to localhost only.

### Updating the Docker deployment

Use a controlled update sequence:

```bash
cd /opt/fieldframe/app
git fetch origin
git checkout main
git pull --ff-only origin main
docker build -t fieldframe-capture-ops:latest .
cd /opt/fieldframe
docker compose run --rm fieldframe sh -lc 'corepack pnpm db:push'
docker compose up -d --force-recreate fieldframe
docker compose logs --tail=100 fieldframe
```

If the new image fails its health check or logs show a startup error, inspect the previous image tag before removing it. Keep at least one known-good image locally during an upgrade.

## 6. Nginx reverse proxy

Create a site configuration using your real domain:

```bash
sudo nano /etc/nginx/sites-available/fieldframe
```

Use this configuration as a starting point:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name YOUR_DOMAIN.example.com;

    client_max_body_size 500m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 180s;
        proxy_send_timeout 180s;
    }
}
```

Enable the site and validate the configuration:

```bash
sudo ln -s /etc/nginx/sites-available/fieldframe /etc/nginx/sites-enabled/fieldframe
sudo nginx -t
sudo systemctl reload nginx
```

The `client_max_body_size 500m` setting is important because the application accepts video files up to 500 MB. Increase it only if the application limit and your storage, timeout, and server-memory policy are changed together.

## 7. HTTPS with Certbot

After the DNS `A` or `AAAA` record points to the Ubuntu server, install Certbot:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d YOUR_DOMAIN.example.com
```

Choose the redirect option when prompted so HTTP requests are redirected to HTTPS. Verify automatic renewal:

```bash
sudo systemctl status certbot.timer
sudo certbot renew --dry-run
```

Once HTTPS is active, update the OAuth provider’s callback and allowed-origin settings to use the HTTPS domain. Then restart the application so any environment changes are loaded:

```bash
cd /opt/fieldframe
sudo docker compose up -d --force-recreate fieldframe
```

## 8. Firewall and basic hardening

Only expose SSH, HTTP, and HTTPS to the public internet. The application port remains bound to localhost in the recommended Compose configuration.

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status verbose
```

Additional operational recommendations are to use SSH keys rather than password login, disable direct root login, apply security updates regularly, keep the environment file readable only by administrators, and use a separate database user for the application. Do not expose MySQL publicly unless a private network or a tightly scoped firewall rule is in place.

## 9. Database migrations and backup strategy

The application schema is defined in `drizzle/schema.ts`. On a new installation, `pnpm db:push` generates and applies the Drizzle migration state using `DATABASE_URL`.

Before applying a schema change in production:

```bash
mysqldump --single-transaction --routines --triggers \
  --host=127.0.0.1 \
  --user=fieldframe_app \
  --password \
  fieldframe > /var/backups/fieldframe-$(date +%F-%H%M%S).sql
```

Keep database backups separate from the application server. Test restoration on a separate database periodically; a backup that has never been restored is not a verified recovery plan.

Video objects are stored outside the database. Confirm that the configured object-storage service has its own retention, versioning, access-control, and backup policy. Database backups alone do not recover uploaded video files.

## 10. Logs, health checks, and routine operations

For Docker deployments, inspect application logs with:

```bash
cd /opt/fieldframe
sudo docker compose logs -f --tail=200 fieldframe
```

Inspect Nginx logs with:

```bash
sudo journalctl -u nginx -n 200 --no-pager
sudo tail -f /var/log/nginx/access.log /var/log/nginx/error.log
```

Useful checks include:

```bash
curl -I http://127.0.0.1:3000/
sudo docker inspect --format '{{.State.Status}}' fieldframe
sudo docker system df
```

The application does not expose a dedicated health endpoint in the current version. A successful HTTP response from `/` confirms that the Node process and production static bundle are responding. Authentication, database, object storage, and upload behavior should also be tested through a staging account before accepting production traffic.

For a safe smoke test, sign in as an administrator, create a task, sign in as an operator, confirm the task is visible, upload a short 1920×1080 recording, and then approve or reject it from the admin queue. Confirm that the operator can see the resulting status and feedback.

## 11. Non-Docker systemd deployment

Docker is recommended because it packages `ffprobe`. If you deploy directly with systemd, install Node.js 22, pnpm, and ffmpeg on the host:

```bash
sudo apt update
sudo apt install -y ffmpeg ca-certificates curl git
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g corepack@latest
corepack enable
```

Install dependencies and build the application:

```bash
cd /opt/fieldframe/app
corepack pnpm install
set -a
. /etc/fieldframe/fieldframe.env
set +a
corepack pnpm check
corepack pnpm test
corepack pnpm db:push
corepack pnpm build
```

Create a dedicated service account and service definition:

```bash
sudo useradd --system --home /opt/fieldframe --shell /usr/sbin/nologin fieldframe || true
sudo chown -R fieldframe:fieldframe /opt/fieldframe
sudo nano /etc/systemd/system/fieldframe.service
```

Use:

```ini
[Unit]
Description=Fieldframe Capture Ops
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=fieldframe
Group=fieldframe
WorkingDirectory=/opt/fieldframe/app
EnvironmentFile=/etc/fieldframe/fieldframe.env
Environment=NODE_ENV=production
ExecStart=/usr/bin/node /opt/fieldframe/app/dist/index.js
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/tmp

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now fieldframe
sudo systemctl status fieldframe
sudo journalctl -u fieldframe -f
```

The Nginx configuration in [Section 6](#6-nginx-reverse-proxy) is the same for Docker and systemd deployments.

## 12. Troubleshooting

### The application starts but uploads fail

Check that `BUILT_IN_FORGE_API_URL` and `BUILT_IN_FORGE_API_KEY` are present in the running environment. Then inspect the application logs for storage presign or object upload errors. Confirm that the server can make outbound HTTPS requests to the Forge API and that the configured storage credential can create and write objects.

### Uploads return `413 Request Entity Too Large`

The reverse proxy is rejecting the request. Confirm that Nginx contains `client_max_body_size 500m` and reload it with `sudo nginx -t && sudo systemctl reload nginx`. If another proxy or load balancer sits in front of Nginx, increase its request limit as well.

### Uploads fail during metadata inspection

Confirm `ffprobe` is installed and executable:

```bash
command -v ffprobe
ffprobe -version
```

In Docker, rebuild the image after changing the Dockerfile. In a systemd deployment, install the `ffmpeg` Ubuntu package. Also check available temporary storage because the multipart route writes the incoming file to a temporary path before probing it.

### A 1080p video is rejected

The minimum is width `1920` and height `1080`. A video with a smaller encoded stream, a rotated stream whose encoded dimensions are lower, or a file whose first video stream is not the expected stream may be rejected. Inspect the file locally:

```bash
ffprobe -v error -select_streams v:0 \
  -show_entries stream=width,height \
  -of default=noprint_wrappers=1 video.mp4
```

### OAuth redirects to the wrong address

Verify the public HTTPS domain, the OAuth callback URL, `OAUTH_SERVER_URL`, `VITE_OAUTH_PORTAL_URL`, and the OAuth provider’s registered redirect URI. The callback must end with `/api/oauth/callback`.

### The app cannot connect to MySQL

Check the `DATABASE_URL` syntax, confirm that the MySQL user is allowed to connect from the application host, and test the credentials with a MySQL client. Passwords containing `@`, `:`, `/`, `?`, or `#` must be URL-encoded inside the connection string.

### The container restarts continuously

Inspect the logs:

```bash
sudo docker compose logs --tail=200 fieldframe
```

Common causes are a missing environment variable, an invalid database URL, a failed database migration, or a build/runtime mismatch. Confirm that the image was built from the same commit as the checked-out source and that `NODE_ENV=production` is set.

## 13. Upgrade checklist

Before each production upgrade, pull the target commit, review the change, create a database backup, build a new image, run the schema migration, and restart the service. After the restart, check application logs, Nginx logs, sign-in, task creation, task visibility, upload validation, admin review, and operator feedback visibility.

A practical upgrade sequence is:

```bash
cd /opt/fieldframe/app
git fetch origin
git checkout main
git pull --ff-only origin main
sudo mysqldump --single-transaction fieldframe > /var/backups/fieldframe-before-upgrade.sql
docker build -t fieldframe-capture-ops:latest .
cd /opt/fieldframe
docker compose run --rm fieldframe sh -lc 'corepack pnpm db:push'
docker compose up -d --force-recreate fieldframe
sudo docker compose logs --tail=200 fieldframe
```

## 14. Current project commands

| Command | Purpose |
| --- | --- |
| `corepack pnpm install` | Install dependencies using the pinned pnpm version. |
| `corepack pnpm check` | Run the TypeScript compiler without emitting files. |
| `corepack pnpm test` | Run the Vitest suite. |
| `corepack pnpm build` | Build the React frontend and production Node bundle. |
| `corepack pnpm db:push` | Generate and apply Drizzle migrations using `DATABASE_URL`. |
| `corepack pnpm dev` | Start the development server with file watching. |
| `corepack pnpm start` | Start the compiled production server. |

## 15. Security notes

Treat all OAuth, database, Forge, and JWT credentials as secrets. Never commit `/etc/fieldframe/fieldframe.env`, local `.env` files, database dumps, uploaded videos, or private keys. Rotate credentials if they are ever printed in shell history, logs, screenshots, or chat.

The current upload path accepts files up to 500 MB and temporarily writes each upload to the server filesystem for metadata verification. Plan disk capacity and concurrency accordingly. The durable video object is stored through the configured object-storage API; the local temporary file is removed after the request finishes.

For a public production deployment, use HTTPS, a firewall, regular OS security updates, least-privilege database credentials, monitored disk space, tested backups, and a separate staging environment for schema and upload changes.

## References

[1]: https://docs.docker.com/engine/install/ubuntu/ "Install Docker Engine on Ubuntu"
[2]: https://docs.nginx.com/nginx/admin-guide/web-server/reverse-proxy/ "NGINX Reverse Proxy"
[3]: https://certbot.eff.org/instructions "Certbot Instructions"
[4]: https://ffmpeg.org/ffprobe.html "FFprobe Documentation"
[5]: https://orm.drizzle.team/docs/kit-overview "Drizzle Kit Documentation"
