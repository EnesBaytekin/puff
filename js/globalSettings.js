// Global Settings Handler - Works on all pages

const GlobalSettings = {
    // Color preview properties
    colorPreview: {
        currentHue: 10,
        previewCanvas: null,
        previewCtx: null,
        previewPuff: null,
        animationFrame: null,
        isActive: false
    },

    init() {
        // Setup all settings buttons
        this.setupSettingsButtons();
        // Setup close button
        this.setupCloseButton();
        // Setup overlay click
        this.setupOverlayClick();
        // Setup theme buttons
        this.setupThemeButtons();
        // Setup tab navigation
        this.setupTabNavigation();
        // Update active state
        this.updateThemeButtons();
        // Setup password change form
        this.setupPasswordChange();
        // Setup color preview
        this.setupColorPreview();
        // Update tab visibility based on auth status
        this.updateTabVisibility();
    },

    setupSettingsButtons() {
        // Find all settings toggle buttons (on all pages)
        const buttons = document.querySelectorAll('[id^="settings-toggle-btn"]');
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                this.openSettingsPanel();
            });
        });
    },

    setupCloseButton() {
        const closeBtn = document.querySelector('#settings-panel .close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.closeSettingsPanel();
            });
        }
    },

    setupOverlayClick() {
        const overlay = document.getElementById('settings-overlay');
        if (overlay) {
            overlay.addEventListener('click', () => {
                this.closeSettingsPanel();
            });
        }
    },

    setupThemeButtons() {
        const themeButtons = document.querySelectorAll('.theme-btn');
        themeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const theme = btn.dataset.theme;
                this.setTheme(theme);
            });
        });
    },

    setupTabNavigation() {
        const tabButtons = document.querySelectorAll('.tab-btn');

        tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const tabName = btn.dataset.tab;
                this.switchTab(tabName);
            });
        });
    },

    switchTab(tabName) {
        // Stop color preview when switching away from color tab
        if (tabName !== 'color') {
            this.stopColorPreviewAnimation();
        }

        // Update tab buttons
        const tabButtons = document.querySelectorAll('.tab-btn');
        tabButtons.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.tab === tabName) {
                btn.classList.add('active');
            }
        });

        // Update tab content
        const tabContents = document.querySelectorAll('.tab-content');
        tabContents.forEach(content => {
            content.classList.remove('active');
            if (content.dataset.tab === tabName) {
                content.classList.add('active');
            }
        });

        // Start color preview when switching to color tab
        if (tabName === 'color') {
            this.startColorPreviewAnimation();
        }
    },

    setupPasswordChange() {
        const form = document.getElementById('password-change-form');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const currentPassword = document.getElementById('current-password').value;
            const newPassword = document.getElementById('new-password').value;
            const confirmPassword = document.getElementById('confirm-password').value;
            const errorElement = document.getElementById('password-error');
            const successElement = document.getElementById('password-success');

            // Clear previous messages
            errorElement.textContent = '';
            successElement.textContent = '';

            // Validation
            if (newPassword.length < 6) {
                errorElement.textContent = 'New password must be at least 6 characters';
                return;
            }

            if (newPassword !== confirmPassword) {
                errorElement.textContent = 'New passwords do not match';
                return;
            }

            if (currentPassword === newPassword) {
                errorElement.textContent = 'New password must be different from current password';
                return;
            }

            try {
                await API.changePassword(currentPassword, newPassword);
                successElement.textContent = 'Password changed successfully!';
                form.reset();
            } catch (error) {
                errorElement.textContent = error.message || 'Failed to change password';
            }
        });
    },

    openSettingsPanel() {
        // Close status and food panels first (only in app view)
        this.closeStatusPanel();
        this.closeFoodPanel();

        const overlay = document.getElementById('settings-overlay');
        const panel = document.getElementById('settings-panel');

        // Update all settings buttons to active state
        const buttons = document.querySelectorAll('[id^="settings-toggle-btn"]');
        buttons.forEach(btn => btn.classList.add('active'));

        overlay.classList.add('active');
        panel.classList.add('active');

        // Update active theme button
        this.updateThemeButtons();

        // Check authentication and show/hide tabs accordingly
        this.updateTabVisibility();

        // Reset to theme tab
        this.switchTab('theme');
    },

    updateTabVisibility() {
        const isLoggedIn = !!API.getToken();
        const passwordTab = document.getElementById('tab-password');
        const colorTab = document.getElementById('tab-color');

        if (isLoggedIn) {
            // Show password and color tabs
            if (passwordTab) passwordTab.style.display = 'flex';
            if (colorTab) colorTab.style.display = 'flex';
        } else {
            // Hide password and color tabs
            if (passwordTab) passwordTab.style.display = 'none';
            if (colorTab) colorTab.style.display = 'none';
        }
    },

    closeStatusPanel() {
        const toggleBtn = document.getElementById('status-toggle-btn');
        const overlay = document.getElementById('status-overlay');
        const panel = document.getElementById('status-panel');

        if (toggleBtn) toggleBtn.classList.remove('active');
        if (overlay) overlay.classList.remove('active');
        if (panel) panel.classList.remove('active');
    },

    closeFoodPanel() {
        const toggleBtn = document.getElementById('food-toggle-btn');
        const overlay = document.getElementById('food-overlay');
        const panel = document.getElementById('food-panel');

        if (toggleBtn) toggleBtn.classList.remove('active');
        if (overlay) overlay.classList.remove('active');
        if (panel) panel.classList.remove('active');
    },

    closeSettingsPanel() {
        const overlay = document.getElementById('settings-overlay');
        const panel = document.getElementById('settings-panel');

        // Remove active state from all settings buttons
        const buttons = document.querySelectorAll('[id^="settings-toggle-btn"]');
        buttons.forEach(btn => btn.classList.remove('active'));

        overlay.classList.remove('active');
        panel.classList.remove('active');

        // Stop color preview animation
        this.stopColorPreviewAnimation();

        // Reset to theme tab for next open
        this.switchTab('theme');
    },

    setTheme(theme) {
        if (theme === 'auto') {
            // Remove saved preference and let system preference take over
            localStorage.removeItem('puff_theme');
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            ThemeManager.setTheme(prefersDark ? 'dark' : 'light');
        } else {
            ThemeManager.setTheme(theme);
        }

        // Update active state
        this.updateThemeButtons();
    },

    updateThemeButtons() {
        const themeButtons = document.querySelectorAll('.theme-btn');
        const currentTheme = ThemeManager.getCurrentTheme();

        // Check if auto mode
        const savedTheme = localStorage.getItem('puff_theme');
        const isAuto = !savedTheme;

        themeButtons.forEach(btn => {
            const btnTheme = btn.dataset.theme;
            btn.classList.remove('active');

            if (isAuto && btnTheme === 'auto') {
                btn.classList.add('active');
            } else if (!isAuto && btnTheme === currentTheme) {
                btn.classList.add('active');
            }
        });
    },

    // ===== Color Preview Setup =====
    setupColorPreview() {
        const hueSlider = document.getElementById('settings-puff-hue');
        const saveBtn = document.getElementById('save-color-btn');
        const canvas = document.getElementById('settings-puff-preview-canvas');

        if (!hueSlider || !saveBtn || !canvas) return;

        // Setup canvas
        this.colorPreview.previewCanvas = canvas;
        this.colorPreview.previewCtx = canvas.getContext('2d');

        // Get current puff color hue from existing puff
        this.loadCurrentPuffColor();

        // Setup slider
        hueSlider.oninput = () => {
            this.colorPreview.currentHue = parseInt(hueSlider.value);
            this.updatePreviewPuffColor();
        };

        // Setup save button
        saveBtn.onclick = () => {
            this.savePuffColor();
        };
    },

    loadCurrentPuffColor() {
        const hueSlider = document.getElementById('settings-puff-hue');

        // Try to get current puff color from AppView
        if (window.AppView && window.AppView.creature) {
            const currentColor = window.AppView.creature.baseColor;
            // Convert hex to HSL to get hue
            const hue = this.hexToHue(currentColor);
            if (hueSlider && hue !== null) {
                this.colorPreview.currentHue = hue;
                hueSlider.value = hue;
            }
        }
    },

    hexToHue(hex) {
        // Convert hex to RGB
        let r = parseInt(hex.slice(1, 3), 16) / 255;
        let g = parseInt(hex.slice(3, 5), 16) / 255;
        let b = parseInt(hex.slice(5, 7), 16) / 255;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h = 0;

        if (max !== min) {
            const d = max - min;
            switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                case g: h = ((b - r) / d + 2) / 6; break;
                case b: h = ((r - g) / d + 4) / 6; break;
            }
        }

        return Math.round(h * 360);
    },

    startColorPreviewAnimation() {
        if (this.colorPreview.isActive) return;

        this.colorPreview.isActive = true;
        const canvas = this.colorPreview.previewCanvas;
        const ctx = this.colorPreview.previewCtx;

        if (!canvas || !ctx) return;

        // Create preview puff
        this.createPreviewPuff();

        const animate = () => {
            if (!this.colorPreview.isActive) return;

            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Update and draw preview puff
            if (this.colorPreview.previewPuff) {
                this.colorPreview.previewPuff.applyOrganicDeformation();
                this.colorPreview.previewPuff.draw(ctx);
            }

            this.colorPreview.animationFrame = requestAnimationFrame(animate);
        };

        animate();
    },

    stopColorPreviewAnimation() {
        this.colorPreview.isActive = false;
        if (this.colorPreview.animationFrame) {
            cancelAnimationFrame(this.colorPreview.animationFrame);
            this.colorPreview.animationFrame = null;
        }
        this.colorPreview.previewPuff = null;
    },

    createPreviewPuff() {
        const canvas = this.colorPreview.previewCanvas;
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = 40; // Smaller radius for settings preview (100x100 canvas)

        const color = this.hslToHex(this.colorPreview.currentHue, 85, 78);

        // Create a softbody puff with neutral state
        this.colorPreview.previewPuff = new SoftBody(centerX, centerY, radius, 12, color, {
            hunger: 100,
            mood: 0,
            energy: 100
        });

        this.updatePreviewPuffColor();
    },

    updatePreviewPuffColor() {
        if (!this.colorPreview.previewPuff) return;

        const color = this.hslToHex(this.colorPreview.currentHue, 85, 78);
        this.colorPreview.previewPuff.baseColor = color;
        this.colorPreview.previewPuff.color = color;
    },

    async savePuffColor() {
        const newColor = this.hslToHex(this.colorPreview.currentHue, 85, 78);
        const errorElement = document.getElementById('color-error');
        const successElement = document.getElementById('color-success');

        // Clear previous messages
        if (errorElement) errorElement.textContent = '';
        if (successElement) successElement.textContent = '';

        try {
            await API.updatePuffColor(newColor);

            // Fetch updated puff data and reinitialize app view
            const updatedPuff = await API.getMyPuff();

            if (window.AppView && typeof window.AppView.init === 'function') {
                // Clean up old instance and reinitialize with new data
                window.AppView.init(updatedPuff);
            } else {
                console.error('AppView or AppView.init not available!');
            }

            if (successElement) {
                successElement.textContent = 'Color updated successfully!';
            }

            // Clear success message after 3 seconds
            setTimeout(() => {
                if (successElement) successElement.textContent = '';
            }, 3000);

        } catch (error) {
            if (errorElement) {
                errorElement.textContent = error.message || 'Failed to update color';
            }
        }
    },

    hslToHex(h, s, l) {
        l /= 100;
        const a = s * Math.min(l, 1 - l) / 100;
        const f = n => {
            const k = (n + h / 30) % 12;
            const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
            return Math.round(255 * color).toString(16).padStart(2, '0');
        };
        return `#${f(0)}${f(8)}${f(4)}`;
    }
};
