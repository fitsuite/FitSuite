document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM Content Loaded');
    
    // Firebase Auth and Firestore
    const auth = firebase.auth();
    const db = firebase.firestore();

    // Forza la persistenza locale per evitare che i dati vadano persi durante il redirect
    try {
        await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    } catch (error) {
        console.error("Errore impostazione persistenza:", error);
    }

    // Flag per impedire che onAuthStateChanged interferisca con la logica del redirect
    let isAuthProcessing = false;

    // GESTIONE RITORNO DA GOOGLE (MOBILE)
    auth.getRedirectResult().then(async (result) => {
        console.log('getRedirectResult eseguito');
        if (result && result.user) {
            isAuthProcessing = true; // Blocca onAuthStateChanged
            console.log('Redirect result trovato! User:', result.user.email);
            
            try {
                if (window.showLoadingToast) window.showLoadingToast('Finalizzazione accesso...');

                // Crea il documento se non esiste
                await createGoogleUserDocument(result.user);
                
                // Pulizia e Redirect
                sessionStorage.removeItem('googleSignInInProgress');
                window.location.href = '../lista_schede/lista_scheda.html';
            } catch (error) {
                console.error('Errore post-redirect:', error);
                isAuthProcessing = false;
            }
        } else {
            console.log('Nessun utente nel redirect result (user è null)');
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

    // Initialize form display states
    if (registrationFormContainer && loginFormContainer && forgotPasswordContainer) {
        registrationFormContainer.style.display = 'block';
        loginFormContainer.style.display = 'none';
        forgotPasswordContainer.style.display = 'none';
        if (navbarLoginButton) {
            navbarLoginButton.innerText = 'Accedi';
        }
    }

    if (registrationFormContainer && loginFormContainer && showLoginLink && showRegisterLink && navbarLoginButton && forgotPasswordLink && forgotPasswordContainer && showLoginFromForgotLink) {
        showLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            registrationFormContainer.style.display = 'none';
            loginFormContainer.style.display = 'block';
            forgotPasswordContainer.style.display = 'none';
            navbarLoginButton.innerText = 'Registrati';
        });

        showRegisterLink.addEventListener('click', (e) => {
            e.preventDefault();
            loginFormContainer.style.display = 'none';
            registrationFormContainer.style.display = 'block';
            forgotPasswordContainer.style.display = 'none';
            navbarLoginButton.innerText = 'Accedi';
        });

        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            loginFormContainer.style.display = 'none';
            registrationFormContainer.style.display = 'none';
            forgotPasswordContainer.style.display = 'block';
            navbarLoginButton.innerText = 'Accedi';
        });

        showLoginFromForgotLink.addEventListener('click', (e) => {
            e.preventDefault();
            forgotPasswordContainer.style.display = 'none';
            loginFormContainer.style.display = 'block';
            navbarLoginButton.innerText = 'Registrati';
        });
    }

    if (navbarLoginBtn && registrationFormContainer && loginFormContainer && navbarLoginButton && forgotPasswordContainer) {
        navbarLoginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const isLoginFormActive = loginFormContainer.style.display === 'block';
            const isForgotPasswordFormActive = forgotPasswordContainer.style.display === 'block';

            if (isLoginFormActive || isForgotPasswordFormActive) {
                loginFormContainer.style.display = 'none';
                forgotPasswordContainer.style.display = 'none';
                registrationFormContainer.style.display = 'block';
                navbarLoginButton.innerText = 'Accedi';
            } else {
                registrationFormContainer.style.display = 'none';
                loginFormContainer.style.display = 'block';
                navbarLoginButton.innerText = 'Registrati';
            }
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
                const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                const user = userCredential.user;
                
                await db.collection('users').doc(user.uid).set({
                    email: email,
                    username: null,
                    phoneNumber: "",
                    preferences: {
                        color: "Arancione",
                        language: "Italiano",
                        notifications: "Consenti tutti"
                    },
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                sessionStorage.setItem('justLoggedIn', 'true');
            } catch (error) {
                displayMessage('registration-error-message', getFirebaseErrorMessage(error.code));
            }
        });
    }

    // Email/Password Login
    const loginForm = document.querySelector('.login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = loginForm.querySelector('#login-email').value;
            const password = loginForm.querySelector('#login-password').value;

            try {
                clearMessages('login-error-message');
                const userCredential = await auth.signInWithEmailAndPassword(email, password);
                const user = userCredential.user;
                
                const userDoc = await db.collection('users').doc(user.uid).get();
                if (!userDoc.exists) {
                    await createGoogleUserDocument(user);
                }
                sessionStorage.setItem('justLoggedIn', 'true');
            } catch (error) {
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
                displayMessage('forgot-password-success-message', 'Link per il reset della password inviato!', false);
                sessionStorage.setItem('passwordResetSuccess', 'true');
                sessionStorage.setItem('passwordResetEmail', email);
                setTimeout(() => { window.location.href = 'auth.html'; }, 3000);
            } catch (error) {
                displayMessage('forgot-password-error-message', getFirebaseErrorMessage(error.code));
            }
        });
    }

    // Helper functions
    async function createGoogleUserDocument(user) {
        if (!user || !user.uid) throw new Error('UID non valido');
        const userRef = db.collection('users').doc(user.uid);
        const userDoc = await userRef.get();
        if (!userDoc.exists) {
            await userRef.set({
                email: user.email,
                username: null,
                phoneNumber: user.phoneNumber || "",
                preferences: { color: "Arancione", language: "Italiano", notifications: "Consenti tutti" },
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
    }

    auth.onAuthStateChanged(async user => {
        if (isAuthProcessing) return;
        if (user) {
            console.log('User is signed in:', user.email);
            localStorage.setItem('lastUserId', user.uid);
            try {
                const userDoc = await db.collection('users').doc(user.uid).get();
                let userData = userDoc.exists ? userDoc.data() : null;

                if (!userDoc.exists) {
                    await createGoogleUserDocument(user);
                    const updated = await db.collection('users').doc(user.uid).get();
                    userData = updated.data();
                }

                if (!userData || !userData.username || userData.username.trim() === '') {
                    window.location.href = '../lista_schede/lista_scheda.html';
                    return;
                }

                if (window.CacheManager) {
                    const force = sessionStorage.getItem('justLoggedIn') === 'true';
                    sessionStorage.removeItem('justLoggedIn');
                    await window.CacheManager.initCache(user.uid, force);
                }

                if (!window.location.href.includes('lista_scheda.html')) {
                    window.location.href = '../lista_schede/lista_scheda.html';
                }
            } catch (error) {
                console.error('Error processing user data:', error);
            }
        } else {
            console.log('User is signed out.');
            sessionStorage.removeItem('googleSignInInProgress');
        }
    });

    function displayMessage(elementId, message, isError = true) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = message;
            element.style.display = 'block';
            element.className = isError ? 'error-message' : 'success-message';
        }
    }

    function clearMessages(elementId) {
        const element = document.getElementById(elementId);
        if (element) { element.style.display = 'none'; }
    }

    function getFirebaseErrorMessage(errorCode) {
        switch (errorCode) {
            case 'auth/email-already-in-use': return 'Questa email è già registrata.';
            case 'auth/wrong-password': return 'Password errata.';
            case 'auth/user-not-found': return 'Nessun utente trovato.';
            default: return 'Si è verificato un errore. Riprova.';
        }
    }
});