document.addEventListener('DOMContentLoaded', () => {
    const resetPasswordForm = document.querySelector('.reset-password-form');
    const newPasswordInput = document.getElementById('new-password');
    const confirmNewPasswordInput = document.getElementById('confirm-new-password');
    const errorMessageDiv = document.getElementById('reset-password-error-message');
    const successMessageDiv = document.getElementById('reset-password-success-message');

    // Get the oobCode from the URL
    const urlParams = new URLSearchParams(window.location.search);
    const oobCode = urlParams.get('oobCode');

    if (!oobCode) {
        errorMessageDiv.textContent = 'Codice di reset password non trovato. Il link potrebbe essere scaduto o non valido.';
        return;
    }

    resetPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorMessageDiv.textContent = '';
        successMessageDiv.textContent = '';

        const newPassword = newPasswordInput.value;
        const confirmNewPassword = confirmNewPasswordInput.value;

        if (newPassword.length < 8 || newPassword.length > 16) {
            errorMessageDiv.textContent = 'La password deve essere lunga tra 8 e 16 caratteri.';
            return;
        }

        if (newPassword !== confirmNewPassword) {
            errorMessageDiv.textContent = 'Le password non corrispondono.';
            return;
        }

        try {
            const auth = firebase.auth();
            await auth.confirmPasswordReset(oobCode, newPassword);
            successMessageDiv.textContent = 'La tua password è stata reimpostata con successo. Ora puoi accedere con la nuova password.';
            resetPasswordForm.reset();
            // Optionally redirect to login page after a delay
            setTimeout(() => {
                window.location.href = '../auth/auth.html';
            }, 3000);
        } catch (error) {
            console.error('Error resetting password:', error);
            if (error.code === 'auth/expired-action-code') {
                errorMessageDiv.textContent = 'Il link per il reset della password è scaduto. Richiedi un nuovo reset.';
            } else if (error.code === 'auth/invalid-action-code') {
                errorMessageDiv.textContent = 'Il link per il reset della password non è valido.';
            } else if (error.code === 'auth/user-disabled') {
                errorMessageDiv.textContent = 'Questo account è stato disabilitato.';
            } else if (error.code === 'auth/user-not-found') {
                errorMessageDiv.textContent = 'Utente non trovato.';
            } else if (error.code === 'auth/weak-password') {
                errorMessageDiv.textContent = 'La password è troppo debole. Scegli una password più complessa.';
            } else {
                errorMessageDiv.textContent = `Errore durante il reset della password: ${error.message}`;
            }
        }
    });
});
