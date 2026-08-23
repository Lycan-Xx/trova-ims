#!/bin/bash

# CircleCI Configuration Validation Script
# Checks if the CircleCI config is valid before pushing

set -e

echo "🔍 CircleCI Configuration Validator"
echo "===================================="
echo ""

# Check if CircleCI CLI is installed
if ! command -v circleci &> /dev/null; then
    echo "⚠️  CircleCI CLI not found"
    echo ""
    echo "Install it with:"
    echo "  macOS/Linux: curl -fLSs https://raw.githubusercontent.com/CircleCI-Public/circleci-cli/master/install.sh | bash"
    echo "  Windows: choco install circleci-cli"
    echo ""
    echo "Or download from: https://github.com/CircleCI-Public/circleci-cli/releases"
    echo ""
    exit 1
fi

echo "✓ CircleCI CLI found: $(circleci version)"
echo ""

# Validate config
echo "📋 Validating .circleci/config.yml..."
echo ""

if circleci config validate; then
    echo ""
    echo "✅ Configuration is valid!"
    echo ""
    
    # Show workflow preview
    echo "📊 Workflow Preview:"
    echo ""
    circleci config process .circleci/config.yml > /dev/null 2>&1 || true
    
    # Check for common issues
    echo "🔍 Checking for common issues..."
    echo ""
    
    config_file=".circleci/config.yml"
    
    # Check 1: Verify all platforms are included
    if grep -q "build-linux" "$config_file" && \
       grep -q "build-macos" "$config_file" && \
       grep -q "build-windows" "$config_file"; then
        echo "✓ All platforms configured (Linux, macOS, Windows)"
    else
        echo "⚠️  Missing platform configurations"
    fi
    
    # Check 2: Verify caching is configured
    if grep -q "restore_cache" "$config_file" && \
       grep -q "save_cache" "$config_file"; then
        echo "✓ Caching configured"
    else
        echo "⚠️  Caching not configured (builds will be slow)"
    fi
    
    # Check 3: Verify artifact storage
    if grep -q "store_artifacts" "$config_file"; then
        echo "✓ Artifact storage configured"
    else
        echo "⚠️  No artifact storage configured"
    fi
    
    # Check 4: Verify timeout settings
    if grep -q "no_output_timeout" "$config_file"; then
        echo "✓ Build timeouts configured"
    else
        echo "⚠️  No timeout configured (may fail on long builds)"
    fi
    
    echo ""
    echo "💡 Tips:"
    echo "  • Test locally first: npm run test:desktop-build"
    echo "  • Monitor first build closely (caches will be cold)"
    echo "  • Expected build times: 15-35 minutes per platform"
    echo ""
    
else
    echo ""
    echo "❌ Configuration has errors!"
    echo ""
    echo "Fix the errors above before pushing to CircleCI"
    exit 1
fi
