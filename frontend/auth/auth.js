// Firebase services
const auth = firebase.auth();
const db = firebase.firestore();

// DOM Elements
const registrationForm = document.querySelector('.registration-form');
const loginForm = document.querySelector('.login-form');
const forgotPasswordForm = document.querySelector('.forgot-password-form');

const registrationContainer = document.getElementById('registration-form-container');
const loginContainer = document.getElementById('login-form-container');
const forgotPasswordContainer = document.getElementById('forgot-password-container');

const showLoginLinks = document.querySelectorAll('#show-login');
const showRegisterLink = document.getElementById('show-register');
const showLoginFromForgotLink = document.getElementById('show-login-from-forgot');
const forgotPasswordLink = document.getElementById('forgot-password-link');

const googleSignInButtons = document.querySelectorAll('.google-signin-btn');

// Error message elements
const registrationError = document.getElementById('registration-error-message');
const loginError = document.getElementById('login-error-message');
const forgotPasswordError = document.getElementById('forgot-password-error-message');
const forgotPasswordSuccess = document.getElementById('forgot-password-success-message');

// Form inputs
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const confirmPasswordInput = document.getElementById('confirm-password');
const loginEmailInput = document.getElementById('login-email');
const loginPasswordInput = document.getElementById('login-password');
const resetEmailInput = document.getElementById('reset-email');

// Device detection
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// GitHub Pages detection
function isGitHubPages() {
    return window.location.hostname.includes('github.io');
}

// Form switching functions
function showRegistration() {
    registrationContainer.style.display = 'block';
    loginContainer.style.display = 'none';
    forgotPasswordContainer.style.display = 'none';
    clearAllErrorMessages();
}

function showLogin() {
    registrationContainer.style.display = 'none';
    loginContainer.style.display = 'block';
    forgotPasswordContainer.style.display = 'none';
    clearAllErrorMessages();
}

function showForgotPassword() {
    registrationContainer.style.display = 'none';
    loginContainer.style.display = 'none';
    forgotPasswordContainer.style.display = 'block';
    clearAllErrorMessages();
}

function clearAllErrorMessages() {
    registrationError.textContent = '';
    loginError.textContent = '';
    forgotPasswordError.textContent = '';
    forgotPasswordSuccess.textContent = '';
}

// Form validation functions
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function validatePassword(password) {
    return password.length >= 8 && password.length <= 16;
}

function validateRegistrationForm(email, password, confirmPassword) {
    const errors = [];
    
    if (!email) {
        errors.push('Email è obbligatoria');
    } else if (!validateEmail(email)) {
        errors.push('Inserisci un\'email valida');
    }
    
    if (!password) {
        errors.push('Password è obbligatoria');
    } else if (!validatePassword(password)) {
        errors.push('La password deve essere tra 8 e 16 caratteri');
    }
    
    if (!confirmPassword) {
        errors.push('Conferma password è obbligatoria');
    } else if (password !== confirmPassword) {
        errors.push('Le password non coincidono');
    }
    
    return errors;
}

function validateLoginForm(email, password) {
    const errors = [];
    
    if (!email) {
        errors.push('Email è obbligatoria');
    } else if (!validateEmail(email)) {
        errors.push('Inserisci un\'email valida');
    }
    
    if (!password) {
        errors.push('Password è obbligatoria');
    }
    
    return errors;
}

// Error message display
function showError(element, message) {
    element.textContent = message;
    element.style.display = 'block';
}

function showSuccess(element, message) {
    element.textContent = message;
    element.style.display = 'block';
}

// Firebase user document creation
async function createGoogleUserDocument(user) {
    try {
        const userRef = db.collection('users').doc(user.uid);
        const userDoc = await userRef.get();
        
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
            
            await userRef.set(userData);
            console.log('User document created for Google user:', user.uid);
        }
    } catch (error) {
        console.error('Error creating Google user document:', error);
    }
}

// Get Firebase error message
function getFirebaseErrorMessage(error) {
    switch (error.code) {
        case 'auth/email-already-in-use':
            return 'Questa email è già registrata. Usa un\'altra email o accedi.';
        case 'auth/invalid-email':
            return 'Email non valida. Controlla e riprova.';
        case 'auth/weak-password':
            return 'La password è troppo debole. Usa almeno 8 caratteri.';
        case 'auth/user-not-found':
            return 'Utente non trovato. Controlla email o registrati.';
        case 'auth/wrong-password':
            return 'Password errata. Riprova o recupera la password.';
        case 'auth/too-many-requests':
            return 'Troppi tentativi. Riprova più tardi.';
        case 'auth/network-request-failed':
            return 'Errore di rete. Controlla la connessione.';
        case 'auth/unauthorized-domain':
            return 'Dominio non autorizzato. Contatta l\'amministratore.';
        case 'auth/popup-blocked':
            return 'Popup bloccato. Consenti i popup o usa il login tradizionale.';
        case 'auth/popup-closed-by-user':
            return 'Login annullato. Riprova.';
        default:
            return `Errore: ${error.message}`;
    }
}

// Google Sign-In
async function signInWithGoogle() {
    console.log('=== GOOGLE SIGN-IN START ===');
    const provider = new firebase.auth.GoogleAuthProvider();
    console.log('Google provider created');
    
    try {
        const isMobile = isMobileDevice();
        const isGitHub = isGitHubPages();
        const shouldUseRedirect = isMobile || isGitHub;
        
        console.log('Device detection - Mobile:', isMobile, 'GitHub Pages:', isGitHub);
        console.log('Using method:', shouldUseRedirect ? 'REDIRECT' : 'POPUP');
        
        if (shouldUseRedirect) {
            console.log('Starting Google Sign-In with REDIRECT method...');
            await auth.signInWithRedirect(provider);
            console.log('Redirect initiated successfully');
        } else {
            console.log('Starting Google Sign-In with POPUP method...');
            const result = await auth.signInWithPopup(provider);
            console.log('Popup successful, user:', result.user.uid);
            console.log('Creating Google user document...');
            await createGoogleUserDocument(result.user);
            console.log('Google user document created successfully');
        }
    } catch (error) {
        console.error('=== GOOGLE SIGN-IN ERROR ===');
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        console.error('Full error:', error);
        
        if (error.code === 'auth/popup-blocked' || error.message.includes('Cross-Origin-Opener-Policy')) {
            console.log('Popup blocked, trying redirect method as fallback...');
            try {
                await auth.signInWithRedirect(provider);
                console.log('Fallback redirect initiated');
            } catch (redirectError) {
                console.error('=== FALLBACK REDIRECT ERROR ===');
                console.error('Redirect error code:', redirectError.code);
                console.error('Redirect error message:', redirectError.message);
                showError(loginError, getFirebaseErrorMessage(redirectError));
            }
        } else {
            console.log('Showing error to user:', getFirebaseErrorMessage(error));
            showError(loginError, getFirebaseErrorMessage(error));
        }
    }
}

// Handle redirect result
async function handleRedirectResult() {
    console.log('=== REDIRECT RESULT HANDLER START ===');
    try {
        console.log('Calling getRedirectResult()...');
        const result = await auth.getRedirectResult();
        console.log('getRedirectResult() completed');
        console.log('Result user:', result.user ? result.user.uid : 'null');
        console.log('Result credential:', result.credential ? 'present' : 'null');
        console.log('Operation type:', result.operationType || 'null');
        
        if (result.user) {
            console.log('=== REDIRECT SUCCESS ===');
            console.log('Redirect result user found:', result.user.uid);
            console.log('User email:', result.user.email);
            console.log('Creating Google user document...');
            await createGoogleUserDocument(result.user);
            console.log('Google user document created, auth state change will handle redirect');
            
            // Force a small delay to ensure document is created before auth state change
            console.log('Waiting 500ms for document creation to settle...');
            await new Promise(resolve => setTimeout(resolve, 500));
            console.log('Delay completed, redirect result handler finished');
        } else {
            console.log('=== NO REDIRECT RESULT ===');
            console.log('No redirect result user found - this is normal for initial page load');
        }
    } catch (error) {
        console.error('=== REDIRECT RESULT ERROR ===');
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        console.error('Full error:', error);
        
        if (error.code !== 'auth/no-auth-event') {
            console.log('Error is not "no-auth-event", showing to user');
            showError(loginError, getFirebaseErrorMessage(error));
        } else {
            console.log('Error is "no-auth-event" - this is normal, no action needed');
        }
    }
    console.log('=== REDIRECT RESULT HANDLER END ===');
}

// Registration form handler
async function handleRegistration(e) {
    e.preventDefault();
    
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;
    
    const errors = validateRegistrationForm(email, password, confirmPassword);
    if (errors.length > 0) {
        showError(registrationError, errors[0]);
        return;
    }
    
    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // Create user document in Firestore
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
        
        await db.collection('users').doc(user.uid).set(userData);
        
        console.log('Registration successful:', user.uid);
        
        // Send email verification
        await user.sendEmailVerification();
        
        showSuccess(registrationError, 'Registrazione completata! Controlla l\'email per la verifica.');
        
        // Redirect after delay
        setTimeout(() => {
            window.location.href = '../lista_schede/lista_schede.html';
        }, 2000);
        
    } catch (error) {
        console.error('Registration error:', error);
        showError(registrationError, getFirebaseErrorMessage(error));
    }
}

// Login form handler
async function handleLogin(e) {
    e.preventDefault();
    
    const email = loginEmailInput.value.trim();
    const password = loginPasswordInput.value;
    
    const errors = validateLoginForm(email, password);
    if (errors.length > 0) {
        showError(loginError, errors[0]);
        return;
    }
    
    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        console.log('Login successful:', user.uid);
        
        // Check if user has username
        const userDoc = await db.collection('users').doc(user.uid).get();
        const userData = userDoc.data();
        
        if (userData && userData.username) {
            window.location.href = '../crea_scheda/crea_scheda.html';
        } else {
            window.location.href = '../lista_schede/lista_schede.html';
        }
        
    } catch (error) {
        console.error('Login error:', error);
        showError(loginError, getFirebaseErrorMessage(error));
    }
}

// Forgot password handler
async function handleForgotPassword(e) {
    e.preventDefault();
    
    const email = resetEmailInput.value.trim();
    
    if (!email) {
        showError(forgotPasswordError, 'Email è obbligatoria');
        return;
    }
    
    if (!validateEmail(email)) {
        showError(forgotPasswordError, 'Inserisci un\'email valida');
        return;
    }
    
    try {
        await auth.sendPasswordResetEmail(email);
        showSuccess(forgotPasswordSuccess, 'Email di reset inviata! Controlla la tua casella di posta.');
        forgotPasswordError.textContent = '';
        
        // Clear the form
        resetEmailInput.value = '';
        
        // Redirect to login after delay
        setTimeout(() => {
            showLogin();
        }, 3000);
        
    } catch (error) {
        console.error('Password reset error:', error);
        showError(forgotPasswordError, getFirebaseErrorMessage(error));
    }
}

// Auth state observer
auth.onAuthStateChanged(async (user) => {
    console.log('Auth state changed - User:', user ? user.uid : 'null');
    
    if (user) {
        console.log('User is signed in:', user.uid);
        console.log('User email:', user.email);
        console.log('Current page:', window.location.pathname);
        
        try {
            console.log('Fetching user document...');
            const userDoc = await db.collection('users').doc(user.uid).get();
            console.log('User document exists:', userDoc.exists);
            
            if (!userDoc.exists) {
                console.log('User document not found, creating one...');
                await createGoogleUserDocument(user);
                // Reload the document after creation
                console.log('Reloading user document after creation...');
                await userDoc.ref.get();
                console.log('User document reloaded');
            }
            
            // Check if user has completed registration
            const userData = userDoc.data();
            console.log('User data:', userData);
            console.log('User has username:', userData ? userData.username : 'no data');
            
            if (userData && userData.username) {
                // User is complete, redirect to main app
                if (!window.location.pathname.includes('crea_scheda.html') && 
                    !window.location.pathname.includes('lista_schede.html') &&
                    !window.location.pathname.includes('schede_condivise.html') &&
                    !window.location.pathname.includes('impostazioni.html')) {
                    console.log('User has username, redirecting to crea_scheda');
                    window.location.href = '../crea_scheda/crea_scheda.html';
                } else {
                    console.log('User has username but already on valid page, staying put');
                }
            } else {
                // User needs to complete registration (username)
                if (!window.location.pathname.includes('lista_schede.html')) {
                    console.log('User needs username, redirecting to lista_schede');
                    window.location.href = '../lista_schede/lista_schede.html';
                } else {
                    console.log('User needs username and is on lista_schede, username checker will handle it');
                }
            }
        } catch (error) {
            console.error('Error checking user document:', error);
            // If there's an error, still try to redirect to lista_schede
            if (!window.location.pathname.includes('lista_schede.html')) {
                console.log('Error occurred, redirecting to lista_schede as fallback');
                window.location.href = '../lista_schede/lista_schede.html';
            }
        }
    } else {
        console.log('User is signed out');
        // Only redirect to auth if not already on auth page
        if (!window.location.pathname.includes('auth.html')) {
            console.log('Redirecting to auth page');
            window.location.href = '../auth/auth.html';
        } else {
            console.log('Already on auth page, staying put');
        }
    }
});

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Handle redirect result on page load
    handleRedirectResult();
    
    // Load username checker if not on auth page
    if (!window.location.pathname.includes('auth.html')) {
        // Load username checker script
        const script = document.createElement('script');
        script.src = '../components/username_checker.js';
        script.onload = () => {
            console.log('Username checker loaded');
        };
        document.head.appendChild(script);
    }
    
    // Form submissions
    if (registrationForm) registrationForm.addEventListener('submit', handleRegistration);
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    if (forgotPasswordForm) forgotPasswordForm.addEventListener('submit', handleForgotPassword);
    
    // Form switching
    showLoginLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            showLogin();
        });
    });
    
    showRegisterLink.addEventListener('click', (e) => {
        e.preventDefault();
        showRegistration();
    });
    
    showLoginFromForgotLink.addEventListener('click', (e) => {
        e.preventDefault();
        showLogin();
    });
    
    forgotPasswordLink.addEventListener('click', (e) => {
        e.preventDefault();
        showForgotPassword();
    });
    
    // Google Sign-In buttons
    googleSignInButtons.forEach(button => {
        button.addEventListener('click', signInWithGoogle);
    });
    
    // Clear error messages on input
    [emailInput, passwordInput, confirmPasswordInput].forEach(input => {
        if (input) {
            input.addEventListener('input', () => {
                registrationError.textContent = '';
            });
        }
    });
    
    [loginEmailInput, loginPasswordInput].forEach(input => {
        if (input) {
            input.addEventListener('input', () => {
                loginError.textContent = '';
            });
        }
    });
    
    if (resetEmailInput) {
        resetEmailInput.addEventListener('input', () => {
            forgotPasswordError.textContent = '';
            forgotPasswordSuccess.textContent = '';
        });
    }
});

// Export functions for external use if needed
window.authFunctions = {
    showRegistration,
    showLogin,
    showForgotPassword,
    signInWithGoogle,
    validateEmail,
    validatePassword,
    createGoogleUserDocument,
    handleRedirectResult
};

// Make auth and db available globally for other components
window.auth = auth;
window.db = db;
