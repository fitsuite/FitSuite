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
    const navbarLoginBtn = document.getElementById('navbar-login-btn');
    const navbarLoginButton = navbarLoginBtn ? navbarLoginBtn.querySelector('.login-btn') : null;

    if (registrationFormContainer && loginFormContainer && showLoginLink && showRegisterLink && navbarLoginButton) {
        showLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            registrationFormContainer.style.display = 'none';
            loginFormContainer.style.display = 'block';
            navbarLoginButton.innerText = 'Registrati'; // Cambia il testo del pulsante della navbar
        });

        showRegisterLink.addEventListener('click', (e) => {
            e.preventDefault();
            loginFormContainer.style.display = 'none';
            registrationFormContainer.style.display = 'block';
            navbarLoginButton.innerText = 'Accedi'; // Cambia il testo del pulsante della navbar
        });
    }

    if (navbarLoginBtn && registrationFormContainer && loginFormContainer && navbarLoginButton) {
        navbarLoginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            // Check if the login form is currently displayed
            if (loginFormContainer.style.display === 'block') {
                // If login form is visible, switch to registration form
                loginFormContainer.style.display = 'none';
                registrationFormContainer.style.display = 'block';
                navbarLoginButton.innerText = 'Accedi';
            } else {
                // If registration form is visible (or initially), switch to login form
                registrationFormContainer.style.display = 'none';
                loginFormContainer.style.display = 'block';
                navbarLoginButton.innerText = 'Registrati';
            }
        });
    }
});
