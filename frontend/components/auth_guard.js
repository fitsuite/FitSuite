/**
 * AuthGuard.js
 * Protegge le pagine richiedendo il login, la verifica dell'email e l'username.
 */

(function() {
    'use strict';

    const AuthGuard = {
        /**
         * Verifica i requisiti di autenticazione dell'utente.
         * Ritorna true se tutti i requisiti sono soddisfatti.
         */
        verify: async function() {
            return new Promise((resolve) => {
                firebase.auth().onAuthStateChanged(async (user) => {
                    if (!user) {
                        console.log('AuthGuard - Nessun utente loggato, reindirizzamento...');
                        window.location.href = '../auth/auth.html';
                        resolve(false);
                        return;
                    }

                    // Verifica se l'email è verificata
                    if (!user.emailVerified) {
                        console.log('AuthGuard - Email non verificata, reindirizzamento...');
                        // Salviamo l'informazione che l'utente è loggato ma non verificato
                        sessionStorage.setItem('needsEmailVerification', 'true');
                        window.location.href = '../auth/auth.html';
                        resolve(false);
                        return;
                    }

                    // Verifica se l'utente ha un username (utilizzando UsernameChecker se disponibile)
                    if (window.UsernameChecker) {
                        const hasValidUsername = await window.UsernameChecker.enforceUsernameRequirement();
                        if (!hasValidUsername) {
                            console.log('AuthGuard - Username mancante o non valido');
                            resolve(false);
                            return;
                        }
                    }

                    console.log('AuthGuard - Tutti i controlli superati');
                    resolve(true);
                });
            });
        }
    };

    // Esponi globalmente
    window.AuthGuard = AuthGuard;
})();
