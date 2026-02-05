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
        // Update active state
        this.updateThemeButtons();
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
