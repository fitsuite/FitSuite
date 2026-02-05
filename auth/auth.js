document.addEventListener('DOMContentLoaded', () => {
    // Navbar functionality
    const hamburger = document.getElementById('hamburger');
    const navLinks = document.getElementById('navLinks');

    if (hamburger && navLinks) {
        hamburger.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            hamburger.classList.toggle('active');
        });
    }

    // Form toggle functionality
    const registrationFormContainer = document.getElementById('registration-form-container');
    const loginFormContainer = document.getElementById('login-form-container');
    const showLoginLink = document.getElementById('show-login');
    const showRegisterLink = document.getElementById('show-register');

    if (registrationFormContainer && loginFormContainer && showLoginLink && showRegisterLink) {
        showLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            registrationFormContainer.style.display = 'none';
            loginFormContainer.style.display = 'block';
        });

        showRegisterLink.addEventListener('click', (e) => {
            e.preventDefault();
            loginFormContainer.style.display = 'none';
            registrationFormContainer.style.display = 'block';
        });
    }
});
