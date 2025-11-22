# Girls Gamified Routine

This project uses a **Docker Compose** setup with a "Base + Override" pattern to efficiently manage Development and Production environments.

## 🚀 Quick Start (Development)

Use this mode for day-to-day coding. It features hot-reloading, local file mounting, and full debugging capabilities.

```powershell
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```

- **Frontend**: [http://localhost:5173](http://localhost:5173)
- **Backend**: Internal (proxied via Frontend)
- **Changes**: Edit files in `frontend/` or `backend/` and see changes instantly.

---

## 🚢 Production Mode

Use this mode to test the optimized build or deploy the application. It uses Nginx and pre-compiled Node.js code.

```powershell
docker-compose up --build
```

- **Frontend**: [http://localhost](http://localhost) (Default Port 80, configurable via `.env`)
- **Backend**: Internal (proxied via Nginx)
- **Performance**: Optimized assets, no file watchers, native file system speed.

> **Note**: To stop the production server, press `Ctrl+C`. To run it in the background, add `-d` to the end of the command.

### Customizing the Port

To change the production frontend port, create a `.env` file in the project root:

```bash
FRONTEND_PORT=8080
```

Then restart the containers. The frontend will be accessible at the port you specified.

---

## 🛠️ Architecture Guide

We use two Docker Compose files to manage configuration:

1.  **`docker-compose.yml` (Base)**
    -   Defines the *shared* infrastructure (Service names, Networks, Timezone).
    -   *Edit this when:* You add a new service (e.g., a database) or change a shared environment variable.

2.  **`docker-compose.override.yml` (Production Override)**
    -   *Automatically loaded by `docker-compose up`.*
    -   Configures production builds: `Dockerfile` builds, Nginx, Restart policies.
    -   Uses environment variables from `.env` for port configuration.
    -   *Edit this when:* You change how the app is built or deployed.

3.  **`docker-compose.dev.yml` (Development Override)**
    -   *Explicitly load with `-f` for development mode.*
    -   Configures development tools: `nodemon`, `vite`, volume mounts, file watchers.
    -   *Edit this when:* You need to change dev server ports or dev-specific flags.

## 📦 Common Tasks

### Adding a New Package
Since `node_modules` are inside the container, you should install packages via the container or rebuild.

**Option A: Install inside running container (Fastest for Dev)**
```powershell
# Frontend
docker-compose exec frontend npm install <package-name>

# Backend
docker-compose exec backend npm install <package-name>
```

**Option B: Rebuild (Cleanest)**
1.  Stop the containers.
2.  Delete `node_modules` locally (optional but recommended if syncing issues occur).
3.  Run:
    ```powershell
    docker-compose up --build
    ```

### Troubleshooting
**"File not found" or "Module not found" in Prod**
-   Production builds are stricter than Dev.
-   Check `.dockerignore` in `frontend/` and `backend/`.
-   Ensure you aren't relying on dev-only dependencies in your production code.

**"Port already in use"**
-   Dev uses port `5173`. Prod uses port `80` by default (configurable via `.env`).
-   Ensure no other service is running on these ports.

## 🍓 Raspberry Pi 4 Deployment

Yes, this project is fully compatible with Raspberry Pi 4 (ARM64).

**Why it works:**
-   We use `node:20-alpine` and `nginx:alpine` base images, which support ARM64 out of the box.
-   Production mode is extremely lightweight (Nginx + Node.js) and runs great on 2GB+ RAM models.

**How to deploy on Pi:**
1.  Clone the repo on your Pi.
2.  (Optional) Create a `.env` file to customize the port (default is 80).
3.  Run the **Production** command:
    ```bash
    docker-compose up --build -d
    ```
    *(Note: The first build might take 5-10 minutes on the Pi's CPU. Subsequent starts will be instant.)*

**Performance Tip:**
Do **not** use the Development mode (`docker-compose -f docker-compose.yml -f docker-compose.dev.yml up`) on the Pi if you can avoid it. The file-watching mechanism (`CHOKIDAR_USEPOLLING`) consumes a lot of CPU on low-power devices. Always use Production mode for the Pi.
