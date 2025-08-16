// Streamlined Promoter Submission with Firebase Recurring Events Integration
document.addEventListener('DOMContentLoaded', () => {
    console.log('Streamlined promoter submission form loaded');
    
    // Initialize form elements
    const form = document.getElementById('event-submission-form');
    const isRecurringCheckbox = document.getElementById('is-recurring');
    const recurringConfig = document.getElementById('recurring-config');
    const venueSearch = document.getElementById('venue-search');
    const venueResults = document.getElementById('venue-results');
    const venueIdInput = document.getElementById('venue-id');
    const selectedVenueDetails = document.getElementById('selected-venue-details');
    const venueDetailsContent = document.getElementById('venue-details-content');
    const changeVenueBtn = document.getElementById('change-venue');
    const addNewVenueBtn = document.getElementById('add-new-venue');
    
    // Poster parser elements
    const uploadArea = document.getElementById('upload-area');
    const posterUpload = document.getElementById('poster-upload');
    const aiProcessing = document.getElementById('ai-processing');
    const extractedData = document.getElementById('extracted-data');
    const extractedFields = document.getElementById('extracted-fields');
    const useExtractedBtn = document.getElementById('use-extracted');
    const ignoreExtractedBtn = document.getElementById('ignore-extracted');
    
    let extractedEventData = null;
    
    // Initialize poster parser
    initializePosterParser();
    
    // Initialize recurring events functionality
    initializeRecurringEvents();
    
    // Initialize venue search
    initializeVenueSearch();
    
    // Initialize form submission
    initializeFormSubmission();
    
    function initializePosterParser() {
        // Handle file upload
        uploadArea.addEventListener('click', () => {
            posterUpload.click();
        });
        
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('border-purple-500');
        });
        
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('border-purple-500');
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('border-purple-500');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                posterUpload.files = files;
                handlePosterUpload(files[0]);
            }
        });
        
        posterUpload.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handlePosterUpload(e.target.files[0]);
            }
        });
        
        // Handle extracted data buttons
        useExtractedBtn.addEventListener('click', () => {
            if (extractedEventData) {
                applyExtractedData(extractedEventData);
                extractedData.classList.add('hidden');
            }
        });
        
        ignoreExtractedBtn.addEventListener('click', () => {
            extractedData.classList.add('hidden');
            extractedEventData = null;
        });
    }
    
    async function handlePosterUpload(file) {
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }
        
        // Show processing state
        aiProcessing.classList.remove('hidden');
        extractedData.classList.add('hidden');
        
        try {
            // Convert file to base64
            const base64 = await fileToBase64(file);
            console.log('File converted to base64, length:', base64.length);
            
            // Call AI analysis
            const response = await fetch('/.netlify/functions/analyze-poster', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: base64 })
            });
            
            console.log('AI analysis response status:', response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('AI analysis failed:', response.status, errorText);
                throw new Error(`AI analysis failed: ${response.status} ${response.statusText}`);
            }
            
            const result = await response.json();
            console.log('AI analysis result:', result);
            
            if (result.success && result.extractedData) {
                extractedEventData = result.extractedData;
                displayExtractedData(result.extractedData);
                extractedData.classList.remove('hidden');
            } else {
                console.log('No data extracted from poster:', result.error || 'Unknown error');
            }
            
        } catch (error) {
            console.error('Poster analysis error:', error);
            alert('Failed to analyze poster. Please fill in the details manually.');
        } finally {
            aiProcessing.classList.add('hidden');
        }
    }
    
    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
    
    function displayExtractedData(data) {
        const fields = [];
        
        if (data.eventName) fields.push(`<strong>Event Name:</strong> ${data.eventName}`);
        if (data.date) fields.push(`<strong>Date:</strong> ${data.date}`);
        if (data.time) fields.push(`<strong>Time:</strong> ${data.time}`);
        if (data.venue) fields.push(`<strong>Venue:</strong> ${data.venue}`);
        if (data.description) fields.push(`<strong>Description:</strong> ${data.description}`);
        if (data.price) fields.push(`<strong>Price:</strong> ${data.price}`);
        if (data.categories && data.categories.length > 0) {
            fields.push(`<strong>Categories:</strong> ${data.categories.join(', ')}`);
        }
        
        extractedFields.innerHTML = fields.map(field => `<div>${field}</div>`).join('');
    }
    
    function applyExtractedData(data) {
        if (data.eventName) {
            document.getElementById('event-name').value = data.eventName;
        }
        if (data.description) {
            document.getElementById('description').value = data.description;
        }
        if (data.date) {
            document.getElementById('date').value = data.date;
            // Update recurring start date if it's empty
            const recurringStartDate = document.getElementById('recurring-start-date');
            if (recurringStartDate && !recurringStartDate.value) {
                recurringStartDate.value = data.date;
            }
        }
        if (data.time) {
            document.getElementById('start-time').value = data.time;
        }
        if (data.venue) {
            // Try to find and auto-select the venue
            const matchedVenue = findMatchingVenue(data.venue);
            if (matchedVenue) {
                // Auto-select the venue
                selectVenue(matchedVenue.id, matchedVenue.name, matchedVenue.address);
            } else {
                // Fallback to search box if no match found
                venueSearch.value = data.venue;
                venueSearch.dispatchEvent(new Event('input'));
            }
        }
        if (data.categories && data.categories.length > 0) {
            const categorySelect = document.getElementById('category-select');
            const category = data.categories[0]; // Use first category
            if (categorySelect) {
                // Try to find matching category
                const option = Array.from(categorySelect.options).find(opt => 
                    opt.value.toLowerCase() === category.toLowerCase()
                );
                if (option) {
                    categorySelect.value = option.value;
                }
            }
        }
        
        // Update recurring preview if needed
        updateRecurringPreview();
    }
    
    function initializeRecurringEvents() {
        // Toggle recurring configuration visibility
        isRecurringCheckbox.addEventListener('change', () => {
            recurringConfig.classList.toggle('hidden', !isRecurringCheckbox.checked);
            if (isRecurringCheckbox.checked) {
                // Auto-fill recurring start date with main event date
                const mainEventDate = document.getElementById('date').value;
                const recurringStartDate = document.getElementById('recurring-start-date');
                if (mainEventDate && !recurringStartDate.value) {
                    recurringStartDate.value = mainEventDate;
                }
            }
            updateRecurringPreview();
        });
        
        // Update preview when pattern or dates change
        document.querySelectorAll('input[name="recurring-pattern"]').forEach(radio => {
            radio.addEventListener('change', updateRecurringPreview);
        });
        
        document.getElementById('recurring-start-date').addEventListener('change', updateRecurringPreview);
        document.getElementById('recurring-end-date').addEventListener('change', updateRecurringPreview);
        document.getElementById('max-instances').addEventListener('input', updateRecurringPreview);
        
        // Auto-update recurring start date when main event date changes
        document.getElementById('date').addEventListener('change', (e) => {
            if (isRecurringCheckbox.checked) {
                const recurringStartDate = document.getElementById('recurring-start-date');
                if (!recurringStartDate.value) {
                    recurringStartDate.value = e.target.value;
                    updateRecurringPreview();
                }
            }
        });
        
        // Set initial state
        updateRecurringPreview();
    }
    
    function updateRecurringPreview() {
        const previewDiv = document.getElementById('recurring-preview');
        
        if (!isRecurringCheckbox.checked) {
            previewDiv.textContent = 'Select a pattern and start date to see a preview of upcoming dates.';
            return;
        }
        
        const pattern = document.querySelector('input[name="recurring-pattern"]:checked');
        const startDate = document.getElementById('recurring-start-date').value;
        const endDate = document.getElementById('recurring-end-date').value;
        const maxInstances = parseInt(document.getElementById('max-instances').value) || 52;
        
        if (!pattern || !startDate) {
            previewDiv.textContent = 'Select a pattern and start date to see a preview of upcoming dates.';
            return;
        }
        
        try {
            const instances = calculateRecurringInstances({
                startDate,
                endDate,
                pattern: pattern.value,
                maxInstances
            });
            
            if (instances.length === 0) {
                previewDiv.textContent = 'No valid dates found for the selected pattern.';
                return;
            }
            
            const previewDates = instances.slice(0, 8).map(date => {
                const d = new Date(date);
                return d.toLocaleDateString('en-GB', { 
                    weekday: 'short', 
                    day: 'numeric', 
                    month: 'short' 
                });
            });
            
            let previewText = previewDates.join(', ');
            if (instances.length > 8) {
                previewText += ` and ${instances.length - 8} more...`;
            }
            
            previewDiv.innerHTML = `
                <div class="text-green-400 font-semibold mb-2">✓ ${instances.length} events will be created</div>
                <div class="text-sm">${previewText}</div>
            `;
            
        } catch (error) {
            console.error('Error calculating recurring instances:', error);
            previewDiv.textContent = 'Error calculating preview. Please check your settings.';
        }
    }
    
    function calculateRecurringInstances({ startDate, endDate, pattern, maxInstances }) {
        const start = new Date(startDate);
        const end = endDate ? new Date(endDate) : null;
        
        const instances = [];
        let current = new Date(start);
        let count = 0;
        
        while (count < maxInstances) {
            if (end && current > end) {
                break;
            }
            
            instances.push(new Date(current));
            count++;
            
            switch (pattern) {
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
    
    function initializeVenueSearch() {
        let searchTimeout;
        let venues = [];
        
        // Load venues on page load
        loadVenues();
        
        venueSearch.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            const query = e.target.value.trim();
            
            if (query.length < 2) {
                venueResults.classList.add('hidden');
                return;
            }
            
            searchTimeout = setTimeout(() => {
                searchVenues(query);
            }, 300);
        });
        
        async function loadVenues() {
            try {
                const response = await fetch('/.netlify/functions/get-venue-list');
                if (response.ok) {
                    venues = await response.json();
                }
            } catch (error) {
                console.error('Error loading venues:', error);
            }
        }
        
        function searchVenues(query) {
            const filtered = venues.filter(venue => 
                venue.name.toLowerCase().includes(query.toLowerCase()) ||
                venue.address.toLowerCase().includes(query.toLowerCase())
            ).slice(0, 5);
            
            if (filtered.length === 0) {
                venueResults.classList.add('hidden');
                return;
            }
            
            venueResults.innerHTML = filtered.map(venue => `
                <div class="venue-result p-3 bg-gray-800/50 rounded-lg cursor-pointer hover:bg-gray-700/50 transition-colors"
                     data-venue-id="${venue.id}" data-venue-name="${venue.name}" data-venue-address="${venue.address}">
                    <div class="font-semibold">${venue.name}</div>
                    <div class="text-sm text-gray-400">${venue.address}</div>
                </div>
            `).join('');
            
            venueResults.classList.remove('hidden');
            
            // Add click handlers
            venueResults.querySelectorAll('.venue-result').forEach(result => {
                result.addEventListener('click', () => {
                    selectVenue(
                        result.dataset.venueId,
                        result.dataset.venueName,
                        result.dataset.venueAddress
                    );
                });
            });
        }
        
        function findMatchingVenue(venueText) {
            if (!venues || venues.length === 0) return null;
            
            const searchText = venueText.toLowerCase();
            
            // First, try exact name match
            let match = venues.find(venue => 
                venue.name.toLowerCase() === searchText
            );
            
            if (match) return match;
            
            // Try partial name match (venue name contains search text)
            match = venues.find(venue => 
                venue.name.toLowerCase().includes(searchText) ||
                searchText.includes(venue.name.toLowerCase())
            );
            
            if (match) return match;
            
            // Try address match
            match = venues.find(venue => 
                venue.address && venue.address.toLowerCase().includes(searchText)
            );
            
            if (match) return match;
            
            // Try fuzzy matching for common venue names
            const commonVenueNames = {
                'victoria': 'The Victoria',
                'nightingale': 'The Nightingale Club',
                'eden': 'Eden Bar',
                'missing': 'Missing Bar',
                'sidewalk': 'Sidewalk',
                'glee': 'The Glee Club',
                'fox': 'The Fox',
                'hub': 'The Hub',
                'fountain': 'The Fountain inn',
                'village': 'The Village Inn'
            };
            
            for (const [key, venueName] of Object.entries(commonVenueNames)) {
                if (searchText.includes(key)) {
                    match = venues.find(venue => venue.name === venueName);
                    if (match) return match;
                }
            }
            
            return null;
        }
        
        function selectVenue(id, name, address) {
            venueIdInput.value = id;
            venueSearch.value = name;
            venueResults.classList.add('hidden');
            
            venueDetailsContent.innerHTML = `
                <div class="font-semibold">${name}</div>
                <div class="text-sm text-gray-400">${address}</div>
            `;
            selectedVenueDetails.classList.remove('hidden');
        }
        
        changeVenueBtn.addEventListener('click', () => {
            venueIdInput.value = '';
            venueSearch.value = '';
            selectedVenueDetails.classList.add('hidden');
            venueSearch.focus();
        });
        
        addNewVenueBtn.addEventListener('click', () => {
            // For now, just show a message - venue creation can be added later
            alert('Venue creation feature coming soon! Please select an existing venue for now.');
        });
    }
    
    function initializeFormSubmission() {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const submitButton = form.querySelector('button[type="submit"]');
            const submitText = document.getElementById('submit-text');
            const submitLoader = document.getElementById('submit-loader');
            
            // Show loading state
            submitButton.disabled = true;
            submitText.classList.add('hidden');
            submitLoader.classList.remove('hidden');
            
            try {
                // Validate form
                const validation = validateForm();
                if (!validation.isValid) {
                    throw new Error(validation.errors.join(', '));
                }
                
                // Prepare form data
                const formData = new FormData();
                
                // Basic event data
                formData.append('event-name', document.getElementById('event-name').value.trim());
                formData.append('description', document.getElementById('description').value.trim());
                formData.append('date', document.getElementById('date').value);
                formData.append('start-time', document.getElementById('start-time').value);
                formData.append('category-select', document.getElementById('category-select').value);
                formData.append('link', document.getElementById('link').value.trim());
                formData.append('contact-name', document.getElementById('contact-name').value.trim());
                formData.append('contact-email', document.getElementById('contact-email').value.trim());
                
                // Venue data
                if (venueIdInput.value) {
                    formData.append('venue-id', venueIdInput.value);
                }
                
                // Recurring event data
                if (isRecurringCheckbox.checked) {
                    formData.append('is-recurring', 'true');
                    formData.append('recurring-pattern', document.querySelector('input[name="recurring-pattern"]:checked').value);
                    
                    // Use main event date as recurring start date if not specified
                    let recurringStartDate = document.getElementById('recurring-start-date').value;
                    if (!recurringStartDate) {
                        recurringStartDate = document.getElementById('date').value;
                    }
                    formData.append('recurring-start-date', recurringStartDate);
                    
                    const endDate = document.getElementById('recurring-end-date').value;
                    if (endDate) {
                        formData.append('recurring-end-date', endDate);
                    }
                    
                    const maxInstances = document.getElementById('max-instances').value;
                    if (maxInstances) {
                        formData.append('max-instances', maxInstances);
                    }
                    
                    const customDesc = document.getElementById('custom-recurrence-desc').value;
                    if (customDesc) {
                        formData.append('custom-recurrence-desc', customDesc);
                    }
                }
                
                // Image file
                const imageFile = document.getElementById('promo-image').files[0];
                if (imageFile) {
                    formData.append('promo-image', imageFile);
                }
                
                // Submit to Firebase
                const response = await fetch('/.netlify/functions/event-submission-firestore-only', {
                    method: 'POST',
                    body: formData
                });
                
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ message: 'Server error' }));
                    throw new Error(errorData.message || `HTTP ${response.status}`);
                }
                
                const result = await response.json();
                
                if (result.success) {
                    showSuccess('Event submitted successfully! We\'ll review and approve it soon.');
                    form.reset();
                    resetForm();
                } else {
                    throw new Error(result.message || 'Submission failed');
                }
                
            } catch (error) {
                console.error('Form submission error:', error);
                showError(`Submission failed: ${error.message}`);
            } finally {
                // Reset button state
                submitButton.disabled = false;
                submitText.classList.remove('hidden');
                submitLoader.classList.add('hidden');
            }
        });
    }
    
    function validateForm() {
        const errors = [];
        
        // Required fields
        const requiredFields = [
            { id: 'event-name', label: 'Event name' },
            { id: 'description', label: 'Description' },
            { id: 'date', label: 'Event date' },
            { id: 'start-time', label: 'Start time' },
            { id: 'category-select', label: 'Category' },
            { id: 'contact-name', label: 'Contact name' },
            { id: 'contact-email', label: 'Contact email' }
        ];
        
        requiredFields.forEach(field => {
            const element = document.getElementById(field.id);
            if (!element.value.trim()) {
                errors.push(`${field.label} is required`);
                element.classList.add('border-red-500');
            } else {
                element.classList.remove('border-red-500');
            }
        });
        
        // Email validation
        const email = document.getElementById('contact-email').value;
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            errors.push('Please enter a valid email address');
        }
        
        // Date validation
        const eventDate = new Date(document.getElementById('date').value);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (eventDate < today) {
            errors.push('Event date cannot be in the past');
        }
        
        // Venue validation
        if (!venueIdInput.value) {
            errors.push('Please select a venue');
        }
        
        // Recurring event validation
        if (isRecurringCheckbox.checked) {
            const pattern = document.querySelector('input[name="recurring-pattern"]:checked');
            const startDate = document.getElementById('recurring-start-date').value;
            
            if (!pattern) {
                errors.push('Please select a recurrence pattern');
            }
            
            if (!startDate) {
                errors.push('Please select a recurrence start date');
            }
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }
    
    function showSuccess(message) {
        // Create success message
        const successDiv = document.createElement('div');
        successDiv.className = 'fixed top-4 right-4 bg-green-900 border border-green-600 text-green-200 px-6 py-4 rounded-lg shadow-lg z-50';
        successDiv.innerHTML = `
            <div class="flex items-center">
                <i class="fas fa-check-circle mr-3"></i>
                <span>${message}</span>
            </div>
        `;
        
        document.body.appendChild(successDiv);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (successDiv.parentNode) {
                successDiv.remove();
            }
        }, 5000);
    }
    
    function showError(message) {
        // Create error message
        const errorDiv = document.createElement('div');
        errorDiv.className = 'fixed top-4 right-4 bg-red-900 border border-red-600 text-red-200 px-6 py-4 rounded-lg shadow-lg z-50';
        errorDiv.innerHTML = `
            <div class="flex items-center">
                <i class="fas fa-exclamation-triangle mr-3"></i>
                <span>${message}</span>
            </div>
        `;
        
        document.body.appendChild(errorDiv);
        
        // Auto-remove after 8 seconds
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.remove();
            }
        }, 8000);
    }
    
    function resetForm() {
        // Reset recurring events
        isRecurringCheckbox.checked = false;
        recurringConfig.classList.add('hidden');
        
        // Reset venue selection
        venueIdInput.value = '';
        venueSearch.value = '';
        selectedVenueDetails.classList.add('hidden');
        venueResults.classList.add('hidden');
        
        // Update preview
        updateRecurringPreview();
    }
});