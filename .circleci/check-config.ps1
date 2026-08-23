# CircleCI Configuration Validation Script (PowerShell)
# Checks if the CircleCI config is valid before pushing

Write-Host "🔍 CircleCI Configuration Validator" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# Check if CircleCI CLI is installed
$circleciCmd = Get-Command circleci -ErrorAction SilentlyContinue

if (-not $circleciCmd) {
    Write-Host "⚠️  CircleCI CLI not found" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Install it with:"
    Write-Host "  choco install circleci-cli"
    Write-Host ""
    Write-Host "Or download from: https://github.com/CircleCI-Public/circleci-cli/releases"
    Write-Host ""
    exit 1
}

$version = circleci version
Write-Host "✓ CircleCI CLI found: $version" -ForegroundColor Green
Write-Host ""

# Validate config
Write-Host "📋 Validating .circleci/config.yml..." -ForegroundColor Cyan
Write-Host ""

$validationResult = circleci config validate 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Configuration is valid!" -ForegroundColor Green
    Write-Host ""
    
    # Check for common issues
    Write-Host "🔍 Checking for common issues..." -ForegroundColor Cyan
    Write-Host ""
    
    $configFile = ".circleci\config.yml"
    $configContent = Get-Content $configFile -Raw
    
    # Check 1: Verify all platforms are included
    if ($configContent -match "build-linux" -and 
        $configContent -match "build-macos" -and 
        $configContent -match "build-windows") {
        Write-Host "✓ All platforms configured (Linux, macOS, Windows)" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Missing platform configurations" -ForegroundColor Yellow
    }
    
    # Check 2: Verify caching is configured
    if ($configContent -match "restore_cache" -and 
        $configContent -match "save_cache") {
        Write-Host "✓ Caching configured" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Caching not configured (builds will be slow)" -ForegroundColor Yellow
    }
    
    # Check 3: Verify artifact storage
    if ($configContent -match "store_artifacts") {
        Write-Host "✓ Artifact storage configured" -ForegroundColor Green
    } else {
        Write-Host "⚠️  No artifact storage configured" -ForegroundColor Yellow
    }
    
    # Check 4: Verify timeout settings
    if ($configContent -match "no_output_timeout") {
        Write-Host "✓ Build timeouts configured" -ForegroundColor Green
    } else {
        Write-Host "⚠️  No timeout configured (may fail on long builds)" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "💡 Tips:" -ForegroundColor Cyan
    Write-Host "  • Test locally first: npm run test:desktop-build"
    Write-Host "  • Monitor first build closely (caches will be cold)"
    Write-Host "  • Expected build times: 15-35 minutes per platform"
    Write-Host ""
    
} else {
    Write-Host ""
    Write-Host "❌ Configuration has errors!" -ForegroundColor Red
    Write-Host ""
    Write-Host $validationResult
    Write-Host ""
    Write-Host "Fix the errors above before pushing to CircleCI" -ForegroundColor Red
    exit 1
}
