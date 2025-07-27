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

    setupTooltip(uploadTipsToggle, uploadTips);
    setupTooltip(recurrenceTipsToggle, recurrenceTips);

    // Venue selection logic
    venueSelect.addEventListener('change', () => {
        const selectedValue = venueSelect.value;
        
        if (selectedValue === 'new') {
            // Show new venue fields
            newVenueFields.classList.remove('hidden');
            isCreatingNewVenue = true;
            
            // Make new venue fields required
            newVenueName.required = true;
            newVenueAddress.required = true;
            newVenuePostcode.required = true;
        } else {
            // Hide new venue fields
            newVenueFields.classList.add('hidden');
            isCreatingNewVenue = false;
            
            // Remove required from new venue fields
            newVenueName.required = false;
            newVenueAddress.required = false;
            newVenuePostcode.required = false;
        }
    });

    // Poster upload functionality
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

    // Remove poster functionality
    if (removePosterBtn) {
        removePosterBtn.addEventListener('click', () => {
            posterUpload.value = '';
            posterPreview.classList.add('hidden');
            uploadArea.classList.remove('hidden');
            extractedData.classList.add('hidden');
        });
    }

    // Poster Processing
    async function handlePosterUpload(file) {
        // Show poster preview
        posterFilename.textContent = file.name;
        posterPreview.classList.remove('hidden');
        uploadArea.classList.add('hidden');
        
        // Show processing status
        aiProcessing.classList.remove('hidden');
        
        // Create FormData for upload
        const formData = new FormData();
        formData.append('poster', file);
        
        try {
            const response = await fetch('/.netlify/functions/process-poster', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success && result.data) {
                extractedEventData = result.data;
                showExtractedData(result.data);
            } else {
                showUploadSuccess();
            }
        } catch (error) {
            console.error('Error processing poster:', error);
            showUploadSuccess();
        } finally {
            aiProcessing.classList.add('hidden');
        }
    }

    function showExtractedData(data) {
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
        
        extractedData.classList.remove('hidden');
    }

    function showUploadSuccess() {
        uploadNote.classList.remove('hidden');
    }

    // Apply selected extracted data
    if (useSelectedBtn) {
        useSelectedBtn.addEventListener('click', () => {
            if (!extractedEventData) return;
            
            // Apply only checked fields
            const checkedFields = extractedFields.querySelectorAll('input[type="checkbox"]:checked');
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
                            
                            for (let i = 0; i < venueSelect.options.length; i++) {
                                const option = venueSelect.options[i];
                                if (option.text.toLowerCase().includes(extractedVenue) || 
                                    extractedVenue.includes(option.text.toLowerCase())) {
                                    venueSelect.selectedIndex = i;
                                    break;
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
            
            extractedData.classList.add('hidden');
        });
    }

    if (ignoreExtractedBtn) {
        ignoreExtractedBtn.addEventListener('click', () => {
            extractedData.classList.add('hidden');
        });
    }

    // Load venues
    async function loadVenues() {
        try {
            const response = await fetch('/.netlify/functions/get-venue-list');
            const venues = await response.json();
            
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

    // Form submission
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
        
        if (!venueSelect.value) {
            errors.push('Please select a venue.');
            venueSelect.classList.add('border-red-500');
        }
        
        // Validate new venue fields if creating new venue
        if (isCreatingNewVenue) {
            if (!newVenueName.value.trim()) {
                errors.push('New venue name is required.');
                newVenueName.classList.add('border-red-500');
            }
            if (!newVenueAddress.value.trim()) {
                errors.push('New venue address is required.');
                newVenueAddress.classList.add('border-red-500');
            }
            if (!newVenuePostcode.value.trim()) {
                errors.push('New venue postcode is required.');
                newVenuePostcode.classList.add('border-red-500');
            }
        }
        
        // Show validation errors
        if (errors.length > 0) {
            alert('Please fix the following issues:\n' + errors.join('\n'));
            return;
        }
        
        // Submit form
        try {
            let finalVenueId = venueSelect.value;
            
            // If creating a new venue, create it first
            if (isCreatingNewVenue) {
                const venueFormData = new FormData();
                venueFormData.append('venue-name', newVenueName.value.trim());
                venueFormData.append('address', newVenueAddress.value.trim());
                venueFormData.append('contact-email', contactEmail);
                venueFormData.append('website', newVenueWebsite.value.trim());
                venueFormData.append('description', `Venue created during event submission for: ${eventName}`);
                
                const venueResponse = await fetch('/.netlify/functions/venue-submission-firestore-simple', {
                    method: 'POST',
                    body: venueFormData
                });
                
                if (!venueResponse.ok) {
                    throw new Error(`Venue creation failed: ${venueResponse.status}`);
                }
                
                // For now, we'll need to find the venue by name to get its ID
                // This is a limitation - ideally the venue submission would return the venue ID
                const venuesResponse = await fetch('/.netlify/functions/get-venue-list');
                const venues = await venuesResponse.json();
                const newVenue = venues.find(v => v.name === newVenueName.value.trim());
                
                if (newVenue) {
                    finalVenueId = newVenue.id;
                } else {
                    throw new Error('New venue was created but could not be found');
                }
            }
            
            // Now submit the event with the venue ID
            const eventFormData = new FormData(form);
            
            // Add poster if uploaded
            if (posterUpload.files.length > 0) {
                eventFormData.append('promo-image', posterUpload.files[0]);
            }
            
            // Add the venue ID
            eventFormData.append('venueId', finalVenueId);
            
            const response = await fetch('/.netlify/functions/event-submission-firestore-simple', {
                method: 'POST',
                body: eventFormData
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                alert('Event submitted successfully! We\'ll review it within 24-48 hours.');
                form.reset();
                posterPreview.classList.add('hidden');
                uploadArea.classList.remove('hidden');
                extractedData.classList.add('hidden');
                newVenueFields.classList.add('hidden');
            } else {
                alert('Error submitting event: ' + (result.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error submitting form:', error);
            alert('Error submitting event. Please try again.');
        }
    });

    // Initialize
    loadVenues();
});