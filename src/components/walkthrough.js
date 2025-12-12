/**
 * Walkthrough - Interactive onboarding tutorial for first-time users
 * Shows step-by-step highlights of key UI elements with descriptions
 */
class Walkthrough {
    constructor() {
        this.currentStep = 0;
        this.overlay = null;
        this.card = null;
        this.isActive = false;

        // Walkthrough steps configuration
        // Each step targets a specific element and provides guidance
        this.steps = [
            {
                target: 'canvas',
                title: 'Welcome to Satorama',
                description: '3D satellite orbit visualization. Watch satellites orbit Earth with accurate orbital mechanics. Let\'s take a quick tour!',
                icon: 'rocket_launch',
                position: 'center'
            },
            {
                target: '.control-section:has(#time-play-pause)',
                title: 'Time Control',
                description: 'Control simulation time. Play/pause, speed up, or run time backwards to see satellite orbits evolve.',
                icon: 'schedule',
                position: 'left'
            },
            {
                target: '.control-section:has(#satellite-slider)',
                title: 'Synthetic Density',
                description: 'Add synthetic satellites to visualize orbital patterns. Try sliding to ~500 to see the orbits come alive!',
                icon: 'tune',
                position: 'left',
                action: 'slide'
            },
            {
                target: '.toggle-grid',
                title: 'Data Layers',
                description: 'Toggle visibility of satellites and ground stations on the globe.',
                icon: 'layers',
                position: 'left'
            },
            {
                target: '.control-section:has(.filter-list)',
                title: 'Orbit Class Filter',
                description: 'Filter satellites by orbit type: LEO (Low Earth), MEO (Medium), GEO (Geostationary), or HEO (Highly Elliptical).',
                icon: 'filter_alt',
                position: 'left'
            },
            {
                target: '#preset-buttons',
                title: 'Load Presets',
                description: 'Load curated satellite groups like ISS, GPS constellation, Starlink, or weather satellites.',
                icon: 'collections_bookmark',
                position: 'left'
            },
            {
                target: '#search-toggle',
                title: 'Search Database',
                description: 'Search for specific satellites by name or designation. Use Ctrl+F as a shortcut.',
                icon: 'search',
                position: 'left'
            },
            {
                target: '#info',
                title: 'Object Analysis',
                description: 'Click any satellite or ground station to see detailed information here, including orbital parameters.',
                icon: 'radar',
                position: 'right'
            },
            {
                target: 'canvas',
                title: 'Camera Controls',
                description: 'Drag to rotate the view. Scroll to zoom in/out. Middle-click drag to pan. Enjoy exploring!',
                icon: '3d_rotation',
                position: 'center'
            }
        ];
    }

    /**
     * Check if user has seen the walkthrough before
     */
    hasSeenWalkthrough() {
        return localStorage.getItem('satorama-walkthrough-seen') === 'true';
    }

    /**
     * Mark walkthrough as seen
     */
    markAsSeen() {
        localStorage.setItem('satorama-walkthrough-seen', 'true');
    }

    /**
     * Create the walkthrough overlay and card elements
     */
    createElements() {
        // Main overlay
        this.overlay = document.createElement('div');
        this.overlay.className = 'walkthrough-overlay';
        this.overlay.innerHTML = `
            <div class="walkthrough-backdrop"></div>
            <div class="walkthrough-spotlight"></div>
            <div class="walkthrough-card">
                <button class="walkthrough-close" title="Skip Tutorial">
                    <span class="material-icons">close</span>
                </button>
                <div class="walkthrough-icon">
                    <span class="material-icons">info</span>
                </div>
                <div class="walkthrough-content">
                    <h3 class="walkthrough-title">Welcome</h3>
                    <p class="walkthrough-description">Loading...</p>
                </div>
                <div class="walkthrough-footer">
                    <div class="walkthrough-progress"></div>
                    <div class="walkthrough-nav">
                        <button class="walkthrough-btn walkthrough-prev">
                            <span class="material-icons">arrow_back</span> Back
                        </button>
                        <button class="walkthrough-btn walkthrough-btn-primary walkthrough-next">
                            Next <span class="material-icons">arrow_forward</span>
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(this.overlay);

        // Cache references
        this.card = this.overlay.querySelector('.walkthrough-card');
        this.spotlight = this.overlay.querySelector('.walkthrough-spotlight');
        this.backdrop = this.overlay.querySelector('.walkthrough-backdrop');

        // Event listeners
        this.overlay.querySelector('.walkthrough-close').addEventListener('click', () => this.end());
        this.overlay.querySelector('.walkthrough-prev').addEventListener('click', () => this.prev());
        this.overlay.querySelector('.walkthrough-next').addEventListener('click', () => this.next());

        // Click on backdrop to close
        this.backdrop.addEventListener('click', () => this.end());

        // Keyboard navigation
        this.keyHandler = (e) => {
            if (!this.isActive) return;
            if (e.key === 'Escape') this.end();
            if (e.key === 'ArrowRight' || e.key === 'Enter') this.next();
            if (e.key === 'ArrowLeft') this.prev();
        };
        document.addEventListener('keydown', this.keyHandler);
    }

    /**
     * Start the walkthrough from the beginning
     */
    start() {
        if (this.isActive) return;

        this.currentStep = 0;
        this.isActive = true;

        if (!this.overlay) {
            this.createElements();
        }

        this.overlay.classList.add('active');
        this.updateStep();
    }

    /**
     * End the walkthrough
     */
    end() {
        if (!this.isActive) return;

        this.isActive = false;
        this.overlay.classList.remove('active');
        this.spotlight.style.opacity = '0';
        this.markAsSeen();
    }

    /**
     * Go to next step
     */
    next() {
        if (this.currentStep < this.steps.length - 1) {
            this.currentStep++;
            this.updateStep();
        } else {
            this.end();
        }
    }

    /**
     * Go to previous step
     */
    prev() {
        if (this.currentStep > 0) {
            this.currentStep--;
            this.updateStep();
        }
    }

    /**
     * Update display for current step
     */
    updateStep() {
        const step = this.steps[this.currentStep];
        const targetEl = document.querySelector(step.target);

        // Update card content
        this.card.querySelector('.walkthrough-icon .material-icons').textContent = step.icon;
        this.card.querySelector('.walkthrough-title').textContent = step.title;
        this.card.querySelector('.walkthrough-description').textContent = step.description;

        // Update progress dots
        const progressContainer = this.card.querySelector('.walkthrough-progress');
        progressContainer.innerHTML = this.steps.map((_, i) =>
            `<span class="progress-dot ${i === this.currentStep ? 'active' : ''} ${i < this.currentStep ? 'completed' : ''}"></span>`
        ).join('');

        // Update nav buttons
        const prevBtn = this.card.querySelector('.walkthrough-prev');
        const nextBtn = this.card.querySelector('.walkthrough-next');

        prevBtn.style.visibility = this.currentStep === 0 ? 'hidden' : 'visible';

        if (this.currentStep === this.steps.length - 1) {
            nextBtn.innerHTML = `Done <span class="material-icons">check</span>`;
        } else {
            nextBtn.innerHTML = `Next <span class="material-icons">arrow_forward</span>`;
        }

        // Position spotlight and card
        if (targetEl) {
            const rect = targetEl.getBoundingClientRect();
            const padding = 8;

            // Position spotlight
            this.spotlight.style.cssText = `
                top: ${rect.top - padding}px;
                left: ${rect.left - padding}px;
                width: ${rect.width + padding * 2}px;
                height: ${rect.height + padding * 2}px;
                opacity: 1;
            `;

            // Position card based on step position preference
            this.positionCard(rect, step.position);
        } else {
            // No target found, hide spotlight and center card
            this.spotlight.style.opacity = '0';
            this.card.style.cssText = `
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
            `;
        }
    }

    /**
     * Position the card relative to the target element
     */
    positionCard(targetRect, position) {
        const cardWidth = 320;
        const cardHeight = 200;
        const gap = 20;

        let top, left;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        switch (position) {
            case 'left':
                // Card to the left of target
                top = Math.min(targetRect.top, viewportHeight - cardHeight - gap);
                left = targetRect.left - cardWidth - gap;
                if (left < gap) {
                    // Not enough space on left, try bottom
                    left = targetRect.left;
                    top = targetRect.bottom + gap;
                }
                break;
            case 'right':
                // Card to the right of target
                top = Math.min(targetRect.top, viewportHeight - cardHeight - gap);
                left = targetRect.right + gap;
                if (left + cardWidth > viewportWidth - gap) {
                    // Not enough space on right, try bottom
                    left = targetRect.right - cardWidth;
                    top = targetRect.bottom + gap;
                }
                break;
            case 'center':
            default:
                // Center card on screen
                top = viewportHeight / 2 - cardHeight / 2;
                left = viewportWidth / 2 - cardWidth / 2;
                break;
        }

        // Clamp to viewport
        top = Math.max(gap, Math.min(top, viewportHeight - cardHeight - gap));
        left = Math.max(gap, Math.min(left, viewportWidth - cardWidth - gap));

        this.card.style.cssText = `
            top: ${top}px;
            left: ${left}px;
            transform: none;
        `;
    }

    /**
     * Handle window resize
     */
    handleResize() {
        if (this.isActive) {
            this.updateStep();
        }
    }
}

export default Walkthrough;
