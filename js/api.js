// API client for backend communication
const API = {
    // Base URL for API (empty means same origin)
    baseURL: '',

    // Get stored token
    getToken() {
        return localStorage.getItem('token');
    },

    // Store token
    setToken(token) {
        localStorage.setItem('token', token);
    },

    // Remove token
    removeToken() {
        localStorage.removeItem('token');
    },

    // Get user ID
    getUserId() {
        return localStorage.getItem('userId');
    },

    // Set user ID
    setUserId(userId) {
        localStorage.setItem('userId', userId);
    },

    // Remove user ID
    removeUserId() {
        localStorage.removeItem('userId');
    },

    // Helper method to make authenticated requests
    async request(endpoint, options = {}) {
        const token = this.getToken();

        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${this.baseURL}${endpoint}`, {
            ...options,
            headers
        });

        // Handle 401/403 - token expired or invalid
        if (response.status === 401 || response.status === 403) {
            this.removeToken();
            this.removeUserId();
            Router.navigate('login');
            throw new Error('Session expired');
        }

        return response;
    },

    // Auth API
    async register(email, password) {
        const response = await this.request('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Registration failed');
        }

        const data = await response.json();
        this.setToken(data.token);
        this.setUserId(data.userId);
        return data;
    },

    async login(email, password) {
        const response = await this.request('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Login failed');
        }

        const data = await response.json();
        this.setToken(data.token);
        this.setUserId(data.userId);
        return data;
    },

    logout() {
        this.removeToken();
        this.removeUserId();

        // Clear all form fields
        const loginEmail = document.getElementById('login-email');
        const loginPassword = document.getElementById('login-password');
        const registerEmail = document.getElementById('register-email');
        const registerPassword = document.getElementById('register-password');

        if (loginEmail) loginEmail.value = '';
        if (loginPassword) loginPassword.value = '';
        if (registerEmail) registerEmail.value = '';
        if (registerPassword) registerPassword.value = '';

        Router.navigate('login');
    },

    // Puff API
    async createPuff(name, color) {
        const response = await this.request('/api/puffs/create', {
            method: 'POST',
            body: JSON.stringify({ name, color })
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to create puff');
        }

        return response.json();
    },

    async getMyPuff() {
        const response = await this.request('/api/puffs/mine');

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to get puff');
        }

        return response.json();
    },

    async updatePuffState(state) {
        const response = await this.request('/api/puffs/state', {
            method: 'PUT',
            body: JSON.stringify(state)
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to update puff state');
        }

        return response.json();
    }
};
