# Visualizer Nouveau: UI Redesign Specification

## 1. Design Philosophy: "Retro-Industrial Futurism"
**Concept:** The interface should feel like a robust, professional tool from a "new industrial age." It moves away from the generic "Hacker Green" aesthetic to a grounded, engineering-focused look that combines mid-century technical blueprints with modern digital precision.

### Core Visual Pillars
*   **Authority & Reliability:** The UI looks built-to-last, like heavy machinery control panels.
*   **Technical Precision:** Layouts follow strict grids, mimicking engineering diagrams and spec sheets.
*   **Tactile Depth:** Use of subtle borders, "rivet" shadows, and muted textures (grain/dither) to avoid flat minimalism.

---

## 2. Visual Identity System

### Color Palette
*   **Backgrounds:** Deep Charcoals & Desaturated Grays (e.g., `#1a1b1e`, `#25262b`). No pitch black.
*   **Primary Accent:** Steel Blue / Desaturated Teal (e.g., `#66a1ff` -> muted).
*   **Functional Colors:** 
    *   *Active/Safe:* Rusty Orange or Muted Green (e.g., `#ff922b`, `#51cf66`).
    *   *Alert/Selection:* Neon Cyan or Electric Teal (sparingly used for pop).
*   **Text:** Off-white / Light Gray (`#c1c2c5`) to reduce eye strain.

### Typography
*   **Headers:** Bold, Condensed Sans-Serif (e.g., `Oswald`, `Barlow Condensed`, or heavy `Inter`). "Machined" look.
*   **Data/Specs:** Monospace (e.g., `JetBrains Mono`, `Fira Code`). Crucial for coordinates, time, and telemetry.
*   **Labeling:** Small caps, widely spaced, precise.

### Effects & Texture
*   **Grid Overlays:** Faint background grids to ground floating elements.
*   **Borders:** 1px solid borders with slight opacity, distinct corners (no large border-radius).
*   **Glass/Blur:** `backdrop-filter: blur(10px)` used for panels to maintain visibility of the 3D Earth, but tinted dark gray/blue.

---

## 3. UI Architecture (The "HUD")

The interface will be consolidated into a unified "Head-Up Display" rather than scattered floating divs.

### A. Top Telemetry Bar (Global Stats)
*   **Location:** Fixed Top, full width or centered block.
*   **Content:** Simulation Time, FPS, Satellite Count, Ground Station Count.
*   **Style:** Digital readout strip. Monospace numbers.

### B. Left Analysis Panel (Selection Details)
*   **Location:** Fixed Left Sidebar (or floating panel).
*   **Content:** 
    *   **Header:** Object Name (FIX: Previously missing).
    *   **Spec Sheet:** Type, Orbit Period, Altitude, Inclination.
    *   **Actions:** Follow, Reset, Deselect (Styled as physical buttons).
    *   **Visuals:** Satellite Trail / Ground Track toggles.
*   **Style:** formatted like a technical "Spec Sheet" with dividers and label/value pairs.

### C. Right Control Deck (Global Controls)
*   **Location:** Fixed Right Sidebar.
*   **Content:**
    *   **Time Control:** Play/Pause, Speed slider/presets.
    *   **Layers:** Visibility toggles (Satellites, Orbits, LOS).
    *   **Filters:** Orbit types (LEO, MEO, GEO, HEO).
    *   **Search:** Integrated search field (moved from hidden drawer to always accessible or expanding).
*   **Style:** Modular grid. Toggles look like switches or checkboxes with "indicator lights."

---

## 4. Functional Improvements
1.  **Satellite Naming:** Ensure the selected satellite's name (`tleData.name`) is prominently displayed in the Analysis Panel.
2.  **Search Integration:** Make search a primary tool, not a hidden menu.
3.  **Iconography:** Replace Emojis (⏸️, ⏩) with Material Icons or similar geometric icons.
