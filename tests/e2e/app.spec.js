import { test, expect } from '@playwright/test';

test.describe('Satorama E2E Tests', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        // Wait for the app to initialize (simulation clock updates from INIT...)
        await expect(page.locator('#simulation-clock')).not.toHaveText('INIT...', { timeout: 30000 });
    });

    test.describe('App Initialization', () => {

        test('page title is correct', async ({ page }) => {
            await expect(page).toHaveTitle(/SATORAMA/);
        });

        test('telemetry bar displays', async ({ page }) => {
            await expect(page.locator('.hud-header')).toBeVisible();
            await expect(page.locator('#simulation-clock')).toBeVisible();
            await expect(page.locator('#fps')).toBeVisible();
            await expect(page.locator('#satellite-count')).toBeVisible();
        });

        test('FPS counter shows a number', async ({ page }) => {
            const fpsText = await page.locator('#fps').textContent();
            expect(parseInt(fpsText, 10)).toBeGreaterThan(0);
        });

        test('control panels are visible', async ({ page }) => {
            await expect(page.locator('#info.hud-panel')).toBeVisible();
            await expect(page.locator('#controls.hud-panel')).toBeVisible();
        });
    });

    test.describe('Time Controls', () => {

        test('play/pause button toggles', async ({ page }) => {
            const playPauseBtn = page.locator('#time-play-pause');

            // Should start in playing state (showing pause icon)
            await expect(playPauseBtn.locator('.material-icons')).toHaveText('pause');

            // Click to pause
            await playPauseBtn.click();
            await expect(playPauseBtn.locator('.material-icons')).toHaveText('play_arrow');

            // Click to resume
            await playPauseBtn.click();
            await expect(playPauseBtn.locator('.material-icons')).toHaveText('pause');
        });

        test('speed buttons change warp display', async ({ page }) => {
            const speedDisplay = page.locator('#time-speed-display');

            // Click 10x speed
            await page.locator('[data-speed="10"]').click();
            await expect(speedDisplay).toHaveText('10x');

            // Click 100x speed
            await page.locator('[data-speed="100"]').click();
            await expect(speedDisplay).toHaveText('100x');

            // Click 1x to reset
            await page.locator('[data-speed="1"]').click();
            await expect(speedDisplay).toHaveText('1x');
        });

        test('reset button exists', async ({ page }) => {
            await expect(page.locator('#time-reset')).toBeVisible();
        });
    });

    test.describe('Preset Loading', () => {

        test('preset buttons are displayed', async ({ page }) => {
            const presetGrid = page.locator('#preset-buttons');
            await expect(presetGrid).toBeVisible();

            // Should have at least one preset button
            const buttons = presetGrid.locator('button');
            await expect(buttons.first()).toBeVisible();
        });

        test('clicking a preset loads satellites', async ({ page }) => {
            const satCount = page.locator('#satellite-count');

            // Click the first preset button
            const firstPreset = page.locator('#preset-buttons button').first();
            await firstPreset.click();

            // Wait for satellites to load (count should be non-zero)
            await expect(satCount).not.toHaveText('0', { timeout: 30000 });
        });
    });

    test.describe('Search Overlay', () => {

        test('search button opens overlay', async ({ page }) => {
            const searchOverlay = page.locator('#search-sidebar');

            // Should be hidden initially (no 'open' class)
            await expect(searchOverlay).not.toHaveClass(/open/);

            // Click search button
            await page.locator('#search-toggle').click();

            // Overlay should now be visible
            await expect(searchOverlay).toHaveClass(/open/);
        });

        test('search input accepts text', async ({ page }) => {
            // Open search
            await page.locator('#search-toggle').click();

            const searchInput = page.locator('#search-input');
            await searchInput.fill('ISS');
            await expect(searchInput).toHaveValue('ISS');
        });

        test('clicking search button again closes overlay', async ({ page }) => {
            const searchOverlay = page.locator('#search-sidebar');

            // Open
            await page.locator('#search-toggle').click();
            await expect(searchOverlay).toHaveClass(/open/);

            // Close by clicking again
            await page.locator('#search-toggle').click();
            await expect(searchOverlay).not.toHaveClass(/open/);
        });
    });

    test.describe('TLE Modal', () => {

        test('add TLE button opens modal', async ({ page }) => {
            const modal = page.locator('#tle-modal');

            // Should be hidden initially
            await expect(modal).not.toHaveClass(/open/);

            // Click add TLE button
            await page.locator('#add-tle-toggle').click();

            // Modal should be visible
            await expect(modal).toHaveClass(/open/);
        });

        test('modal has required input fields', async ({ page }) => {
            await page.locator('#add-tle-toggle').click();

            await expect(page.locator('#tle-name')).toBeVisible();
            await expect(page.locator('#tle-line1')).toBeVisible();
            await expect(page.locator('#tle-line2')).toBeVisible();
            await expect(page.locator('#tle-full')).toBeVisible();
        });

        test('cancel button closes modal', async ({ page }) => {
            const modal = page.locator('#tle-modal');

            // Open
            await page.locator('#add-tle-toggle').click();
            await expect(modal).toHaveClass(/open/);

            // Cancel
            await page.locator('#tle-cancel').click();
            await expect(modal).not.toHaveClass(/open/);
        });

        test('submit with empty fields shows error', async ({ page }) => {
            await page.locator('#add-tle-toggle').click();

            // Click submit without filling anything
            await page.locator('#tle-submit').click();

            // Error message should appear
            const errorDiv = page.locator('#tle-error');
            await expect(errorDiv).not.toBeEmpty();
        });
    });

    test.describe('Layer Toggles', () => {

        test('satellite toggle is checked by default', async ({ page }) => {
            await expect(page.locator('#toggle-satellites')).toBeChecked();
        });

        test('ground station toggle is checked by default', async ({ page }) => {
            await expect(page.locator('#toggle-groundstations')).toBeChecked();
        });

        test('orbit class filters are checked by default', async ({ page }) => {
            const types = ['LEO', 'MEO', 'GEO', 'HEO'];
            for (const type of types) {
                await expect(page.locator(`[data-type="${type}"]`)).toBeChecked();
            }
        });
    });

    test.describe('Help Button', () => {

        test('help button is visible', async ({ page }) => {
            await expect(page.locator('#help-btn')).toBeVisible();
        });
    });
});
