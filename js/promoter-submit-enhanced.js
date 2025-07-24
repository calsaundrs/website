// Enhanced Promoter Submission with EventStore Integration
document.addEventListener('DOMContentLoaded', () => {
    // Initialize EventStore
    let eventStore;
    let venues = [];
    let categories = [];

    // DOM Elements
    const form = document.getElementById('event-form');
    const posterUpload = document.getElementById('poster-upload');
    const uploadArea = document.getElementById('upload-area');
    const removePosterBtn = document.getElementById('remove-poster');
    const posterPreview = document.getElementById('poster-preview');
    const venueSelect = document.getElementById('venue-select');
    const categorySelect = document.getElementById('category-select');
    const recurrenceRadios = document.querySelectorAll('input[name="recurrence"]');
    const weeklyOptions = document.getElementById('weekly-options');
    const monthlyOptions = document.getElementById('monthly-options');
    const submitBtn = document.getElementById('submit-btn');
    const loadingSpinner = document.getElementById('loading-spinner');
    const successMessage = document.getElementById('success-message');
    const errorMessage = document.getElementById('error-message');

    // Initialize the application
    async function initialize() {
        try {
            // Initialize EventStore
            eventStore = new EventStore();
            
            // Load venues and categories
            await loadVenuesAndCategories();
            
            // Setup event listeners
            setupEventListeners();
            
            // Setup form validation
            setupFormValidation();
            
        } catch (error) {
            console.error('Error initializing promoter submission:', error);
            showError('Failed to initialize form. Please refresh the page.');
        }
    }

    // Load venues and categories from EventStore
    async function loadVenuesAndCategories() {
        try {
            // Load venues
            venues = await eventStore.api.getVenues();
            populateVenueSelect(venues);
            
            // Load categories from current events
            const events = await eventStore.api.getEvents({ limit: 1000 });
            categories = [...new Set(events.flatMap(event => event.category))].filter(Boolean).sort();
            populateCategorySelect(categories);
            
        } catch (error) {
            console.error('Error loading venues and categories:', error);
            // Fallback to default options
            populateVenueSelect([]);
            populateCategorySelect([]);
        }
    }

    // Populate venue select
    function populateVenueSelect(venues) {
        venueSelect.innerHTML = '<option value="">Select a venue</option>';
        
        if (venues.length === 0) {
            venueSelect.innerHTML += '<option value="">No venues available</option>';
            return;
        }
        
        venues.forEach(venue => {
            const option = document.createElement('option');
            option.value = venue.id;
            option.textContent = venue.name;
            venueSelect.appendChild(option);
        });
    }

    // Populate category select
    function populateCategorySelect(categories) {
        categorySelect.innerHTML = '<option value="">Select a category</option>';
        
        if (categories.length === 0) {
            categorySelect.innerHTML += '<option value="Other">Other</option>';
            return;
        }
        
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            categorySelect.appendChild(option);
        });
    }

    // Setup event listeners
    function setupEventListeners() {
        // Poster upload
        uploadArea.addEventListener('click', () => posterUpload.click());
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('border-accent-color');
        });
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('border-accent-color');
        });
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('border-accent-color');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                handlePosterUpload(files[0]);
            }
        });

        posterUpload.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handlePosterUpload(e.target.files[0]);
            }
        });

        removePosterBtn.addEventListener('click', () => {
            posterUpload.value = '';
            posterPreview.style.display = 'none';
            removePosterBtn.style.display = 'none';
            uploadArea.style.display = 'flex';
        });

        // Recurrence options
        recurrenceRadios.forEach(radio => {
            radio.addEventListener('change', handleRecurrenceChange);
        });

        // Form submission
        form.addEventListener('submit', handleFormSubmit);
    }

    // Handle poster upload
    function handlePosterUpload(file) {
        if (!file.type.startsWith('image/')) {
            showError('Please select an image file.');
            return;
        }

        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            showError('Image file size must be less than 5MB.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            posterPreview.src = e.target.result;
            posterPreview.style.display = 'block';
            removePosterBtn.style.display = 'block';
            uploadArea.style.display = 'none';
        };
        reader.readAsDataURL(file);
    }

    // Handle recurrence change
    function handleRecurrenceChange(e) {
        const value = e.target.value;
        
        // Hide all options
        weeklyOptions.style.display = 'none';
        monthlyOptions.style.display = 'none';
        
        // Show relevant options
        if (value === 'weekly') {
            weeklyOptions.style.display = 'block';
        } else if (value === 'monthly') {
            monthlyOptions.style.display = 'block';
        }
    }

    // Setup form validation
    function setupFormValidation() {
        const requiredFields = form.querySelectorAll('[required]');
        
        requiredFields.forEach(field => {
            field.addEventListener('blur', validateField);
            field.addEventListener('input', clearFieldError);
        });
    }

    // Validate individual field
    function validateField(e) {
        const field = e.target;
        const value = field.value.trim();
        
        if (field.hasAttribute('required') && !value) {
            showFieldError(field, 'This field is required.');
            return false;
        }
        
        // Specific validations
        if (field.type === 'email' && value && !isValidEmail(value)) {
            showFieldError(field, 'Please enter a valid email address.');
            return false;
        }
        
        if (field.type === 'url' && value && !isValidUrl(value)) {
            showFieldError(field, 'Please enter a valid URL.');
            return false;
        }
        
        clearFieldError(field);
        return true;
    }

    // Show field error
    function showFieldError(field, message) {
        clearFieldError(field);
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'text-red-400 text-sm mt-1';
        errorDiv.textContent = message;
        errorDiv.id = `${field.id}-error`;
        
        field.parentNode.appendChild(errorDiv);
        field.classList.add('border-red-400');
    }

    // Clear field error
    function clearFieldError(field) {
        const errorDiv = field.parentNode.querySelector(`#${field.id}-error`);
        if (errorDiv) {
            errorDiv.remove();
        }
        field.classList.remove('border-red-400');
    }

    // Validation helpers
    function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    function isValidUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    // Handle form submission
    async function handleFormSubmit(e) {
        e.preventDefault();
        
        // Validate form
        if (!validateForm()) {
            return;
        }
        
        // Show loading state
        setLoadingState(true);
        hideMessages();
        
        try {
            // Prepare form data
            const formData = await prepareFormData();
            
            // Submit event
            const response = await submitEvent(formData);
            
            if (response.success) {
                showSuccess(response.message || 'Event submitted successfully!');
                form.reset();
                resetPosterUpload();
            } else {
                showError(response.message || 'Failed to submit event.');
            }
            
        } catch (error) {
            console.error('Error submitting event:', error);
            showError('An error occurred while submitting your event. Please try again.');
        } finally {
            setLoadingState(false);
        }
    }

    // Validate entire form
    function validateForm() {
        const requiredFields = form.querySelectorAll('[required]');
        let isValid = true;
        
        requiredFields.forEach(field => {
            if (!validateField({ target: field })) {
                isValid = false;
            }
        });
        
        return isValid;
    }

    // Prepare form data
    async function prepareFormData() {
        const formData = new FormData();
        
        // Basic event data
        const eventData = {
            name: form.querySelector('[name="event-name"]').value.trim(),
            date: form.querySelector('[name="event-date"]').value,
            time: form.querySelector('[name="start-time"]').value,
            venueId: venueSelect.value,
            description: form.querySelector('[name="description"]').value.trim(),
            link: form.querySelector('[name="link"]').value.trim(),
            categories: categorySelect.value ? [categorySelect.value] : []
        };
        
        // Handle recurrence
        const recurrenceType = form.querySelector('input[name="recurrence"]:checked').value;
        if (recurrenceType !== 'none') {
            eventData['recurring-info'] = JSON.stringify(getRecurrenceData());
        }
        
        // Add poster if uploaded
        if (posterUpload.files.length > 0) {
            formData.append('promo-image', posterUpload.files[0]);
        }
        
        // Add events data
        formData.append('events', JSON.stringify([eventData]));
        
        return formData;
    }

    // Get recurrence data
    function getRecurrenceData() {
        const recurrenceType = form.querySelector('input[name="recurrence"]:checked').value;
        
        if (recurrenceType === 'weekly') {
            const selectedDays = Array.from(form.querySelectorAll('input[name="weekly-days"]:checked'))
                .map(checkbox => parseInt(checkbox.value));
            return {
                type: 'weekly',
                days: selectedDays
            };
        } else if (recurrenceType === 'monthly') {
            const monthlyType = form.querySelector('input[name="monthly-type"]:checked').value;
            if (monthlyType === 'date') {
                return {
                    type: 'monthly',
                    monthlyType: 'date',
                    dayOfMonth: parseInt(form.querySelector('[name="day-of-month"]').value)
                };
            } else {
                return {
                    type: 'monthly',
                    monthlyType: 'day',
                    week: form.querySelector('[name="week-of-month"]').value,
                    dayOfWeek: parseInt(form.querySelector('[name="day-of-week"]').value)
                };
            }
        }
        
        return { type: 'none' };
    }

    // Submit event to server
    async function submitEvent(formData) {
        const response = await fetch('/.netlify/functions/create-approved-event-v2', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    }

    // UI State Management
    function setLoadingState(loading) {
        submitBtn.disabled = loading;
        if (loading) {
            loadingSpinner.style.display = 'inline-block';
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Submitting...';
        } else {
            loadingSpinner.style.display = 'none';
            submitBtn.innerHTML = '<i class="fas fa-paper-plane mr-2"></i>Submit Event';
        }
    }

    function showSuccess(message) {
        successMessage.textContent = message;
        successMessage.style.display = 'block';
        successMessage.scrollIntoView({ behavior: 'smooth' });
    }

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        errorMessage.scrollIntoView({ behavior: 'smooth' });
    }

    function hideMessages() {
        successMessage.style.display = 'none';
        errorMessage.style.display = 'none';
    }

    function resetPosterUpload() {
        posterUpload.value = '';
        posterPreview.style.display = 'none';
        removePosterBtn.style.display = 'none';
        uploadArea.style.display = 'flex';
    }

    // Initialize the application
    initialize();
});