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
                            console.log('Attempting signInWithRedirect...');
                            console.log('Provider config:', provider.toJSON ? provider.toJSON() : 'Provider object');
                            console.log('Current URL before redirect:', window.location.href);
                            
                            const redirectPromise = auth.signInWithRedirect(provider);
                            console.log('Redirect promise created:', redirectPromise);
                            
                            await redirectPromise;
                            console.log('signInWithRedirect initiated successfully');
                            
                            // Add a small delay to check if redirect actually happens
                            setTimeout(() => {
                                console.log('Checking if redirect happened after 2 seconds...');
                                console.log('Current URL after supposed redirect:', window.location.href);
                            }, 2000);
                            
                        } catch (redirectError) {
                            console.error('Redirect failed, trying popup as fallback:', redirectError);
                            
                            // Fallback to popup if redirect fails (might be blocked)
                            if (redirectError.code === 'auth/unauthorized-domain' || 
                                redirectError.message.includes('ERR_BLOCKED_BY_CLIENT') ||
                                redirectError.message.includes('Failed to fetch')) {
                                
                                console.log('Redirect blocked, trying popup fallback...');
                                
                                // Show specific error for mobile redirect failure
                                const message = 'Redirect Google bloccato su mobile.\n\n' +
                                             'Tentativo fallback con popup...\n' +
                                             'Se anche questo fallisce:\n' +
                                             '1. Disabilita ad-blocker per questo sito\n' +
                                             '2. Prova con browser in incognito\n' +
                                             '3. Usa il login email/password temporaneamente';
                                
                                displayMessage('login-error-message', message);
                                displayMessage('registration-error-message', message);
                                
                                // Try popup as fallback
                                try {
                                    console.log('Trying popup fallback on mobile...');
                                    const result = await auth.signInWithPopup(provider);
                                    console.log('Popup fallback successful on mobile!');
                                    
                                    // Hide loading state
                                    if (window.hideLoadingToast) {
                                        window.hideLoadingToast();
                                    }
                                    
                                    // Clear the flag immediately after successful popup sign-in
                                    sessionStorage.removeItem('googleSignInInProgress');
                                    
                                    // Create user document immediately after successful Google sign-in
                                    const user = result.user;
                                    console.log('Google popup fallback successful, creating user document...');
                                    
                                    try {
                                        // Check if user document exists, create if missing
                                        const userDoc = await db.collection('users').doc(user.uid).get();
                                        if (!userDoc.exists) {
                                            console.log('Creating user document for Google popup fallback user...');
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
                                            console.log('User document created for Google popup fallback user');
                                        } else {
                                            console.log('User document already exists for Google popup fallback user');
                                        }
                                    } catch (dbError) {
                                        console.error('Error creating user document for Google popup fallback user:', dbError);
                                    }
                                    
                                    // Redirect immediately to lista_scheda.html after successful fallback login
                                    window.location.href = '../lista_schede/lista_scheda.html';
                                    
                                } catch (popupError) {
                                    console.error('Popup fallback also failed:', popupError);
                                    
                                    const fallbackMessage = 'Sia redirect che popup Google sono falliti.\n\n' +
                                                          'Soluzioni:\n' +
                                                          '1. Disabilita ad-blocker per questo sito\n' +
                                                          '2. Prova con browser in incognito\n' +
                                                          '3. Usa il login email/password\n' +
                                                          '4. Controlla connessione internet';
                                    
                                    displayMessage('login-error-message', fallbackMessage);
                                    displayMessage('registration-error-message', fallbackMessage);
                                    
                                    if (window.hideLoadingToast) {
                                        window.hideLoadingToast();
                                    }
                                    sessionStorage.removeItem('googleSignInInProgress');
                                    return;
                                }
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
                        
                        // Create user document immediately after successful Google sign-in
                        const user = result.user;
                        console.log('Google sign-in successful, creating user document...');
                        
                        try {
                            // Check if user document exists, create if missing
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
                            } else {
                                console.log('User document already exists for Google user');
                            }
                        } catch (dbError) {
                            console.error('Error creating user document for Google user:', dbError);
                            // Continue with sign-in even if document creation fails initially
                        }
                        
                        // Redirect immediately to lista_scheda.html after successful login
                        window.location.href = '../lista_schede/lista_scheda.html';
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
                        const currentPort = window.location.port;
                        const fullDomain = currentPort ? `${currentDomain}:${currentPort}` : currentDomain;
                        
                        // Detect if we're on GitHub Pages
                        const isGitHubPages = currentDomain.includes('github.io') || currentDomain.includes('fitsuite.github.io');
                        
                        let message = `Dominio non autorizzato: ${fullDomain}\n\n`;
                        
                        if (isGitHubPages) {
                            message += `ERRORE CRITICO PER GITHUB PAGES:\n` +
                                     `Il dominio ${fullDomain} non è configurato in Firebase.\n\n` +
                                     `SOLUZIONE IMMEDIATA:\n` +
                                     `1. Apri: https://console.firebase.google.com/project/fitsuite-a7b6c/authentication/settings\n` +
                                     `2. In "Authorized domains" aggiungi:\n` +
                                     `   - fitsuite.github.io\n` +
                                     `   - www.fitsuite.github.io\n` +
                                     `3. Salva e riprova\n\n` +
                                     `NOTA: Senza questa configurazione, l'accesso Google non funzionerà su GitHub Pages.`;
                        } else {
                            message += `Per risolvere:\n` +
                                     `1. Vai su Firebase Console → Authentication → Settings\n` +
                                     `2. In "Authorized domains" aggiungi: ${fullDomain}\n` +
                                     `3. Aggiungi anche: localhost, 127.0.0.1\n` +
                                     `4. Salva e riprova\n\n` +
                                     `Link diretto: https://console.firebase.google.com/project/fitsuite-a7b6c/authentication/settings`;
                        }
                        
                        console.error('CRITICAL: Unauthorized domain error detected:', {
                            domain: fullDomain,
                            isGitHubPages: isGitHubPages,
                            userAgent: navigator.userAgent,
                            timestamp: new Date().toISOString()
                        });
                        
                        displayMessage('login-error-message', message);
                        displayMessage('registration-error-message', message);
                        
                        // Show enhanced popup for GitHub Pages
                        if (isGitHubPages) {
                            const confirmMsg = 'DETEZIONE GITHUB PAGES\n\n' +
                                             'Il tuo dominio GitHub Pages non è autorizzato.\n' +
                                             'Vuoi aprire la Firebase Console per risolvere?\n\n' +
                                             'SÌ = Apro la console automaticamente\n' +
                                             'NO = Copio il link negli appunti';
                            
                            if (await window.showConfirm(confirmMsg)) {
                                const firebaseConsoleUrl = 'https://console.firebase.google.com/project/fitsuite-a7b6c/authentication/settings';
                                window.open(firebaseConsoleUrl, '_blank');
                            } else {
                                // Copy to clipboard as fallback
                                navigator.clipboard.writeText('https://console.firebase.google.com/project/fitsuite-a7b6c/authentication/settings')
                                    .then(() => {
                                        if (window.showSuccessToast) {
                                            window.showSuccessToast('Link copiato negli appunti! Incollalo nel browser.');
                                        }
                                    })
                                    .catch(() => {
                                        if (window.showErrorToast) {
                                            window.showErrorToast('Link: https://console.firebase.google.com/project/fitsuite-a7b6c/authentication/settings');
                                        }
                                    });
                            }
                        } else {
                            if (await window.showConfirm('Vuoi aprire la Firebase Console per risolvere il problema?')) {
                                const firebaseConsoleUrl = 'https://console.firebase.google.com/project/fitsuite-a7b6c/authentication/settings';
                                window.open(firebaseConsoleUrl, '_blank');
                            }
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


    // Helper function to create Google user document
    async function createGoogleUserDocument(user) {
        if (!user || !user.uid) {
            throw new Error('UID utente non valido per la creazione del documento');
        }
        
        try {
            // Check if user document exists, create if missing
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
            } else {
                console.log('User document already exists for Google user');
            }
        } catch (error) {
            console.error('Error in createGoogleUserDocument:', error);
            throw error;
        }
    }

    // Handle Google Redirect Result (for mobile and redirect flows) - UNIFIED HANDLER
    auth.getRedirectResult().then(function(result) {
        console.log('getRedirectResult executed. Result:', result);
        
        if (result.credential) {
            // This gives you a Google Access Token. You can use it to access the Google API.
            var token = result.credential.accessToken;
            console.log('Google Access Token:', token);
        }
        
        if (result.user) {
            // The signed-in user info.
            var user = result.user;
            console.log('Google Redirect User:', user);
            
            // Validate user object before proceeding
            if (!user || !user.uid) {
                console.error('Invalid user object from redirect result:', user);
                throw new Error('UID null o non valido dal redirect Google');
            }
            
            // Clear the flag immediately after successful redirect sign-in
            sessionStorage.removeItem('googleSignInInProgress');

            // Hide loading state
            if (window.hideLoadingToast) {
                window.hideLoadingToast();
            }

            // Create user document immediately after successful Google sign-in
            console.log('Google redirect successful, creating user document...');
            
            // Use async/await for better error handling
            createGoogleUserDocument(user).then(() => {
                console.log('Google redirect user document creation completed');
                // Don't redirect here - let onAuthStateChanged handle it to avoid conflicts
                if (window.showSuccessToast) {
                    window.showSuccessToast('Accesso Google completato!');
                }
            }).catch(dbError => {
                console.error('Error creating user document for Google redirect user:', dbError);
                displayMessage('login-error-message', 'Errore durante la creazione del profilo utente. Riprova.');
                displayMessage('registration-error-message', 'Errore durante la creazione del profilo utente. Riprova.');
            });
            
        } else {
            console.log('No user in redirect result - might be page refresh or direct access');
            // Clear the flag if no user found
            sessionStorage.removeItem('googleSignInInProgress');
        }
    }).catch(function(error) {
        console.error('Error in getRedirectResult:', error);
        // Clear the flag on error
        sessionStorage.removeItem('googleSignInInProgress');
        
        // Hide loading state
        if (window.hideLoadingToast) {
            window.hideLoadingToast();
        }
        
        // Show error message
        const errorMessage = getFirebaseErrorMessage(error.code);
        displayMessage('login-error-message', errorMessage);
        displayMessage('registration-error-message', errorMessage);
    });

    // Handle authentication state changes
    firebase.auth().onAuthStateChanged(async user => {
        const isGoogleSignInInProgress = sessionStorage.getItem('googleSignInInProgress') === 'true';
        
        if (user) {
            // Validate user object before proceeding
            if (!user || !user.uid) {
                console.error('Invalid user object in onAuthStateChanged:', user);
                displayMessage('login-error-message', 'Errore critico: UID utente non valido. Riprova l\'accesso.');
                displayMessage('registration-error-message', 'Errore critico: UID utente non valido. Riprova l\'accesso.');
                sessionStorage.removeItem('googleSignInInProgress');
                return;
            }
            
            console.log('User is signed in:', user);
            
            // Save lastUserId for optimistic loading
            localStorage.setItem('lastUserId', user.uid);
            
            try {
                // Check if user document exists, create if not
                const userDoc = await db.collection('users').doc(user.uid).get();
                if (!userDoc.exists) {
                    console.log('Creating user document for Google user...');
                    await createGoogleUserDocument(user);
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
