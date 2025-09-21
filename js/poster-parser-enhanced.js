/**
 * Enhanced Poster Parser Interface
 * Phase 4: Code Quality & Error Handling
 * 
 * Features:
 * - Real-time poster analysis
 * - User confirmation interface
 * - Field-by-field editing
 * - Confidence indicators
 * - Fallback handling
 */

class EnhancedPosterParser {
    constructor() {
        this.isProcessing = false;
        this.extractedData = null;
        this.confidenceThreshold = 0.7; // Only auto-fill high confidence fields
        this.init();
    }

    init() {
        this.setupPosterUpload();
        this.setupExtractionInterface();
        this.setupConfirmationHandlers();
    }

    /**
     * Setup poster upload with enhanced feedback
     */
    setupPosterUpload() {
        const uploadArea = document.getElementById('upload-area');
        const posterUpload = document.getElementById('poster-upload');
        const posterPreview = document.getElementById('poster-preview');
        const aiProcessing = document.getElementById('ai-processing');
        const extractedData = document.getElementById('extracted-data');

        if (!uploadArea || !posterUpload) return;

        // Enhanced drag and drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('border-accent-color', 'dragover');
            uploadArea.innerHTML = '<div class="text-center"><i class="fas fa-cloud-upload-alt text-2xl mb-2"></i><p>Drop your poster here</p></div>';
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('border-accent-color', 'dragover');
            uploadArea.innerHTML = '<div class="text-center"><i class="fas fa-upload text-2xl mb-2"></i><p>Click or drag to upload poster</p></div>';
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('border-accent-color', 'dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handlePosterUpload(files[0]);
            }
        });

        // Click to upload
        uploadArea.addEventListener('click', () => posterUpload.click());
        posterUpload.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handlePosterUpload(e.target.files[0]);
            }
        });
    }

    /**
     * Handle poster upload and trigger AI analysis
     */
    async handlePosterUpload(file) {
        if (!file || !file.type.startsWith('image/')) {
            this.showError('Please select a valid image file.');
            return;
        }

        if (file.size > 10 * 1024 * 1024) { // 10MB limit
            this.showError('Image file is too large. Please use an image under 10MB.');
            return;
        }

        this.isProcessing = true;
        this.showProcessingState();

        try {
            // Create preview
            const preview = await this.createImagePreview(file);
            this.showPosterPreview(preview);

            // Convert to base64 for AI processing
            const base64 = await this.fileToBase64(file);
            
            // Trigger AI analysis
            await this.analyzePoster(base64);

        } catch (error) {
            console.error('Poster upload error:', error);
            this.showError('Failed to process poster. Please try again.');
            this.hideProcessingState();
        }
    }

    /**
     * Create image preview
     */
    createImagePreview(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    /**
     * Convert file to base64
     */
    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    /**
     * Show poster preview
     */
    showPosterPreview(preview) {
        const posterPreview = document.getElementById('poster-preview');
        const uploadArea = document.getElementById('upload-area');
        
        if (posterPreview) {
            posterPreview.innerHTML = `
                <img src="${preview}" alt="Poster preview" class="max-w-full h-auto rounded-lg">
                <button type="button" id="remove-poster" class="absolute top-2 right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-600 transition-colors">
                    <i class="fas fa-times"></i>
                </button>
            `;
            posterPreview.classList.remove('hidden');
        }
        
        if (uploadArea) {
            uploadArea.classList.add('hidden');
        }

        // Setup remove button
        const removeBtn = document.getElementById('remove-poster');
        if (removeBtn) {
            removeBtn.addEventListener('click', () => this.removePoster());
        }
    }

    /**
     * Analyze poster with AI
     */
    async analyzePoster(base64Image) {
        try {
            this.updateProcessingMessage('Analyzing poster with AI...');

            const response = await fetch('/.netlify/functions/analyze-poster', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: base64Image })
            });

            if (!response.ok) {
                throw new Error(`AI analysis failed: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.success && result.extractedData) {
                this.extractedData = result.extractedData;
                this.showExtractionResults();
            } else {
                this.showExtractionError('AI analysis completed but no data was extracted. Please fill in the form manually.');
            }

        } catch (error) {
            console.error('AI analysis error:', error);
            this.showExtractionError('AI analysis failed. Please fill in the form manually.');
        } finally {
            this.hideProcessingState();
        }
    }

    /**
     * Show extraction results interface
     */
    showExtractionResults() {
        const extractedData = document.getElementById('extracted-data');
        if (!extractedData || !this.extractedData) return;

        const confidence = this.extractedData.confidence || 'medium';
        const confidenceColor = this.getConfidenceColor(confidence);

        extractedData.innerHTML = `
            <div class="bg-blue-900/20 border border-blue-500 rounded-lg p-4 mb-4">
                <div class="flex items-center justify-between mb-3">
                    <h3 class="text-lg font-semibold text-blue-300">
                        <i class="fas fa-robot mr-2"></i>AI Analysis Results
                    </h3>
                    <span class="px-2 py-1 rounded text-xs font-medium ${confidenceColor}">
                        Confidence: ${confidence}
                    </span>
                </div>
                
                <div class="space-y-3">
                    ${this.renderExtractedFields()}
                </div>
                
                <div class="flex space-x-3 mt-4">
                    <button type="button" id="use-all-extracted" class="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg transition-colors">
                        <i class="fas fa-check mr-2"></i>Use All Data
                    </button>
                    <button type="button" id="use-selected-extracted" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors">
                        <i class="fas fa-edit mr-2"></i>Edit & Use
                    </button>
                    <button type="button" id="ignore-extracted" class="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg transition-colors">
                        <i class="fas fa-times mr-2"></i>Ignore
                    </button>
                </div>
            </div>
        `;

        extractedData.classList.remove('hidden');
        this.setupExtractionHandlers();
    }

    /**
     * Render extracted fields with confidence indicators
     */
    renderExtractedFields() {
        const fields = [
            { key: 'eventName', label: 'Event Name', icon: 'fas fa-calendar' },
            { key: 'date', label: 'Date', icon: 'fas fa-calendar-day' },
            { key: 'time', label: 'Time', icon: 'fas fa-clock' },
            { key: 'venue', label: 'Venue', icon: 'fas fa-map-marker-alt' },
            { key: 'description', label: 'Description', icon: 'fas fa-align-left' },
            { key: 'price', label: 'Price', icon: 'fas fa-tag' },
            { key: 'ageRestriction', label: 'Age Restriction', icon: 'fas fa-user' },
            { key: 'categories', label: 'Categories', icon: 'fas fa-tags' }
        ];

        return fields.map(field => {
            const value = this.extractedData[field.key];
            if (!value) return '';

            const isHighConfidence = this.isHighConfidence(field.key);
            const confidenceIcon = isHighConfidence ? 'fas fa-check-circle text-green-400' : 'fas fa-exclamation-triangle text-yellow-400';
            const confidenceText = isHighConfidence ? 'High confidence' : 'Low confidence';

            return `
                <div class="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                    <div class="flex items-center space-x-3">
                        <i class="${field.icon} text-blue-400 w-5"></i>
                        <div>
                            <div class="font-medium text-white">${field.label}</div>
                            <div class="text-sm text-gray-300">${this.formatFieldValue(field.key, value)}</div>
                        </div>
                    </div>
                    <div class="flex items-center space-x-2">
                        <i class="${confidenceIcon} text-xs"></i>
                        <span class="text-xs text-gray-400">${confidenceText}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Format field value for display
     */
    formatFieldValue(key, value) {
        if (key === 'categories' && Array.isArray(value)) {
            return value.join(', ');
        }
        if (key === 'date' && value) {
            return new Date(value).toLocaleDateString();
        }
        return value || 'Not found';
    }

    /**
     * Check if field has high confidence
     */
    isHighConfidence(fieldKey) {
        // Simple confidence logic - can be enhanced
        const highConfidenceFields = ['eventName', 'date', 'venue'];
        return highConfidenceFields.includes(fieldKey);
    }

    /**
     * Get confidence color
     */
    getConfidenceColor(confidence) {
        switch (confidence) {
            case 'high': return 'bg-green-500/20 text-green-300 border border-green-500';
            case 'medium': return 'bg-yellow-500/20 text-yellow-300 border border-yellow-500';
            case 'low': return 'bg-red-500/20 text-red-300 border border-red-500';
            default: return 'bg-gray-500/20 text-gray-300 border border-gray-500';
        }
    }

    /**
     * Setup extraction result handlers
     */
    setupExtractionHandlers() {
        const useAllBtn = document.getElementById('use-all-extracted');
        const useSelectedBtn = document.getElementById('use-selected-extracted');
        const ignoreBtn = document.getElementById('ignore-extracted');

        if (useAllBtn) {
            useAllBtn.addEventListener('click', () => this.useAllExtractedData());
        }
        if (useSelectedBtn) {
            useSelectedBtn.addEventListener('click', () => this.showFieldEditor());
        }
        if (ignoreBtn) {
            ignoreBtn.addEventListener('click', () => this.ignoreExtractedData());
        }
    }

    /**
     * Use all extracted data
     */
    useAllExtractedData() {
        if (!this.extractedData) return;

        // Auto-fill form fields
        this.fillFormFields(this.extractedData);
        
        // Show success message
        this.showSuccess('All extracted data has been applied to the form!');
        
        // Hide extraction interface
        this.hideExtractionInterface();
    }

    /**
     * Show field editor for selective use
     */
    showFieldEditor() {
        const extractedData = document.getElementById('extracted-data');
        if (!extractedData || !this.extractedData) return;

        extractedData.innerHTML = `
            <div class="bg-blue-900/20 border border-blue-500 rounded-lg p-4">
                <h3 class="text-lg font-semibold text-blue-300 mb-4">
                    <i class="fas fa-edit mr-2"></i>Edit Extracted Data
                </h3>
                
                <div class="space-y-3">
                    ${this.renderEditableFields()}
                </div>
                
                <div class="flex space-x-3 mt-4">
                    <button type="button" id="apply-selected" class="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg transition-colors">
                        <i class="fas fa-check mr-2"></i>Apply Selected
                    </button>
                    <button type="button" id="cancel-edit" class="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg transition-colors">
                        <i class="fas fa-times mr-2"></i>Cancel
                    </button>
                </div>
            </div>
        `;

        this.setupEditorHandlers();
    }

    /**
     * Render editable fields
     */
    renderEditableFields() {
        const fields = [
            { key: 'eventName', label: 'Event Name', type: 'text', formField: 'event-name' },
            { key: 'date', label: 'Date', type: 'date', formField: 'date' },
            { key: 'time', label: 'Time', type: 'time', formField: 'start-time' },
            { key: 'venue', label: 'Venue', type: 'text', formField: 'venue-name' },
            { key: 'description', label: 'Description', type: 'textarea', formField: 'description' },
            { key: 'price', label: 'Price', type: 'text', formField: 'price' },
            { key: 'ageRestriction', label: 'Age Restriction', type: 'text', formField: 'age-restriction' }
        ];

        return fields.map(field => {
            const value = this.extractedData[field.key] || '';
            const isHighConfidence = this.isHighConfidence(field.key);
            const confidenceIcon = isHighConfidence ? 'fas fa-check-circle text-green-400' : 'fas fa-exclamation-triangle text-yellow-400';

            return `
                <div class="flex items-center space-x-3 p-3 bg-gray-800/50 rounded-lg">
                    <input type="checkbox" id="use-${field.key}" class="form-checkbox text-blue-500" ${isHighConfidence ? 'checked' : ''}>
                    <div class="flex-1">
                        <label for="use-${field.key}" class="flex items-center space-x-2 cursor-pointer">
                            <span class="font-medium text-white">${field.label}</span>
                            <i class="${confidenceIcon} text-xs"></i>
                        </label>
                        ${this.renderFieldInput(field, value)}
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Render field input
     */
    renderFieldInput(field, value) {
        if (field.type === 'textarea') {
            return `<textarea class="mt-2 w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white" rows="2" data-field="${field.formField}">${value}</textarea>`;
        } else {
            return `<input type="${field.type}" class="mt-2 w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white" value="${value}" data-field="${field.formField}">`;
        }
    }

    /**
     * Setup editor handlers
     */
    setupEditorHandlers() {
        const applyBtn = document.getElementById('apply-selected');
        const cancelBtn = document.getElementById('cancel-edit');

        if (applyBtn) {
            applyBtn.addEventListener('click', () => this.applySelectedFields());
        }
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.showExtractionResults());
        }
    }

    /**
     * Apply selected fields
     */
    applySelectedFields() {
        const selectedData = {};
        
        // Get selected fields
        document.querySelectorAll('#extracted-data input[type="checkbox"]:checked').forEach(checkbox => {
            const fieldKey = checkbox.id.replace('use-', '');
            const input = checkbox.parentNode.querySelector('input, textarea');
            if (input) {
                selectedData[fieldKey] = input.value;
            }
        });

        // Fill form with selected data
        this.fillFormFields(selectedData);
        
        this.showSuccess('Selected data has been applied to the form!');
        this.hideExtractionInterface();
    }

    /**
     * Fill form fields with data
     */
    fillFormFields(data) {
        const fieldMappings = {
            eventName: 'event-name',
            date: 'date',
            time: 'start-time',
            venue: 'venue-name',
            description: 'description',
            price: 'price',
            ageRestriction: 'age-restriction'
        };

        Object.entries(data).forEach(([key, value]) => {
            const formField = fieldMappings[key];
            if (formField && value) {
                const element = document.querySelector(`[name="${formField}"]`);
                if (element) {
                    element.value = value;
                    element.classList.add('border-green-500');
                    
                    // Remove green border after 3 seconds
                    setTimeout(() => {
                        element.classList.remove('border-green-500');
                    }, 3000);
                }
            }
        });
    }

    /**
     * Ignore extracted data
     */
    ignoreExtractedData() {
        this.extractedData = null;
        this.hideExtractionInterface();
        this.showInfo('AI extraction ignored. Please fill in the form manually.');
    }

    /**
     * Remove poster
     */
    removePoster() {
        const posterPreview = document.getElementById('poster-preview');
        const uploadArea = document.getElementById('upload-area');
        const extractedData = document.getElementById('extracted-data');
        const posterUpload = document.getElementById('poster-upload');

        if (posterPreview) posterPreview.classList.add('hidden');
        if (uploadArea) uploadArea.classList.remove('hidden');
        if (extractedData) extractedData.classList.add('hidden');
        if (posterUpload) posterUpload.value = '';

        this.extractedData = null;
        this.isProcessing = false;
    }

    /**
     * Show processing state
     */
    showProcessingState() {
        const aiProcessing = document.getElementById('ai-processing');
        if (aiProcessing) {
            aiProcessing.classList.remove('hidden');
            aiProcessing.innerHTML = `
                <div class="flex items-center space-x-3">
                    <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-accent-color"></div>
                    <div>
                        <div class="font-medium text-accent-color">AI Analysis in Progress...</div>
                        <div class="text-sm text-gray-400" id="processing-message">Uploading poster...</div>
                    </div>
                </div>
            `;
        }
    }

    /**
     * Update processing message
     */
    updateProcessingMessage(message) {
        const processingMessage = document.getElementById('processing-message');
        if (processingMessage) {
            processingMessage.textContent = message;
        }
    }

    /**
     * Hide processing state
     */
    hideProcessingState() {
        const aiProcessing = document.getElementById('ai-processing');
        if (aiProcessing) {
            aiProcessing.classList.add('hidden');
        }
    }

    /**
     * Hide extraction interface
     */
    hideExtractionInterface() {
        const extractedData = document.getElementById('extracted-data');
        if (extractedData) {
            extractedData.classList.add('hidden');
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
     * Show info message
     */
    showInfo(message) {
        if (window.formErrorHandler) {
            window.formErrorHandler.showInfo(message);
        } else {
            alert(message);
        }
    }

    /**
     * Show extraction error
     */
    showExtractionError(message) {
        const extractedData = document.getElementById('extracted-data');
        if (extractedData) {
            extractedData.innerHTML = `
                <div class="bg-yellow-900/20 border border-yellow-500 rounded-lg p-4">
                    <div class="flex items-center space-x-2 mb-2">
                        <i class="fas fa-exclamation-triangle text-yellow-400"></i>
                        <span class="font-medium text-yellow-300">AI Analysis Note</span>
                    </div>
                    <p class="text-yellow-200">${message}</p>
                    <button type="button" id="dismiss-extraction-error" class="mt-3 text-yellow-300 hover:text-yellow-100">
                        <i class="fas fa-times mr-1"></i>Dismiss
                    </button>
                </div>
            `;
            extractedData.classList.remove('hidden');

            const dismissBtn = document.getElementById('dismiss-extraction-error');
            if (dismissBtn) {
                dismissBtn.addEventListener('click', () => {
                    extractedData.classList.add('hidden');
                });
            }
        }
    }
}

// Initialize the enhanced poster parser
document.addEventListener('DOMContentLoaded', () => {
    window.enhancedPosterParser = new EnhancedPosterParser();
});
