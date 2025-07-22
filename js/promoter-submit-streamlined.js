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
    const useExtractedBtn = document.getElementById('use-extracted');
    const ignoreExtractedBtn = document.getElementById('ignore-extracted');
    
    const venueSelect = document.getElementById('venue-select');
    const categorySelect = document.getElementById('category-select');
    const statusDiv = document.getElementById('form-status');
    const submitButton = document.getElementById('submit-button');
    const termsCheckbox = document.getElementById('terms-agree');
    
    // Recurrence elements
    const recurrenceOptions = document.getElementById('recurrence-options');
    const weeklyOptions = document.getElementById('weekly-options');
    const monthlyOptions = document.getElementById('monthly-options');
    const monthlyByDateOptions = document.getElementById('monthly-by-date-options');
    const monthlyByDayOptions = document.getElementById('monthly-by-day-options');
    const datesPreviewSection = document.getElementById('dates-preview-section');
    const datesPreview = document.getElementById('dates-preview');
    const exceptionDatesList = document.getElementById('exception-dates-list');
    const exceptionDateInput = document.getElementById('exception-date-input');
    const addExceptionBtn = document.getElementById('add-exception-btn');
    const recurringInfoHidden = document.getElementById('recurring-info-hidden');
    
    // State variables
    let extractedEventData = null;
    let exceptionDates = [];
    let generatedDates = [];

    // Terms checkbox handler
    termsCheckbox.addEventListener('change', () => {
        submitButton.disabled = !termsCheckbox.checked;
    });

    // Description character counter
    const descriptionTextarea = document.getElementById('description');
    const descriptionCount = document.getElementById('description-count');
    
    if (descriptionTextarea && descriptionCount) {
        descriptionTextarea.addEventListener('input', () => {
            const length = descriptionTextarea.value.length;
            descriptionCount.textContent = `${length}/500`;
            
            if (length > 450) {
                descriptionCount.classList.add('text-yellow-400');
            } else {
                descriptionCount.classList.remove('text-yellow-400');
            }
            
            if (length > 500) {
                descriptionCount.classList.add('text-red-400');
            } else {
                descriptionCount.classList.remove('text-red-400');
            }
        });
    }

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

    // Poster Processing
    async function handlePosterUpload(file) {
        // Show poster preview
        posterFilename.textContent = file.name;
        posterPreview.classList.remove('hidden');
        uploadArea.classList.add('hidden');
        
        // Show processing, hide other states
        aiProcessing.classList.remove('hidden');
        uploadNote.classList.add('hidden');
        extractedData.classList.add('hidden');
        
        try {
            // Create form data for processing
            const formData = new FormData();
            formData.append('poster', file);
            
            // Call processing function
            const response = await fetch('/.netlify/functions/process-poster', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error('Processing failed');
            }
            
            const result = await response.json();
            
            if (result.success && result.extractedData) {
                extractedEventData = result.extractedData;
                showExtractedData(result.extractedData);
            } else {
                // No data extracted, just show success message
                aiProcessing.classList.add('hidden');
                showUploadSuccess();
            }
        } catch (error) {
            console.error('Processing error:', error);
            aiProcessing.classList.add('hidden');
            showUploadSuccess();
        }
    }

    function showExtractedData(data) {
        aiProcessing.classList.add('hidden');
        uploadNote.classList.add('hidden');
        
        // Clear previous extracted fields
        extractedFields.innerHTML = '';
        
        // Add extracted fields
        const fields = [
            { key: 'eventName', label: 'Event Name', value: data.eventName },
            { key: 'date', label: 'Date', value: data.date },
            { key: 'time', label: 'Time', value: data.time },
            { key: 'venue', label: 'Venue', value: data.venue },
            { key: 'description', label: 'Description', value: data.description }
        ];
        
        // Add recurrence info if present
        if (data.recurrence && data.recurrence.type !== 'none') {
            let recurrenceText = '';
            if (data.recurrence.type === 'weekly' && data.recurrence.weekly_days) {
                const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                const days = data.recurrence.weekly_days.map(day => dayNames[day]).join(', ');
                recurrenceText = `Weekly on ${days}`;
            } else if (data.recurrence.type === 'monthly') {
                if (data.recurrence.monthly_type === 'day') {
                    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                    const weekNames = ['', 'First', 'Second', 'Third', 'Fourth', 'Last'];
                    const week = data.recurrence.monthly_week;
                    const day = dayNames[data.recurrence.monthly_day_of_week];
                    const weekName = week === -1 ? 'Last' : weekNames[week];
                    recurrenceText = `Monthly on ${weekName} ${day}`;
                } else if (data.recurrence.monthly_day_of_month) {
                    recurrenceText = `Monthly on day ${data.recurrence.monthly_day_of_month}`;
                }
            }
            
            if (recurrenceText) {
                fields.push({ key: 'recurrence', label: 'Recurrence', value: recurrenceText });
            }
        }
        
        // Add categories if present
        if (data.categories && data.categories.length > 0) {
            fields.push({ key: 'categories', label: 'Categories', value: data.categories.join(', ') });
        }
        
        fields.forEach(field => {
            if (field.value) {
                const fieldDiv = document.createElement('div');
                fieldDiv.className = 'extracted-field';
                fieldDiv.innerHTML = `
                    <div class="flex items-center justify-between">
                        <span class="text-gray-300 font-medium">${field.label}:</span>
                        <span class="text-white">${field.value}</span>
                    </div>
                `;
                extractedFields.appendChild(fieldDiv);
            }
        });
        
        extractedData.classList.remove('hidden');
    }

    function showUploadSuccess() {
        uploadNote.classList.remove('hidden');
    }

    // Use extracted data
    useExtractedBtn.addEventListener('click', () => {
        if (extractedEventData) {
            if (extractedEventData.eventName) {
                document.getElementById('event-name').value = extractedEventData.eventName;
            }
            if (extractedEventData.date) {
                document.getElementById('date').value = extractedEventData.date;
            }
            if (extractedEventData.time) {
                document.getElementById('start-time').value = extractedEventData.time;
            }
            if (extractedEventData.venue) {
                // Try to match venue name to venue dropdown
                const venueSelect = document.getElementById('venue-select');
                const extractedVenue = extractedEventData.venue.toLowerCase();
                
                for (let i = 0; i < venueSelect.options.length; i++) {
                    const option = venueSelect.options[i];
                    if (option.text.toLowerCase().includes(extractedVenue) || 
                        extractedVenue.includes(option.text.toLowerCase())) {
                        venueSelect.selectedIndex = i;
                        break;
                    }
                }
            }
            if (extractedEventData.description) {
                document.getElementById('description').value = extractedEventData.description;
            }
            
            // Handle recurrence
            if (extractedEventData.recurrence && extractedEventData.recurrence.type !== 'none') {
                // Set recurrence type
                const recurrenceType = extractedEventData.recurrence.type;
                document.querySelector(`input[name="recurrence-type"][value="${recurrenceType}"]`).checked = true;
                updateRecurrenceVisibility();
                
                if (recurrenceType === 'weekly' && extractedEventData.recurrence.weekly_days) {
                    // Set weekly days
                    extractedEventData.recurrence.weekly_days.forEach(day => {
                        const checkbox = document.querySelector(`input[name="weekly_days"][value="${day}"]`);
                        if (checkbox) checkbox.checked = true;
                    });
                } else if (recurrenceType === 'monthly') {
                    if (extractedEventData.recurrence.monthly_type === 'day') {
                        // Set monthly by day
                        document.querySelector('input[name="monthly_type"][value="day"]').checked = true;
                        updateMonthlyOptionsVisibility();
                        
                        if (extractedEventData.recurrence.monthly_week) {
                            document.getElementById('monthly-week').value = extractedEventData.recurrence.monthly_week;
                        }
                        if (extractedEventData.recurrence.monthly_day_of_week) {
                            document.getElementById('monthly-day-of-week').value = extractedEventData.recurrence.monthly_day_of_week;
                        }
                    } else if (extractedEventData.recurrence.monthly_day_of_month) {
                        // Set monthly by date
                        document.querySelector('input[name="monthly_type"][value="date"]').checked = true;
                        updateMonthlyOptionsVisibility();
                        document.getElementById('monthly-day-of-month').value = extractedEventData.recurrence.monthly_day_of_month;
                    }
                }
                
                // Update preview
                updateDatesPreview();
            }
            
            // Handle categories
            if (extractedEventData.categories && extractedEventData.categories.length > 0) {
                const categorySelect = document.getElementById('category-select');
                const extractedCategories = extractedEventData.categories.map(cat => cat.toLowerCase());
                
                for (let i = 0; i < categorySelect.options.length; i++) {
                    const option = categorySelect.options[i];
                    if (extractedCategories.some(cat => option.text.toLowerCase().includes(cat))) {
                        option.selected = true;
                    }
                }
            }
            
            extractedData.classList.add('hidden');
            showStatus('Extracted data applied to form!', 'success');
        }
    });

    // Ignore extracted data
    ignoreExtractedBtn.addEventListener('click', () => {
        extractedData.classList.add('hidden');
        extractedEventData = null;
    });

    // Remove poster
    removePosterBtn.addEventListener('click', () => {
        posterUpload.value = '';
        posterPreview.classList.add('hidden');
        uploadArea.classList.remove('hidden');
        extractedData.classList.add('hidden');
        extractedEventData = null;
        aiProcessing.classList.add('hidden');
        uploadNote.classList.add('hidden');
    });

    // Recurrence type handlers
    document.querySelectorAll('input[name="recurrence-type"]').forEach(radio => {
        radio.addEventListener('change', updateRecurrenceVisibility);
    });

    document.querySelectorAll('input[name="monthly_type"]').forEach(radio => {
        radio.addEventListener('change', updateMonthlyOptionsVisibility);
    });

    function updateRecurrenceVisibility() {
        const selectedType = document.querySelector('input[name="recurrence-type"]:checked').value;
        
        recurrenceOptions.classList.add('hidden');
        weeklyOptions.classList.add('hidden');
        monthlyOptions.classList.add('hidden');
        datesPreviewSection.classList.add('hidden');
        
        if (selectedType !== 'none') {
            recurrenceOptions.classList.remove('hidden');
            
            if (selectedType === 'weekly') {
                weeklyOptions.classList.remove('hidden');
            } else if (selectedType === 'monthly') {
                monthlyOptions.classList.remove('hidden');
                updateMonthlyOptionsVisibility();
            }
            
            updateDatesPreview();
        }
    }

    function updateMonthlyOptionsVisibility() {
        const selectedMonthlyType = document.querySelector('input[name="monthly_type"]:checked').value;
        
        monthlyByDateOptions.classList.add('hidden');
        monthlyByDayOptions.classList.add('hidden');
        
        if (selectedMonthlyType === 'date') {
            monthlyByDateOptions.classList.remove('hidden');
        } else if (selectedMonthlyType === 'day') {
            monthlyByDayOptions.classList.remove('hidden');
        }
        
        updateDatesPreview();
    }

    // Date preview functionality
    function updateDatesPreview() {
        const selectedType = document.querySelector('input[name="recurrence-type"]:checked').value;
        const startDate = document.getElementById('date').value;
        const startTime = document.getElementById('start-time').value;
        
        if (selectedType === 'none' || !startDate) {
            datesPreviewSection.classList.add('hidden');
            return;
        }
        
        let recurrenceData = null;
        
        if (selectedType === 'weekly') {
            const weeklyDays = Array.from(document.querySelectorAll('input[name="weekly_days"]:checked'))
                .map(cb => parseInt(cb.value, 10));
            if (weeklyDays.length > 0) {
                recurrenceData = { type: 'weekly', days: weeklyDays };
            }
        } else if (selectedType === 'monthly') {
            const monthlyType = document.querySelector('input[name="monthly_type"]:checked').value;
            if (monthlyType === 'date') {
                const dayOfMonth = document.getElementById('monthly-day-of-month').value;
                if (dayOfMonth) {
                    recurrenceData = { type: 'monthly', monthlyType: 'date', dayOfMonth: parseInt(dayOfMonth, 10) };
                }
            } else if (monthlyType === 'day') {
                const week = document.getElementById('monthly-week').value;
                const dayOfWeek = document.getElementById('monthly-day-of-week').value;
                if (week && dayOfWeek) {
                    recurrenceData = { type: 'monthly', monthlyType: 'day', week: parseInt(week, 10), dayOfWeek: parseInt(dayOfWeek, 10) };
                }
            }
        }
        
        if (recurrenceData) {
            generatedDates = calculateRecurringDates(startDate, recurrenceData, 3);
            // Filter out exception dates
            generatedDates = generatedDates.filter(date => !exceptionDates.includes(date));
            renderDatesPreview();
            datesPreviewSection.classList.remove('hidden');
        } else {
            datesPreviewSection.classList.add('hidden');
        }
    }

    function renderDatesPreview() {
        datesPreview.innerHTML = '';
        
        generatedDates.forEach((date, index) => {
            const dateDiv = document.createElement('div');
            dateDiv.className = 'date-card flex items-center justify-between';
            
            const dateObj = new Date(date);
            const formattedDate = dateObj.toLocaleDateString('en-GB', { 
                weekday: 'long', 
                day: 'numeric', 
                month: 'long',
                year: 'numeric'
            });
            
            // Get current venue and time
            const venueSelect = document.getElementById('venue-select');
            const selectedVenue = venueSelect.options[venueSelect.selectedIndex];
            const venueName = selectedVenue ? selectedVenue.textContent : 'No venue selected';
            const startTime = document.getElementById('start-time').value || 'TBD';
            
            dateDiv.innerHTML = `
                <div class="flex items-center">
                    <i class="fas fa-calendar-day text-accent-color mr-3"></i>
                    <div>
                        <div class="text-white">${formattedDate}</div>
                        <div class="text-sm text-gray-400">${startTime} at ${venueName}</div>
                    </div>
                </div>
                <div class="flex items-center space-x-2">
                    <button type="button" class="edit-date-btn text-blue-400 hover:text-blue-300" data-index="${index}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button type="button" class="remove-date-btn text-red-400 hover:text-red-300" data-index="${index}">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
            
            datesPreview.appendChild(dateDiv);
        });
        
        // Add event listeners for edit/remove buttons
        datesPreview.querySelectorAll('.edit-date-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.closest('.edit-date-btn').dataset.index);
                editDate(index);
            });
        });
        
        datesPreview.querySelectorAll('.remove-date-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.closest('.remove-date-btn').dataset.index);
                removeDate(index);
            });
        });
    }

    function editDate(index) {
        const date = generatedDates[index];
        const newDate = prompt('Enter new date (YYYY-MM-DD):', date);
        
        if (newDate && newDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
            generatedDates[index] = newDate;
            renderDatesPreview();
        }
    }

    function removeDate(index) {
        if (confirm('Remove this date from the series?')) {
            generatedDates.splice(index, 1);
            renderDatesPreview();
        }
    }

    // Exception dates functionality
    addExceptionBtn.addEventListener('click', () => {
        const date = exceptionDateInput.value;
        if (date && !exceptionDates.includes(date)) {
            exceptionDates.push(date);
            renderExceptionDates();
            exceptionDateInput.value = '';
            updateDatesPreview();
        }
    });

    function renderExceptionDates() {
        exceptionDatesList.innerHTML = '';
        
        exceptionDates.forEach(date => {
            const dateDiv = document.createElement('div');
            dateDiv.className = 'exception-date flex items-center justify-between';
            
            const dateObj = new Date(date);
            const formattedDate = dateObj.toLocaleDateString('en-GB', { 
                weekday: 'short', 
                day: 'numeric', 
                month: 'short' 
            });
            
            dateDiv.innerHTML = `
                <span class="text-red-300">${formattedDate}</span>
                <button type="button" class="remove-exception-btn text-red-400 hover:text-red-300" data-date="${date}">
                    <i class="fas fa-times"></i>
                </button>
            `;
            
            exceptionDatesList.appendChild(dateDiv);
        });
        
        // Add event listeners for remove buttons
        exceptionDatesList.querySelectorAll('.remove-exception-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const date = e.target.closest('.remove-exception-btn').dataset.date;
                removeExceptionDate(date);
            });
        });
    }

    function removeExceptionDate(date) {
        exceptionDates = exceptionDates.filter(d => d !== date);
        renderExceptionDates();
        updateDatesPreview();
    }

    // Add event listeners for recurrence updates
    document.querySelectorAll('input[name="weekly_days"]').forEach(checkbox => {
        checkbox.addEventListener('change', updateDatesPreview);
    });
    
    document.getElementById('monthly-day-of-month').addEventListener('input', updateDatesPreview);
    document.getElementById('monthly-week').addEventListener('change', updateDatesPreview);
    document.getElementById('monthly-day-of-week').addEventListener('change', updateDatesPreview);
    document.getElementById('date').addEventListener('change', updateDatesPreview);
    document.getElementById('start-time').addEventListener('change', updateDatesPreview);
    
    // Update preview when venue changes
    venueSelect.addEventListener('change', () => {
        if (datesPreviewSection.classList.contains('hidden') === false) {
            renderDatesPreview();
        }
    });

    // Date calculation functions
    function calculateRecurringDates(startDate, recurrenceData, monthsAhead = 3) {
        const dates = [];
        const start = new Date(startDate);
        const endDate = new Date(start);
        endDate.setMonth(endDate.getMonth() + monthsAhead);
        
        if (recurrenceData.type === 'weekly') {
            const daysOfWeek = recurrenceData.days || [];
            let currentDate = new Date(start);
            
            while (currentDate <= endDate) {
                if (daysOfWeek.includes(currentDate.getDay())) {
                    dates.push(currentDate.toISOString().split('T')[0]);
                }
                currentDate.setDate(currentDate.getDate() + 1);
            }
        } else if (recurrenceData.type === 'monthly') {
            if (recurrenceData.monthlyType === 'date') {
                const dayOfMonth = recurrenceData.dayOfMonth;
                let currentDate = new Date(start);
                
                while (currentDate <= endDate) {
                    const maxDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
                    const actualDay = Math.min(dayOfMonth, maxDay);
                    
                    const eventDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), actualDay);
                    if (eventDate >= start) {
                        dates.push(eventDate.toISOString().split('T')[0]);
                    }
                    
                    currentDate.setMonth(currentDate.getMonth() + 1);
                }
            } else if (recurrenceData.monthlyType === 'day') {
                const week = recurrenceData.week;
                const dayOfWeek = recurrenceData.dayOfWeek;
                let currentDate = new Date(start);
                
                while (currentDate <= endDate) {
                    const eventDate = getNthWeekdayOfMonth(currentDate.getFullYear(), currentDate.getMonth(), week, dayOfWeek);
                    if (eventDate && eventDate >= start) {
                        dates.push(eventDate.toISOString().split('T')[0]);
                    }
                    currentDate.setMonth(currentDate.getMonth() + 1);
                }
            }
        }
        
        return dates;
    }

    function getNthWeekdayOfMonth(year, month, week, dayOfWeek) {
        const date = new Date(year, month, 1);
        
        if (week > 0) {
            let day = date.getDay();
            let diff = (dayOfWeek - day + 7) % 7;
            date.setDate(date.getDate() + diff);
            date.setDate(date.getDate() + (week - 1) * 7);
        } else {
            date.setMonth(date.getMonth() + 1);
            date.setDate(0);
            let day = date.getDay();
            let diff = (dayOfWeek - day + 7) % 7;
            date.setDate(date.getDate() - diff);
        }
        
        if (date.getMonth() !== month) return null;
        return date;
    }

    // Populate categories
    const categories = ["Comedy", "Drag", "Live Music", "Party", "Pride", "Social", "Theatre", "Viewing Party", "Kink", "Community", "Exhibition", "Health", "Quiz", "Trans & Non-Binary", "Sober", "Queer Women & Sapphic"];
    categorySelect.innerHTML = '';
    categories.forEach(categoryName => {
        const option = document.createElement('option');
        option.value = categoryName;
        option.textContent = categoryName;
        categorySelect.appendChild(option);
    });

    // Fetch venues
    fetch('/.netlify/functions/get-venue-list')
        .then(response => response.json())
        .then(venues => {
            venueSelect.innerHTML = '<option value="" disabled selected>Select an existing venue...</option>';
            venues.forEach(venue => {
                const option = document.createElement('option');
                option.value = venue.id;
                option.textContent = venue.name;
                venueSelect.appendChild(option);
            });
        })
        .catch(error => {
            console.error('Error fetching venues:', error);
            showStatus('Error loading venues. Please refresh the page.', 'error');
        });

    // Form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Clear previous error states
        document.querySelectorAll('.border-red-500').forEach(field => {
            field.classList.remove('border-red-500');
        });
        
        // Validation
        const errors = [];
        
        if (!termsCheckbox.checked) {
            errors.push('You must agree to the Terms of Submission.');
        }
        
        const eventName = document.getElementById('event-name').value.trim();
        const eventDate = document.getElementById('date').value;
        const startTime = document.getElementById('start-time').value;
        const contactEmail = document.getElementById('contact-email').value.trim();
        
        if (!eventName) {
            errors.push('Event name is required.');
            document.getElementById('event-name').classList.add('border-red-500');
        }
        
        if (!eventDate) {
            errors.push('Event date is required.');
            document.getElementById('date').classList.add('border-red-500');
        }
        
        if (!startTime) {
            errors.push('Start time is required.');
            document.getElementById('start-time').classList.add('border-red-500');
        }
        
        if (!contactEmail) {
            errors.push('Contact email is required.');
            document.getElementById('contact-email').classList.add('border-red-500');
        }
        
        if (!venueSelect.value) {
            errors.push('Please select a venue.');
            venueSelect.classList.add('border-red-500');
        }
        
        const selectedCategories = Array.from(categorySelect.selectedOptions).map(option => option.value);
        if (selectedCategories.length === 0) {
            errors.push('Please select at least one category.');
            categorySelect.classList.add('border-red-500');
        }
        
        // Show validation errors
        if (errors.length > 0) {
            showStatus(`
                <div class="text-red-400 font-semibold mb-2">Please fix the following issues:</div>
                <ul class="list-disc list-inside text-left">
                    ${errors.map(error => `<li>${error}</li>`).join('')}
                </ul>
            `, 'error');
            return;
        }
        
        // Build recurrence data
        const selectedRecurrenceType = document.querySelector('input[name="recurrence-type"]:checked').value;
        let recurrenceRule = null;
        
        if (selectedRecurrenceType === 'weekly') {
            const weeklyDays = Array.from(document.querySelectorAll('input[name="weekly_days"]:checked'))
                .map(cb => parseInt(cb.value, 10));
            if (weeklyDays.length > 0) {
                recurrenceRule = { type: 'weekly', days: weeklyDays };
            }
        } else if (selectedRecurrenceType === 'monthly') {
            const monthlyType = document.querySelector('input[name="monthly_type"]:checked').value;
            if (monthlyType === 'date') {
                const dayOfMonth = document.getElementById('monthly-day-of-month').value;
                if (dayOfMonth) {
                    recurrenceRule = { type: 'monthly', monthlyType: 'date', dayOfMonth: parseInt(dayOfMonth, 10) };
                }
            } else if (monthlyType === 'day') {
                const week = document.getElementById('monthly-week').value;
                const dayOfWeek = document.getElementById('monthly-day-of-week').value;
                if (week && dayOfWeek) {
                    recurrenceRule = { type: 'monthly', monthlyType: 'day', week: parseInt(week, 10), dayOfWeek: parseInt(dayOfWeek, 10) };
                }
            }
        }
        
        // Add end date and exceptions to recurrence rule
        if (recurrenceRule) {
            const endDate = document.getElementById('recurrence-end-date').value;
            if (endDate) {
                recurrenceRule.endDate = endDate;
            }
            
            if (exceptionDates.length > 0) {
                recurrenceRule.exceptions = exceptionDates;
            }
            
            recurringInfoHidden.value = JSON.stringify(recurrenceRule);
        } else {
            recurringInfoHidden.value = '';
        }
        
        // Disable submit button and show loading
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Submitting...';
        showStatus('Submitting your event, please wait...', 'info');
        
        // Submit event
        try {
            const formData = new FormData(form);
            
            // Handle categories
            formData.delete('categoryIds');
            selectedCategories.forEach(categoryName => {
                formData.append('categoryIds', categoryName);
            });
            
            const response = await fetch('/.netlify/functions/event-submission', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                const errorResult = await response.json().catch(() => ({ message: 'Server error during event submission.' }));
                throw new Error(errorResult.message || `Server responded with status: ${response.status}`);
            }
            
            showStatus('Success! Your event has been submitted for review. Our team will review it within 24-48 hours and you\'ll be notified once it\'s live.', 'success');
            form.reset();
            termsCheckbox.checked = false;
            submitButton.disabled = true;
            extractedData.classList.add('hidden');
            posterPreview.classList.add('hidden');
            uploadArea.classList.remove('hidden');
            datesPreviewSection.classList.add('hidden');
            generatedDates = [];
            exceptionDates = [];
            
        } catch (error) {
            showStatus(`Error: ${error.message}`, 'error');
            submitButton.disabled = !termsCheckbox.checked;
            submitButton.innerHTML = '<i class="fas fa-paper-plane mr-2"></i>Submit Event';
        }
    });

    // Status message function
    function showStatus(message, type = 'info') {
        statusDiv.innerHTML = message;
        statusDiv.className = 'mt-6 p-4 rounded-lg text-center';
        
        switch (type) {
            case 'success':
                statusDiv.classList.add('bg-green-800/20', 'border', 'border-green-500', 'text-green-300');
                break;
            case 'error':
                statusDiv.classList.add('bg-red-800/20', 'border', 'border-red-500', 'text-red-300');
                break;
            case 'info':
            default:
                statusDiv.classList.add('bg-blue-800/20', 'border', 'border-blue-500', 'text-blue-300');
                break;
        }
        
        statusDiv.classList.remove('hidden');
        
        if (type === 'success') {
            setTimeout(() => statusDiv.classList.add('hidden'), 5000);
        }
    }
});