#!/bin/bash

# Enhanced Build and Optimization Script for Brum Outloud
# This script handles CSS building, venue SSG, and optimization

set -e  # Exit on any error

echo "🚀 Starting Brum Outloud build process..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install npm first."
    exit 1
fi

# Check if required environment variables are set
print_status "Checking environment variables..."

REQUIRED_VARS=(
    "FIREBASE_PROJECT_ID"
    "FIREBASE_CLIENT_EMAIL"
    "FIREBASE_PRIVATE_KEY"
    "CLOUDINARY_CLOUD_NAME"
)

MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
    print_warning "Some environment variables are not set:"
    for var in "${MISSING_VARS[@]}"; do
        echo "  - $var"
    done
    print_warning "Venue SSG may not work correctly without these variables."
    echo ""
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    print_status "Installing dependencies..."
    npm install
    print_success "Dependencies installed successfully"
else
    print_status "Dependencies already installed"
fi

# Build CSS
print_status "Building CSS..."
if npm run build:css; then
    print_success "CSS built successfully"
else
    print_error "CSS build failed"
    exit 1
fi

# Generate venue pages (SSG)
print_status "Generating venue pages (SSG)..."
if npm run build:venues; then
    print_success "Venue pages generated successfully"
else
    print_warning "Venue SSG failed - this may be due to missing environment variables"
    print_warning "Continuing with build process..."
fi

# Check if venue directory was created
if [ -d "venue" ]; then
    VENUE_COUNT=$(find venue -name "*.html" | wc -l)
    print_success "Generated $VENUE_COUNT venue pages"
else
    print_warning "No venue directory found - SSG may have failed"
fi

# Optimize images (if ImageOptim CLI is available)
if command -v imageoptim &> /dev/null; then
    print_status "Optimizing images..."
    if [ -d "images" ]; then
        imageoptim images/
        print_success "Images optimized"
    else
        print_status "No images directory found, skipping image optimization"
    fi
else
    print_warning "ImageOptim CLI not found. Install it for automatic image optimization."
fi

# Check for common issues
print_status "Running health checks..."

# Check for broken links in generated venue pages
if [ -d "venue" ]; then
    print_status "Checking venue pages for common issues..."
    
    # Count total venue pages
    TOTAL_VENUES=$(find venue -name "*.html" | wc -l)
    print_success "Found $TOTAL_VENUES venue pages"
    
    # Check for pages with missing images
    PAGES_WITH_PLACEHOLDERS=$(grep -r "placehold.co" venue/ | wc -l || echo "0")
    if [ "$PAGES_WITH_PLACEHOLDERS" -gt 0 ]; then
        print_warning "Found $PAGES_WITH_PLACEHOLDERS venue pages with placeholder images"
    fi
fi

# Check file sizes
print_status "Checking file sizes..."
LARGE_FILES=$(find . -name "*.html" -size +1M 2>/dev/null || true)
if [ -n "$LARGE_FILES" ]; then
    print_warning "Found large HTML files:"
    echo "$LARGE_FILES"
fi

# Validate HTML structure
print_status "Validating HTML structure..."
if command -v tidy &> /dev/null; then
    for file in venue/*.html; do
        if [ -f "$file" ]; then
            if ! tidy -q -e "$file" > /dev/null 2>&1; then
                print_warning "HTML validation issues found in $file"
            fi
        fi
    done
else
    print_status "HTML Tidy not found, skipping HTML validation"
fi

# Create build summary
print_status "Creating build summary..."

BUILD_SUMMARY="build-summary-$(date +%Y%m%d-%H%M%S).txt"

{
    echo "Brum Outloud Build Summary"
    echo "=========================="
    echo "Build Date: $(date)"
    echo "Build Time: $(date +%H:%M:%S)"
    echo ""
    echo "Environment Variables:"
    for var in "${REQUIRED_VARS[@]}"; do
        if [ -n "${!var}" ]; then
            echo "  ✓ $var: Set"
        else
            echo "  ✗ $var: Not set"
        fi
    done
    echo ""
    echo "Generated Files:"
    if [ -d "venue" ]; then
        echo "  Venue pages: $(find venue -name "*.html" | wc -l)"
        echo "  Venue directory: $(du -sh venue 2>/dev/null | cut -f1 || echo "N/A")"
    else
        echo "  Venue pages: 0 (directory not found)"
    fi
    echo ""
    echo "CSS Files:"
    if [ -f "css/tailwind.css" ]; then
        echo "  Tailwind CSS: $(du -sh css/tailwind.css | cut -f1)"
    else
        echo "  Tailwind CSS: Not found"
    fi
    echo ""
    echo "Build Status: SUCCESS"
} > "$BUILD_SUMMARY"

print_success "Build summary saved to $BUILD_SUMMARY"

# Final status
echo ""
print_success "🎉 Build process completed successfully!"
echo ""
echo "Next steps:"
echo "  1. Test the site locally: npx serve ."
echo "  2. Deploy to Netlify: git push"
echo "  3. Check the build summary: cat $BUILD_SUMMARY"
echo ""

# Optional: Start local server for testing
if [ "$1" = "--serve" ]; then
    print_status "Starting local server for testing..."
    if command -v npx &> /dev/null; then
        npx serve . -p 3000
    else
        print_warning "npx not found. Install serve manually: npm install -g serve"
    fi
fi

print_success "Build script completed!"