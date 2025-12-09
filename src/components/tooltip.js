/**
 * Tooltip - Hover tooltip for satellites and ground stations
 * Creates a DOM element that follows the cursor when hovering over objects
 */
class Tooltip {
  constructor() {
    this.element = null;
    this.visible = false;
    this.createTooltipElement();
  }

  /**
   * Create the tooltip DOM element
   */
  createTooltipElement() {
    this.element = document.createElement('div');
    this.element.id = 'object-tooltip';
    this.element.style.cssText = `
      position: fixed;
      background: rgba(10, 15, 25, 0.9);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      padding: 10px 14px;
      color: #fff;
      font-family: 'Segoe UI', system-ui, sans-serif;
      font-size: 13px;
      pointer-events: none;
      z-index: 1000;
      display: none;
      max-width: 280px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    `;
    document.body.appendChild(this.element);
  }

  /**
   * Show tooltip at screen position with data
   * @param {number} x - Screen X coordinate
   * @param {number} y - Screen Y coordinate
   * @param {Object} data - Object data to display
   */
  show(x, y, data) {
    if (!data) return;

    let html = '';

    if (data.type === 'satellite') {
      const typeColors = {
        LEO: '#00ffff',
        MEO: '#ffff00',
        GEO: '#ff00ff',
        HEO: '#ff0000'
      };
      const color = typeColors[data.objectType] || '#ffffff';
      
      html = `
        <div style="font-weight: 600; margin-bottom: 6px; color: ${color};">${data.name}</div>
        <div style="color: #aaa; font-size: 11px; text-transform: uppercase; margin-bottom: 4px;">${data.objectType} Satellite</div>
        <div style="display: grid; gap: 3px; font-size: 12px;">
          <div><span style="color: #888;">Altitude:</span> ${data.altitude?.toFixed(0) || '—'} km</div>
          <div><span style="color: #888;">Period:</span> ${data.period?.toFixed(1) || '—'} min</div>
          <div><span style="color: #888;">Inclination:</span> ${data.inclination?.toFixed(1) || '—'}°</div>
        </div>
      `;
    } else if (data.type === 'groundStation') {
      html = `
        <div style="font-weight: 600; margin-bottom: 6px; color: #00ff00;">${data.name}</div>
        <div style="color: #aaa; font-size: 11px; text-transform: uppercase; margin-bottom: 4px;">Ground Station</div>
        <div style="display: grid; gap: 3px; font-size: 12px;">
          <div><span style="color: #888;">Location:</span> ${data.lat?.toFixed(2)}°, ${data.lon?.toFixed(2)}°</div>
          ${data.visibleCount !== undefined ? `<div><span style="color: #888;">Visible Sats:</span> ${data.visibleCount}</div>` : ''}
        </div>
      `;
    }

    this.element.innerHTML = html;
    this.updatePosition(x, y);
    this.element.style.display = 'block';
    this.visible = true;
  }

  /**
   * Update tooltip position
   * @param {number} x - Screen X coordinate
   * @param {number} y - Screen Y coordinate
   */
  updatePosition(x, y) {
    // Offset from cursor
    const offsetX = 15;
    const offsetY = 15;

    // Keep tooltip within viewport
    const rect = this.element.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width - 10;
    const maxY = window.innerHeight - rect.height - 10;

    const posX = Math.min(x + offsetX, maxX);
    const posY = Math.min(y + offsetY, maxY);

    this.element.style.left = `${posX}px`;
    this.element.style.top = `${posY}px`;
  }

  /**
   * Hide the tooltip
   */
  hide() {
    this.element.style.display = 'none';
    this.visible = false;
  }

  /**
   * Check if tooltip is currently visible
   * @returns {boolean}
   */
  isVisible() {
    return this.visible;
  }

  /**
   * Destroy the tooltip element
   */
  destroy() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}

export default Tooltip;
