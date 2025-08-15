/**
 * Enhanced Form Validation & Auto-Save System
 * Phase 4: Code Quality & Error Handling
 */

class FormValidationManager {
    constructor() {
        this.forms = new Map();
        this.autoSaveIntervals = new Map();
        this.validationStates = new Map();
        this.init();
    }

    init() {
        this.setupFormValidation();
        this.setupAutoSave();
        this.setupRealTimeValidation();
    }

    /**
     * Setup form validation for all forms
     */
    setupFormValidation() {
        const forms = document.querySelectorAll('form');
        forms.forEach(form => {
            this.registerForm(form);
        });
    }

    /**
     * Register a form for validation
     */
    registerForm(form) {
        const formId = form.id || `form-${Date.now()}`;
        form.id = formId;
        
        this.forms.set(formId, {
            element: form,
            fields: new Map(),
            isValid: false,
            lastSaved: null
        });

        // Setup field validation
        this.setupFieldValidation(form);
        
        // Setup form submission
        this.setupFormSubmission(form);
    }

    /**
     * Setup validation for individual fields
     */
    setupFieldValidation(form) {
        const fields = form.querySelectorAll('input, textarea, select');
        
        fields.forEach(field => {
            const fieldId = field.id || field.name || `field-${Date.now()}`;
            
            // Store field info
            this.forms.get(form.id).fields.set(fieldId, {
                element: field,
                isValid: true,
                errors: [],
                lastValidated: null
            });

            // Add validation event listeners
            field.addEventListener('blur', () => this.validateField(field, form.id));
            field.addEventListener('input', () => this.validateField(field, form.id, true));
            
            // Add ARIA attributes
            this.setupARIA(field);
        });
    }

    /**
     * Setup ARIA attributes for accessibility
     */
    setupARIA(field) {
        if (!field.hasAttribute('aria-describedby')) {
            const errorId = `${field.id || field.name}-error`;
            field.setAttribute('aria-describedby', errorId);
        }
    }

    /**
     * Validate a single field
     */
    validateField(field, formId, isRealTime = false) {
        const fieldId = field.id || field.name;
        const fieldInfo = this.forms.get(formId).fields.get(fieldId);
        
        if (!fieldInfo) return;

        const errors = [];
        const value = field.value.trim();

        // Required validation
        if (field.hasAttribute('required') && !value) {
            errors.push('This field is required');
        }

        // Email validation
        if (field.type === 'email' && value && !this.isValidEmail(value)) {
            errors.push('Please enter a valid email address');
        }

        // URL validation
        if (field.type === 'url' && value && !this.isValidUrl(value)) {
            errors.push('Please enter a valid URL');
        }

        // Min length validation
        if (field.hasAttribute('minlength')) {
            const minLength = parseInt(field.getAttribute('minlength'));
            if (value.length < minLength) {
                errors.push(`Must be at least ${minLength} characters`);
            }
        }

        // Max length validation
        if (field.hasAttribute('maxlength')) {
            const maxLength = parseInt(field.getAttribute('maxlength'));
            if (value.length > maxLength) {
                errors.push(`Must be no more than ${maxLength} characters`);
            }
        }

        // Pattern validation
        if (field.hasAttribute('pattern')) {
            const pattern = new RegExp(field.getAttribute('pattern'));
            if (value && !pattern.test(value)) {
                const title = field.getAttribute('title') || 'Invalid format';
                errors.push(title);
            }
        }

        // Custom validation
        const customValidation = this.getCustomValidation(field);
        if (customValidation) {
            const customError = customValidation(value, field);
            if (customError) {
                errors.push(customError);
            }
        }

        // Update field state
        fieldInfo.errors = errors;
        fieldInfo.isValid = errors.length === 0;
        fieldInfo.lastValidated = new Date();

        // Show/hide error messages
        this.showFieldErrors(field, errors, isRealTime);

        // Update form validity
        this.updateFormValidity(formId);

        return fieldInfo.isValid;
    }

    /**
     * Get custom validation rules
     */
    getCustomValidation(field) {
        const customRules = {
            'event-name': (value) => {
                if (value.length < 3) return 'Event name must be at least 3 characters';
                if (value.length > 100) return 'Event name must be less than 100 characters';
                return null;
            },
            'description': (value) => {
                if (value.length < 10) return 'Description must be at least 10 characters';
                if (value.length > 1000) return 'Description must be less than 1000 characters';
                return null;
            },
            'contact-email': (value) => {
                if (value && !this.isValidEmail(value)) return 'Please enter a valid email address';
                return null;
            },
            'date': (value) => {
                if (value) {
                    const selectedDate = new Date(value);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    
                    if (selectedDate < today) {
                        return 'Event date cannot be in the past';
                    }
                }
                return null;
            }
        };

        return customRules[field.name] || customRules[field.id];
    }

    /**
     * Show field error messages
     */
    showFieldErrors(field, errors, isRealTime = false) {
        const fieldId = field.id || field.name;
        const errorId = `${fieldId}-error`;
        
        // Remove existing error message
        const existingError = document.getElementById(errorId);
        if (existingError) {
            existingError.remove();
        }

        // Remove error styling
        field.classList.remove('error', 'border-red-500');
        field.setAttribute('aria-invalid', 'false');

        if (errors.length > 0) {
            // Add error styling
            field.classList.add('error', 'border-red-500');
            field.setAttribute('aria-invalid', 'true');

            // Create error message element
            const errorElement = document.createElement('div');
            errorElement.id = errorId;
            errorElement.className = 'field-error';
            errorElement.setAttribute('role', 'alert');
            errorElement.innerHTML = `
                <i class="fas fa-exclamation-triangle text-red-500 mr-1"></i>
                ${errors[0]}
            `;

            // Add styles if not present
            if (!document.getElementById('field-error-styles')) {
                const style = document.createElement('style');
                style.id = 'field-error-styles';
                style.textContent = `
                    .field-error {
                        color: #dc2626;
                        font-size: 0.875rem;
                        margin-top: 0.25rem;
                        display: flex;
                        align-items: center;
                        animation: fadeIn 0.2s ease;
                    }
                    
                    @keyframes fadeIn {
                        from { opacity: 0; transform: translateY(-5px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                    
                    .field-error i {
                        font-size: 0.75rem;
                    }
                `;
                document.head.appendChild(style);
            }

            // Insert error message after field
            field.parentNode.insertBefore(errorElement, field.nextSibling);

            // Add shake animation for real-time validation
            if (isRealTime) {
                field.style.animation = 'shake 0.5s ease';
                setTimeout(() => {
                    field.style.animation = '';
                }, 500);
            }
        }
    }

    /**
     * Update form validity
     */
    updateFormValidity(formId) {
        const formInfo = this.forms.get(formId);
        if (!formInfo) return;

        const allFieldsValid = Array.from(formInfo.fields.values()).every(field => field.isValid);
        formInfo.isValid = allFieldsValid;

        // Update submit button state
        const submitButton = formInfo.element.querySelector('button[type="submit"]');
        if (submitButton) {
            submitButton.disabled = !allFieldsValid;
            submitButton.classList.toggle('opacity-50', !allFieldsValid);
        }
    }

    /**
     * Setup form submission with validation
     */
    setupFormSubmission(form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            
            // Validate all fields
            const allValid = this.validateAllFields(form.id);
            
            if (allValid) {
                this.handleFormSubmission(form);
            } else {
                // Focus first invalid field
                const firstInvalidField = this.getFirstInvalidField(form.id);
                if (firstInvalidField) {
                    firstInvalidField.focus();
                }
            }
        });
    }

    /**
     * Validate all fields in a form
     */
    validateAllFields(formId) {
        const formInfo = this.forms.get(formId);
        if (!formInfo) return false;

        let allValid = true;
        
        formInfo.fields.forEach((fieldInfo, fieldId) => {
            const isValid = this.validateField(fieldInfo.element, formId);
            if (!isValid) allValid = false;
        });

        return allValid;
    }

    /**
     * Get first invalid field
     */
    getFirstInvalidField(formId) {
        const formInfo = this.forms.get(formId);
        if (!formInfo) return null;

        for (const [fieldId, fieldInfo] of formInfo.fields) {
            if (!fieldInfo.isValid) {
                return fieldInfo.element;
            }
        }
        return null;
    }

    /**
     * Handle form submission
     */
    handleFormSubmission(form) {
        // This will be handled by the existing form submission logic
        // We just ensure validation is complete
        ErrorHandler.log('Form validation passed, proceeding with submission');
    }

    /**
     * Setup real-time validation
     */
    setupRealTimeValidation() {
        // Debounced validation for better performance
        let validationTimeout;
        
        document.addEventListener('input', (e) => {
            if (e.target.matches('input, textarea, select')) {
                clearTimeout(validationTimeout);
                validationTimeout = setTimeout(() => {
                    const form = e.target.closest('form');
                    if (form && this.forms.has(form.id)) {
                        this.validateField(e.target, form.id, true);
                    }
                }, 300);
            }
        });
    }

    /**
     * Setup auto-save functionality
     */
    setupAutoSave() {
        const forms = document.querySelectorAll('form');
        forms.forEach(form => {
            if (form.id === 'event-submission-form') {
                this.setupAutoSaveForForm(form);
            }
        });
    }

    /**
     * Setup auto-save for specific form
     */
    setupAutoSaveForForm(form) {
        const formId = form.id;
        const storageKey = `form_draft_${formId}`;
        
        // Load saved draft on page load
        this.loadDraft(form, storageKey);
        
        // Auto-save every 30 seconds
        const autoSaveInterval = setInterval(() => {
            this.saveDraft(form, storageKey);
        }, 30000);
        
        this.autoSaveIntervals.set(formId, autoSaveInterval);
        
        // Save on form reset
        form.addEventListener('reset', () => {
            localStorage.removeItem(storageKey);
            ErrorHandler.log('Form draft cleared');
        });
    }

    /**
     * Save form draft
     */
    saveDraft(form, storageKey) {
        const formData = new FormData(form);
        const draft = {};
        
        for (let [key, value] of formData.entries()) {
            draft[key] = value;
        }
        
        try {
            localStorage.setItem(storageKey, JSON.stringify(draft));
            ErrorHandler.log('Form draft saved');
        } catch (error) {
            ErrorHandler.warn('Failed to save form draft:', error);
        }
    }

    /**
     * Load form draft
     */
    loadDraft(form, storageKey) {
        try {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                const draft = JSON.parse(saved);
                
                // Restore form values
                Object.keys(draft).forEach(key => {
                    const field = form.querySelector(`[name="${key}"]`);
                    if (field) {
                        field.value = draft[key];
                        // Trigger validation
                        this.validateField(field, form.id);
                    }
                });
                
                ErrorHandler.log('Form draft loaded');
                
                // Show draft restored notification
                this.showDraftNotification();
            }
        } catch (error) {
            ErrorHandler.warn('Failed to load form draft:', error);
        }
    }

    /**
     * Show draft restored notification
     */
    showDraftNotification() {
        const notification = document.createElement('div');
        notification.className = 'draft-notification';
        notification.innerHTML = `
            <div class="draft-content">
                <i class="fas fa-save"></i>
                <span>Draft restored from previous session</span>
                <button class="draft-close" onclick="this.parentElement.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        // Add styles if not present
        if (!document.getElementById('draft-notification-styles')) {
            const style = document.createElement('style');
            style.id = 'draft-notification-styles';
            style.textContent = `
                .draft-notification {
                    position: fixed;
                    top: 20px;
                    left: 20px;
                    background: #059669;
                    color: white;
                    padding: 1rem;
                    border-radius: 0.5rem;
                    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
                    z-index: 10000;
                    max-width: 400px;
                    animation: slideInLeft 0.3s ease;
                }
                
                .draft-content {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                
                .draft-close {
                    background: none;
                    border: none;
                    color: white;
                    cursor: pointer;
                    padding: 0.25rem;
                    margin-left: auto;
                }
                
                @keyframes slideInLeft {
                    from { transform: translateX(-100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(notification);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    /**
     * Validation helper methods
     */
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    isValidUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Cleanup on page unload
     */
    cleanup() {
        this.autoSaveIntervals.forEach(interval => {
            clearInterval(interval);
        });
    }
}

// Initialize form validation when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.formValidationManager = new FormValidationManager();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.formValidationManager) {
        window.formValidationManager.cleanup();
    }
});

// Export for use in other modules
window.FormValidationManager = FormValidationManager;
