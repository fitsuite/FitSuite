document.addEventListener('DOMContentLoaded', async () => {
    const auth = firebase.auth();
    // Utilizziamo i manager globali già istanziati nei componenti
    const loading = window.LoadingManager;
    
    // Funzioni helper per i toast per mantenere coerenza con il resto dell'app
    const showError = (msg, title) => window.showErrorToast ? window.showErrorToast(msg, title) : alert(msg);
    const showSuccess = (msg, title) => window.showSuccessToast ? window.showSuccessToast(msg, title) : alert(msg);

    // DOM Elements
    const resetForm = document.getElementById('reset-password-form');
    const errorContainer = document.getElementById('error-container');
    const successContainer = document.getElementById('success-container');
    const userEmailDisplay = document.getElementById('user-email-display');
    const newPasswordInput = document.getElementById('new-password');
    const confirmPasswordInput = document.getElementById('confirm-password');
    const submitBtn = document.getElementById('submit-btn');
    const errorMessageEl = document.getElementById('error-message');

    // Password Toggle Buttons
    const toggleNewPasswordBtn = document.getElementById('toggle-new-password');
    const toggleConfirmPasswordBtn = document.getElementById('toggle-confirm-password');

    // Get action code from URL (oobCode)
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    const oobCode = urlParams.get('oobCode');

    // Password Visibility Toggles
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

    // Step 1: Verify the action code
    if (mode === 'resetPassword' && oobCode) {
        loading.show(['Verifica del link...', 'Recupero informazioni account...']);
        
        try {
            // Verify the password reset code and get user email
            const email = await auth.verifyPasswordResetCode(oobCode);
            userEmailDisplay.textContent = `Reimposta la password per: ${email}`;
            resetForm.style.display = 'block';
            loading.hide();
        } catch (error) {
            console.error('Errore durante la verifica del codice:', error);
            handleResetError(error);
            loading.hide();
        }
    } else {
        // No valid mode or oobCode in URL
        handleResetError({ code: 'auth/invalid-action-code' });
    }

    // Step 2: Handle form submission
    resetForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const newPassword = newPasswordInput.value;
        const confirmPassword = confirmPasswordInput.value;

        // Validation
        if (newPassword.length < 6) {
            showError('La password deve contenere almeno 6 caratteri.', 'Password troppo corta');
            return;
        }

        if (newPassword !== confirmPassword) {
            showError('Le password non corrispondono.', 'Errore coincidenza');
            return;
        }

        // Proceed with reset
        submitBtn.disabled = true;
        submitBtn.classList.add('loading');
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Aggiornamento...</span>';

        try {
            // Confirm the password reset
            await auth.confirmPasswordReset(oobCode, newPassword);
            
            // Success
            resetForm.style.display = 'none';
            successContainer.style.display = 'block';
            userEmailDisplay.style.display = 'none';
            showSuccess('La tua password è stata aggiornata con successo.', 'Password aggiornata');
            
        } catch (error) {
            console.error('Errore durante l\'aggiornamento della password:', error);
            showError(getErrorMessage(error), 'Errore aggiornamento');
            submitBtn.disabled = false;
            submitBtn.classList.remove('loading');
            submitBtn.innerHTML = '<span>Aggiorna Password</span><i class="fas fa-arrow-right"></i>';
        }
    });

    // Helper functions
    function handleResetError(error) {
        resetForm.style.display = 'none';
        errorContainer.style.display = 'block';
        userEmailDisplay.style.display = 'none';
        errorMessageEl.textContent = getErrorMessage(error);
    }

    function getErrorMessage(error) {
        switch (error.code) {
            case 'auth/expired-action-code':
                return 'Il link di reset della password è scaduto.';
            case 'auth/invalid-action-code':
                return 'Il link di reset della password non è valido o è già stato utilizzato.';
            case 'auth/user-disabled':
                return 'L\'account associato a questo link è stato disabilitato.';
            case 'auth/user-not-found':
                return 'Utente non trovato.';
            case 'auth/weak-password':
                return 'La nuova password è troppo debole.';
            default:
                return 'Si è verificato un errore imprevisto. Riprova più tardi.';
        }
    }
});
