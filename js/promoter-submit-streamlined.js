document.addEventListener('DOMContentLoaded', () => {
    console.log('Streamlined form loaded successfully!');
    
    // Form elements
    const form = document.getElementById('event-submission-form');
    const uploadArea = document.getElementById('upload-area');
    const posterUpload = document.getElementById('poster-upload');
    const posterPreview = document.getElementById('poster-preview');
    const posterFilename = document.getElementById('poster-filename');
    const removePosterBtn = document.getElementById('remove-poster');
    const aiProcessing = document.getElementById('ai-processing');
    const uploadNote = document.getElementById('upload-note');
    const extractedData = document.getElementById('extracted-data');
    const extractedFields = document.getElementById('extracted-fields');
    const useSelectedBtn = document.getElementById('use-selected');
    const ignoreExtractedBtn = document.getElementById('ignore-extracted');
    
    const venueSelect = document.getElementById('venue-select');
    const newVenueFields = document.getElementById('new-venue-fields');
    const newVenueName = document.getElementById('new-venue-name');
    const newVenueAddress = document.getElementById('new-venue-address');
    const newVenuePostcode = document.getElementById('new-venue-postcode');
    const newVenueWebsite = document.getElementById('new-venue-website');
    
    // Tooltip elements
    const uploadTipsToggle = document.getElementById('upload-tips-toggle');
    const uploadTips = document.getElementById('upload-tips');
    const recurrenceTipsToggle = document.getElementById('recurrence-tips-toggle');
    const recurrenceTips = document.getElementById('recurrence-tips');
    
    // State variables
    let extractedEventData = null;
    let isCreatingNewVenue = false;

    // Tooltip functionality
    function setupTooltip(toggleBtn, tooltip) {
        if (!toggleBtn || !tooltip) return;
        
        toggleBtn.addEventListener('mouseenter', () => {
            tooltip.classList.remove('opacity-0', 'pointer-events-none');
        });
        
        toggleBtn.addEventListener('mouseleave', () => {
            tooltip.classList.add('opacity-0', 'pointer-events-none');
        });
        
        // Touch support for mobile
        toggleBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            tooltip.classList.toggle('opacity-0');
            tooltip.classList.toggle('pointer-events-none');
        });
    }

    // Only setup tooltips if elements exist
    if (uploadTipsToggle && uploadTips) {
        setupTooltip(uploadTipsToggle, uploadTips);
    }
    if (recurrenceTipsToggle && recurrenceTips) {
        setupTooltip(recurrenceTipsToggle, recurrenceTips);
    }

    // Venue selection logic - only if venue select exists
    if (venueSelect) {
        venueSelect.addEventListener('change', () => {
            const selectedValue = venueSelect.value;
            
            if (selectedValue === 'new') {
                // Show new venue fields
                if (newVenueFields) newVenueFields.classList.remove('hidden');
                isCreatingNewVenue = true;
                
                // Make new venue fields required
                if (newVenueName) newVenueName.required = true;
                if (newVenueAddress) newVenueAddress.required = true;
                if (newVenuePostcode) newVenuePostcode.required = true;
            } else {
                // Hide new venue fields
                if (newVenueFields) newVenueFields.classList.add('hidden');
                isCreatingNewVenue = false;
                
                // Remove required from new venue fields
                if (newVenueName) newVenueName.required = false;
                if (newVenueAddress) newVenueAddress.required = false;
                if (newVenuePostcode) newVenuePostcode.required = false;
            }
        });
    }

    // Poster upload functionality - only if elements exist
    if (uploadArea && posterUpload) {
        uploadArea.addEventListener('click', () => posterUpload.click());
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('border-accent-color', 'dragover');
        });
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('border-accent-color', 'dragover');
        });
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('border-accent-color', 'dragover');
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
    }

    // Remove poster functionality
    if (removePosterBtn) {
        removePosterBtn.addEventListener('click', () => {
            if (posterUpload) posterUpload.value = '';
            if (posterPreview) posterPreview.classList.add('hidden');
            if (uploadArea) uploadArea.classList.remove('hidden');
            if (extractedData) extractedData.classList.add('hidden');
        });
    }

    // Poster Processing
    async function handlePosterUpload(file) {
        // Show poster preview
        if (posterFilename) posterFilename.textContent = file.name;
        if (posterPreview) posterPreview.classList.remove('hidden');
        if (uploadArea) uploadArea.classList.add('hidden');
        
        // Show upload success - poster will be uploaded with event submission
        showUploadSuccess();
        
        // Skip AI processing for now to avoid 500 errors
        // The poster will be uploaded directly with the event submission
    }

    function showExtractedData(data) {
        if (!extractedFields) return;
        extractedFields.innerHTML = '';
        
        // Create checkboxes for each extracted field
        const fields = [
            { key: 'eventName', label: 'Event Name', value: data.eventName },
            { key: 'eventDescription', label: 'Event Description', value: data.eventDescription },
            { key: 'eventDate', label: 'Event Date', value: data.eventDate },
            { key: 'eventTime', label: 'Event Time', value: data.eventTime },
            { key: 'eventCategory', label: 'Event Category', value: data.eventCategory },
            { key: 'eventPrice', label: 'Event Price', value: data.eventPrice },
            { key: 'venueName', label: 'Venue Name', value: data.venueName },
            { key: 'venueAddress', label: 'Venue Address', value: data.venueAddress }
        ];
        
        fields.forEach(field => {
            if (field.value && field.value !== 'null' && field.value !== null) {
                const fieldDiv = document.createElement('div');
                fieldDiv.className = 'flex items-center space-x-3 p-3 bg-gray-800/50 rounded-lg';
                
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.id = `extract-${field.key}`;
                checkbox.className = 'text-green-500 focus:ring-green-500';
                checkbox.checked = true;
                
                const label = document.createElement('label');
                label.htmlFor = `extract-${field.key}`;
                label.className = 'flex-1 text-sm';
                label.innerHTML = `
                    <span class="font-semibold text-green-300">${field.label}:</span>
                    <span class="text-green-200 ml-2">${field.value}</span>
                `;
                
                fieldDiv.appendChild(checkbox);
                fieldDiv.appendChild(label);
                extractedFields.appendChild(fieldDiv);
            }
        });
        
        if (extractedData) extractedData.classList.remove('hidden');
    }

    function showUploadSuccess() {
        if (uploadNote) uploadNote.classList.remove('hidden');
    }

    // Apply selected extracted data
    if (useSelectedBtn) {
        useSelectedBtn.addEventListener('click', () => {
            if (!extractedEventData) return;
            
            // Apply only checked fields
            const checkedFields = extractedFields ? extractedFields.querySelectorAll('input[type="checkbox"]:checked') : null;
            if (!checkedFields) return;

            checkedFields.forEach(checkbox => {
                const fieldKey = checkbox.id.replace('extract-', '');
                const fieldValue = extractedEventData[fieldKey];
                
                if (fieldValue && fieldValue !== 'null' && fieldValue !== null) {
                    // Map extracted field names to form field names
                    let targetFieldId;
                    switch (fieldKey) {
                        case 'eventName':
                            targetFieldId = 'event-name';
                            break;
                        case 'eventDescription':
                            targetFieldId = 'description';
                            break;
                        case 'eventDate':
                            targetFieldId = 'date';
                            break;
                        case 'eventTime':
                            targetFieldId = 'start-time';
                            break;
                        case 'eventCategory':
                            targetFieldId = 'category-select';
                            break;
                        case 'venueName':
                            // Try to match venue name to venue dropdown
                            const venueSelect = document.getElementById('venue-select');
                            const extractedVenue = fieldValue.toLowerCase();
                            
                            if (venueSelect) {
                                for (let i = 0; i < venueSelect.options.length; i++) {
                                    const option = venueSelect.options[i];
                                    if (option.text.toLowerCase().includes(extractedVenue) || 
                                        extractedVenue.includes(option.text.toLowerCase())) {
                                        venueSelect.selectedIndex = i;
                                        break;
                                    }
                                }
                            }
                            return; // Skip the general field assignment
                        default:
                            targetFieldId = fieldKey.replace('event', 'event-').toLowerCase();
                    }
                    
                    const targetField = document.getElementById(targetFieldId);
                    if (targetField) {
                        targetField.value = fieldValue;
                    }
                }
            });
            
            if (extractedData) extractedData.classList.add('hidden');
        });
    }

    if (ignoreExtractedBtn) {
        ignoreExtractedBtn.addEventListener('click', () => {
            if (extractedData) extractedData.classList.add('hidden');
        });
    }

    // Load venues
    async function loadVenues() {
        try {
            const response = await fetch('/.netlify/functions/get-venue-list');
            const venues = await response.json();
            
            if (venueSelect) {
                venueSelect.innerHTML = '<option value="">Select an existing venue...</option>';
                
                venues.forEach(venue => {
                    const option = document.createElement('option');
                    option.value = venue.id;
                    option.textContent = venue.name;
                    venueSelect.appendChild(option);
                });
                
                // Add "Create New Venue" option
                const newVenueOption = document.createElement('option');
                newVenueOption.value = 'new';
                newVenueOption.textContent = '➕ Create New Venue';
                venueSelect.appendChild(newVenueOption);
            }
            
        } catch (error) {
            console.error('Error fetching venues:', error);
            // Fallback to some common venues for testing
            const fallbackVenues = [
                'The Nightingale Club',
                'The Village Inn',
                'The Old Joint Stock Pub & Theatre',
                'Glamorous',
                'The Sunflower Lounge',
                'The Actress & Bishop',
                'The Flapper',
                'The Victoria',
                'The Rainbow',
                'The Missing Bar',
                'The Custard Factory',
                'The Hare & Hounds',
                'The O2 Academy',
                'The Institute',
                'The Asylum'
            ];
            
            if (venueSelect) {
                venueSelect.innerHTML = '<option value="">Select an existing venue...</option>';
                fallbackVenues.forEach(venue => {
                    const option = document.createElement('option');
                    option.value = venue;
                    option.textContent = venue;
                    venueSelect.appendChild(option);
                });
                
                // Add "Create New Venue" option
                const newVenueOption = document.createElement('option');
                newVenueOption.value = 'new';
                newVenueOption.textContent = '➕ Create New Venue';
                venueSelect.appendChild(newVenueOption);
            }
        }
    }

    // Form submission
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Clear previous error states
            document.querySelectorAll('.border-red-500').forEach(field => {
                field.classList.remove('border-red-500');
            });
            
            // Validation
            const errors = [];
            
            const eventName = document.getElementById('event-name').value.trim();
            const eventDescription = document.getElementById('description').value.trim();
            const eventDate = document.getElementById('date').value;
            const eventTime = document.getElementById('start-time').value;
            const eventCategory = document.getElementById('category-select').value;
            const contactName = document.getElementById('contact-name').value.trim();
            const contactEmail = document.getElementById('contact-email').value.trim();
            
            if (!eventName) {
                errors.push('Event name is required.');
                document.getElementById('event-name').classList.add('border-red-500');
            }
            
            if (!eventDescription) {
                errors.push('Event description is required.');
                document.getElementById('description').classList.add('border-red-500');
            }
            
            if (!eventDate) {
                errors.push('Event date is required.');
                document.getElementById('date').classList.add('border-red-500');
            }
            
            if (!eventTime) {
                errors.push('Event time is required.');
                document.getElementById('start-time').classList.add('border-red-500');
            }
            
            if (!eventCategory) {
                errors.push('Event category is required.');
                document.getElementById('category-select').classList.add('border-red-500');
            }
            
            if (!contactName) {
                errors.push('Contact name is required.');
                document.getElementById('contact-name').classList.add('border-red-500');
            }
            
            if (!contactEmail) {
                errors.push('Contact email is required.');
                document.getElementById('contact-email').classList.add('border-red-500');
            }
            
            // Check venue selection (support both old select and new search system)
            const venueId = document.getElementById('venue-id');
            const venueSearch = document.getElementById('venue-search');
            const venueSelect = document.getElementById('venue-select');
            
            // Check if venue is selected (either through search or select)
            const hasVenueSelected = (venueId && venueId.value && venueId.value !== '') || (venueSelect && venueSelect.value && venueSelect.value !== '');
            
            if (!hasVenueSelected) {
                errors.push('Please select a venue.');
                if (venueSearch) venueSearch.classList.add('border-red-500');
                if (venueSelect) venueSelect.classList.add('border-red-500');
            }
            
            // Validate new venue fields if creating new venue
            if (isCreatingNewVenue) {
                if (!newVenueName || !newVenueName.value.trim()) {
                    errors.push('New venue name is required.');
                    if (newVenueName) newVenueName.classList.add('border-red-500');
                }
                if (!newVenueAddress || !newVenueAddress.value.trim()) {
                    errors.push('New venue address is required.');
                    if (newVenueAddress) newVenueAddress.classList.add('border-red-500');
                }
                if (!newVenuePostcode || !newVenuePostcode.value.trim()) {
                    errors.push('New venue postcode is required.');
                    if (newVenuePostcode) newVenuePostcode.classList.add('border-red-500');
                }
            }
            
            // Show validation errors
            if (errors.length > 0) {
                alert('Please fix the following issues:\n' + errors.join('\n'));
                return;
            }
            
            // Submit form
            try {
                // Get venue ID from the hidden input (new system) or select (old system)
                const venueIdInput = document.getElementById('venue-id');
                let finalVenueId = venueIdInput ? venueIdInput.value : (venueSelect ? venueSelect.value : '');
                
                // If creating a new venue, create it first
                if (finalVenueId === 'new' || isCreatingNewVenue) {
                    const venueParams = new URLSearchParams();
                    if (newVenueName) venueParams.append('venue-name', newVenueName.value.trim());
                    if (newVenueAddress) venueParams.append('address', newVenueAddress.value.trim());
                    if (contactEmail) venueParams.append('contact-email', contactEmail);
                    if (newVenueWebsite) venueParams.append('website', newVenueWebsite.value.trim());
                    venueParams.append('description', `Venue created during event submission for: ${eventName}`);
                    
                    const venueResponse = await fetch('/.netlify/functions/venue-submission-firestore-simple', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: venueParams.toString()
                    });
                    
                    if (!venueResponse.ok) {
                        throw new Error(`Venue creation failed: ${venueResponse.status}`);
                    }
                    
                    // Parse response JSON and use returned ID when available
                    const createdVenue = await venueResponse.json().catch(() => null);
                    if (createdVenue && (createdVenue.firestoreId || createdVenue.id)) {
                        finalVenueId = createdVenue.firestoreId || createdVenue.id;
                    } else {
                        // Fallback: fetch list and match by name
                        const venuesResponse = await fetch('/.netlify/functions/get-venue-list');
                        const venues = await venuesResponse.json();
                        const newVenue = Array.isArray(venues) ? venues.find(v => v.name === newVenueName.value.trim()) : null;
                        if (newVenue) {
                            finalVenueId = newVenue.id;
                        } else {
                            throw new Error('New venue was created but could not be found');
                        }
                    }
                }
                
                // Now submit the event with the venue ID
                const eventFormData = new FormData(form);
                
                // Add poster if uploaded
                if (posterUpload && posterUpload.files.length > 0) {
                    eventFormData.append('image', posterUpload.files[0]);
                }
                
                // Add the venue ID
                eventFormData.append('venueId', finalVenueId);
                
                const response = await fetch('/.netlify/functions/event-submission-firestore-only', {
                    method: 'POST',
                    body: eventFormData
                });
                
                const contentType = response.headers.get('content-type') || '';
                let result;
                if (contentType.includes('application/json')) {
                    result = await response.json();
                } else {
                    const text = await response.text();
                    throw new Error(`Unexpected response (expected JSON). Status ${response.status}. Body: ${text.slice(0, 200)}...`);
                }
                
                if (!response.ok || result.success === false) {
                    const message = (result && (result.error || result.message)) || `HTTP error! status: ${response.status}`;
                    throw new Error(message);
                }
                
                if (result.success) {
                    let successMessage = 'Event submitted successfully! We\'ll review it within 24-48 hours.';
                    
                    // Add AI extraction feedback if available
                    if (result.aiExtraction && result.aiExtraction.success) {
                        const extractedCount = result.aiExtraction.extractedFields.length;
                        const confidence = result.aiExtraction.confidence;
                        successMessage += `\n\n🤖 AI extracted ${extractedCount} fields from your poster (confidence: ${confidence}).`;
                    }
                    
                    alert(successMessage);
                    form.reset();
                    if (posterPreview) posterPreview.classList.add('hidden');
                    if (uploadArea) uploadArea.classList.remove('hidden');
                    if (extractedData) extractedData.classList.add('hidden');
                    if (newVenueFields) newVenueFields.classList.add('hidden');
                } else {
                    alert('Error submitting event: ' + (result.error || 'Unknown error'));
                }
            } catch (error) {
                console.error('Error submitting form:', error);
                alert('Error submitting event. Please try again.');
            }
        });
    }

    // Initialize
    loadVenues();
});