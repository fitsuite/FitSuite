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


    // Email/Password Registration
    const registrationForm = document.querySelector('.registration-form');
    if (registrationForm) {
        registrationForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = registrationForm.querySelector('#email').value;
            const password = registrationForm.querySelector('#password').value;
            const confirmPassword = registrationForm.querySelector('#confirm-password').value;


            if (password !== confirmPassword) {
                displayMessage('registration-error-message', 'Le password inserite non corrispondono.');
                return;
            }

            try {
                clearMessages('registration-error-message');
                
                // Create user with email and password first
                const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                const user = userCredential.user;
                
                console.log('User created successfully:', user.uid);

                // Create the user profile in the database
                await db.collection('users').doc(user.uid).set({
                    email: email,
                    username: null, // Will be set later after login
                    phoneNumber: "",
                    preferences: {
                        color: "Arancione",
                        language: "Italiano",
                        notifications: "Consenti tutti"
                    },
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                console.log('User document created in Firestore');
                sessionStorage.setItem('justLoggedIn', 'true');
                
            } catch (error) {
                console.error('Registration error:', error);
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
                console.log('Attempting login with:', { email });
                
                // Sign in with email and password
                const userCredential = await auth.signInWithEmailAndPassword(email, password);
                const user = userCredential.user;
                
                console.log('Login successful:', user.uid);
                
                // Check if user document exists, create if missing
                const userDoc = await db.collection('users').doc(user.uid).get();
                if (!userDoc.exists) {
                    console.log('User document not found, creating...');
                    await db.collection('users').doc(user.uid).set({
                        email: user.email,
                        username: null, // Will be set by username checker
                        phoneNumber: user.phoneNumber || "",
                        preferences: {
                            color: "Arancione",
                            language: "Italiano",
                            notifications: "Consenti tutti"
                        },
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    console.log('User document created during login');
                }
                
                sessionStorage.setItem('justLoggedIn', 'true');
                
            } catch (error) {
                console.error('Login error:', error);
                displayMessage('login-error-message', getFirebaseErrorMessage(error.code));
            }
        });
    }

    // Google Sign-In
    const googleSignInBtns = document.querySelectorAll('.google-signin-btn');
    if (googleSignInBtns.length > 0) {
        googleSignInBtns.forEach(googleSignInBtn => {
            googleSignInBtn.addEventListener('click', async (e) => {
                e.preventDefault(); // Prevent any default behavior
                console.log('Google sign-in button clicked');
                
                try {
                    clearMessages('login-error-message'); // Clear login errors before Google sign-in
                    clearMessages('registration-error-message'); // Also clear registration errors
                    sessionStorage.setItem('justLoggedIn', 'true');
                    sessionStorage.setItem('googleSignInInProgress', 'true'); // Set flag to prevent redirect
                    
                    console.log('Starting Google sign-in...');
                    
                    // Pre-check: Test if Google domains are accessible
                    try {
                        const testResponse = await fetch('https://accounts.google.com/generate_204', {
                            method: 'HEAD',
                            mode: 'no-cors',
                            cache: 'no-cache'
                        });
                        console.log('Google accessibility check passed');
                    } catch (fetchError) {
                        console.warn('Google accessibility check failed:', fetchError);
                        // Don't block sign-in, just log the warning
                    }
                    
                    const provider = new firebase.auth.GoogleAuthProvider();
                    
                    // Add scopes for better profile access
                    provider.addScope('email');
                    provider.addScope('profile');
                    
                    // Set custom parameters for better UX
                    provider.setCustomParameters({
                        prompt: 'select_account' // Force account selection
                    });
                    
                    // Detect if mobile device - more comprehensive detection
                    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile/i.test(navigator.userAgent) || 
                                    (window.innerWidth <= 768 && 'ontouchstart' in window);
                    
                    console.log('Device detection - UserAgent:', navigator.userAgent);
                    console.log('Device detection - Screen width:', window.innerWidth);
                    console.log('Device detection - Touch support:', 'ontouchstart' in window);
                    console.log('Device detection - Is mobile:', isMobile);
                    
                    // Show loading state
                    if (window.showLoadingToast) {
                        window.showLoadingToast('Accesso con Google in corso...');
                    }
                    
                    if (isMobile) {
                        // Use redirect for mobile devices
                        console.log('Mobile detected, using signInWithRedirect...');
                        
                        // Set a timeout to clear the flag if redirect takes too long
                        setTimeout(() => {
                            if (sessionStorage.getItem('googleSignInInProgress') === 'true') {
                                console.log('Google sign-in timeout, clearing flag');
                                sessionStorage.removeItem('googleSignInInProgress');
                                if (window.hideLoadingToast) {
                                    window.hideLoadingToast();
                                }
                                displayMessage('login-error-message', 'Timeout durante l\'accesso Google. Riprova.');
                                displayMessage('registration-error-message', 'Timeout durante l\'accesso Google. Riprova.');
                            }
                        }, 30000); // 30 seconds timeout
                        
                        try {
                            await auth.signInWithRedirect(provider);
                        } catch (redirectError) {
                            console.error('Redirect failed, trying popup as fallback:', redirectError);
                            
                            // Fallback to popup if redirect fails (might be blocked)
                            if (redirectError.code === 'auth/unauthorized-domain' || 
                                redirectError.message.includes('ERR_BLOCKED_BY_CLIENT')) {
                                
                                // Show specific error for mobile redirect failure
                                const message = 'Redirect Google bloccato su mobile.\n\n' +
                                             'Soluzioni:\n' +
                                             '1. Disabilita ad-blocker per questo sito\n' +
                                             '2. Prova con browser in incognito\n' +
                                             '3. Usa il login email/password temporaneamente';
                                displayMessage('login-error-message', message);
                                displayMessage('registration-error-message', message);
                                
                                if (window.hideLoadingToast) {
                                    window.hideLoadingToast();
                                }
                                sessionStorage.removeItem('googleSignInInProgress');
                                return;
                            }
                            
                            throw redirectError; // Re-throw if not a blocking error
                        }
                    } else {
                        // Use popup for desktop
                        console.log('Desktop detected, using signInWithPopup...');
                        const result = await auth.signInWithPopup(provider);
                        
                        // Hide loading state
                        if (window.hideLoadingToast) {
                            window.hideLoadingToast();
                        }
                        
                        // Clear the flag immediately after successful popup sign-in
                        sessionStorage.removeItem('googleSignInInProgress');
                        
                        // Show success message
                        if (window.showSuccessToast) {
                            window.showSuccessToast('Accesso Google completato!');
                        }
                    }
                    
                } catch (error) {
                    console.error('Google sign-in error:', error);
                    
                    // Hide loading state
                    if (window.hideLoadingToast) {
                        window.hideLoadingToast();
                    }
                    
                    // Clear the flag on error
                    sessionStorage.removeItem('googleSignInInProgress');
                    
                    // Special handling for unauthorized domain error
                    if (error.code === 'auth/unauthorized-domain') {
                        const currentDomain = window.location.hostname;
                        const message = `Dominio non autorizzato: ${currentDomain}. Per favore:\n` +
                                     `1. Aggiungi ${currentDomain} ai domini autorizzati nella Firebase Console\n` +
                                     `2. Vai su Authentication → Settings → Authorized domains\n` +
                                     `3. Oppure usa un server locale (es. localhost)`;
                        displayMessage('login-error-message', message);
                        displayMessage('registration-error-message', message); // Also show in registration form
                        
                        // Also show in a popup for better visibility
                        if (window.alert) {
                            await window.alert(message, 'Errore Dominio OAuth');
                        }
                    } else if (error.code === 'auth/popup-closed-by-user') {
                        // Don't show error for user cancellation
                        console.log('User cancelled Google sign-in');
                    } else if (error.code === 'auth/network-request-failed' || error.message.includes('ERR_BLOCKED_BY_CLIENT')) {
                        // Handle ad-blocker or network issues
                        const message = 'Accesso Google bloccato. Possibili cause:\n' +
                                     '1. Ad-blocker o estensioni del browser attive\n' +
                                     '2. Problemi di connessione\n' +
                                     '3. Firewall o proxy che bloccano Google\n\n' +
                                     'Soluzioni:\n' +
                                     '- Disabilita ad-blocker per questo sito\n' +
                                     '- Prova con un browser diverso\n' +
                                     '- Controlla la connessione internet';
                        displayMessage('login-error-message', message);
                        displayMessage('registration-error-message', message);
                        
                        if (window.showErrorToast) {
                            window.showErrorToast('Accesso Google bloccato da estensioni');
                        }
                    } else {
                        const errorMessage = getFirebaseErrorMessage(error.code);
                        displayMessage('login-error-message', errorMessage);
                        displayMessage('registration-error-message', errorMessage); // Also show in registration form
                        
                        if (window.showErrorToast) {
                            window.showErrorToast(errorMessage);
                        }
                    }
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


    // Handle authentication state changes
    firebase.auth().onAuthStateChanged(async user => {
        const isGoogleSignInInProgress = sessionStorage.getItem('googleSignInInProgress') === 'true';
        
        if (user) {
            console.log('User is signed in:', user);
            
            // Save lastUserId for optimistic loading
            localStorage.setItem('lastUserId', user.uid);
            
            try {
                // Handle Google redirect completion
                if (isGoogleSignInInProgress) {
                    console.log('Google redirect sign-in completed, processing...');
                    
                    try {
                        const result = await auth.getRedirectResult();
                        console.log('Google redirect result:', result);
                        
                        // Verify this is actually a Google sign-in result
                        if (!result || !result.user) {
                            console.log('No redirect result available, might be page refresh');
                            sessionStorage.removeItem('googleSignInInProgress');
                        } else {
                            // Hide loading state
                            if (window.hideLoadingToast) {
                                window.hideLoadingToast();
                            }
                            
                            // Show success message
                            if (window.showSuccessToast) {
                                window.showSuccessToast('Accesso Google completato!');
                            }
                        }
                        
                    } catch (error) {
                        console.error('Error getting redirect result:', error);
                        
                        // Hide loading state
                        if (window.hideLoadingToast) {
                            window.hideLoadingToast();
                        }
                        
                        // Show error message
                        const errorMessage = getFirebaseErrorMessage(error.code);
                        displayMessage('login-error-message', errorMessage);
                        displayMessage('registration-error-message', errorMessage);
                        
                        if (window.showErrorToast) {
                            window.showErrorToast(errorMessage);
                        }
                        
                        // Clear the flag and sign out on error
                        sessionStorage.removeItem('googleSignInInProgress');
                        await auth.signOut();
                        return;
                    }
                }
                
                // Check if user document exists, create if not
                const userDoc = await db.collection('users').doc(user.uid).get();
                if (!userDoc.exists) {
                    console.log('Creating user document for Google user...');
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
                
                // Check if user has username, if not redirect to username selection page
                const userData = userDoc.exists ? userDoc.data() : null;
                if (!userData || !userData.username || userData.username.trim() === '') {
                    console.log('Google user needs username, redirecting to username selection');
                    window.location.href = '../lista_schede/lista_scheda.html';
                    return;
                }
                
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
                
                // Clear Google sign-in flag
                sessionStorage.removeItem('googleSignInInProgress');
                
                // Redirect to lista_schede.html
                console.log('Redirecting to lista_schede.html...');
                window.location.href = '../lista_schede/lista_scheda.html';
                
            } catch (error) {
                console.error('Error processing user data:', error);
                displayMessage('login-error-message', getFirebaseErrorMessage(error.code));
                sessionStorage.removeItem('googleSignInInProgress');
            }
        } else {
            // User is signed out.
            console.log('User is signed out.');
            // Clear Google sign-in flag when signed out
            sessionStorage.removeItem('googleSignInInProgress');
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
                return 'Accesso annullato: popup chiuso dall\'utente.';
            case 'auth/popup-blocked':
                return 'Accesso bloccato: il popup è stato bloccato dal browser. Per favore consenti i popup e riprova.';
            case 'auth/cancelled-popup-request':
                return 'Richiesta di accesso annullata.';
            case 'auth/too-many-requests':
                return 'Troppi tentativi di accesso falliti. Riprova più tardi.';
            case 'auth/unauthorized-domain':
                return 'Dominio non autorizzato per l\'accesso Google.';
            default:
                return 'Si è verificato un errore sconosciuto. Riprova.';
        }
    }
});
