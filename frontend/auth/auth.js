document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded');
    // Firebase Auth and Firestore
    const auth = firebase.auth();
    const db = firebase.firestore();

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
    const forgotPasswordLink = document.getElementById('forgot-password-link');
    const forgotPasswordContainer = document.getElementById('forgot-password-container');
    const showLoginFromForgotLink = document.getElementById('show-login-from-forgot');
    const navbarLoginBtn = document.getElementById('navbar-login-btn');
    const navbarLoginButton = navbarLoginBtn ? navbarLoginBtn.querySelector('.login-btn') : null;

    console.log('Elements found:');
    console.log('registrationFormContainer:', registrationFormContainer);
    console.log('loginFormContainer:', loginFormContainer);
    console.log('showLoginLink:', showLoginLink);
    console.log('showRegisterLink:', showRegisterLink);
    console.log('forgotPasswordLink:', forgotPasswordLink);
    console.log('forgotPasswordContainer:', forgotPasswordContainer);
    console.log('showLoginFromForgotLink:', showLoginFromForgotLink);
    console.log('navbarLoginBtn:', navbarLoginBtn);
    console.log('navbarLoginButton:', navbarLoginButton);

    // Initialize form display states
    if (registrationFormContainer && loginFormContainer && forgotPasswordContainer) {
        registrationFormContainer.style.display = 'block';
        loginFormContainer.style.display = 'none';
        forgotPasswordContainer.style.display = 'none';
        if (navbarLoginButton) {
            navbarLoginButton.innerText = 'Accedi'; // Initial state for navbar button
        }
    }


    if (registrationFormContainer && loginFormContainer && showLoginLink && showRegisterLink && navbarLoginButton && forgotPasswordLink && forgotPasswordContainer && showLoginFromForgotLink) {
        showLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('showLoginLink clicked');
            registrationFormContainer.style.display = 'none';
            loginFormContainer.style.display = 'block';
            forgotPasswordContainer.style.display = 'none';
            navbarLoginButton.innerText = 'Registrati'; // Cambia il testo del pulsante della navbar
        });

        showRegisterLink.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('showRegisterLink clicked');
            loginFormContainer.style.display = 'none';
            registrationFormContainer.style.display = 'block';
            forgotPasswordContainer.style.display = 'none';
            navbarLoginButton.innerText = 'Accedi'; // Cambia il testo del pulsante della navbar
        });

        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('forgotPasswordLink clicked');
            loginFormContainer.style.display = 'none';
            registrationFormContainer.style.display = 'none';
            forgotPasswordContainer.style.display = 'block';
            navbarLoginButton.innerText = 'Accedi'; // Il pulsante della navbar dovrebbe mostrare "Accedi" per tornare al login
        });

        showLoginFromForgotLink.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('showLoginFromForgotLink clicked');
            forgotPasswordContainer.style.display = 'none';
            loginFormContainer.style.display = 'block';
            navbarLoginButton.innerText = 'Registrati'; // Il pulsante della navbar dovrebbe mostrare "Registrati" per tornare alla registrazione
        });
    }

    if (navbarLoginBtn && registrationFormContainer && loginFormContainer && navbarLoginButton && forgotPasswordContainer) {
        navbarLoginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('navbarLoginBtn clicked');

            // Determine current active form
            const isLoginFormActive = loginFormContainer.style.display === 'block';
            const isRegistrationFormActive = registrationFormContainer.style.display === 'block';
            const isForgotPasswordFormActive = forgotPasswordContainer.style.display === 'block';

            if (isLoginFormActive || isForgotPasswordFormActive) {
                // If login or forgot password is active, switch to registration
                loginFormContainer.style.display = 'none';
                forgotPasswordContainer.style.display = 'none';
                registrationFormContainer.style.display = 'block';
                navbarLoginButton.innerText = 'Accedi';
            } else if (isRegistrationFormActive) {
                // If registration is active, switch to login
                registrationFormContainer.style.display = 'none';
                loginFormContainer.style.display = 'block';
                navbarLoginButton.innerText = 'Registrati';
            }
            // Clear any messages when switching forms
            clearMessages('registration-error-message');
            clearMessages('login-error-message');
            clearMessages('forgot-password-error-message');
            clearMessages('forgot-password-success-message');
        });
    }

    // Function to check if username is unique
    async function isUsernameUnique(username) {
        try {
            console.log('Checking username uniqueness for:', username);
            const snapshot = await db.collection('users')
                .where('username', '==', username)
                .get();
            
            console.log('Query result - snapshot.empty:', snapshot.empty);
            console.log('Query result - snapshot.size:', snapshot.size);
            
            if (!snapshot.empty) {
                console.log('Username already exists, found documents:');
                snapshot.forEach(doc => {
                    console.log('Document ID:', doc.id, 'Username:', doc.data().username);
                });
            }
            
            return snapshot.empty;
        } catch (error) {
            console.error('Error checking username uniqueness:', error);
            console.error('Error details:', error.code, error.message);
            return false;
        }
    }

    // Email/Password Registration
    const registrationForm = document.querySelector('.registration-form');
    if (registrationForm) {
        registrationForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = registrationForm.querySelector('#email').value;
            const username = registrationForm.querySelector('#username').value.trim();
            const password = registrationForm.querySelector('#password').value;
            const confirmPassword = registrationForm.querySelector('#confirm-password').value;

            // Validate username
            if (!username || username.length < 3) {
                displayMessage('registration-error-message', 'L\'username deve contenere almeno 3 caratteri.');
                return;
            }

            if (username.length > 20) {
                displayMessage('registration-error-message', 'L\'username non può superare i 20 caratteri.');
                return;
            }

            // Validate username format (alphanumeric and underscores only)
            if (!/^[a-zA-Z0-9_]+$/.test(username)) {
                displayMessage('registration-error-message', 'L\'username può contenere solo lettere, numeri e underscore.');
                return;
            }

            if (password !== confirmPassword) {
                displayMessage('registration-error-message', 'Le password inserite non corrispondono.');
                return;
            }

            try {
                clearMessages('registration-error-message');
                
                // Check if username is unique
                const isUnique = await isUsernameUnique(username);
                if (!isUnique) {
                    displayMessage('registration-error-message', 'Questo username è già stato scelto da un altro utente. Scegline un altro.');
                    return;
                }
                
                sessionStorage.setItem('justLoggedIn', 'true');
                const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                const user = userCredential.user;

                // Crea il profilo utente nel database con campi predefiniti
                await db.collection('users').doc(user.uid).set({
                    email: email,
                    username: username,
                    phoneNumber: "",
                    preferences: {
                        color: "Arancione",
                        language: "Italiano",
                        notifications: "Consenti tutti"
                    },
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                console.log('User document created in Firestore');
            } catch (error) {
                displayMessage('registration-error-message', getFirebaseErrorMessage(error.code));
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
                clearMessages('login-error-message');
                sessionStorage.setItem('justLoggedIn', 'true');
                await auth.signInWithEmailAndPassword(email, password);
            } catch (error) {
                displayMessage('login-error-message', getFirebaseErrorMessage(error.code));
            }
        });
    }

    // Google Sign-In
    const googleSignInBtns = document.querySelectorAll('.google-signin-btn');
    if (googleSignInBtns.length > 0) {
        googleSignInBtns.forEach(googleSignInBtn => {
            googleSignInBtn.addEventListener('click', async () => {
                const provider = new firebase.auth.GoogleAuthProvider();
                try {
                    clearMessages('login-error-message'); // Clear login errors before Google sign-in
                    sessionStorage.setItem('justLoggedIn', 'true');
                    const result = await auth.signInWithPopup(provider);
                    const user = result.user;

                    // Controlla se il documento utente esiste già, altrimenti crealo
                    const userDoc = await db.collection('users').doc(user.uid).get();
                    if (!userDoc.exists) {
                        // For Google sign-in, we don't have a username, so we'll use a default or ask for it later
                        await db.collection('users').doc(user.uid).set({
                            email: user.email,
                            username: null, // Will be set later when user chooses one
                            phoneNumber: user.phoneNumber || "",
                            preferences: {
                                color: "Arancione",
                                language: "Italiano",
                                notifications: "Consenti tutti"
                            },
                            createdAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                        console.log('User document created for Google user');
                    }
                } catch (error) {
                    displayMessage('login-error-message', getFirebaseErrorMessage(error.code));
                }
            });
        });
    }

    // Password Reset
    const forgotPasswordForm = document.querySelector('.forgot-password-form');
    if (forgotPasswordForm) {
        forgotPasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = forgotPasswordForm.querySelector('#reset-email').value;

            try {
                clearMessages('forgot-password-error-message');
                clearMessages('forgot-password-success-message');
                await auth.sendPasswordResetEmail(email);
                displayMessage('forgot-password-success-message', 'Link per il reset della password inviato alla tua email!', false);
                // Store success message in session storage and redirect to login
                sessionStorage.setItem('passwordResetSuccess', 'true');
                sessionStorage.setItem('passwordResetEmail', email);
                setTimeout(() => {
                    window.location.href = 'auth.html'; // Redirect to auth.html
                }, 3000); // 3 seconds delay
            } catch (error) {
                displayMessage('forgot-password-error-message', getFirebaseErrorMessage(error.code));
            }
        });
    }

    // Function to check if user has username
    async function checkUserHasUsername(userId) {
        try {
            const userDoc = await db.collection('users').doc(userId).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                return userData.username && userData.username.trim() !== '';
            }
            return false;
        } catch (error) {
            console.error('Error checking user username:', error);
            return false;
        }
    }

    // Function to show username selection popup
    async function showUsernameSelectionPopup() {
        return new Promise(async (resolve) => {
            let selectedUsername = null;
            let isValid = false;

            const showPopup = async () => {
                const username = await window.showPrompt(
                    'Scegli un username obbligatorio (3-20 caratteri, solo lettere, numeri e _):',
                    '',
                    'Username Richiesto'
                );

                if (username === null) {
                    // User cancelled
                    resolve(null);
                    return;
                }

                const trimmedUsername = username.trim();

                // Validate username
                if (trimmedUsername.length < 3) {
                    await window.alert('L\'username deve contenere almeno 3 caratteri.');
                    showPopup();
                    return;
                }

                if (trimmedUsername.length > 20) {
                    await window.alert('L\'username non può superare i 20 caratteri.');
                    showPopup();
                    return;
                }

                if (!/^[a-zA-Z0-9_]+$/.test(trimmedUsername)) {
                    await window.alert('L\'username può contenere solo lettere, numeri e underscore.');
                    showPopup();
                    return;
                }

                // Check if username is unique
                const isUnique = await isUsernameUnique(trimmedUsername);
                if (!isUnique) {
                    await window.alert('Questo username è già stato scelto da un altro utente. Scegline un altro.');
                    showPopup();
                    return;
                }

                selectedUsername = trimmedUsername;
                resolve(selectedUsername);
            };

            showPopup();
        });
    }

    // Function to update user username in Firestore
    async function updateUserUsername(userId, username) {
        try {
            await db.collection('users').doc(userId).update({
                username: username
            });
            console.log('Username updated successfully');
            return true;
        } catch (error) {
            console.error('Error updating username:', error);
            return false;
        }
    }

    // Handle authentication state changes
    firebase.auth().onAuthStateChanged(async user => {
        if (user) {
            // User is signed in.
            console.log('User is signed in:', user);
            
            // Save lastUserId for optimistic loading
            localStorage.setItem('lastUserId', user.uid);
            
            // Initialize Cache
            if (window.CacheManager) {
                try {
                    const force = sessionStorage.getItem('justLoggedIn') === 'true';
                    sessionStorage.removeItem('justLoggedIn');
                    await window.CacheManager.initCache(user.uid, force);
                } catch (e) {
                    console.error("Cache init failed", e);
                }
            }

            // Redirect to lista_schede.html
            window.location.href = '../lista_schede/lista_scheda.html';
        } else {
            // User is signed out.
            console.log('User is signed out.');
            // Stay on the auth page or redirect to login if needed
        }
    });

    // Check for password reset success message in session storage
    const passwordResetSuccess = sessionStorage.getItem('passwordResetSuccess');
    const passwordResetEmail = sessionStorage.getItem('passwordResetEmail');

    if (passwordResetSuccess === 'true' && passwordResetEmail) {
        // Display success message in the login form
        displayMessage('login-error-message', `Link per il reset della password inviato a ${passwordResetEmail}! Controlla la tua casella di posta.`, false);
        // Clear the session storage items
        sessionStorage.removeItem('passwordResetSuccess');
        sessionStorage.removeItem('passwordResetEmail');
        // Switch to login form if not already there
        if (loginFormContainer.style.display === 'none') {
            registrationFormContainer.style.display = 'none';
            loginFormContainer.style.display = 'block';
            forgotPasswordContainer.style.display = 'none';
            if (navbarLoginButton) {
                navbarLoginButton.innerText = 'Registrati';
            }
        }
    }

    // Helper function to display messages
    function displayMessage(elementId, message, isError = true) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = message;
            element.style.display = 'block';
            if (isError) {
                element.classList.add('error-message');
                element.classList.remove('success-message');
            } else {
                element.classList.add('success-message');
                element.classList.remove('error-message');
            }
        }
    }

    // Helper function to clear messages
    function clearMessages(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = '';
            element.style.display = 'none';
        }
    }

    // Helper function to translate Firebase error codes
    function getFirebaseErrorMessage(errorCode) {
        switch (errorCode) {
            case 'auth/email-already-in-use':
                return 'Questa email è già registrata. Prova ad accedere o usa un\'altra email.';
            case 'auth/invalid-email':
                return 'L\'indirizzo email non è valido.';
            case 'auth/operation-not-allowed':
                return 'Operazione non consentita. Contatta il supporto.';
            case 'auth/weak-password':
                return 'La password deve essere di almeno 6 caratteri.';
            case 'auth/user-disabled':
                return 'Questo account è stato disabilitato.';
            case 'auth/user-not-found':
                return 'Nessun utente trovato con questa email.';
            case 'auth/wrong-password':
                return 'Password errata. Riprova.';
            case 'auth/popup-closed-by-user':
                return 'Accesso annullato dall\'utente.';
            case 'auth/cancelled-popup-request':
                return 'Richiesta di accesso annullata.';
            case 'auth/too-many-requests':
                return 'Troppi tentativi di accesso falliti. Riprova più tardi.';
            default:
                return 'Si è verificato un errore sconosciuto. Riprova.';
        }
    }
});
