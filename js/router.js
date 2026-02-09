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
            this.handleNavigationEvent(() => {
                const route = e.state?.route || this.getRouteFromHash();
                this.navigate(route, false);
            });
        });

        // Handle hash changes
        window.addEventListener('hashchange', () => {
            this.handleNavigationEvent(() => {
                const route = this.getRouteFromHash();
                if (route !== this.currentRoute) {
                    this.navigate(route, false);
                }
            });
        });
    },

    // Check auth and redirect if necessary
    handleNavigationEvent(navigationCallback) {
        const token = API.getToken();

        // If trying to access protected routes without auth, redirect to login
        const protectedRoutes = ['app', 'customize'];
        const currentHash = this.getRouteFromHash();

        if (!token && protectedRoutes.includes(currentHash)) {
            // Not logged in, redirect to login
            this.navigate('login');
            return;
        }

        // If logged in and trying to access auth routes, redirect to app
        const authRoutes = ['login', 'register'];
        if (token && authRoutes.includes(currentHash)) {
            // Already logged in with puff? Go to app
            // Otherwise go to customize
            API.getMyPuff()
                .then(() => this.navigate('app'))
                .catch((err) => {
                    if (err.message === 'Puff not found') {
                        this.navigate('customize');
                    } else {
                        this.navigate('login');
                    }
                });
            return;
        }

        // Proceed with navigation
        navigationCallback();
    },

    getRouteFromHash() {
        const hash = window.location.hash.slice(1); // Remove #
        return hash || 'login';
    },

    navigate(route, pushState = true) {
        // Cleanup previous view (if it was app view)
        if (this.currentRoute === 'app' && route !== 'app') {
            AppView.cleanup();
        }

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
                return;
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
                // Only allow access if logged in
                if (!API.getToken()) {
                    this.navigate('login');
                    return;
                }
                CustomizeView.init();
                break;
            case 'app':
                // App view is initialized after fetching puff data
                // Should only be accessible if logged in with puff
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
