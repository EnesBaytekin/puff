// Login view
const LoginView = {
    init() {
        const form = document.getElementById('login-form');
        const errorEl = document.getElementById('login-error');

        // Clear previous error
        errorEl.textContent = '';

        // Handle form submission
        form.onsubmit = async (e) => {
            e.preventDefault();

            const username = document.getElementById('login-username').value;
            const password = document.getElementById('login-password').value;

            errorEl.textContent = '';

            try {
                await API.login(username, password);
                // Router will fetch puff and navigate
                Router.fetchPuffAndRoute();
            } catch (err) {
                errorEl.textContent = err.message;
            }
        };

        // Handle register link
        const registerLink = document.querySelector('#view-login a[href="#register"]');
        if (registerLink) {
            registerLink.onclick = (e) => {
                e.preventDefault();
                Router.navigate('register');
            };
        }
    }
};
