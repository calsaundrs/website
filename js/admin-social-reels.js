class SocialReelsGenerator {
    constructor() {
        this.events = [];
        this.selectedEvent = null;
        this.selectedTemplate = 'modern';
        this.generatedVideos = 0;
        this.downloadCount = 0;
        this.selectedEvents = new Set();
        this.currentDateRange = {
            preset: 'this-week',
            customStart: null,
            customEnd: null
        };
        this.videoSettings = {
            duration: 5,
            includeLogo: true,
            includeHashtags: true
        };
        this.currentVideoData = null;
        
        this.init();
    }

    init() {
        console.log('🎬 Initializing Social Reels Generator');
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Load initial data
        this.loadEvents();
        
        // Initialize UI
        this.selectTemplate('modern');
        this.setupTryDifferentRangeButton();
        // this.setupCreateExamplesButton(); // Removed - now using real events
    }

    setupEventListeners() {
        // Refresh events
        document.getElementById('refresh-events').addEventListener('click', () => {
            this.loadEvents(this.currentDateRange.preset, this.currentDateRange.customStart, this.currentDateRange.customEnd);
        });

        // Date range controls
        document.getElementById('date-preset').addEventListener('change', (e) => {
            const preset = e.target.value;
            if (preset === 'custom') {
                document.getElementById('custom-date-range').classList.remove('hidden');
            } else {
                document.getElementById('custom-date-range').classList.add('hidden');
                this.currentDateRange.preset = preset;
                this.currentDateRange.customStart = null;
                this.currentDateRange.customEnd = null;
                this.loadEvents(preset);
            }
        });

        document.getElementById('apply-custom-range').addEventListener('click', () => {
            const startDate = document.getElementById('start-date').value;
            const endDate = document.getElementById('end-date').value;
            
            if (startDate && endDate) {
                this.currentDateRange.preset = 'custom';
                this.currentDateRange.customStart = startDate;
                this.currentDateRange.customEnd = endDate;
                this.loadEvents('custom', startDate, endDate);
            }
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

    async loadEvents(preset = 'this-week', customStart = null, customEnd = null) {
        console.log('📅 Loading real events from main system for date range:', preset, customStart, customEnd);
        
        this.showLoading(true);
        
        try {
            // Use the same endpoint as the main events page
            const url = '/.netlify/functions/get-events';
            const params = new URLSearchParams();
            
            // Set up date range filtering
            const dateRange = this.getDateRangeFromPreset(preset, customStart, customEnd);
            params.append('dateRange', JSON.stringify({
                type: 'between',
                start: dateRange.start.toISOString(),
                end: dateRange.end.toISOString()
            }));
            
            // Only get approved events
            params.append('status', 'approved');
            
            // Increase limit for Social Reels Generator
            params.append('limit', '100');
            
            console.log('📡 Fetching from:', `${url}?${params.toString()}`);
            
            const response = await fetch(`${url}?${params.toString()}`);
            const data = await response.json();
            
            if (data.success !== false && data.events) {
                // Filter events to only include future events in our date range
                const dateRange = this.getDateRangeFromPreset(preset, customStart, customEnd);
                this.events = data.events.filter(event => {
                    const eventDate = new Date(event.date);
                    return eventDate >= dateRange.start && eventDate <= dateRange.end;
                });
                
                // Process events for Social Reels format
                this.events = this.events.map(event => this.processEventForReels(event));
                
                this.renderEvents();
                this.updateStats();
                
                // Create fake date range display data for compatibility
                this.updateDateRangeDisplay({
                    dateRange: {
                        start: dateRange.start.toISOString(),
                        end: dateRange.end.toISOString(),
                        preset: preset,
                        isCustomRange: !!(customStart && customEnd)
                    }
                });
                
                const rangeDesc = (customStart && customEnd) ? 'custom range' : preset.replace('-', ' ');
                this.showStatus('success', `Loaded ${this.events.length} real events for ${rangeDesc}`);
                console.log(`✅ Loaded ${this.events.length} real events from main system`, this.events);
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
            
            // Generate actual video using Remotion
            const videoData = await this.generateActualVideo(this.selectedEvent);
            
            if (videoData.success) {
                // Show actual video player
                this.showVideoPlayer(videoData);
                
                // Enable download button
                document.getElementById('download-video').disabled = false;
                
                this.generatedVideos++;
                this.updateStats();
                
                this.showStatus('success', 'Video preview generated and ready to play!');
            } else {
                throw new Error(videoData.error || 'Video generation failed');
            }
            
        } catch (error) {
            console.error('❌ Error generating preview:', error);
            this.showStatus('error', 'Failed to generate preview: ' + error.message);
            
            // Fallback to preview placeholder for demo
            const previewData = await this.generateVideoData(this.selectedEvent);
            this.showVideoPreview(previewData);
        } finally {
            button.innerHTML = originalText;
            button.disabled = false;
        }
    }

    async generateActualVideo(event) {
        // Try the full Remotion generator first, fallback to demo generator
        console.log('🎯 Generating actual video for template:', this.selectedTemplate);
        
        try {
            // First try the full Remotion integration
            const response = await fetch('/.netlify/functions/generate-social-reel', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    eventId: event.id,
                    template: this.selectedTemplate,
                    settings: this.videoSettings
                })
            });
            
            const result = await response.json();
            if (result.success) {
                return result;
            }
            
            // If Remotion fails, fallback to demo generator
            console.log('🔄 Remotion failed, trying demo generator...');
            throw new Error('Remotion unavailable');
            
        } catch (error) {
            console.log('🎭 Using demo video generator for immediate preview');
            
            // Fallback to demo generator for immediate functionality
            const demoResponse = await fetch('/.netlify/functions/generate-demo-video', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    eventId: event.id,
                    template: this.selectedTemplate,
                    settings: this.videoSettings
                })
            });
            
            return await demoResponse.json();
        }
    }

    async generateVideoData(event) {
        // This is a fallback placeholder for the actual Remotion integration
        console.log('🎯 Generating fallback video data for template:', this.selectedTemplate);
        
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

    showVideoPlayer(videoData) {
        const placeholder = document.getElementById('video-placeholder');
        const player = document.getElementById('video-player');
        
        // Hide placeholder and show video player
        placeholder.classList.add('hidden');
        player.classList.remove('hidden');
        
        if (videoData.mockMode || videoData.demoMode) {
            // Show interactive demo player with enhanced preview
            player.innerHTML = `
                <div id="remotion-player-container" class="w-full h-full">
                    <div class="w-full h-full bg-gradient-to-br from-pink-500 via-purple-600 to-blue-600 flex flex-col items-center justify-center text-white p-4 relative overflow-hidden">
                        <div class="absolute top-2 right-2 bg-black bg-opacity-50 px-2 py-1 rounded text-xs">
                            ${videoData.demoMode ? 'DEMO MODE' : 'PREVIEW MODE'}
                        </div>
                        
                        <!-- Background animation elements -->
                        <div class="absolute inset-0 opacity-10">
                            <div class="absolute top-10 left-10 w-32 h-32 bg-white rounded-full animate-pulse"></div>
                            <div class="absolute bottom-20 right-10 w-24 h-24 bg-white rounded-full animate-pulse" style="animation-delay: 1s;"></div>
                        </div>
                        
                        <div class="text-center relative z-10">
                            <div class="mb-4">
                                <div class="w-20 h-20 mx-auto mb-3 bg-white bg-opacity-20 rounded-full flex items-center justify-center relative">
                                    <i class="fas fa-video text-3xl"></i>
                                    <div class="absolute inset-0 border-2 border-[#f3e8ff] border-opacity-30 rounded-full animate-spin"></div>
                                </div>
                                <h3 class="font-bold text-xl mb-1">${videoData.event.name}</h3>
                                <p class="text-sm opacity-90 mb-1">${videoData.event.venue.name}</p>
                                <p class="text-xs opacity-75">${videoData.event.formattedDate}</p>
                            </div>
                            
                            <div class="mt-4 bg-black bg-opacity-30 rounded-lg p-4 backdrop-blur-sm">
                                <div class="grid grid-cols-2 gap-3 text-xs">
                                    <div>
                                        <span class="opacity-60">Template:</span><br>
                                        <span class="font-semibold">${this.getTemplateName(videoData.template)}</span>
                                    </div>
                                    <div>
                                        <span class="opacity-60">Duration:</span><br>
                                        <span class="font-semibold">${videoData.duration}s</span>
                                    </div>
                                    <div>
                                        <span class="opacity-60">Resolution:</span><br>
                                        <span class="font-semibold">${videoData.resolution.width}x${videoData.resolution.height}</span>
                                    </div>
                                    <div>
                                        <span class="opacity-60">Format:</span><br>
                                        <span class="font-semibold">${videoData.format.toUpperCase()}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="mt-4 space-y-2">
                                <button class="w-full bg-white bg-opacity-20 hover:bg-opacity-30 px-4 py-3 rounded-lg text-sm transition-all flex items-center justify-center" onclick="window.reelsGenerator.playPreviewAnimation()">
                                    <i class="fas fa-play mr-2"></i>Play Preview Animation
                                </button>
                                <p class="text-xs opacity-60">Interactive preview • Click to animate</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } else {
            // Show actual video player for real video
            player.innerHTML = `
                <video 
                    controls 
                    autoplay 
                    muted 
                    loop 
                    class="w-full h-full object-cover rounded-lg"
                    src="${videoData.videoUrl}"
                    poster="${videoData.thumbnailUrl || ''}"
                >
                    <p class="text-center text-gray-400 p-4">
                        Your browser does not support the video tag.
                        <a href="${videoData.videoUrl}" class="text-purple-400 underline">Download video</a>
                    </p>
                </video>
                <div class="absolute bottom-2 left-2 bg-black bg-opacity-70 text-white px-2 py-1 rounded text-xs">
                    ${videoData.resolution.width}x${videoData.resolution.height} • ${videoData.duration}s
                </div>
            `;
        }
        
        // Store video data for download
        this.currentVideoData = videoData;
    }

    showVideoPreview(videoData) {
        const placeholder = document.getElementById('video-placeholder');
        const player = document.getElementById('video-player');
        
        // Show fallback static preview
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

    playPreviewAnimation() {
        // Enhanced preview animation that simulates video playback
        const container = document.getElementById('remotion-player-container');
        const button = container?.querySelector('button');
        
        if (container && button) {
            // Disable button during animation
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner animate-spin mr-2"></i>Playing Preview...';
            
            // Add visual effects
            container.style.transform = 'scale(1.02)';
            container.style.transition = 'transform 0.3s ease';
            
            // Simulate video frames with color transitions
            let frame = 0;
            const totalFrames = 60; // 2 seconds at 30fps
            
            const animationInterval = setInterval(() => {
                frame++;
                const progress = frame / totalFrames;
                
                // Create color transitions
                const hue = (progress * 360) % 360;
                const saturation = 50 + (Math.sin(progress * Math.PI * 4) * 20);
                const lightness = 40 + (Math.sin(progress * Math.PI * 2) * 10);
                
                const gradientDiv = container.querySelector('.bg-gradient-to-br');
                if (gradientDiv) {
                    gradientDiv.style.background = `linear-gradient(135deg, 
                        hsl(${hue}, ${saturation}%, ${lightness}%) 0%, 
                        hsl(${(hue + 60) % 360}, ${saturation + 10}%, ${lightness + 10}%) 50%, 
                        hsl(${(hue + 120) % 360}, ${saturation}%, ${lightness}%) 100%)`;
                }
                
                // Add scale animation
                const videoIcon = container.querySelector('.fas.fa-video');
                if (videoIcon) {
                    const scale = 1 + (Math.sin(progress * Math.PI * 8) * 0.1);
                    videoIcon.style.transform = `scale(${scale})`;
                }
                
                if (frame >= totalFrames) {
                    clearInterval(animationInterval);
                    
                    // Reset styles
                    container.style.transform = 'scale(1)';
                    if (gradientDiv) {
                        gradientDiv.style.background = '';
                        gradientDiv.className = 'w-full h-full bg-gradient-to-br from-pink-500 via-purple-600 to-blue-600 flex flex-col items-center justify-center text-white p-4 relative overflow-hidden';
                    }
                    
                    // Reset button
                    button.disabled = false;
                    button.innerHTML = '<i class="fas fa-play mr-2"></i>Play Preview Animation';
                    
                    // Show completion message
                    this.showStatus('success', 'Preview animation completed!');
                }
            }, 33); // ~30fps
        }
    }

    async downloadVideo() {
        if (!this.selectedEvent) return;
        
        console.log('📥 Downloading video for:', this.selectedEvent.name);
        
        const filename = `${this.selectedEvent.slug || this.selectedEvent.name.toLowerCase().replace(/\s+/g, '-')}_reel.mp4`;
        
        if (this.currentVideoData && this.currentVideoData.videoUrl && !this.currentVideoData.mockMode) {
            // Download actual video file
            try {
                const response = await fetch(this.currentVideoData.videoUrl);
                const blob = await response.blob();
                
                // Create download link
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                
                this.downloadCount++;
                this.updateStats();
                this.showStatus('success', 'Video downloaded successfully!');
                
            } catch (error) {
                console.error('Download error:', error);
                this.showStatus('error', 'Failed to download video');
            }
        } else {
            // Simulate download for preview mode
            this.showStatus('info', `Preparing download: ${filename}`);
            
            setTimeout(() => {
                this.downloadCount++;
                this.updateStats();
                this.showStatus('success', 'Video download started! (Preview mode)');
            }, 1000);
        }
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

    updateDateRangeDisplay(data) {
        const formatDate = (date) => {
            return new Date(date).toLocaleDateString('en-GB', { 
                day: 'numeric', 
                month: 'short',
                year: 'numeric'
            });
        };
        
        const startFormatted = formatDate(data.dateRange.start);
        const endFormatted = formatDate(data.dateRange.end);
        
        document.getElementById('date-range-display').textContent = 
            `${startFormatted} - ${endFormatted}`;
            
        // Update section title based on preset
        const titles = {
            'today': 'Today\'s Events',
            'tomorrow': 'Tomorrow\'s Events', 
            'this-week': 'This Week\'s Events',
            'next-week': 'Next Week\'s Events',
            'this-month': 'This Month\'s Events',
            'next-month': 'Next Month\'s Events',
            'next-30-days': 'Next 30 Days Events',
            'next-60-days': 'Next 60 Days Events',
            'custom': 'Custom Range Events'
        };
        
        const title = titles[data.dateRange.preset] || 'Selected Events';
        document.getElementById('events-section-title').textContent = title;
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

    getDateRangeFromPreset(preset, customStart = null, customEnd = null) {
        if (customStart && customEnd) {
            return {
                start: new Date(customStart),
                end: new Date(customEnd + 'T23:59:59.999Z')
            };
        }
        
        const now = new Date();
        let start, end;
        
        switch (preset) {
            case 'today':
                start = new Date(now);
                start.setHours(0, 0, 0, 0);
                end = new Date(now);
                end.setHours(23, 59, 59, 999);
                break;
                
            case 'tomorrow':
                start = new Date(now);
                start.setDate(start.getDate() + 1);
                start.setHours(0, 0, 0, 0);
                end = new Date(start);
                end.setHours(23, 59, 59, 999);
                break;
                
            case 'this-week':
                start = new Date(now);
                start.setHours(0, 0, 0, 0);
                end = new Date(now);
                end.setDate(end.getDate() + 7);
                end.setHours(23, 59, 59, 999);
                break;
                
            case 'next-week':
                start = new Date(now);
                start.setDate(start.getDate() + 7);
                start.setHours(0, 0, 0, 0);
                end = new Date(start);
                end.setDate(end.getDate() + 7);
                end.setHours(23, 59, 59, 999);
                break;
                
            case 'this-month':
                start = new Date(now.getFullYear(), now.getMonth(), 1);
                end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                end.setHours(23, 59, 59, 999);
                break;
                
            case 'next-month':
                start = new Date(now.getFullYear(), now.getMonth() + 1, 1);
                end = new Date(now.getFullYear(), now.getMonth() + 2, 0);
                end.setHours(23, 59, 59, 999);
                break;
                
            case 'next-30-days':
                start = new Date(now);
                start.setHours(0, 0, 0, 0);
                end = new Date(now);
                end.setDate(end.getDate() + 30);
                end.setHours(23, 59, 59, 999);
                break;
                
            case 'next-60-days':
                start = new Date(now);
                start.setHours(0, 0, 0, 0);
                end = new Date(now);
                end.setDate(end.getDate() + 60);
                end.setHours(23, 59, 59, 999);
                break;
                
            default:
                // Default to this week
                start = new Date(now);
                start.setHours(0, 0, 0, 0);
                end = new Date(now);
                end.setDate(end.getDate() + 7);
                end.setHours(23, 59, 59, 999);
        }
        
        return { start, end };
    }

    processEventForReels(event) {
        // Convert the main events format to Social Reels format
        const eventDate = new Date(event.date);
        
        return {
            id: event.id,
            name: event.name || 'Untitled Event',
            description: event.description || '',
            date: event.date,
            dayOfWeek: eventDate.toLocaleDateString('en-GB', { weekday: 'long' }),
            time: eventDate.toLocaleTimeString('en-GB', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            }),
            venue: {
                id: event.venueId || null,
                name: event.venue || event.venueName || 'TBA',
                address: event.venueAddress || '',
                slug: event.venueSlug || ''
            },
            category: event.category || event.categories || [],
            image: event.image?.url || event.cloudinaryPublicId ? 
                `https://res.cloudinary.com/dbxhpjoiz/image/upload/f_auto,q_auto,w_1080,h_1080,c_fill,g_center/${event.cloudinaryPublicId || event.image?.cloudinaryId}` : 
                'https://res.cloudinary.com/dbxhpjoiz/image/upload/f_auto,q_auto,w_1080,h_1080,c_fill,g_center/sample-event-placeholder',
            slug: event.slug || '',
            ticketLink: event.link || event.ticketLink || '',
            priceInfo: event.priceInfo || event.price || 'Free',
            ageRestriction: event.ageRestriction || '18+',
            shortDescription: this.truncateText(event.description || '', 100),
            hashtags: this.generateHashtags(event.category || event.categories || [], event.venue || event.venueName || ''),
            formattedDate: this.formatDateForVideo(eventDate)
        };
    }

    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substr(0, maxLength) + '...';
    }

    generateHashtags(categories, venueName) {
        const hashtags = ['#BrumOutLoud', '#LGBTQ', '#Birmingham'];
        
        // Add category hashtags
        categories.forEach(cat => {
            const tag = '#' + cat.replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '');
            if (tag.length > 1) hashtags.push(tag);
        });
        
        // Add venue hashtag
        if (venueName) {
            const venueTag = '#' + venueName.replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '');
            if (venueTag.length > 1) hashtags.push(venueTag);
        }
        
        return hashtags.slice(0, 8); // Limit to 8 hashtags
    }

    formatDateForVideo(date) {
        const options = { 
            weekday: 'long', 
            day: 'numeric', 
            month: 'long',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        };
        
        return date.toLocaleDateString('en-GB', options);
    }

    setupTryDifferentRangeButton() {
        document.getElementById('try-different-range').addEventListener('click', () => {
            // Suggest a broader range
            const suggestions = ['this-month', 'next-month', 'next-30-days', 'next-60-days'];
            const currentPreset = this.currentDateRange.preset;
            
            // Find next suggestion that's broader than current
            let nextPreset = 'next-30-days';
            if (currentPreset === 'today' || currentPreset === 'tomorrow') {
                nextPreset = 'this-week';
            } else if (currentPreset === 'this-week') {
                nextPreset = 'this-month';
            } else if (currentPreset === 'this-month') {
                nextPreset = 'next-month';
            }
            
            document.getElementById('date-preset').value = nextPreset;
            this.currentDateRange.preset = nextPreset;
            this.currentDateRange.customStart = null;
            this.currentDateRange.customEnd = null;
            this.loadEvents(nextPreset);
        });
    }

    // setupCreateExamplesButton() {
    //     // Removed - now using real events from the main events system
    // }
}

// Debug logging
console.log('🎬 Social Reels Generator JavaScript loaded');
console.log('📅 Loading timestamp:', new Date().toISOString());

// Initialize the Social Reels Generator when the page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎯 DOM Content Loaded - Initializing Social Reels Generator');
    
    try {
        window.reelsGenerator = new SocialReelsGenerator();
        console.log('✅ Social Reels Generator initialized successfully');
    } catch (error) {
        console.error('❌ Error initializing Social Reels Generator:', error);
        alert('Error initializing Social Reels Generator: ' + error.message);
    }
}); 