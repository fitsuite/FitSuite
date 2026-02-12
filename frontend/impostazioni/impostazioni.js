document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const deleteBtn = document.getElementById('delete-account-btn');
    const modal = document.getElementById('delete-confirm-modal');
    const cancelBtn = document.getElementById('cancel-delete');
    const confirmBtn = document.getElementById('confirm-delete');
    const errorMessageDiv = document.getElementById('settings-error-message');
    const successMessageDiv = document.getElementById('settings-success-message');

    // Mostra il modal
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            modal.style.display = 'block';
        });
    }

    // Chiudi il modal
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    // Azione di eliminazione
    if (confirmBtn) {
        confirmBtn.addEventListener('click', async () => {
            const user = auth.currentUser;
            if (user) {
                try {
                    await user.delete();
                    modal.style.display = 'none';
                    successMessageDiv.textContent = 'Account eliminato con successo. Verrai reindirizzato alla home.';
                    successMessageDiv.style.display = 'block';
                    setTimeout(() => {
                        window.location.href = '../../index.html';
                    }, 3000);
                } catch (error) {
                    console.error('Errore durante l\'eliminazione dell\'account:', error);
                    modal.style.display = 'none';
                    if (error.code === 'auth/requires-recent-login') {
                        errorMessageDiv.textContent = 'Per eliminare l\'account devi aver effettuato l\'accesso di recente. Esci e rientra, poi riprova.';
                    } else {
                        errorMessageDiv.textContent = 'Si è verificato un errore: ' + error.message;
                    }
                    errorMessageDiv.style.display = 'block';
                }
            } else {
                errorMessageDiv.textContent = 'Nessun utente collegato.';
                errorMessageDiv.style.display = 'block';
                modal.style.display = 'none';
            }
        });
    }

    // Chiudi modal cliccando fuori
    window.addEventListener('click', (event) => {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    });
});