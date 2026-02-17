// Global Settings Handler - Works on all pages

const GlobalSettings = {
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

        if (isLoggedIn) {
            // Show password tab
            if (passwordTab) passwordTab.style.display = 'flex';
        } else {
            // Hide password tab
            if (passwordTab) passwordTab.style.display = 'none';
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
    }
};
