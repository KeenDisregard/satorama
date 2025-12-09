# Contributing to Satorama

Thank you for your interest in contributing! Whether you're fixing a bug, adding a feature, or improving documentation, your help is appreciated.

---

## 🚀 Getting Started

### Prerequisites

- Node.js 14+
- npm 6+
- Git

### Setup

1. **Fork** the repository on GitHub
2. **Clone** your fork:
   ```bash
   git clone https://github.com/KeenDisregard/satorama.git
   cd satorama
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Start the dev server**:
   ```bash
   npm run dev
   ```
5. Open `http://localhost:3000` to verify everything works

---

## 🔀 Workflow

### Creating a Feature Branch

```bash
# Sync with upstream first
git fetch origin
git checkout main
git pull origin main

# Create your branch
git checkout -b feature/your-feature-name
# or for bugs:
git checkout -b fix/issue-description
```

### Making Changes

1. Make your changes in small, focused commits
2. Test locally in the browser
3. Run the test suite (see below)
4. Commit with clear messages:
   ```bash
   git commit -m "feat: add satellite filtering by altitude"
   git commit -m "fix: correct line-of-sight calculation at horizon"
   git commit -m "docs: update README with new controls"
   ```

### Submitting a Pull Request

1. Push your branch:
   ```bash
   git push origin feature/your-feature-name
   ```
2. Open a Pull Request on GitHub
3. Fill out the PR template with:
   - What changed and why
   - Screenshots/GIFs for UI changes
   - Link to related issue (if any)
4. Wait for review — we aim to respond within a few days

---

## 🧪 Testing

Run the test suite before submitting:

```bash
# Run tests in watch mode (during development)
npm test

# Run tests once (for final check)
npm run test:run

# Run with coverage report
npm run test:coverage
```

### Test Requirements

- All existing tests must pass
- New features should include tests when practical
- Tests are located in `tests/` directory
- We use [Vitest](https://vitest.dev/) with jsdom environment

---

## 📝 Code Style Guide

Please match the existing code style to keep the codebase consistent.

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Classes | PascalCase | `Satellite`, `TimeController` |
| Methods | camelCase | `calculateOrbitalParameters()` |
| Variables | camelCase | `earthRadius`, `stationPos` |
| Files | kebab-case | `time-controller.js`, `ground-station.js` |
| CSS classes | kebab-case | `.control-group`, `.time-speed-btn` |

### Comments

**JSDoc for exported functions:**
```javascript
/**
 * Converts lat/lon coordinates to 3D position
 * @param {number} lat - Latitude in degrees
 * @param {number} lon - Longitude in degrees
 * @param {number} radius - Radius of the sphere
 * @returns {Object} - {x, y, z} position
 */
export function latLonToVector3(lat, lon, radius) {
```

**Inline comments for clarity:**
```javascript
const a = 42164; // km - geostationary orbit semi-major axis
return 0x00ffff; // Cyan
```

**Block comments for logic sections:**
```javascript
// Calculate semi-major axis from mean motion
const mm = this.satrec.no;
const a = Math.pow(6378.137 * 6378.137 * 6378.137 / (398600.4418 * mm * mm), 1/3);
```

### Code Structure

- **ES6 modules** — use `import`/`export`
- **2-space indentation**
- **Classes** — constructor first, then methods grouped logically
- **Blank lines** between methods and logical sections
- **No trailing whitespace**

### Directory Structure

```
src/
├── components/    # 3D objects and UI controllers
├── data/          # Data generation and parsing
├── app.js         # Main application class
├── index.js       # Entry point and DOM bindings
├── utils.js       # Shared helper functions
└── styles.css     # UI styling

tests/             # Unit tests (mirror src/ structure)
assets/textures/   # Static image files
```

---

## 🐛 Reporting Issues

Use GitHub Issues with the provided templates. Include:

- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Browser and OS version
- Screenshots if applicable

---

## 💡 Feature Requests

We welcome ideas! Check the [ROADMAP.md](ROADMAP.md) first to see if it's already planned, then open an issue using the Feature Request template.

---

## ❓ Questions?

Open a GitHub issue or discussion — we're happy to help!
