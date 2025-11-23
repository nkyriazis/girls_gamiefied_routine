# GitHub Authentication for CI/CD Builds

## Setup (One-Time)

### 1. Create a Personal Access Token

1. Go to: https://github.com/settings/tokens/new?scopes=repo,workflow
2. Set **Note**: "Routine CI/CD Builds"
3. Set **Expiration**: Choose your preference (90 days, 1 year, or no expiration)
4. Ensure these scopes are checked:
   - ✅ **`repo`** (Full control of repositories)
   - ✅ **`workflow`** (Update GitHub Action workflows)
5. Click **"Generate token"**
6. Copy the token (starts with `ghp_`)

### 2. Save the Token

**Windows (PowerShell):**
```powershell
# Save permanently (recommended)
[System.Environment]::SetEnvironmentVariable('GITHUB_TOKEN', 'ghp_your_token_here', 'User')

# Restart PowerShell or refresh environment
$env:GITHUB_TOKEN = [System.Environment]::GetEnvironmentVariable('GITHUB_TOKEN', 'User')
```

**Linux/Mac (Bash):**
```bash
# Add to ~/.bashrc or ~/.zshrc
echo 'export GITHUB_TOKEN="ghp_your_token_here"' >> ~/.bashrc
source ~/.bashrc
```

---

## Usage

After setup, trigger builds with:

```powershell
# Windows
.\build.ps1

# Linux/Mac
./build.sh
```

The script will:
1. Use Docker to call GitHub API (no local dependencies)
2. Trigger the workflow to build multi-arch images
3. Show success/error status

---

## Troubleshooting

**"GitHub token required"**
- Token not set in environment
- Run setup step 2 above

**"Workflow not found (404)"**
- Push the workflow file first: `git push`
- Ensure `.github/workflows/docker-build.yml` exists on GitHub

**"Failed to trigger build (HTTP 401)"**
- Token is invalid or expired
- Create a new token and update environment variable

**"Failed to trigger build (HTTP 403)"**
- Token doesn't have `workflow` scope
- Create a new token with correct permissions

## Security Notes

- ⚠️ Keep your token secret (don't commit it to git)
- ⚠️ The token has access to all your repos - protect it like a password
- ✅ Token is only used locally on your machine
- ✅ Docker container runs gh CLI and exits (no persistence)

## Troubleshooting

**"Failed to trigger build"**
- Verify token has `repo` and `workflow` scopes
- Check token hasn't expired
- Ensure repository name is correct in build script

**"Docker not found"**
- Install Docker Desktop: https://www.docker.com/products/docker-desktop/

**First run is slow**
- Docker pulls the `ghcr.io/cli/cli` image (~50MB)
- Subsequent runs are instant
