/**
 * Username Checker Module
 * Verifica che tutti gli utenti abbiano un username obbligatorio
 * Se manca, mostra popup per sceglierne uno
 */

(function() {
    'use strict';

    // Initialize Firebase if not already initialized
    function initFirebase() {
        if (typeof firebase !== 'undefined' && !firebase.apps.length) {
            // Firebase config should match auth.html
            const firebaseConfig = {
                apiKey: "AIzaSyCEgbB9rBBKOov3aDma0DMn-EuU0bGMMYo",
                authDomain: "fitsuite-a7b6c.firebaseapp.com",
                projectId: "fitsuite-a7b6c",
                storageBucket: "fitsuite-a7b6c.firebasestorage.app",
                messagingSenderId: "721614273457",
                appId: "1:721614273457:web:195f48279fafd01a1f5b90",
                measurementId: "G-W4ME455MH5"
            };
            firebase.initializeApp(firebaseConfig);
        }
    }

    // Check if user has username
    async function checkUserHasUsername(userId) {
        try {
            const db = firebase.firestore();
            const userDoc = await db.collection('users').doc(userId).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                return userData.username && userData.username.trim() !== '';
            }
            return false;
        } catch (error) {
            console.error('Error checking user username:', error);
            return false;
        }
    }

    // Check if username is unique using only users collection
    async function isUsernameUnique(username) {
        try {
            console.log('UsernameChecker - Checking username uniqueness for:', username);
            
            const db = firebase.firestore();
            
            // Query only the users collection since we have permissions for it
            const usersSnapshot = await db.collection('users')
                .where('username', '==', username)
                .limit(1)
                .get();
            
            if (usersSnapshot.empty) {
                console.log('UsernameChecker - Username is available (verified via users collection)');
                return true;
            } else {
                console.log('UsernameChecker - Username already exists in users collection');
                return false;
            }
            
        } catch (error) {
            console.error('UsernameChecker - Error checking username uniqueness:', error);
            // Safer to assume not unique on error
            return false;
        }
    }

    // Show username selection popup
    async function showUsernameSelectionPopup() {
        console.log('UsernameChecker - Starting showUsernameSelectionPopup');
        
        const validateUsername = async (value) => {
            // Non usiamo trim() qui perché vogliamo che lo spazio sia rilevato come errore
            if (!value || value.length === 0) return 'ERRORE: Inserisci un username.';
            if (value.length < 3) return 'ERRORE: Troppo corto (min 3 caratteri).';
            if (value.length > 20) return 'ERRORE: Troppo lungo (max 20 caratteri).';
            
            // Regex aggiornata: solo lettere, numeri, . e _ (NIENTE SPAZI)
            const validRegex = /^[a-zA-Z0-9._]+$/;
            if (!validRegex.test(value)) {
                return 'ERRORE: Caratteri non ammessi (usa solo lettere, numeri, . e _). Niente spazi.';
            }
            
            // Se arriviamo qui, l'input è formalmente corretto, controlliamo l'unicità
            if (window.showLoadingToast) window.showLoadingToast('Verifica disponibilità...');
            const isUnique = await isUsernameUnique(value);
            if (window.hideLoadingToast) window.hideLoadingToast();
            
            if (!isUnique) return 'ERRORE: Questo username è già occupato.';
            return null; // Valido!
        };

        const username = await window.showPrompt(
            'L\'username è obbligatorio per continuare.\nScegline uno (3-20 caratteri):',
            '',
            'Username Richiesto',
            'SALVA',
            '', // Rimuoviamo il testo del pulsante annulla per nasconderlo
            validateUsername,
            20
        );

        if (username === null) {
            console.log('UsernameChecker - User cancelled popup, reopening...');
            return await showUsernameSelectionPopup();
        }

        return username; // Restituiamo il valore così come inserito
    }

    // Update user username in Firestore using simple update
    async function updateUserUsername(userId, username) {
        try {
            // Validazione di sicurezza dell'ultimo secondo prima della scrittura
            const validRegex = /^[a-zA-Z0-9._]+$/;
            if (!username || username.length < 3 || username.length > 20 || !validRegex.test(username)) {
                console.error('UsernameChecker - Tentativo di salvataggio username non valido:', username);
                return false;
            }

            const db = firebase.firestore();
            
            // Show loading state
            if (window.showLoadingToast) {
                window.showLoadingToast('Salvataggio username...');
            }
            
            // Simple update to users collection only
            await db.collection('users').doc(userId).update({
                username: username
            });
            
            // Update local cache after successful update
            try {
                // Update CacheManager if available
                if (window.CacheManager) {
                    const cachedProfile = localStorage.getItem(`userProfile_${userId}`);
                    if (cachedProfile) {
                        const profile = JSON.parse(cachedProfile);
                        profile.username = username;
                        localStorage.setItem(`userProfile_${userId}`, JSON.stringify(profile));
                    }
                }
                
                // Update sidebar if loaded
                const sidebarUsername = document.querySelector('#sidebar-username');
                if (sidebarUsername) {
                    sidebarUsername.textContent = `@${username}`;
                }
                
                // Update any username elements in the current page
                const usernameElements = document.querySelectorAll('[data-username]');
                usernameElements.forEach(element => {
                    element.textContent = `@${username}`;
                });
                
                // Dispatch custom event to notify other components
                window.dispatchEvent(new CustomEvent('usernameUpdated', { 
                    detail: { userId, username } 
                }));
                
            } catch (cacheError) {
                console.warn('Error updating local cache:', cacheError);
            }
            
            // Hide loading state
            if (window.hideLoadingToast) {
                window.hideLoadingToast();
            }
            
            // Show success message
            if (window.showSuccessToast) {
                window.showSuccessToast(`Username @${username} salvato con successo!`);
            }
            
            console.log('Username updated successfully');
            return true;
            
        } catch (error) {
            console.error('Error updating username:', error);
            
            // Hide loading state
            if (window.hideLoadingToast) {
                window.hideLoadingToast();
            }
            
            // Handle specific errors
            if (error.message && error.message.includes('permission-denied')) {
                if (window.showErrorToast) {
                    window.showErrorToast('Permessi insufficienti per salvare l\'username. Contatta l\'amministratore.');
                }
            } else {
                if (window.showErrorToast) {
                    window.showErrorToast('Errore nel salvataggio dell\'username. Riprova.');
                }
            }
            
            return false;
        }
    }

    // Main function to enforce username requirement
    async function enforceUsernameRequirement() {
        try {
            console.log('UsernameChecker - Starting enforceUsernameRequirement');
            
            // Check if Firebase is initialized
            if (typeof firebase === 'undefined') {
                console.error('Firebase not loaded. Cannot enforce username requirement.');
                return false;
            }

            const auth = firebase.auth();
            const currentUser = auth.currentUser;

            if (!currentUser) {
                console.log('UsernameChecker - No user logged in, no need to check username');
                return true;
            }

            console.log('UsernameChecker - Checking user:', currentUser.uid);

            // Check if user has username
            const hasUsername = await checkUserHasUsername(currentUser.uid);
            console.log('UsernameChecker - User has username:', hasUsername);
            
            if (!hasUsername) {
                console.log('UsernameChecker - User needs username, showing popup');
                // User doesn't have username, show popup to choose one (this will loop until success)
                const username = await showUsernameSelectionPopup();
                console.log('UsernameChecker - Username selected:', username);
                
                if (username) {
                    console.log('UsernameChecker - Updating username in database');
                    // User chose a username, update it
                    const updated = await updateUserUsername(currentUser.uid, username);
                    console.log('UsernameChecker - Update result:', updated);
                    if (!updated) {
                        // Se fallisce l'aggiornamento (es. errore di rete), riproviamo il giro
                        return await enforceUsernameRequirement();
                    }
                    console.log('UsernameChecker - Username set successfully:', username);
                    return true;
                }
            }

            console.log('UsernameChecker - User already has username, all good');
            return true;
        } catch (error) {
            console.error('UsernameChecker - Error enforcing username requirement:', error);
            return false;
        }
    }

    // Auto-enforce when page loads
    document.addEventListener('DOMContentLoaded', async () => {
        // Wait a bit for Firebase to initialize
        setTimeout(async () => {
            // Enforce username requirement
            await enforceUsernameRequirement();
        }, 1000);
    });

    // Test function for debugging - saves a test username directly
    window.testUsernameSave = async function() {
        try {
            console.log('UsernameChecker - Testing direct username save');
            const auth = firebase.auth();
            const currentUser = auth.currentUser;
            
            if (!currentUser) {
                console.error('No user logged in for test');
                return false;
            }
            
            const testUsername = `testuser_${Date.now()}`;
            console.log('UsernameChecker - Attempting to save test username:', testUsername);
            
            const result = await updateUserUsername(currentUser.uid, testUsername);
            console.log('UsernameChecker - Test save result:', result);
            
            return result;
        } catch (error) {
            console.error('UsernameChecker - Test save error:', error);
            return false;
        }
    };

    // Expose functions globally
    window.UsernameChecker = {
        enforceUsernameRequirement,
        checkUserHasUsername,
        showUsernameSelectionPopup,
        updateUserUsername,
        isUsernameUnique
    };

})();
