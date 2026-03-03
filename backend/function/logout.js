// backend/function/logout.js
// Non è necessario importare getAuth e signOut separatamente per la versione compat

async function logout() {
    try {
        await firebase.auth().signOut(); // Usa la versione compat di signOut
        console.log("Utente disconnesso con successo.");
        
        // Remove lastUserId to prevent optimistic loading for next user
        localStorage.removeItem('lastUserId');

        // Reindirizza alla pagina di autenticazione dopo il logout
        window.location.href = '../../frontend/auth/auth.html';
    } catch (error) {
        console.error("Errore durante il logout:", error);
        if (window.showErrorToast) {
            window.showErrorToast("Errore durante il logout: " + error.message);
        } else {
            // Fallback a console se toast non disponibile
            console.error("Logout error:", error.message);
        }
    }
}
