// Theme Manager - Handles dark/light mode with system preference detection

const ThemeManager = {
    currentTheme: null,
    storageKey: 'puff_theme',

    init() {
        // Load saved theme or detect system preference
        const savedTheme = localStorage.getItem(this.storageKey);

        if (savedTheme) {
            this.setTheme(savedTheme);
        } else {
            // Auto-detect system preference
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            this.setTheme(prefersDark ? 'dark' : 'light');
        }

        // Listen for system theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            // Only auto-switch if user hasn't manually set a preference
            if (!localStorage.getItem(this.storageKey)) {
                this.setTheme(e.matches ? 'dark' : 'light');
            }
        });
    },

    setTheme(theme) {
        this.currentTheme = theme;

        // Remove old theme class and add new one
        document.body.classList.remove('theme-light', 'theme-dark');
        document.body.classList.add(`theme-${theme}`);

        // Save to localStorage
        localStorage.setItem(this.storageKey, theme);

        console.log(`[ThemeManager] Theme set to: ${theme}`);
    },

    toggleTheme() {
        const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        this.setTheme(newTheme);
        return newTheme;
    },

    getCurrentTheme() {
        return this.currentTheme;
    },

    // Check if currently in dark mode
    isDark() {
        return this.currentTheme === 'dark';
    }
};
