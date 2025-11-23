param(
    [string]$Token = $env:GITHUB_TOKEN
)

Write-Host "Triggering GitHub Actions build..." -ForegroundColor Cyan
Write-Host ""

if ([string]::IsNullOrEmpty($Token)) {
    Write-Host "GitHub token required" -ForegroundColor Red
    Write-Host ""
    Write-Host "Create a token at: https://github.com/settings/tokens/new?scopes=repo,workflow" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Then set it:" -ForegroundColor Yellow
    Write-Host "  `$env:GITHUB_TOKEN = 'your_token_here'" -ForegroundColor White
    Write-Host ""
    Write-Host "Or save permanently:" -ForegroundColor Yellow
    Write-Host "  [Environment]::SetEnvironmentVariable('GITHUB_TOKEN', 'your_token', 'User')" -ForegroundColor White
    exit 1
}

Write-Host "Triggering workflow via GitHub API..."

$result = docker run --rm curlimages/curl:latest `
    curl -X POST `
    -H "Accept: application/vnd.github.v3+json" `
    -H "Authorization: Bearer $Token" `
    -w "%{http_code}" `
    -s `
    "https://api.github.com/repos/nkyriazis/girls_gamiefied_routine/actions/workflows/docker-build.yml/dispatches" `
    -d '{\"ref\":\"master\"}'

if ($result -eq "204") {
    Write-Host ""
    Write-Host "Build triggered successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "View progress at:"
    Write-Host "  https://github.com/nkyriazis/girls_gamiefied_routine/actions"
} elseif ($result -eq "404") {
    Write-Host ""
    Write-Host "Workflow not found (404)" -ForegroundColor Red
    Write-Host ""
    Write-Host "You need to push the workflow file first:" -ForegroundColor Yellow
    Write-Host "  git add .github/workflows/docker-build.yml"
    Write-Host "  git commit -m 'Add CI/CD workflow'"
    Write-Host "  git push"
    exit 1
} else {
    Write-Host ""
    Write-Host "Failed to trigger build (HTTP $result)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Check your token has 'repo' and 'workflow' permissions" -ForegroundColor Yellow
    exit 1
}
