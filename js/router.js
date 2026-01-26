// Simple SPA router
const Router = {
    currentRoute: null,

    init() {
        // Check if user is logged in
        const token = API.getToken();

        if (token) {
            // Check if user has a puff
            this.fetchPuffAndRoute();
        } else {
            this.navigate('login');
        }

        // Handle browser back/forward
        window.addEventListener('popstate', (e) => {
            const route = e.state?.route || this.getRouteFromHash();
            this.navigate(route, false);
        });

        // Handle hash changes
        window.addEventListener('hashchange', () => {
            const route = this.getRouteFromHash();
            if (route !== this.currentRoute) {
                this.navigate(route, false);
            }
        });
    },

    getRouteFromHash() {
        const hash = window.location.hash.slice(1); // Remove #
        return hash || 'login';
    },

    navigate(route, pushState = true) {
        this.currentRoute = route;

        // Hide all views
        document.querySelectorAll('.view').forEach(el => el.style.display = 'none');

        // Show target view
        const targetView = document.getElementById(`view-${route}`);
        if (targetView) {
            targetView.style.display = 'block';
        } else {
            console.error(`View not found: view-${route}`);
            // Fallback to login
            if (route !== 'login') {
                this.navigate('login');
            }
        }

        // Update URL
        if (pushState) {
            const hash = route === 'login' ? '' : `#${route}`;
            history.pushState({ route }, '', hash);
        }

        // Route-specific initialization
        this.initializeRoute(route);
    },

    initializeRoute(route) {
        switch (route) {
            case 'login':
                LoginView.init();
                break;
            case 'register':
                RegisterView.init();
                break;
            case 'customize':
                CustomizeView.init();
                break;
            case 'app':
                // App view is initialized after fetching puff data
                break;
        }
    },

    async fetchPuffAndRoute() {
        try {
            const puff = await API.getMyPuff();
            // Navigate to app with puff data
            this.navigate('app');
            AppView.init(puff);
        } catch (err) {
            if (err.message === 'Puff not found') {
                // No puff yet, go to customization
                this.navigate('customize');
            } else {
                console.error('Error fetching puff:', err);
                API.logout();
            }
        }
    }
};
