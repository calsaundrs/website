/**
 * Enhanced Recurring Events Management System
 * Phase 4: Code Quality & Error Handling
 * 
 * Features:
 * - Improved recurring event creation interface
 * - Better recurring event display and grouping
 * - Enhanced admin management tools
 * - Recurring event preview and validation
 * - Series management and editing
 */

class EnhancedRecurringEventsManager {
    constructor() {
        this.currentSeries = null;
        this.previewInstances = [];
        this.maxPreviewInstances = 12;
        this.init();
    }

    init() {
        this.setupRecurringInterface();
        this.setupPreviewSystem();
        this.setupAdminTools();
    }

    /**
     * Setup recurring events interface
     */
    setupRecurringInterface() {
        const recurringToggle = document.getElementById('recurring-toggle');
        const recurringOptions = document.getElementById('recurring-options');
        const patternSelect = document.getElementById('recurring-pattern');
        const startDateInput = document.getElementById('recurring-start-date');
        const endDateInput = document.getElementById('recurring-end-date');
        const maxInstancesInput = document.getElementById('max-instances');
        const previewContainer = document.getElementById('recurring-preview');

        if (!recurringToggle) return;

        // Toggle recurring options
        recurringToggle.addEventListener('change', () => {
            if (recurringOptions) {
                recurringOptions.classList.toggle('hidden', !recurringToggle.checked);
            }
            
            if (recurringToggle.checked) {
                this.updateRecurringPreview();
            } else {
                this.clearRecurringPreview();
            }
        });

        // Update preview when pattern changes
        if (patternSelect) {
            patternSelect.addEventListener('change', () => this.updateRecurringPreview());
        }

        // Update preview when dates change
        if (startDateInput) {
            startDateInput.addEventListener('change', () => this.updateRecurringPreview());
        }

        if (endDateInput) {
            endDateInput.addEventListener('change', () => this.updateRecurringPreview());
        }

        if (maxInstancesInput) {
            maxInstancesInput.addEventListener('change', () => this.updateRecurringPreview());
        }
    }

    /**
     * Setup preview system
     */
    setupPreviewSystem() {
        const previewContainer = document.getElementById('recurring-preview');
        if (!previewContainer) return;

        // Create preview container if it doesn't exist
        if (!document.getElementById('recurring-preview-container')) {
            const previewDiv = document.createElement('div');
            previewDiv.id = 'recurring-preview-container';
            previewDiv.className = 'mt-4 p-4 bg-blue-900/20 border border-blue-500 rounded-lg';
            previewDiv.innerHTML = `
                <h4 class="text-blue-300 font-semibold mb-3">
                    <i class="fas fa-calendar-alt mr-2"></i>Recurring Event Preview
                </h4>
                <div id="recurring-preview-list" class="space-y-2"></div>
                <div id="recurring-preview-summary" class="mt-3 text-sm text-blue-200"></div>
            `;
            previewContainer.appendChild(previewDiv);
        }
    }

    /**
     * Update recurring event preview
     */
    updateRecurringPreview() {
        const patternSelect = document.getElementById('recurring-pattern');
        const startDateInput = document.getElementById('recurring-start-date');
        const endDateInput = document.getElementById('recurring-end-date');
        const maxInstancesInput = document.getElementById('max-instances');
        const previewList = document.getElementById('recurring-preview-list');
        const previewSummary = document.getElementById('recurring-preview-summary');

        if (!patternSelect || !startDateInput || !previewList) return;

        const pattern = patternSelect.value;
        const startDate = startDateInput.value;
        const endDate = endDateInput?.value || null;
        const maxInstances = parseInt(maxInstancesInput?.value || '12');

        if (!pattern || !startDate) {
            this.clearRecurringPreview();
            return;
        }

        try {
            // Calculate preview instances
            this.previewInstances = this.calculatePreviewInstances({
                pattern,
                startDate,
                endDate,
                maxInstances
            });

            // Display preview
            this.displayPreviewInstances(previewList, previewSummary);

        } catch (error) {
            console.error('Error updating recurring preview:', error);
            this.showPreviewError('Invalid recurring event configuration');
        }
    }

    /**
     * Calculate preview instances
     */
    calculatePreviewInstances({ pattern, startDate, endDate, maxInstances }) {
        const start = new Date(startDate);
        const end = endDate ? new Date(endDate) : null;
        
        const instances = [];
        let current = new Date(start);
        let count = 0;

        while (count < maxInstances && count < this.maxPreviewInstances) {
            if (end && current > end) {
                break;
            }

            instances.push(new Date(current));
            count++;

            switch (pattern) {
                case 'daily':
                    current.setDate(current.getDate() + 1);
                    break;
                case 'weekly':
                    current.setDate(current.getDate() + 7);
                    break;
                case 'bi-weekly':
                    current.setDate(current.getDate() + 14);
                    break;
                case 'monthly':
                    current.setMonth(current.getMonth() + 1);
                    break;
                case 'yearly':
                    current.setFullYear(current.getFullYear() + 1);
                    break;
                default:
                    return instances;
            }
        }

        return instances;
    }

    /**
     * Display preview instances
     */
    displayPreviewInstances(previewList, previewSummary) {
        if (!previewList) return;

        previewList.innerHTML = '';

        this.previewInstances.forEach((date, index) => {
            const instanceDiv = document.createElement('div');
            instanceDiv.className = 'flex items-center justify-between p-2 bg-gray-800/50 rounded';
            
            const isPast = date < new Date();
            const dateClass = isPast ? 'text-gray-500' : 'text-white';
            
            instanceDiv.innerHTML = `
                <div class="flex items-center space-x-3">
                    <span class="text-sm font-medium ${dateClass}">${index + 1}.</span>
                    <span class="text-sm ${dateClass}">${date.toLocaleDateString()}</span>
                    <span class="text-xs text-gray-400">${date.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                </div>
                <div class="flex items-center space-x-2">
                    ${isPast ? '<span class="text-xs text-gray-500">Past</span>' : '<span class="text-xs text-green-400">Future</span>'}
                </div>
            `;
            
            previewList.appendChild(instanceDiv);
        });

        // Update summary
        if (previewSummary) {
            const futureInstances = this.previewInstances.filter(date => date > new Date()).length;
            const totalInstances = this.previewInstances.length;
            
            previewSummary.innerHTML = `
                <div class="flex items-center justify-between">
                    <span>Total instances: ${totalInstances}</span>
                    <span class="text-green-400">Future: ${futureInstances}</span>
                </div>
            `;
        }
    }

    /**
     * Clear recurring preview
     */
    clearRecurringPreview() {
        const previewList = document.getElementById('recurring-preview-list');
        const previewSummary = document.getElementById('recurring-preview-summary');
        
        if (previewList) previewList.innerHTML = '';
        if (previewSummary) previewSummary.innerHTML = '';
        
        this.previewInstances = [];
    }

    /**
     * Show preview error
     */
    showPreviewError(message) {
        const previewList = document.getElementById('recurring-preview-list');
        if (previewList) {
            previewList.innerHTML = `
                <div class="text-red-400 text-sm p-2 bg-red-900/20 border border-red-500 rounded">
                    <i class="fas fa-exclamation-triangle mr-2"></i>${message}
                </div>
            `;
        }
    }

    /**
     * Setup admin tools for recurring events
     */
    setupAdminTools() {
        this.setupRecurringFilters();
        this.setupSeriesManagement();
        this.setupBulkOperations();
    }

    /**
     * Setup recurring event filters
     */
    setupRecurringFilters() {
        const filterRecurring = document.getElementById('filter-recurring');
        const filterPastRecurring = document.getElementById('filter-past-recurring');
        const filterAll = document.getElementById('filter-all');

        if (filterRecurring) {
            filterRecurring.addEventListener('click', () => {
                this.filterEvents('recurring');
                this.updateActiveFilter(filterRecurring);
            });
        }

        if (filterPastRecurring) {
            filterPastRecurring.addEventListener('click', () => {
                this.filterEvents('past-recurring');
                this.updateActiveFilter(filterPastRecurring);
            });
        }

        if (filterAll) {
            filterAll.addEventListener('click', () => {
                this.filterEvents('all');
                this.updateActiveFilter(filterAll);
            });
        }
    }

    /**
     * Filter events by type
     */
    filterEvents(type) {
        const eventCards = document.querySelectorAll('.event-card');
        
        eventCards.forEach(card => {
            const isRecurring = card.dataset.isRecurring === 'true';
            const eventDate = new Date(card.dataset.eventDate);
            const isPast = eventDate < new Date();
            
            let show = true;
            
            switch (type) {
                case 'recurring':
                    show = isRecurring && !isPast;
                    break;
                case 'past-recurring':
                    show = isRecurring && isPast;
                    break;
                case 'all':
                    show = true;
                    break;
            }
            
            card.style.display = show ? 'block' : 'none';
        });
    }

    /**
     * Update active filter button
     */
    updateActiveFilter(activeButton) {
        const filterButtons = document.querySelectorAll('.filter-btn');
        filterButtons.forEach(btn => {
            btn.classList.remove('bg-accent-color', 'text-white');
            btn.classList.add('bg-gray-700', 'text-gray-300');
        });
        
        activeButton.classList.remove('bg-gray-700', 'text-gray-300');
        activeButton.classList.add('bg-accent-color', 'text-white');
    }

    /**
     * Setup series management
     */
    setupSeriesManagement() {
        const seriesManagementContainer = document.getElementById('series-management');
        if (!seriesManagementContainer) return;

        // Add series management interface
        seriesManagementContainer.innerHTML = `
            <div class="bg-gray-800 rounded-lg p-4 mb-6">
                <h3 class="text-white font-semibold mb-4">
                    <i class="fas fa-layer-group mr-2"></i>Recurring Series Management
                </h3>
                
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div class="bg-gray-700 rounded p-3">
                        <div class="text-2xl font-bold text-green-400" id="active-series-count">-</div>
                        <div class="text-sm text-gray-400">Active Series</div>
                    </div>
                    <div class="bg-gray-700 rounded p-3">
                        <div class="text-2xl font-bold text-blue-400" id="total-instances-count">-</div>
                        <div class="text-sm text-gray-400">Total Instances</div>
                    </div>
                    <div class="bg-gray-700 rounded p-3">
                        <div class="text-2xl font-bold text-yellow-400" id="future-instances-count">-</div>
                        <div class="text-sm text-gray-400">Future Instances</div>
                    </div>
                </div>
                
                <div class="mt-4">
                    <button id="refresh-series-stats" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm">
                        <i class="fas fa-sync-alt mr-2"></i>Refresh Stats
                    </button>
                </div>
            </div>
        `;

        // Setup refresh button
        const refreshBtn = document.getElementById('refresh-series-stats');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadSeriesStats());
        }

        // Load initial stats
        this.loadSeriesStats();
    }

    /**
     * Load series statistics
     */
    async loadSeriesStats() {
        try {
            const response = await fetch('/.netlify/functions/get-recurring-stats');
            const stats = await response.json();

            const activeCount = document.getElementById('active-series-count');
            const totalCount = document.getElementById('total-instances-count');
            const futureCount = document.getElementById('future-instances-count');

            if (activeCount) activeCount.textContent = stats.activeSeries || 0;
            if (totalCount) totalCount.textContent = stats.totalInstances || 0;
            if (futureCount) futureCount.textContent = stats.futureInstances || 0;

        } catch (error) {
            console.error('Error loading series stats:', error);
        }
    }

    /**
     * Setup bulk operations
     */
    setupBulkOperations() {
        const bulkOperationsContainer = document.getElementById('bulk-operations');
        if (!bulkOperationsContainer) return;

        bulkOperationsContainer.innerHTML = `
            <div class="bg-gray-800 rounded-lg p-4">
                <h3 class="text-white font-semibold mb-4">
                    <i class="fas fa-tasks mr-2"></i>Bulk Operations
                </h3>
                
                <div class="space-y-3">
                    <button id="bulk-approve-series" class="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm">
                        <i class="fas fa-check mr-2"></i>Approve Selected Series
                    </button>
                    <button id="bulk-cancel-series" class="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm">
                        <i class="fas fa-times mr-2"></i>Cancel Selected Series
                    </button>
                    <button id="bulk-edit-series" class="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm">
                        <i class="fas fa-edit mr-2"></i>Edit Selected Series
                    </button>
                </div>
            </div>
        `;

        // Setup bulk operation handlers
        this.setupBulkOperationHandlers();
    }

    /**
     * Setup bulk operation handlers
     */
    setupBulkOperationHandlers() {
        const bulkApprove = document.getElementById('bulk-approve-series');
        const bulkCancel = document.getElementById('bulk-cancel-series');
        const bulkEdit = document.getElementById('bulk-edit-series');

        if (bulkApprove) {
            bulkApprove.addEventListener('click', () => this.bulkApproveSeries());
        }

        if (bulkCancel) {
            bulkCancel.addEventListener('click', () => this.bulkCancelSeries());
        }

        if (bulkEdit) {
            bulkEdit.addEventListener('click', () => this.bulkEditSeries());
        }
    }

    /**
     * Bulk approve series
     */
    async bulkApproveSeries() {
        const selectedSeries = this.getSelectedSeries();
        if (selectedSeries.length === 0) {
            this.showMessage('Please select series to approve', 'warning');
            return;
        }

        if (!confirm(`Approve ${selectedSeries.length} recurring series?`)) {
            return;
        }

        try {
            for (const seriesId of selectedSeries) {
                await this.approveSeries(seriesId);
            }
            
            this.showMessage(`Successfully approved ${selectedSeries.length} series`, 'success');
            this.refreshEventList();
            
        } catch (error) {
            console.error('Error in bulk approve:', error);
            this.showMessage('Error approving series', 'error');
        }
    }

    /**
     * Bulk cancel series
     */
    async bulkCancelSeries() {
        const selectedSeries = this.getSelectedSeries();
        if (selectedSeries.length === 0) {
            this.showMessage('Please select series to cancel', 'warning');
            return;
        }

        if (!confirm(`Cancel ${selectedSeries.length} recurring series? This will cancel all future instances.`)) {
            return;
        }

        try {
            for (const seriesId of selectedSeries) {
                await this.cancelSeries(seriesId);
            }
            
            this.showMessage(`Successfully cancelled ${selectedSeries.length} series`, 'success');
            this.refreshEventList();
            
        } catch (error) {
            console.error('Error in bulk cancel:', error);
            this.showMessage('Error cancelling series', 'error');
        }
    }

    /**
     * Get selected series
     */
    getSelectedSeries() {
        const checkboxes = document.querySelectorAll('input[name="series-select"]:checked');
        return Array.from(checkboxes).map(cb => cb.value);
    }

    /**
     * Approve series
     */
    async approveSeries(seriesId) {
        const response = await fetch('/.netlify/functions/approve-recurring-series', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ seriesId })
        });

        if (!response.ok) {
            throw new Error(`Failed to approve series: ${response.status}`);
        }

        return response.json();
    }

    /**
     * Cancel series
     */
    async cancelSeries(seriesId) {
        const response = await fetch('/.netlify/functions/end-recurring-series', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ seriesId })
        });

        if (!response.ok) {
            throw new Error(`Failed to cancel series: ${response.status}`);
        }

        return response.json();
    }

    /**
     * Refresh event list
     */
    refreshEventList() {
        // Trigger a page refresh or reload events
        if (typeof loadEvents === 'function') {
            loadEvents();
        } else {
            location.reload();
        }
    }

    /**
     * Show message
     */
    showMessage(message, type = 'info') {
        if (window.formErrorHandler) {
            switch (type) {
                case 'success':
                    window.formErrorHandler.showSuccess(message);
                    break;
                case 'error':
                    window.formErrorHandler.showError(message);
                    break;
                case 'warning':
                    window.formErrorHandler.showWarning(message);
                    break;
                default:
                    window.formErrorHandler.showInfo(message);
            }
        } else {
            alert(message);
        }
    }

    /**
     * Validate recurring event configuration
     */
    validateRecurringConfig(config) {
        const errors = [];

        if (!config.pattern) {
            errors.push('Recurring pattern is required');
        }

        if (!config.startDate) {
            errors.push('Start date is required');
        } else {
            const startDate = new Date(config.startDate);
            if (isNaN(startDate.getTime())) {
                errors.push('Invalid start date');
            }
        }

        if (config.endDate) {
            const startDate = new Date(config.startDate);
            const endDate = new Date(config.endDate);
            if (endDate <= startDate) {
                errors.push('End date must be after start date');
            }
        }

        if (config.maxInstances && (config.maxInstances < 1 || config.maxInstances > 100)) {
            errors.push('Max instances must be between 1 and 100');
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Get recurring event configuration from form
     */
    getRecurringConfig() {
        const patternSelect = document.getElementById('recurring-pattern');
        const startDateInput = document.getElementById('recurring-start-date');
        const endDateInput = document.getElementById('recurring-end-date');
        const maxInstancesInput = document.getElementById('max-instances');

        return {
            pattern: patternSelect?.value || '',
            startDate: startDateInput?.value || '',
            endDate: endDateInput?.value || '',
            maxInstances: parseInt(maxInstancesInput?.value || '12')
        };
    }
}

// Initialize the enhanced recurring events manager
document.addEventListener('DOMContentLoaded', () => {
    window.enhancedRecurringManager = new EnhancedRecurringEventsManager();
});
