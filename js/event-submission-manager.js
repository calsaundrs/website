/**
 * Event Submission Manager - Fixes Reliability Issues
 * Phase 4: Code Quality & Error Handling
 * 
 * Handles:
 * - Race condition prevention
 * - Retry mechanism with exponential backoff
 * - Form state management
 * - Network timeout handling
 * - User feedback and progress indicators
 */

class EventSubmissionManager {
    constructor() {
        this.isSubmitting = false;
        this.submissionQueue = [];
        this.retryAttempts = new Map();
        this.maxRetries = 3;
        this.baseTimeout = 10000; // 10 seconds
        this.progressIndicators = new Map();
        this.init();
    }

    init() {
        this.setupFormSubmission();
        this.setupProgressIndicators();
        this.setupOfflineHandling();
    }

    /**
     * Setup form submission with reliability improvements
     */
    setupFormSubmission() {
        const form = document.getElementById('event-submission-form');
        if (!form) return;

        // Remove existing submit listeners to prevent conflicts
        const existingListeners = form.querySelectorAll('*');
        existingListeners.forEach(element => {
            const newElement = element.cloneNode(true);
            element.parentNode.replaceChild(newElement, element);
        });

        // Add our reliable submit handler
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleSubmission(form);
        });

        // Add submission state to form
        form.dataset.submissionState = 'ready';
    }

    /**
     * Setup progress indicators
     */
    setupProgressIndicators() {
        const form = document.getElementById('event-submission-form');
        if (!form) return;

        // Create progress indicator
        const progressContainer = document.createElement('div');
        progressContainer.id = 'submission-progress';
        progressContainer.className = 'hidden fixed top-4 right-4 bg-white border border-gray-300 rounded-lg shadow-lg p-4 z-50 max-w-sm';
        progressContainer.innerHTML = `
            <div class="flex items-center space-x-3">
                <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-accent-color"></div>
                <div>
                    <div class="font-medium text-gray-900" id="progress-title">Submitting Event...</div>
                    <div class="text-sm text-gray-500" id="progress-message">Please wait...</div>
                </div>
            </div>
            <div class="mt-3">
                <div class="w-full bg-gray-200 rounded-full h-2">
                    <div class="bg-accent-color h-2 rounded-full transition-all duration-300" id="progress-bar" style="width: 0%"></div>
                </div>
            </div>
        `;

        document.body.appendChild(progressContainer);
        this.progressIndicators.set('main', progressContainer);
    }

    /**
     * Setup offline handling
     */
    setupOfflineHandling() {
        window.addEventListener('online', () => {
            this.processOfflineQueue();
        });

        window.addEventListener('offline', () => {
            this.showOfflineMessage();
        });
    }

    /**
     * Handle form submission with reliability improvements
     */
    async handleSubmission(form) {
        if (this.isSubmitting) {
            console.log('Submission already in progress, ignoring duplicate submission');
            return false;
        }

        // Set submission state
        this.isSubmitting = true;
        form.dataset.submissionState = 'submitting';
        this.disableForm(form);

        try {
            // Show progress indicator
            this.showProgress('Preparing submission...', 10);

            // Validate form first
            const validationResult = await this.validateForm(form);
            if (!validationResult.isValid) {
                this.showValidationErrors(validationResult.errors);
                return false;
            }

            this.updateProgress('Validating data...', 30);

            // Prepare form data
            const formData = await this.prepareFormData(form);
            this.updateProgress('Submitting event...', 50);

            // Submit with retry mechanism
            const result = await this.submitWithRetry(formData);
            this.updateProgress('Processing response...', 90);

            if (result.success) {
                this.handleSuccess(result, form);
            } else {
                this.handleError(result.error, form);
            }

        } catch (error) {
            this.handleError(error, form);
        } finally {
            this.cleanupSubmission(form);
        }

        return false; // Prevent default form submission
    }

    /**
     * Validate form data
     */
    async validateForm(form) {
        const errors = [];

        // Check terms agreement
        const termsCheckbox = form.querySelector('input[name="terms"]');
        if (termsCheckbox && !termsCheckbox.checked) {
            errors.push('You must agree to the Terms of Submission.');
        }

        // Required field validation
        const requiredFields = [
            { name: 'event-name', display: 'Event name' },
            { name: 'date', display: 'Event date' },
            { name: 'start-time', display: 'Start time' }
        ];

        requiredFields.forEach(field => {
            const element = form.querySelector(`[name="${field.name}"]`);
            if (element && (!element.value || element.value.trim() === '')) {
                errors.push(`${field.display} is required`);
                element.classList.add('border-red-500');
            }
        });

        // Venue validation
        const venueSelect = form.querySelector('#venue-select');
        if (venueSelect && (!venueSelect.value || venueSelect.value === '')) {
            errors.push('Please select a venue or choose to add a new one.');
            venueSelect.classList.add('border-red-500');
        }

        // New venue validation
        if (venueSelect && venueSelect.value === '__CREATE_NEW__') {
            const newVenueName = form.querySelector('#new-venue-name');
            const newVenueAddress = form.querySelector('#new-venue-address');
            
            if (newVenueName && (!newVenueName.value || newVenueName.value.trim() === '')) {
                errors.push('New venue name is required.');
                newVenueName.classList.add('border-red-500');
            }
            if (newVenueAddress && (!newVenueAddress.value || newVenueAddress.value.trim() === '')) {
                errors.push('New venue address is required.');
                newVenueAddress.classList.add('border-red-500');
            }
        }

        // Date validation
        const dateElement = form.querySelector('#date');
        if (dateElement && dateElement.value) {
            const date = new Date(dateElement.value);
            if (isNaN(date.getTime()) || date < new Date()) {
                errors.push('Event date must be a valid future date');
                dateElement.classList.add('border-red-500');
            }
        }

        // Time validation
        const timeElement = form.querySelector('#start-time');
        if (timeElement && timeElement.value && !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(timeElement.value)) {
            errors.push('Start time must be in HH:MM format');
            timeElement.classList.add('border-red-500');
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Prepare form data for submission
     */
    async prepareFormData(form) {
        const formData = new FormData(form);
        const data = {};

        // Convert FormData to object
        for (let [key, value] of formData.entries()) {
            data[key] = value;
        }

        // Handle venue creation if needed
        const venueSelect = form.querySelector('#venue-select');
        if (venueSelect && venueSelect.value === '__CREATE_NEW__') {
            const venueResult = await this.createVenue(data);
            if (venueResult.success) {
                data.venueId = venueResult.venueId;
            } else {
                throw new Error(`Venue creation failed: ${venueResult.error}`);
            }
        } else if (venueSelect) {
            data.venueId = venueSelect.value;
        }

        // Handle categories
        const categorySelect = form.querySelector('#category-select');
        if (categorySelect) {
            const selectedCategories = Array.from(categorySelect.selectedOptions).map(option => option.value);
            data.category = selectedCategories.join(',');
        }

        // Handle recurring events
        const recurringInfoInput = form.querySelector('#recurring-info');
        if (recurringInfoInput && recurringInfoInput.value) {
            data['recurring-info'] = recurringInfoInput.value;
        }

        return data;
    }

    /**
     * Create new venue
     */
    async createVenue(eventData) {
        try {
            const venueParams = new URLSearchParams();
            venueParams.append('venue-name', eventData['new-venue-name']);
            venueParams.append('address', eventData['new-venue-address']);
            venueParams.append('contact-email', eventData['contact-email']);
            venueParams.append('website', eventData['new-venue-website']);
            venueParams.append('description', `Venue created during event submission for: ${eventData['event-name']}`);

            const response = await fetch('/.netlify/functions/venue-submission-firestore-simple', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: venueParams.toString()
            });

            if (!response.ok) {
                throw new Error(`Venue creation failed: ${response.status}`);
            }

            const result = await response.json();
            return {
                success: true,
                venueId: result.firestoreId || result.id
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Submit with retry mechanism
     */
    async submitWithRetry(data, attempt = 1) {
        const submissionId = this.generateSubmissionId();
        
        try {
            this.updateProgress(`Submitting event (attempt ${attempt})...`, 50);

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.baseTimeout * attempt);

            const response = await fetch('/.netlify/functions/event-submission-firestore-only', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            const contentType = response.headers.get('content-type') || '';
            let result;

            if (contentType.includes('application/json')) {
                result = await response.json();
            } else {
                const text = await response.text();
                throw new Error(`Unexpected response format. Status: ${response.status}`);
            }

            if (!response.ok || result.success === false) {
                throw new Error(result.error || result.message || `HTTP error: ${response.status}`);
            }

            return result;

        } catch (error) {
            console.error(`Submission attempt ${attempt} failed:`, error);

            // Check if we should retry
            if (attempt < this.maxRetries && this.shouldRetry(error)) {
                const delay = this.calculateRetryDelay(attempt);
                this.updateProgress(`Retrying in ${delay/1000}s...`, 60);
                
                await this.delay(delay);
                return this.submitWithRetry(data, attempt + 1);
            }

            // If offline, queue for later
            if (!navigator.onLine) {
                this.queueOfflineSubmission(data);
                return {
                    success: false,
                    error: 'You are offline. Submission will be retried when connection is restored.'
                };
            }

            throw error;
        }
    }

    /**
     * Determine if error is retryable
     */
    shouldRetry(error) {
        const retryableErrors = [
            'NetworkError',
            'TypeError',
            'AbortError',
            'timeout',
            'network',
            'ECONNRESET',
            'ETIMEDOUT'
        ];

        const errorMessage = error.message.toLowerCase();
        return retryableErrors.some(retryable => 
            errorMessage.includes(retryable.toLowerCase())
        );
    }

    /**
     * Calculate retry delay with exponential backoff
     */
    calculateRetryDelay(attempt) {
        return Math.min(1000 * Math.pow(2, attempt - 1), 30000); // Max 30 seconds
    }

    /**
     * Queue submission for offline processing
     */
    queueOfflineSubmission(data) {
        const offlineSubmissions = JSON.parse(localStorage.getItem('offline_submissions') || '[]');
        offlineSubmissions.push({
            data: data,
            timestamp: new Date().toISOString(),
            id: this.generateSubmissionId()
        });
        localStorage.setItem('offline_submissions', JSON.stringify(offlineSubmissions));
    }

    /**
     * Process offline queue when back online
     */
    async processOfflineQueue() {
        const offlineSubmissions = JSON.parse(localStorage.getItem('offline_submissions') || '[]');
        if (offlineSubmissions.length === 0) return;

        this.showProgress(`Processing ${offlineSubmissions.length} offline submissions...`, 10);

        for (let i = 0; i < offlineSubmissions.length; i++) {
            const submission = offlineSubmissions[i];
            try {
                await this.submitWithRetry(submission.data);
                this.updateProgress(`Processed ${i + 1}/${offlineSubmissions.length}`, 
                    ((i + 1) / offlineSubmissions.length) * 100);
            } catch (error) {
                console.error('Failed to process offline submission:', error);
            }
        }

        // Clear processed submissions
        localStorage.removeItem('offline_submissions');
        this.hideProgress();
        this.showSuccess('Offline submissions processed successfully!');
    }

    /**
     * Handle successful submission
     */
    handleSuccess(result, form) {
        this.updateProgress('Success!', 100);
        
        let successMessage = 'Event submitted successfully! We\'ll review it within 24-48 hours.';
        
        if (result.aiExtraction && result.aiExtraction.success) {
            const extractedCount = result.aiExtraction.extractedFields.length;
            const confidence = result.aiExtraction.confidence;
            successMessage += `\n\n🤖 AI extracted ${extractedCount} fields from your poster (confidence: ${confidence}).`;
        }

        this.showSuccess(successMessage);
        this.resetForm(form);
    }

    /**
     * Handle submission error
     */
    handleError(error, form) {
        console.error('Submission error:', error);
        
        let errorMessage = 'Error submitting event. Please try again.';
        
        if (error.message) {
            if (error.message.includes('offline')) {
                errorMessage = 'You are offline. Your submission will be saved and sent when you reconnect.';
            } else if (error.message.includes('timeout')) {
                errorMessage = 'Request timed out. Please check your connection and try again.';
            } else if (error.message.includes('network')) {
                errorMessage = 'Network error. Please check your connection and try again.';
            } else {
                errorMessage = error.message;
            }
        }

        this.showError(errorMessage);
    }

    /**
     * Cleanup after submission
     */
    cleanupSubmission(form) {
        this.isSubmitting = false;
        form.dataset.submissionState = 'ready';
        this.enableForm(form);
        this.hideProgress();
    }

    /**
     * Show progress indicator
     */
    showProgress(title, percentage) {
        const progress = this.progressIndicators.get('main');
        if (!progress) return;

        progress.classList.remove('hidden');
        progress.querySelector('#progress-title').textContent = title;
        progress.querySelector('#progress-bar').style.width = `${percentage}%`;
    }

    /**
     * Update progress
     */
    updateProgress(message, percentage) {
        const progress = this.progressIndicators.get('main');
        if (!progress) return;

        progress.querySelector('#progress-message').textContent = message;
        progress.querySelector('#progress-bar').style.width = `${percentage}%`;
    }

    /**
     * Hide progress indicator
     */
    hideProgress() {
        const progress = this.progressIndicators.get('main');
        if (progress) {
            progress.classList.add('hidden');
        }
    }

    /**
     * Show success message
     */
    showSuccess(message) {
        if (window.formErrorHandler) {
            window.formErrorHandler.showSuccess(message);
        } else {
            alert(message);
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        if (window.formErrorHandler) {
            window.formErrorHandler.showError(message);
        } else {
            alert(message);
        }
    }

    /**
     * Show validation errors
     */
    showValidationErrors(errors) {
        if (window.formErrorHandler) {
            window.formErrorHandler.showFormErrors(errors);
        } else {
            alert('Please fix the following issues:\n' + errors.join('\n'));
        }
    }

    /**
     * Disable form during submission
     */
    disableForm(form) {
        const inputs = form.querySelectorAll('input, textarea, select, button');
        inputs.forEach(input => {
            input.disabled = true;
        });
    }

    /**
     * Enable form after submission
     */
    enableForm(form) {
        const inputs = form.querySelectorAll('input, textarea, select, button');
        inputs.forEach(input => {
            input.disabled = false;
        });
    }

    /**
     * Reset form
     */
    resetForm(form) {
        form.reset();
        
        // Reset any custom UI elements
        const posterPreview = document.getElementById('poster-preview');
        const uploadArea = document.getElementById('upload-area');
        const extractedData = document.getElementById('extracted-data');
        const newVenueFields = document.getElementById('new-venue-fields');

        if (posterPreview) posterPreview.classList.add('hidden');
        if (uploadArea) uploadArea.classList.remove('hidden');
        if (extractedData) extractedData.classList.add('hidden');
        if (newVenueFields) newVenueFields.classList.add('hidden');
    }

    /**
     * Show offline message
     */
    showOfflineMessage() {
        this.showError('You are offline. Submissions will be saved and sent when you reconnect.');
    }

    /**
     * Get field display name
     */
    getFieldDisplayName(fieldName) {
        const displayNames = {
            'event-name': 'Event name',
            'date': 'Event date',
            'start-time': 'Start time',
            'venue-id': 'Venue',
            'description': 'Description',
            'category-select': 'Category'
        };
        return displayNames[fieldName] || fieldName;
    }

    /**
     * Generate unique submission ID
     */
    generateSubmissionId() {
        return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Utility delay function
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize the submission manager
document.addEventListener('DOMContentLoaded', () => {
    window.eventSubmissionManager = new EventSubmissionManager();
});
