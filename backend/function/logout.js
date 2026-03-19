// backend/function/logout.js
// Non è necessario importare getAuth e signOut separatamente per la versione compat

async function logout() {
    try {
        await firebase.auth().signOut(); // Usa la versione compat di signOut
        console.log("Utente disconnesso con successo.");
        
        // Pulisce tutta la cache tramite CacheManager
        if (window.CacheManager && typeof window.CacheManager.clearAllCache === 'function') {
            window.CacheManager.clearAllCache();
        } else {
            // Fallback: pulisce almeno le chiavi fondamentali se CacheManager non è caricato
            console.warn("CacheManager non trovato, eseguo pulizia manuale parziale");
            localStorage.removeItem('lastUserId');
            localStorage.removeItem('fitsuite_sessionId');
            
            // Pulisce anche altre chiavi di cache note
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && (key.startsWith('userPreferences_') || key.startsWith('cachedRoutines_') || key.startsWith('routines_'))) {
                    localStorage.removeItem(key);
                    i--;
                }
            }
        }

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
