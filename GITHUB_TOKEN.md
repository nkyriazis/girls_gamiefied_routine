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

The script runs `curl` in a throwaway Docker container (`curlimages/curl:latest`), so nothing is installed locally, and asks
the GitHub API to run `.github/workflows/docker-build.yml` on `master`. On GitHub the workflow runs the Checks first
(`ci.yml`, the same as every PR); if one fails, no image is built or pushed. Then it builds the multi-arch images.
Follow it at https://github.com/nkyriazis/girls_gamiefied_routine/actions.

---

## Troubleshooting

**"GitHub token required"**
- The token isn't set in this shell: run setup step 2 above.

**"Failed to trigger build"** (`build.ps1` adds the HTTP status; `build.sh` doesn't print it)
- 401: the token is invalid or expired. Create a new one and update the environment variable.
- 403: the token lacks the `workflow` scope. Create one with `repo` and `workflow`.
- 404 (`build.ps1`: "Workflow not found"): the token can't see the repository, or `docker-build.yml` isn't on `master`.

**"Docker not found"**
- Install Docker: https://www.docker.com/products/docker-desktop/

**First run is slow**
- Docker pulls the `curlimages/curl:latest` image once; later runs start at once.

**The build started but failed**
- Open the run on the Actions page. A red «Checks» job means a test, lint or build failed on `master`: fix it there
  first. No images were pushed, and the Pi keeps the ones it has.

## Security Notes

- ⚠️ Keep your token secret (don't commit it to git)
- ⚠️ The token has access to all your repos: protect it like a password
- ✅ The token is only used locally on your machine
- ✅ The curl container exits after the request and keeps nothing
