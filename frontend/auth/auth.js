document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded');
    // Firebase Auth and Firestore
    const auth = firebase.auth();
    const db = firebase.firestore();

    // Flag per impedire che onAuthStateChanged interferisca con la logica del redirect
    let isAuthProcessing = false;

    // GESTIONE RITORNO DA GOOGLE (MOBILE)
    auth.getRedirectResult().then(async (result) => {
        if (result.user) {
            isAuthProcessing = true; // Blocca onAuthStateChanged
            console.log('Redirect result trovato! User:', result.user.email);
            
            try {
                // Mostra caricamento
                if (window.showLoadingToast) window.showLoadingToast('Finalizzazione accesso...');

                // Crea il documento se non esiste (riutilizziamo la tua funzione)
                await createGoogleUserDocument(result.user);
                
                // Pulizia e Redirect
                sessionStorage.removeItem('googleSignInInProgress');
                window.location.href = '../lista_schede/lista_scheda.html';
            } catch (error) {
                console.error('Errore post-redirect:', error);
                isAuthProcessing = false; // Rilascia in caso di errore
            }
        } else {
            console.log('Nessun utente nel redirect (caricamento normale della pagina)');
        }
    }).catch((error) => {
        console.error('Errore getRedirectResult:', error);
        displayMessage('login-error-message', getFirebaseErrorMessage(error.code));
    });

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

    // Google Sign-In Buttons
    const googleSignInBtns = document.querySelectorAll('.google-signin-btn');
    googleSignInBtns.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            
            const provider = new firebase.auth.GoogleAuthProvider();
            provider.addScope('email');
            provider.addScope('profile');
            provider.setCustomParameters({ prompt: 'select_account' });

            const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (window.innerWidth <= 768);

            try {
                if (isMobile) {
                    console.log('Avvio Redirect su Mobile...');
                    sessionStorage.setItem('googleSignInInProgress', 'true');
                    await auth.signInWithRedirect(provider);
                    // Il codice si ferma qui perché la pagina cambia
                } else {
                    console.log('Avvio Popup su Desktop...');
                    if (window.showLoadingToast) window.showLoadingToast('Accesso in corso...');
                    const result = await auth.signInWithPopup(provider);
                    
                    await createGoogleUserDocument(result.user);
                    
                    window.location.href = '../lista_schede/lista_scheda.html';
                }
            } catch (error) {
                console.error('Errore click Google:', error);
                displayMessage('login-error-message', getFirebaseErrorMessage(error.code));
            }
        });
    });

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

    // Handle authentication state changes
    firebase.auth().onAuthStateChanged(async user => {
        // Se il redirect sta processando i dati, non facciamo nulla qui
        if (isAuthProcessing) {
            console.log('Skipping onAuthStateChanged during Google redirect processing');
            return;
        }

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
                let userData;

                if (!userDoc.exists) {
                    console.log('Creating user document for authenticated user...');
                    await createGoogleUserDocument(user);
                    console.log('User document created for authenticated user');
                    // Refetch the document after creation
                    const updatedUserDoc = await db.collection('users').doc(user.uid).get();
                    userData = updatedUserDoc.data();
                } else {
                    userData = userDoc.data();
                }
                
                // Check if user has username, if not redirect to username selection page
                if (!userData || !userData.username || userData.username.trim() === '') {
                    console.log('User needs username, redirecting to lista_scheda.html for username selection');
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
                
                // Redirect to lista_schede.html solo se non siamo già lì
                if (!window.location.href.includes('lista_scheda.html')) {
                    console.log('Redirecting to lista_schede.html from onAuthStateChanged...');
                    window.location.href = '../lista_schede/lista_scheda.html';
                }
                
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