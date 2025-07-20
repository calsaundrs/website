#!/bin/bash

# Brum Outloud - Production Build & Optimization Script
# This script optimizes the site for production deployment

echo "🏳️‍🌈 Brum Outloud - Starting production build optimization..."

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

# Check if required tools are installed
check_dependencies() {
    print_status "Checking dependencies..."
    
    # Check for Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is required but not installed."
        exit 1
    fi
    
    # Check for npm
    if ! command -v npm &> /dev/null; then
        print_error "npm is required but not installed."
        exit 1
    fi
    
    print_success "All dependencies found!"
}

# Install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    npm install
    print_success "Dependencies installed!"
}

# Build Tailwind CSS
build_css() {
    print_status "Building optimized CSS..."
    
    # Build Tailwind CSS with purge for production
    npx tailwindcss build -o css/tailwind.css --minify
    
    if [ $? -eq 0 ]; then
        print_success "CSS built successfully!"
    else
        print_error "CSS build failed!"
        exit 1
    fi
}

# Optimize images (if imagemin-cli is available)
optimize_images() {
    print_status "Checking for image optimization tools..."
    
    if command -v imagemin &> /dev/null; then
        print_status "Optimizing images..."
        
        # Create optimized images directory
        mkdir -p images/optimized
        
        # Optimize PNG files
        find . -name "*.png" -not -path "./images/optimized/*" -not -path "./node_modules/*" | while read img; do
            imagemin "$img" --out-dir="images/optimized" --plugin=imagemin-pngquant
        done
        
        # Optimize JPEG files
        find . -name "*.jpg" -o -name "*.jpeg" -not -path "./images/optimized/*" -not -path "./node_modules/*" | while read img; do
            imagemin "$img" --out-dir="images/optimized" --plugin=imagemin-mozjpeg
        done
        
        print_success "Images optimized!"
    else
        print_warning "imagemin-cli not found. Skipping image optimization."
        print_warning "Install with: npm install -g imagemin-cli imagemin-pngquant imagemin-mozjpeg"
    fi
}

# Generate service worker cache manifest
update_service_worker() {
    print_status "Updating service worker cache..."
    
    # Update cache version in service worker
    TIMESTAMP=$(date +%s)
    sed -i.bak "s/cache-v[0-9]*/cache-v$TIMESTAMP/g" sw.js
    rm sw.js.bak
    
    print_success "Service worker updated with new cache version!"
}

# Validate HTML files
validate_html() {
    print_status "Validating HTML files..."
    
    # Basic HTML validation (check for common issues)
    find . -name "*.html" -not -path "./node_modules/*" | while read html_file; do
        # Check for missing alt attributes
        if grep -q '<img[^>]*src[^>]*>' "$html_file" && ! grep -q 'alt=' "$html_file"; then
            print_warning "Missing alt attributes in $html_file"
        fi
        
        # Check for missing meta description
        if ! grep -q 'meta name="description"' "$html_file"; then
            print_warning "Missing meta description in $html_file"
        fi
        
        # Check for title tag
        if ! grep -q '<title>' "$html_file"; then
            print_warning "Missing title tag in $html_file"
        fi
    done
    
    print_success "HTML validation complete!"
}

# Check for performance issues
performance_check() {
    print_status "Running performance checks..."
    
    # Check for large files
    print_status "Checking for large files..."
    find . -type f -size +1M -not -path "./node_modules/*" -not -path "./.git/*" | while read large_file; do
        size=$(du -h "$large_file" | cut -f1)
        print_warning "Large file found: $large_file ($size)"
    done
    
    # Check for unoptimized images
    print_status "Checking for unoptimized images..."
    find . -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" | while read img; do
        size=$(du -k "$img" | cut -f1)
        if [ "$size" -gt 500 ]; then
            print_warning "Large image file: $img (${size}KB)"
        fi
    done
    
    print_success "Performance check complete!"
}

# Generate sitemap
generate_sitemap() {
    print_status "Checking sitemap configuration..."
    
    if [ -f "netlify/functions/sitemap.js" ]; then
        print_success "Dynamic sitemap function found!"
    else
        print_warning "No sitemap function found. Consider implementing dynamic sitemap generation."
    fi
}

# Security checks
security_check() {
    print_status "Running security checks..."
    
    # Check for exposed sensitive files
    sensitive_files=(".env" "config.js" ".htpasswd" "wp-config.php")
    for file in "${sensitive_files[@]}"; do
        if [ -f "$file" ]; then
            print_warning "Sensitive file found: $file (ensure it's not publicly accessible)"
        fi
    done
    
    # Check .htaccess security headers
    if [ -f ".htaccess" ]; then
        if grep -q "X-Content-Type-Options" .htaccess; then
            print_success "Security headers found in .htaccess"
        else
            print_warning "Consider adding security headers to .htaccess"
        fi
    fi
    
    print_success "Security check complete!"
}

# Create production summary
create_summary() {
    print_status "Creating build summary..."
    
    echo "# Brum Outloud - Production Build Summary" > build-summary.md
    echo "Generated on: $(date)" >> build-summary.md
    echo "" >> build-summary.md
    echo "## Optimizations Applied" >> build-summary.md
    echo "- ✅ CSS minified and optimized" >> build-summary.md
    echo "- ✅ Service worker cache updated" >> build-summary.md
    echo "- ✅ HTML validated" >> build-summary.md
    echo "- ✅ Performance checks completed" >> build-summary.md
    echo "- ✅ Security checks completed" >> build-summary.md
    echo "" >> build-summary.md
    echo "## File Sizes" >> build-summary.md
    echo "\`\`\`" >> build-summary.md
    du -h css/main.css css/tailwind.css js/main.js 2>/dev/null >> build-summary.md
    echo "\`\`\`" >> build-summary.md
    
    print_success "Build summary created: build-summary.md"
}

# Cleanup temporary files
cleanup() {
    print_status "Cleaning up temporary files..."
    
    # Remove any temporary files created during build
    find . -name "*.bak" -delete 2>/dev/null
    find . -name "*.tmp" -delete 2>/dev/null
    
    print_success "Cleanup complete!"
}

# Main execution
main() {
    echo "🏳️‍🌈 Starting Brum Outloud production optimization..."
    echo "=================================================="
    
    check_dependencies
    install_dependencies
    build_css
    optimize_images
    update_service_worker
    validate_html
    performance_check
    generate_sitemap
    security_check
    create_summary
    cleanup
    
    echo "=================================================="
    print_success "🎉 Build optimization complete!"
    print_status "Your site is ready for production deployment."
    echo ""
    print_status "Next steps:"
    echo "1. Review build-summary.md for details"
    echo "2. Test the site locally"
    echo "3. Deploy to your hosting platform"
    echo "4. Run performance tests (e.g., Lighthouse)"
    echo ""
    print_success "Happy deploying! 🏳️‍🌈"
}

# Run the main function
main