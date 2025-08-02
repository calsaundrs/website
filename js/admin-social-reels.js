class SocialReelsGenerator {
    constructor() {
        this.events = [];
        this.selectedEvent = null;
        this.selectedTemplate = 'modern';
        this.generatedVideos = 0;
        this.downloadCount = 0;
        this.selectedEvents = new Set();
        this.videoSettings = {
            duration: 5,
            includeLogo: true,
            includeHashtags: true
        };
        
        this.init();
    }

    init() {
        console.log('🎬 Initializing Social Reels Generator');
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Load initial data
        this.loadEvents();
        
        // Initialize UI
        this.updateWeekRange();
        this.selectTemplate('modern');
    }

    setupEventListeners() {
        // Refresh events
        document.getElementById('refresh-events').addEventListener('click', () => {
            this.loadEvents();
        });

        // Template selection
        document.querySelectorAll('.template-option').forEach(option => {
            option.addEventListener('click', (e) => {
                const template = e.currentTarget.dataset.template;
                this.selectTemplate(template);
            });
        });

        // Video duration slider
        const durationSlider = document.getElementById('video-duration');
        const durationValue = document.getElementById('duration-value');
        durationSlider.addEventListener('input', (e) => {
            this.videoSettings.duration = parseInt(e.target.value);
            durationValue.textContent = e.target.value;
        });

        // Checkboxes
        document.getElementById('include-logo').addEventListener('change', (e) => {
            this.videoSettings.includeLogo = e.target.checked;
        });

        document.getElementById('include-hashtags').addEventListener('change', (e) => {
            this.videoSettings.includeHashtags = e.target.checked;
        });

        // Video generation buttons
        document.getElementById('preview-video').addEventListener('click', () => {
            this.generatePreview();
        });

        document.getElementById('download-video').addEventListener('click', () => {
            this.downloadVideo();
        });

        // Batch operations
        document.getElementById('select-all-events').addEventListener('click', () => {
            this.selectAllEvents();
        });

        document.getElementById('generate-batch').addEventListener('click', () => {
            this.generateBatch();
        });

        document.getElementById('download-batch').addEventListener('click', () => {
            this.downloadBatch();
        });
    }

    async loadEvents() {
        console.log('📅 Loading events for the week...');
        
        this.showLoading(true);
        
        try {
            const response = await fetch('/.netlify/functions/get-upcoming-events-week');
            const data = await response.json();
            
            if (data.success) {
                this.events = data.events;
                this.renderEvents();
                this.updateStats();
                
                this.showStatus('success', `Loaded ${this.events.length} events for this week`);
                console.log(`✅ Loaded ${this.events.length} events`, this.events);
            } else {
                throw new Error(data.error || 'Failed to load events');
            }
        } catch (error) {
            console.error('❌ Error loading events:', error);
            this.showStatus('error', 'Failed to load events');
            this.events = [];
            this.renderEvents();
        } finally {
            this.showLoading(false);
        }
    }

    showLoading(show) {
        const loading = document.getElementById('events-loading');
        const list = document.getElementById('events-list');
        const noEvents = document.getElementById('no-events');
        
        if (show) {
            loading.classList.remove('hidden');
            list.classList.add('hidden');
            noEvents.classList.add('hidden');
        } else {
            loading.classList.add('hidden');
            list.classList.remove('hidden');
        }
    }

    renderEvents() {
        const eventsList = document.getElementById('events-list');
        const noEvents = document.getElementById('no-events');
        
        if (this.events.length === 0) {
            eventsList.classList.add('hidden');
            noEvents.classList.remove('hidden');
            return;
        }
        
        eventsList.innerHTML = '';
        noEvents.classList.add('hidden');
        
        this.events.forEach(event => {
            const eventCard = this.createEventCard(event);
            eventsList.appendChild(eventCard);
        });
    }

    createEventCard(event) {
        const card = document.createElement('div');
        card.className = 'event-card p-4 rounded-lg cursor-pointer';
        card.dataset.eventId = event.id;
        
        const date = new Date(event.date);
        const timeString = event.time || date.toLocaleTimeString('en-GB', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: false 
        });
        
        card.innerHTML = `
            <div class="flex items-start space-x-3">
                <div class="flex-shrink-0">
                    <div class="w-12 h-12 rounded-lg overflow-hidden bg-gray-700">
                        ${event.image ? 
                            `<img src="${event.image}" alt="${event.name}" class="w-full h-full object-cover">` :
                            `<div class="w-full h-full flex items-center justify-center text-gray-400">
                                <i class="fas fa-calendar-alt"></i>
                            </div>`
                        }
                    </div>
                </div>
                <div class="flex-1 min-w-0">
                    <h4 class="font-semibold text-sm truncate">${event.name}</h4>
                    <p class="text-xs text-gray-400">${event.venue.name}</p>
                    <p class="text-xs text-purple-400">${event.dayOfWeek} ${timeString}</p>
                    <div class="flex flex-wrap gap-1 mt-1">
                        ${event.category.slice(0, 2).map(cat => 
                            `<span class="text-xs bg-purple-900 text-purple-200 px-2 py-0.5 rounded">${cat}</span>`
                        ).join('')}
                    </div>
                </div>
                <div class="flex-shrink-0">
                    <input type="checkbox" class="event-checkbox rounded" data-event-id="${event.id}">
                </div>
            </div>
        `;
        
        // Add click handler for selection
        card.addEventListener('click', (e) => {
            if (e.target.type !== 'checkbox') {
                this.selectEvent(event);
            }
        });
        
        // Add checkbox handler
        const checkbox = card.querySelector('.event-checkbox');
        checkbox.addEventListener('change', (e) => {
            e.stopPropagation();
            if (e.target.checked) {
                this.selectedEvents.add(event.id);
            } else {
                this.selectedEvents.delete(event.id);
            }
            this.updateBatchButtons();
        });
        
        return card;
    }

    selectEvent(event) {
        console.log('🎯 Selected event:', event.name);
        
        // Update selected event
        this.selectedEvent = event;
        
        // Update UI selection
        document.querySelectorAll('.event-card').forEach(card => {
            card.classList.remove('selected');
        });
        document.querySelector(`[data-event-id="${event.id}"]`).classList.add('selected');
        
        // Enable preview button
        document.getElementById('preview-video').disabled = false;
        
        // Update video placeholder
        this.updateVideoPlaceholder();
    }

    selectTemplate(templateId) {
        console.log('🎨 Selected template:', templateId);
        
        this.selectedTemplate = templateId;
        
        // Update UI selection
        document.querySelectorAll('.template-option').forEach(option => {
            option.classList.remove('selected');
        });
        document.querySelector(`[data-template="${templateId}"]`).classList.add('selected');
        
        // Update preview if event is selected
        if (this.selectedEvent) {
            this.updateVideoPlaceholder();
        }
    }

    updateVideoPlaceholder() {
        const placeholder = document.getElementById('video-placeholder');
        const player = document.getElementById('video-player');
        
        if (this.selectedEvent) {
            placeholder.innerHTML = `
                <div class="text-center p-4">
                    <div class="w-16 h-16 mx-auto mb-3 rounded-lg overflow-hidden bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
                        <i class="fas fa-video text-white text-2xl"></i>
                    </div>
                    <h4 class="font-semibold mb-1">${this.selectedEvent.name}</h4>
                    <p class="text-sm text-gray-400">${this.selectedEvent.venue.name}</p>
                    <p class="text-xs text-purple-400 mt-1">Template: ${this.getTemplateName(this.selectedTemplate)}</p>
                    <p class="text-xs text-gray-400">Duration: ${this.videoSettings.duration}s</p>
                </div>
            `;
        }
    }

    getTemplateName(templateId) {
        const templates = {
            'modern': 'Modern Gradient',
            'minimalist': 'Minimalist',
            'image-focus': 'Image Focus'
        };
        return templates[templateId] || templateId;
    }

    async generatePreview() {
        if (!this.selectedEvent) return;
        
        console.log('🎬 Generating preview for:', this.selectedEvent.name);
        
        const button = document.getElementById('preview-video');
        const originalText = button.innerHTML;
        
        try {
            // Show loading state
            button.innerHTML = '<i class="fas fa-spinner loading-spinner mr-2"></i>Generating...';
            button.disabled = true;
            
            // Simulate video generation (replace with actual Remotion integration)
            const videoData = await this.generateVideoData(this.selectedEvent);
            
            // For now, show a preview placeholder
            this.showVideoPreview(videoData);
            
            // Enable download button
            document.getElementById('download-video').disabled = false;
            
            this.generatedVideos++;
            this.updateStats();
            
            this.showStatus('success', 'Video preview generated!');
            
        } catch (error) {
            console.error('❌ Error generating preview:', error);
            this.showStatus('error', 'Failed to generate preview');
        } finally {
            button.innerHTML = originalText;
            button.disabled = false;
        }
    }

    async generateVideoData(event) {
        // This is a placeholder for the actual Remotion integration
        // In a real implementation, this would call a Netlify function
        // that uses Remotion to generate the video
        
        console.log('🎯 Generating video data for template:', this.selectedTemplate);
        
        const videoData = {
            event: event,
            template: this.selectedTemplate,
            settings: this.videoSettings,
            timestamp: new Date().toISOString()
        };
        
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        return videoData;
    }

    showVideoPreview(videoData) {
        const placeholder = document.getElementById('video-placeholder');
        const player = document.getElementById('video-player');
        
        // For now, show a static preview
        placeholder.innerHTML = `
            <div class="w-full h-full bg-gradient-to-br from-pink-500 via-purple-600 to-blue-600 flex flex-col items-center justify-center text-white p-4">
                <div class="text-center">
                    <div class="mb-4">
                        <i class="fas fa-play-circle text-4xl mb-2"></i>
                        <p class="text-xs opacity-75">PREVIEW GENERATED</p>
                    </div>
                    <h3 class="font-bold text-sm mb-1">${videoData.event.name}</h3>
                    <p class="text-xs opacity-90">${videoData.event.venue.name}</p>
                    <p class="text-xs opacity-75 mt-2">${videoData.event.formattedDate}</p>
                    <div class="mt-3 text-xs opacity-60">
                        <p>Template: ${this.getTemplateName(videoData.template)}</p>
                        <p>Duration: ${videoData.settings.duration}s</p>
                    </div>
                </div>
            </div>
        `;
    }

    async downloadVideo() {
        if (!this.selectedEvent) return;
        
        console.log('📥 Downloading video for:', this.selectedEvent.name);
        
        // For now, simulate download
        const filename = `${this.selectedEvent.slug || this.selectedEvent.name.toLowerCase().replace(/\s+/g, '-')}_reel.mp4`;
        
        this.showStatus('info', `Preparing download: ${filename}`);
        
        // In a real implementation, this would download the generated video
        // For now, just increment the download counter
        setTimeout(() => {
            this.downloadCount++;
            this.updateStats();
            this.showStatus('success', 'Video download started!');
        }, 1000);
    }

    selectAllEvents() {
        const checkboxes = document.querySelectorAll('.event-checkbox');
        const allSelected = this.selectedEvents.size === this.events.length;
        
        if (allSelected) {
            // Deselect all
            this.selectedEvents.clear();
            checkboxes.forEach(cb => cb.checked = false);
        } else {
            // Select all
            this.events.forEach(event => this.selectedEvents.add(event.id));
            checkboxes.forEach(cb => cb.checked = true);
        }
        
        this.updateBatchButtons();
    }

    updateBatchButtons() {
        const hasSelected = this.selectedEvents.size > 0;
        
        document.getElementById('generate-batch').disabled = !hasSelected;
        document.getElementById('download-batch').disabled = !hasSelected;
        
        // Update select all button text
        const selectAllBtn = document.getElementById('select-all-events');
        const allSelected = this.selectedEvents.size === this.events.length;
        
        if (allSelected) {
            selectAllBtn.innerHTML = '<i class="fas fa-times mr-2"></i>Deselect All';
        } else {
            selectAllBtn.innerHTML = '<i class="fas fa-check-double mr-2"></i>Select All';
        }
    }

    async generateBatch() {
        const selectedEventIds = Array.from(this.selectedEvents);
        const selectedEventObjects = this.events.filter(e => selectedEventIds.includes(e.id));
        
        console.log('🎬 Generating batch videos for:', selectedEventObjects.length, 'events');
        
        const progressContainer = document.getElementById('batch-progress');
        const progressBar = document.getElementById('progress-bar');
        const progressText = document.getElementById('progress-text');
        
        progressContainer.classList.remove('hidden');
        
        let completed = 0;
        const total = selectedEventObjects.length;
        
        try {
            for (const event of selectedEventObjects) {
                progressText.textContent = `${completed}/${total}`;
                progressBar.style.width = `${(completed / total) * 100}%`;
                
                // Generate video for this event
                await this.generateVideoData(event);
                
                completed++;
                this.generatedVideos++;
            }
            
            progressText.textContent = `${completed}/${total}`;
            progressBar.style.width = '100%';
            
            this.updateStats();
            this.showStatus('success', `Generated ${total} videos successfully!`);
            
            // Enable batch download
            document.getElementById('download-batch').disabled = false;
            
        } catch (error) {
            console.error('❌ Error in batch generation:', error);
            this.showStatus('error', 'Batch generation failed');
        } finally {
            setTimeout(() => {
                progressContainer.classList.add('hidden');
            }, 2000);
        }
    }

    downloadBatch() {
        const selectedCount = this.selectedEvents.size;
        
        console.log('📥 Downloading batch of', selectedCount, 'videos');
        
        this.showStatus('info', `Preparing ZIP download with ${selectedCount} videos...`);
        
        // Simulate ZIP creation and download
        setTimeout(() => {
            this.downloadCount += selectedCount;
            this.updateStats();
            this.showStatus('success', 'Batch download started!');
        }, 2000);
    }

    updateStats() {
        document.getElementById('total-events').textContent = this.events.length;
        document.getElementById('generated-videos').textContent = this.generatedVideos;
        document.getElementById('download-count').textContent = this.downloadCount;
        document.getElementById('events-count').textContent = this.events.length;
    }

    updateWeekRange() {
        const now = new Date();
        const endOfWeek = new Date(now);
        endOfWeek.setDate(endOfWeek.getDate() + 7);
        
        const formatDate = (date) => {
            return date.toLocaleDateString('en-GB', { 
                day: 'numeric', 
                month: 'short' 
            });
        };
        
        document.getElementById('week-range').textContent = 
            `${formatDate(now)} - ${formatDate(endOfWeek)}`;
    }

    showStatus(type, message) {
        const container = document.getElementById('status-messages');
        const statusEl = document.createElement('div');
        
        const colors = {
            success: 'bg-green-600',
            error: 'bg-red-600',
            info: 'bg-blue-600',
            warning: 'bg-yellow-600'
        };
        
        statusEl.className = `${colors[type]} text-white px-4 py-2 rounded-lg shadow-lg transform transition-all duration-300 translate-x-full`;
        statusEl.innerHTML = `
            <div class="flex items-center justify-between">
                <span>${message}</span>
                <button class="ml-4 text-white hover:text-gray-200">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        container.appendChild(statusEl);
        
        // Animate in
        setTimeout(() => {
            statusEl.classList.remove('translate-x-full');
        }, 100);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            statusEl.classList.add('translate-x-full');
            setTimeout(() => {
                if (statusEl.parentNode) {
                    statusEl.parentNode.removeChild(statusEl);
                }
            }, 300);
        }, 5000);
        
        // Add close button handler
        statusEl.querySelector('button').addEventListener('click', () => {
            statusEl.classList.add('translate-x-full');
            setTimeout(() => {
                if (statusEl.parentNode) {
                    statusEl.parentNode.removeChild(statusEl);
                }
            }, 300);
        });
    }
}

// Initialize the Social Reels Generator when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.reelsGenerator = new SocialReelsGenerator();
}); 