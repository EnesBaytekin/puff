// Register view
const RegisterView = {
    init() {
        const form = document.getElementById('register-form');
        const errorEl = document.getElementById('register-error');

        // Clear previous error
        errorEl.textContent = '';

        // Handle form submission
        form.onsubmit = async (e) => {
            e.preventDefault();

            const email = document.getElementById('register-email').value;
            const password = document.getElementById('register-password').value;

            errorEl.textContent = '';

            try {
                await API.register(email, password);
                // Navigate to customization
                Router.navigate('customize');
            } catch (err) {
                errorEl.textContent = err.message;
            }
        };

        // Handle login link
        const loginLink = document.querySelector('#view-register a[href="#login"]');
        if (loginLink) {
            loginLink.onclick = (e) => {
                e.preventDefault();
                Router.navigate('login');
            };
        }
    }
};
