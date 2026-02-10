document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded');
    // Firebase Auth
    const auth = firebase.auth();

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

    console.log('Elements found:');
    console.log('registrationFormContainer:', registrationFormContainer);
    console.log('loginFormContainer:', loginFormContainer);
    console.log('showLoginLink:', showLoginLink);
    console.log('showRegisterLink:', showRegisterLink);
    console.log('navbarLoginBtn:', navbarLoginBtn);
    console.log('navbarLoginButton:', navbarLoginButton);


    if (registrationFormContainer && loginFormContainer && showLoginLink && showRegisterLink && navbarLoginButton) {
        showLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('showLoginLink clicked');
            registrationFormContainer.style.display = 'none';
            loginFormContainer.style.display = 'block';
            navbarLoginButton.innerText = 'Registrati'; // Cambia il testo del pulsante della navbar
        });

        showRegisterLink.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('showRegisterLink clicked');
            loginFormContainer.style.display = 'none';
            registrationFormContainer.style.display = 'block';
            navbarLoginButton.innerText = 'Accedi'; // Cambia il testo del pulsante della navbar
        });
    }

    if (navbarLoginBtn && registrationFormContainer && loginFormContainer && navbarLoginButton) {
        navbarLoginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('navbarLoginBtn clicked');
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

    // Email/Password Registration
    const registrationForm = document.querySelector('.registration-form');
    if (registrationForm) {
        registrationForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = registrationForm.querySelector('#email').value;
            const password = registrationForm.querySelector('#password').value;
            const confirmPassword = registrationForm.querySelector('#confirm-password').value;

            if (password !== confirmPassword) {
                alert('Le password non corrispondono!');
                return;
            }

            try {
                await auth.createUserWithEmailAndPassword(email, password);
                // alert('Registrazione avvenuta con successo!'); // Rimosso l'alert di successo
                // Redirect or update UI (handled by onAuthStateChanged)
            } catch (error) {
                console.error('Errore durante la registrazione:', error.message);
                alert('Errore durante la registrazione: ' + error.message);
            }
        });
    }

    // Email/Password Login
    const loginForm = document.querySelector('.login-form');
    if (loginForm) {
        console.log('Login form found.');
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = loginForm.querySelector('#login-email').value;
            const password = loginForm.querySelector('#login-password').value;

            console.log('Attempting login with:', { email, password });

            try {
                await auth.signInWithEmailAndPassword(email, password);
                // alert('Accesso effettuato con successo!'); // Rimosso l'alert di successo
                // Redirect or update UI (handled by onAuthStateChanged)
            } catch (error) {
                console.error('Errore durante l\'accesso:', error.message);
                alert('Errore durante l\'accesso: ' + error.message);
            }
        });
    }

    // Google Sign-In
    const googleSignInBtn = document.querySelector('.google-signin-btn');
    if (googleSignInBtn) {
        googleSignInBtn.addEventListener('click', async () => {
            const provider = new firebase.auth.GoogleAuthProvider();
            try {
                await auth.signInWithPopup(provider);
                alert('Accesso con Google effettuato con successo!');
                // Redirect is handled by onAuthStateChanged
            } catch (error) {
                console.error('Errore durante l\'accesso con Google:', error.message);
                alert('Errore durante l\'accesso con Google: ' + error.message);
            }
        });
    }

    // Handle authentication state changes
    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            // User is signed in.
            console.log('User is signed in:', user);
            // Redirect to crea_scheda.html
            window.location.href = '../crea_scheda/crea_scheda.html';
        } else {
            // User is signed out.
            console.log('User is signed out.');
            // Stay on the auth page or redirect to login if needed
        }
    });
});
