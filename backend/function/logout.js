// backend/function/logout.js
// Non è necessario importare getAuth e signOut separatamente per la versione compat

async function logout() {
    try {
        await firebase.auth().signOut(); // Usa la versione compat di signOut
        console.log("Utente disconnesso con successo.");
        // Reindirizza alla pagina di autenticazione dopo il logout
        window.location.href = '../../frontend/auth/auth.html';
    } catch (error) {
        console.error("Errore durante il logout:", error);
        alert("Errore durante il logout: " + error.message);
    }
}
