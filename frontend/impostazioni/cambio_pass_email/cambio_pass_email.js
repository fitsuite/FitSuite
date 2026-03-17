document.addEventListener('DOMContentLoaded', async () => {
    const auth = firebase.auth();
    const loading = window.LoadingManager;
    
    // Helper per i toast
    const showError = (msg, title) => window.showErrorToast ? window.showErrorToast(msg, title) : alert(msg);
    const showSuccess = (msg, title) => window.showSuccessToast ? window.showSuccessToast(msg, title) : alert(msg);

    // DOM Elements
    const pageTitle = document.getElementById('page-title');
    const userInfoDisplay = document.getElementById('user-info-display');
    const changePasswordForm = document.getElementById('change-password-form');
    const changeEmailForm = document.getElementById('change-email-form');
    const errorContainer = document.getElementById('error-container');
    const successContainer = document.getElementById('success-container');
    
    const passwordSubmitBtn = document.getElementById('password-submit-btn');
    const emailSubmitBtn = document.getElementById('email-submit-btn');
    
    const newPasswordInput = document.getElementById('new-password');
    const confirmPasswordInput = document.getElementById('confirm-password');
    const newEmailInput = document.getElementById('new-email');
    const confirmEmailInput = document.getElementById('confirm-email');

    // Password Visibility Toggles
    const toggleNewPasswordBtn = document.getElementById('toggle-new-password');
    const toggleConfirmPasswordBtn = document.getElementById('toggle-confirm-password');

    [toggleNewPasswordBtn, toggleConfirmPasswordBtn].forEach((btn, index) => {
        btn.addEventListener('click', () => {
            const input = index === 0 ? newPasswordInput : confirmPasswordInput;
            const icon = btn.querySelector('i');
            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.replace('fa-eye', 'fa-eye-slash');
            } else {
                input.type = 'password';
                icon.classList.replace('fa-eye-slash', 'fa-eye');
            }
        });
    });

    // Analisi URL
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    const oobCode = urlParams.get('oobCode');
    const action = urlParams.get('action'); // Per redirect manuali da impostazioni

    // Gestione dei vari stati
    try {
        if (mode === 'resetPassword' && oobCode) {
            setupPasswordReset(oobCode);
        } else if (mode === 'verifyAndChangeEmail' && oobCode) {
            setupEmailChangeVerification(oobCode);
        } else if (mode === 'verifyEmail' && oobCode) {
            setupEmailVerification(oobCode);
        } else if (mode === 'recoverEmail' && oobCode) {
            setupEmailRecovery(oobCode);
        } else if (action === 'changePassword') {
            setupManualPasswordChange();
        } else if (action === 'changeEmail') {
            setupManualEmailChange();
        } else if (mode || oobCode || action) {
            // Se c'è un parametro ma non corrisponde a nulla di noto
            handleError({ code: 'auth/invalid-action-code' }, 'Link non valido o scaduto');
            if (loading) loading.hide();
        } else {
            // Nessun parametro, probabilmente accesso diretto alla pagina
            userInfoDisplay.textContent = "Seleziona un'operazione dalle impostazioni.";
            if (loading) loading.hide();
        }
    } catch (err) {
        console.error("Errore generale nell'inizializzazione:", err);
        handleError(err, 'Errore di sistema');
        if (loading) loading.hide();
    }

    // --- LOGICA PASSWORD RESET (Link Firebase) ---
    async function setupPasswordReset(code) {
        pageTitle.textContent = "Reimposta Password";
        if (loading) loading.show(['Verifica del link...', 'Recupero informazioni account...']);
        
        try {
            const email = await auth.verifyPasswordResetCode(code);
            userInfoDisplay.textContent = `Stai reimpostando la password per: ${email}`;
            changePasswordForm.style.display = 'block';
            if (loading) loading.hide();
        } catch (error) {
            handleError(error, 'Errore di verifica');
            if (loading) loading.hide();
        }

        changePasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newPassword = newPasswordInput.value;
            const confirmPassword = confirmPasswordInput.value;

            if (newPassword !== confirmPassword) {
                showError('Le password non corrispondono.', 'Errore');
                return;
            }

            setLoading(passwordSubmitBtn, true);
            try {
                await auth.confirmPasswordReset(code, newPassword);
                showSuccessState("Password Aggiornata!", "La tua password è stata modificata con successo.");
            } catch (error) {
                showError(getErrorMessage(error), 'Errore aggiornamento');
                setLoading(passwordSubmitBtn, false);
            }
        });
    }

    // --- LOGICA VERIFICA CAMBIO EMAIL (Link Firebase) ---
    async function setupEmailChangeVerification(code) {
        pageTitle.textContent = "Verifica Cambio Email";
        if (loading) loading.show(['Verifica del link...', 'Aggiornamento email in corso...']);
        
        try {
            const info = await auth.checkActionCode(code);
            const newEmail = info.data.email;
            await auth.applyActionCode(code);
            
            // Se l'utente è loggato, aggiorniamo anche Firestore
            const user = auth.currentUser;
            if (user) {
                await firebase.firestore().collection('users').doc(user.uid).update({
                    email: newEmail,
                    is_verified: 1
                });
            }

            if (loading) loading.hide();
            showSuccessState("Email Verificata!", `La tua email è stata aggiornata con successo a: ${newEmail}`);
        } catch (error) {
            handleError(error, 'Errore di verifica');
            if (loading) loading.hide();
        }
    }

    // --- LOGICA VERIFICA EMAIL INIZIALE (Link Firebase) ---
    async function setupEmailVerification(code) {
        pageTitle.textContent = "Verifica Email";
        console.log("Inizio verifica email con codice:", code);
        
        if (loading) {
            loading.show(['Verifica del link...', 'Attivazione account in corso...']);
        } else {
            console.warn("LoadingManager non trovato, procedo senza feedback visivo");
        }
        
        try {
            console.log("Chiamata a auth.applyActionCode...");
            await auth.applyActionCode(code);
            console.log("auth.applyActionCode completata con successo");
            
            // Tentiamo di aggiornare Firestore se l'utente è loggato o se possiamo trovarlo
            // Nota: applyActionCode non logga l'utente, quindi currentUser potrebbe essere null
            // Ma se l'utente ha la scheda aperta nell'altro tab, Firestore verrà aggiornato da lì
            // Tuttavia, se è loggato in questo tab (es. sessione persistente), lo facciamo qui
            const user = auth.currentUser;
            if (user) {
                console.log("Utente loggato trovato, aggiorno Firestore...");
                await firebase.firestore().collection('users').doc(user.uid).update({
                    is_verified: 1
                });
                console.log("Firestore aggiornato con successo");
            } else {
                console.log("Nessun utente loggato in questo tab, Firestore verrà aggiornato al prossimo login o dal tab originale");
            }

            if (loading) loading.hide();
            showSuccessState("Email Verificata!", "Il tuo account è stato attivato con successo. Ora puoi accedere a tutte le funzionalità.");
            
            // Reindirizzamento automatico dopo 3 secondi alla dashboard
            setTimeout(() => {
                console.log("Reindirizzamento alla dashboard...");
                window.location.href = '../../lista_schede/lista_scheda.html';
            }, 3000);
        } catch (error) {
            console.error("Errore durante applyActionCode:", error);
            handleError(error, 'Errore di verifica');
            if (loading) loading.hide();
        }
    }

    // --- LOGICA RECUPERO EMAIL (Link Firebase) ---
    async function setupEmailRecovery(code) {
        pageTitle.textContent = "Recupero Email";
        loading.show(['Verifica del link...', 'Ripristino vecchia email...']);
        
        try {
            await auth.checkActionCode(code);
            await auth.applyActionCode(code);
            loading.hide();
            showSuccessState("Email Ripristinata!", "La tua vecchia email è stata ripristinata con successo.");
        } catch (error) {
            handleError(error, 'Errore di recupero');
            loading.hide();
        }
    }

    // --- LOGICA MANUALE (Redirect da Impostazioni) ---
    function setupManualPasswordChange() {
        pageTitle.textContent = "Cambia Password";
        userInfoDisplay.textContent = "Inserisci la tua nuova password.";
        changePasswordForm.style.display = 'block';

        changePasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const user = auth.currentUser;
            if (!user) {
                showError("Devi essere autenticato per cambiare la password.", "Errore");
                return;
            }

            const newPassword = newPasswordInput.value;
            const confirmPassword = confirmPasswordInput.value;

            if (newPassword !== confirmPassword) {
                showError('Le password non corrispondono.', 'Errore');
                return;
            }

            setLoading(passwordSubmitBtn, true);
            try {
                await user.updatePassword(newPassword);
                showSuccessState("Password Cambiata!", "La tua password è stata aggiornata con successo.");
            } catch (error) {
                if (error.code === 'auth/requires-recent-login') {
                    showError("Per sicurezza, devi rieffettuare l'accesso per cambiare la password.", "Riautenticazione richiesta");
                } else {
                    showError(getErrorMessage(error), 'Errore');
                }
                setLoading(passwordSubmitBtn, false);
            }
        });
    }

    function setupManualEmailChange() {
        pageTitle.textContent = "Cambia Email";
        userInfoDisplay.textContent = "Inserisci il tuo nuovo indirizzo email.";
        changeEmailForm.style.display = 'block';

        changeEmailForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const user = auth.currentUser;
            if (!user) {
                showError("Devi essere autenticato per cambiare l'email.", "Errore");
                return;
            }

            const newEmail = newEmailInput.value;
            const confirmEmail = confirmEmailInput.value;

            if (newEmail !== confirmEmail) {
                showError('Gli indirizzi email non corrispondono.', 'Errore');
                return;
            }

            setLoading(emailSubmitBtn, true);
            try {
                // Utilizziamo verifyBeforeUpdateEmail che è più sicuro e gestisce il link di verifica
                await user.verifyBeforeUpdateEmail(newEmail);
                showSuccessState("Verifica Inviata!", `Abbiamo inviato un link di verifica a ${newEmail}. L'email verrà aggiornata dopo la conferma.`);
            } catch (error) {
                if (error.code === 'auth/requires-recent-login') {
                    showError("Per sicurezza, devi rieffettuare l'accesso per cambiare l'email.", "Riautenticazione richiesta");
                } else {
                    showError(getErrorMessage(error), 'Errore');
                }
                setLoading(emailSubmitBtn, false);
            }
        });
    }

    // --- HELPERS ---
    function setLoading(btn, isLoading) {
        if (isLoading) {
            btn.disabled = true;
            btn.classList.add('loading');
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Elaborazione...</span>';
        } else {
            btn.disabled = false;
            btn.classList.remove('loading');
            const isPassword = btn.id === 'password-submit-btn';
            btn.innerHTML = `<span>Aggiorna ${isPassword ? 'Password' : 'Email'}</span><i class="fas fa-arrow-right"></i>`;
        }
    }

    function showSuccessState(title, message) {
        changePasswordForm.style.display = 'none';
        changeEmailForm.style.display = 'none';
        userInfoDisplay.style.display = 'none';
        successContainer.style.display = 'block';
        document.getElementById('success-title').textContent = title;
        document.getElementById('success-message').textContent = message;
    }

    function handleError(error, title) {
        changePasswordForm.style.display = 'none';
        changeEmailForm.style.display = 'none';
        userInfoDisplay.style.display = 'none';
        errorContainer.style.display = 'block';
        document.getElementById('error-title').textContent = title || "Errore";
        document.getElementById('error-message').textContent = getErrorMessage(error);
    }

    function getErrorMessage(error) {
        switch (error.code) {
            case 'auth/expired-action-code': return 'Il link è scaduto.';
            case 'auth/invalid-action-code': return 'Il link non è valido o è già stato utilizzato.';
            case 'auth/user-disabled': return 'L\'account è stato disabilitato.';
            case 'auth/user-not-found': return 'Utente non trovato.';
            case 'auth/weak-password': return 'La nuova password è troppo debole.';
            case 'auth/email-already-in-use': return 'Questo indirizzo email è già associato a un altro account.';
            case 'auth/invalid-email': return 'Indirizzo email non valido.';
            case 'auth/requires-recent-login': return 'Per sicurezza, devi rieffettuare l\'accesso prima di procedere.';
            default: return 'Si è verificato un errore imprevisto: ' + error.message;
        }
    }
});