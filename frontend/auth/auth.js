// FitSuite Authentication System
// Sistema completo di autenticazione con Email/Password e Google Sign-In

class FitSuiteAuth {
    constructor() {
        this.db = firebase.firestore();
        this.auth = firebase.auth();
        this.googleSignInInProgress = false;
        
        // Detection per dispositivo e dominio
        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        this.isGitHubPages = window.location.hostname.includes('github.io');
        
        this.init();
    }

    init() {
        console.log('FitSuiteAuth - Initializing authentication system');
        console.log('FitSuiteAuth - Device:', this.isMobile ? 'Mobile' : 'Desktop');
        console.log('FitSuiteAuth - Domain:', window.location.hostname);
        console.log('FitSuiteAuth - User Agent:', navigator.userAgent);
        console.log('FitSuiteAuth - Current URL:', window.location.href);
        
        // Controlla se ci sono parametri URL che indicano un redirect da Google
        const urlParams = new URLSearchParams(window.location.search);
        const hasGoogleParams = urlParams.has('code') || urlParams.has('state') || urlParams.has('access_token');
        
        if (hasGoogleParams) {
            console.log('FitSuiteAuth - Detected Google redirect parameters');
            this.showMessage('login-error-message', 'Completamento login Google...', 'loading');
        }
        
        this.setupEventListeners();
        this.setupAuthStateListener();
        
        // Gestisci il redirect result con un piccolo delay per assicurarsi che tutto sia caricato
        setTimeout(() => {
            this.handleRedirectResult();
        }, 100);
    }

    // Setup dei listener per gli eventi della UI
    setupEventListeners() {
        // Form di registrazione
        const registrationForm = document.querySelector('.registration-form');
        if (registrationForm) {
            registrationForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleRegistration();
            });
        }

        // Form di login
        const loginForm = document.querySelector('.login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }

        // Form di password dimenticata
        const forgotPasswordForm = document.querySelector('.forgot-password-form');
        if (forgotPasswordForm) {
            forgotPasswordForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handlePasswordReset();
            });
        }

        // Bottoni Google Sign-In
        const googleButtons = document.querySelectorAll('.google-signin-btn');
        googleButtons.forEach(button => {
            button.addEventListener('click', () => this.handleGoogleSignIn());
        });

        // Switch tra form
        this.setupFormSwitching();
    }

    // Setup per il cambio tra i form
    setupFormSwitching() {
        // Mostra login dalla registrazione
        const showLoginBtn = document.getElementById('show-login');
        if (showLoginBtn) {
            showLoginBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.showLoginForm();
            });
        }

        // Mostra registrazione dal login
        const showRegisterBtn = document.getElementById('show-register');
        if (showRegisterBtn) {
            showRegisterBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.showRegistrationForm();
            });
        }

        // Mostra login dalla password dimenticata
        const showLoginFromForgotBtn = document.getElementById('show-login-from-forgot');
        if (showLoginFromForgotBtn) {
            showLoginFromForgotBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.showLoginForm();
            });
        }

        // Link password dimenticata
        const forgotPasswordLink = document.getElementById('forgot-password-link');
        if (forgotPasswordLink) {
            forgotPasswordLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.showForgotPasswordForm();
            });
        }

        // Navbar login button
        const navbarLoginBtn = document.getElementById('navbar-login-btn');
        if (navbarLoginBtn) {
            navbarLoginBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.showLoginForm();
            });
        }
    }

    // Listener per i cambiamenti di stato di autenticazione
    setupAuthStateListener() {
        this.auth.onAuthStateChanged(async (user) => {
            console.log('FitSuiteAuth - Auth state changed:', user ? 'User logged in' : 'User logged out');
            
            if (user) {
                try {
                    // Verifica che l'utente abbia un documento nel database
                    const userDoc = await this.db.collection('users').doc(user.uid).get();
                    
                    if (!userDoc.exists) {
                        console.log('FitSuiteAuth - Creating user document for:', user.email);
                        await this.createGoogleUserDocument(user);
                    }

                    // Controlla se l'utente ha un username
                    const userData = userDoc.data() || {};
                    if (!userData.username) {
                        console.log('FitSuiteAuth - User missing username, redirecting to lista_schede');
                        window.location.href = '../lista_schede/lista_schede.html';
                    } else {
                        console.log('FitSuiteAuth - User complete, redirecting to crea_scheda');
                        window.location.href = '../crea_scheda/crea_scheda.html';
                    }
                } catch (error) {
                    console.error('FitSuiteAuth - Error in auth state change:', error);
                    this.showMessage('login-error-message', 'Errore durante il caricamento del profilo');
                }
            }
        });
    }

    // Gestisce il risultato del redirect Google
    async handleRedirectResult() {
        console.log('FitSuiteAuth - Checking redirect result...');
        
        try {
            const result = await this.auth.getRedirectResult();
            
            if (result.user) {
                console.log('FitSuiteAuth - Redirect result successful:', result.user.email);
                
                // Mostra messaggio di successo
                this.showMessage('login-error-message', 'Login con Google completato!', 'success');
                
                // Crea il documento utente se non esiste
                try {
                    await this.createGoogleUserDocument(result.user);
                } catch (docError) {
                    console.error('FitSuiteAuth - Error creating user document:', docError);
                    // Continua anche se c'è un errore nella creazione del documento
                }
                
                // Redirect dopo un breve delay
                setTimeout(() => {
                    window.location.href = '../lista_schede/lista_schede.html';
                }, 1500);
            } else {
                console.log('FitSuiteAuth - No user in redirect result');
            }
        } catch (error) {
            console.error('FitSuiteAuth - Redirect result error:', error);
            this.handleGoogleAuthError(error);
        } finally {
            this.googleSignInInProgress = false;
        }
    }

    // Gestisce la registrazione con email/password
    async handleRegistration() {
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirm-password').value;

        // Validazione
        if (!this.validateRegistrationForm(email, password, confirmPassword)) {
            return;
        }

        this.showMessage('registration-error-message', 'Registrazione in corso...', 'loading');

        try {
            console.log('FitSuiteAuth - Attempting registration for:', email);
            
            // Crea utente in Firebase Auth
            const userCredential = await this.auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;

            console.log('FitSuiteAuth - User created successfully:', user.email);

            // Crea documento utente nel database
            await this.createUserDocument(user);

            this.showMessage('registration-error-message', 'Registrazione completata! Reindirizzamento...', 'success');

            // Redirect dopo registrazione
            setTimeout(() => {
                window.location.href = '../lista_schede/lista_schede.html';
            }, 2000);

        } catch (error) {
            console.error('FitSuiteAuth - Registration error:', error);
            this.handleAuthError(error, 'registration-error-message');
        }
    }

    // Gestisce il login con email/password
    async handleLogin() {
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;

        if (!email || !password) {
            this.showMessage('login-error-message', 'Compila tutti i campi');
            return;
        }

        this.showMessage('login-error-message', 'Accesso in corso...', 'loading');

        try {
            console.log('FitSuiteAuth - Attempting login for:', email);
            
            const userCredential = await this.auth.signInWithEmailAndPassword(email, password);
            console.log('FitSuiteAuth - Login successful:', userCredential.user.email);

            this.showMessage('login-error-message', 'Accesso completato!', 'success');

        } catch (error) {
            console.error('FitSuiteAuth - Login error:', error);
            this.handleAuthError(error, 'login-error-message');
        }
    }

    // Gestisce il reset della password
    async handlePasswordReset() {
        const email = document.getElementById('reset-email').value.trim();

        if (!email) {
            this.showMessage('forgot-password-error-message', 'Inserisci la tua email');
            return;
        }

        this.showMessage('forgot-password-error-message', 'Invio email in corso...', 'loading');
        this.clearMessage('forgot-password-success-message');

        try {
            console.log('FitSuiteAuth - Sending password reset to:', email);
            
            await this.auth.sendPasswordResetEmail(email);
            
            this.clearMessage('forgot-password-error-message');
            this.showMessage('forgot-password-success-message', 'Email di reset inviata! Controlla la tua casella di posta.', 'success');

        } catch (error) {
            console.error('FitSuiteAuth - Password reset error:', error);
            this.handleAuthError(error, 'forgot-password-error-message');
        }
    }

    // Gestisce il sign-in con Google
    async handleGoogleSignIn() {
        console.log('FitSuiteAuth - Google Sign-In requested');
        
        // Previene click multipli
        if (this.googleSignInInProgress) {
            console.log('FitSuiteAuth - Google sign-in already in progress');
            return;
        }
        
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.addScope('email');
        
        // Decide il metodo basato su dispositivo e dominio
        const shouldUseRedirect = this.isMobile || this.isGitHubPages;
        
        console.log('FitSuiteAuth - Using method:', shouldUseRedirect ? 'Redirect' : 'Popup');
        console.log('FitSuiteAuth - Device:', this.isMobile ? 'Mobile' : 'Desktop');
        console.log('FitSuiteAuth - Domain:', window.location.hostname);

        try {
            if (shouldUseRedirect) {
                // Metodo redirect per mobile e GitHub Pages
                this.googleSignInInProgress = true;
                this.showMessage('login-error-message', 'Reindirizzamento a Google...', 'loading');
                
                // Breve delay prima del redirect per permettere al messaggio di apparire
                setTimeout(async () => {
                    try {
                        await this.auth.signInWithRedirect(provider);
                    } catch (error) {
                        console.error('FitSuiteAuth - Redirect error:', error);
                        this.googleSignInInProgress = false;
                        this.handleGoogleAuthError(error);
                    }
                }, 500);
                
            } else {
                // Metodo popup per desktop
                this.showMessage('login-error-message', 'Apertura finestra di login...', 'loading');
                
                const result = await this.auth.signInWithPopup(provider);
                
                if (result.user) {
                    console.log('FitSuiteAuth - Popup sign-in successful:', result.user.email);
                    
                    // Mostra messaggio di successo
                    this.showMessage('login-error-message', 'Login con Google completato!', 'success');
                    
                    // Crea il documento utente se non esiste
                    try {
                        await this.createGoogleUserDocument(result.user);
                    } catch (docError) {
                        console.error('FitSuiteAuth - Error creating user document:', docError);
                        // Continua anche se c'è un errore nella creazione del documento
                    }
                    
                    // Redirect dopo un breve delay
                    setTimeout(() => {
                        window.location.href = '../lista_schede/lista_schede.html';
                    }, 1500);
                }
            }
        } catch (error) {
            console.error('FitSuiteAuth - Google Sign-In error:', error);
            
            // Fallback system
            if (!shouldUseRedirect && (error.code === 'auth/popup-blocked' || error.message.includes('ERR_BLOCKED_BY_CLIENT'))) {
                console.log('FitSuiteAuth - Popup blocked, trying redirect fallback');
                
                if (confirm('Il popup è stato bloccato. Vuoi provare con il metodo redirect?')) {
                    this.googleSignInInProgress = true;
                    this.showMessage('login-error-message', 'Tentativo con redirect...', 'loading');
                    
                    try {
                        await this.auth.signInWithRedirect(provider);
                    } catch (fallbackError) {
                        console.error('FitSuiteAuth - Redirect fallback failed:', fallbackError);
                        this.googleSignInInProgress = false;
                        this.handleGoogleAuthError(fallbackError);
                    }
                } else {
                    this.handleGoogleAuthError(error);
                }
            } else {
                this.handleGoogleAuthError(error);
            }
        }
    }

    // Crea documento utente per registrazione normale
    async createUserDocument(user) {
        const userDoc = {
            email: user.email,
            username: null,
            phoneNumber: user.phoneNumber || "",
            preferences: {
                color: "Arancione",
                language: "Italiano",
                notifications: "Consenti tutti"
            },
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        await this.db.collection('users').doc(user.uid).set(userDoc);
        console.log('FitSuiteAuth - User document created for:', user.email);
    }

    // Crea documento utente per Google Sign-In
    async createGoogleUserDocument(user) {
        try {
            const userDocRef = this.db.collection('users').doc(user.uid);
            const userDoc = await userDocRef.get();

            if (!userDoc.exists) {
                const userData = {
                    email: user.email,
                    username: null,
                    phoneNumber: user.phoneNumber || "",
                    preferences: {
                        color: "Arancione",
                        language: "Italiano",
                        notifications: "Consenti tutti"
                    },
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };

                await userDocRef.set(userData);
                console.log('FitSuiteAuth - Google user document created for:', user.email);
            } else {
                console.log('FitSuiteAuth - Google user document already exists for:', user.email);
            }
        } catch (error) {
            console.error('FitSuiteAuth - Error creating Google user document:', error);
            throw error;
        }
    }

    // Validazione del form di registrazione
    validateRegistrationForm(email, password, confirmPassword) {
        if (!email || !password || !confirmPassword) {
            this.showMessage('registration-error-message', 'Compila tutti i campi');
            return false;
        }

        if (!this.isValidEmail(email)) {
            this.showMessage('registration-error-message', 'Inserisci un\'email valida');
            return false;
        }

        if (password.length < 8 || password.length > 16) {
            this.showMessage('registration-error-message', 'La password deve essere tra 8 e 16 caratteri');
            return false;
        }

        if (password !== confirmPassword) {
            this.showMessage('registration-error-message', 'Le password non coincidono');
            return false;
        }

        return true;
    }

    // Validazione email
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // Gestisce gli errori di autenticazione
    handleAuthError(error, messageId) {
        let message = 'Errore durante l\'autenticazione';

        switch (error.code) {
            case 'auth/email-already-in-use':
                message = 'Questa email è già registrata';
                break;
            case 'auth/invalid-email':
                message = 'Email non valida';
                break;
            case 'auth/weak-password':
                message = 'La password è troppo debole';
                break;
            case 'auth/user-not-found':
                message = 'Utente non trovato';
                break;
            case 'auth/wrong-password':
                message = 'Password errata';
                break;
            case 'auth/too-many-requests':
                message = 'Troppi tentativi. Riprova più tardi';
                break;
            default:
                message = error.message || 'Errore sconosciuto';
        }

        this.showMessage(messageId, message);
    }

    // Gestisce gli errori specifici di Google Auth
    handleGoogleAuthError(error) {
        let message = 'Errore durante il login con Google';

        console.log('FitSuiteAuth - Google auth error details:', {
            code: error.code,
            message: error.message,
            email: error.email,
            credential: error.credential
        });

        if (error.code === 'auth/unauthorized-domain') {
            const domain = window.location.hostname;
            message = `Dominio non autorizzato: ${domain}. Aggiungi questo dominio alla Firebase Console.`;
            
            // Offre di aprire la Firebase Console
            if (confirm(`Vuoi aprire la Firebase Console per configurare il dominio?`)) {
                window.open('https://console.firebase.google.com/project/fitsuite-a7b6c/authentication/settings', '_blank');
            }
        } else if (error.code === 'auth/popup-blocked') {
            message = 'Popup bloccato dal browser. Riprova o consenti i popup per questo sito.';
        } else if (error.code === 'auth/popup-closed-by-user') {
            message = 'Finestra di login chiusa. Riprova.';
        } else if (error.code === 'auth/cancelled-popup-request') {
            message = 'Login annullato.';
        } else if (error.code === 'auth/network-request-failed') {
            message = 'Errore di rete. Controlla la connessione e riprova.';
        } else if (error.code === 'auth/too-many-redirects') {
            message = 'Troppi redirect. Prova a svuotare la cache del browser.';
        } else if (error.message && error.message.includes('ERR_BLOCKED_BY_CLIENT')) {
            message = 'Login bloccato da un estensione del browser (es. AdBlocker). Disabilita le estensioni e riprova.';
        } else if (error.message && error.message.includes('ERR_FILE_NOT_FOUND')) {
            message = 'Errore di redirect. Prova a ricaricare la pagina e ripetere il login.';
        } else {
            message = error.message || 'Errore sconosciuto durante il login con Google';
        }

        this.showMessage('login-error-message', message);
        
        // Resetta lo stato del sign-in
        this.googleSignInInProgress = false;
    }

    // Mostra messaggi nella UI
    showMessage(elementId, message, type = 'error') {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = message;
            element.className = type === 'success' ? 'success-message' : 'error-message';
            element.style.display = 'block';

            if (type === 'loading') {
                element.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ' + message;
            }
        }
    }

    // Pulisce messaggi
    clearMessage(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = '';
            element.style.display = 'none';
        }
    }

    // Funzioni per mostrare/nascondere i form
    showRegistrationForm() {
        this.hideAllForms();
        document.getElementById('registration-form-container').style.display = 'block';
        this.clearAllMessages();
    }

    showLoginForm() {
        this.hideAllForms();
        document.getElementById('login-form-container').style.display = 'block';
        this.clearAllMessages();
    }

    showForgotPasswordForm() {
        this.hideAllForms();
        document.getElementById('forgot-password-container').style.display = 'block';
        this.clearAllMessages();
    }

    hideAllForms() {
        document.getElementById('registration-form-container').style.display = 'none';
        document.getElementById('login-form-container').style.display = 'none';
        document.getElementById('forgot-password-container').style.display = 'none';
    }

    clearAllMessages() {
        this.clearMessage('registration-error-message');
        this.clearMessage('login-error-message');
        this.clearMessage('forgot-password-error-message');
        this.clearMessage('forgot-password-success-message');
    }
}

// Inizializza il sistema di autenticazione quando il DOM è caricato
document.addEventListener('DOMContentLoaded', () => {
    console.log('FitSuiteAuth - DOM loaded, initializing...');
    window.fitSuiteAuth = new FitSuiteAuth();
});

// Funzioni globali per debugging
window.testAuth = () => {
    console.log('FitSuiteAuth - Debug info:');
    console.log('Auth instance:', window.fitSuiteAuth);
    console.log('Firebase auth:', firebase.auth());
    console.log('Current user:', firebase.auth().currentUser);
    console.log('Is mobile:', window.fitSuiteAuth?.isMobile);
    console.log('Is GitHub Pages:', window.fitSuiteAuth?.isGitHubPages);
    console.log('Google sign in progress:', window.fitSuiteAuth?.googleSignInInProgress);
};

window.forceGoogleRedirect = async () => {
    console.log('FitSuiteAuth - Forcing Google redirect...');
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope('email');
    try {
        await firebase.auth().signInWithRedirect(provider);
    } catch (error) {
        console.error('FitSuiteAuth - Forced redirect error:', error);
    }
};

window.checkRedirectResult = async () => {
    console.log('FitSuiteAuth - Manually checking redirect result...');
    try {
        const result = await firebase.auth().getRedirectResult();
        console.log('FitSuiteAuth - Redirect result:', result);
        if (result.user) {
            console.log('FitSuiteAuth - User found:', result.user.email);
        } else {
            console.log('FitSuiteAuth - No user in result');
        }
    } catch (error) {
        console.error('FitSuiteAuth - Redirect result error:', error);
    }
};

window.clearAuthState = () => {
    console.log('FitSuiteAuth - Clearing auth state...');
    firebase.auth().signOut().then(() => {
        console.log('FitSuiteAuth - Signed out');
        window.location.reload();
    });
};
