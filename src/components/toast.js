/**
 * Toast - Self-dismissing notification messages
 * Shows brief messages that fade out automatically
 */
class Toast {
    constructor() {
        this.container = null;
        this.createContainer();
    }

    /**
     * Create the toast container element
     */
    createContainer() {
        this.container = document.createElement('div');
        this.container.id = 'toast-container';
        this.container.style.cssText = `
      position: fixed;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 2000;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      pointer-events: none;
    `;
        document.body.appendChild(this.container);
    }

    /**
     * Show a toast message
     * @param {string} message - The message to display
     * @param {Object} options - Display options
     * @param {string} options.type - 'info', 'warning', 'success', 'error'
     * @param {number} options.duration - Duration in ms (default 4000)
     * @param {string} options.icon - Material icon name
     */
    show(message, options = {}) {
        const {
            type = 'info',
            duration = 4000,
            icon = null
        } = options;

        const colors = {
            info: { bg: 'rgba(0, 150, 255, 0.9)', border: 'rgba(0, 200, 255, 0.3)' },
            warning: { bg: 'rgba(255, 180, 0, 0.9)', border: 'rgba(255, 200, 0, 0.3)' },
            success: { bg: 'rgba(0, 200, 100, 0.9)', border: 'rgba(0, 255, 100, 0.3)' },
            error: { bg: 'rgba(255, 80, 80, 0.9)', border: 'rgba(255, 100, 100, 0.3)' }
        };

        const icons = {
            info: 'info',
            warning: 'warning',
            success: 'check_circle',
            error: 'error'
        };

        const color = colors[type] || colors.info;
        const iconName = icon || icons[type];

        const toast = document.createElement('div');
        toast.style.cssText = `
      background: ${color.bg};
      border: 1px solid ${color.border};
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border-radius: 8px;
      padding: 12px 18px;
      color: #fff;
      font-family: 'Segoe UI', system-ui, sans-serif;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 10px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
      opacity: 0;
      transform: translateY(20px);
      transition: opacity 0.3s ease, transform 0.3s ease;
      max-width: 400px;
      text-align: left;
    `;

        toast.innerHTML = `
      <span class="material-icons" style="font-size: 18px;">${iconName}</span>
      <span>${message}</span>
    `;

        this.container.appendChild(toast);

        // Trigger animation
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        });

        // Auto dismiss
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-20px)';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, duration);
    }

    /**
     * Show info toast
     */
    info(message, duration = 4000) {
        this.show(message, { type: 'info', duration });
    }

    /**
     * Show warning toast
     */
    warning(message, duration = 5000) {
        this.show(message, { type: 'warning', duration });
    }

    /**
     * Show success toast
     */
    success(message, duration = 3000) {
        this.show(message, { type: 'success', duration });
    }

    /**
     * Show error toast
     */
    error(message, duration = 5000) {
        this.show(message, { type: 'error', duration });
    }
}

export default Toast;
