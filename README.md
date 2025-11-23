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

Deploy using pre-built images (no building on RPi):

**One-time setup:**
See [GITHUB_TOKEN.md](GITHUB_TOKEN.md) to create and save your GitHub token.

**On your development machine:**
```powershell
# Trigger CI/CD build (uses Docker, no local tools needed)
.\build.ps1

# Wait ~5-10 minutes for build to complete
```

**On your Raspberry Pi:**
```bash
# First time setup
git clone https://github.com/nkyriazis/girls_gamiefied_routine.git
cd girls_gamiefied_routine
chmod +x deploy-rpi.sh

# Deploy (pulls pre-built images in ~30 seconds)
./deploy-rpi.sh
```

**Note:** See [GITHUB_TOKEN.md](GITHUB_TOKEN.md) for one-time authentication setup.

**Alternative - Build locally on RPi:**
If you prefer building on the Pi itself (takes 10-15 minutes):
```bash
docker-compose up --build -d
```

**Performance Tip:**
Do **not** use Development mode on the Pi. The file-watching mechanism consumes too much CPU on low-power devices.
