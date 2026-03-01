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
            // Firebase config should be loaded from config.js
            const firebaseConfig = {
                apiKey: "AIzaSyBkK7C6X3E8l9M0n1O2p3Q4r5s6t7u8v9w",
                authDomain: "fitsuite-app.firebaseapp.com",
                projectId: "fitsuite-app",
                storageBucket: "fitsuite-app.appspot.com",
                messagingSenderId: "123456789012",
                appId: "1:123456789012:web:abcdef123456789012345678"
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
        return new Promise(async (resolve) => {
            const showPopup = async () => {
                console.log('UsernameChecker - Showing popup to user');
                
                // Add username-popup class to the popup content for special styling
                setTimeout(() => {
                    const popupContent = document.querySelector('.custom-popup-content');
                    if (popupContent) {
                        popupContent.classList.add('username-popup');
                        console.log('UsernameChecker - Added username-popup class');
                    }
                }, 10);

                const username = await window.showPrompt(
                    'Scegli un username obbligatorio (3-20 caratteri, solo lettere, numeri e _):',
                    '',
                    'Username Richiesto'
                );

                console.log('UsernameChecker - Popup result:', username);

                if (username === null) {
                    console.log('UsernameChecker - User cancelled popup');
                    resolve(null);
                    return;
                }

                const trimmedUsername = username.trim();
                console.log('UsernameChecker - Validating username:', trimmedUsername);

                // Validate username
                if (trimmedUsername.length < 3) {
                    console.log('UsernameChecker - Username too short');
                    await window.alert('L\'username deve contenere almeno 3 caratteri.', 'Errore Validazione');
                    showPopup();
                    return;
                }

                if (trimmedUsername.length > 20) {
                    console.log('UsernameChecker - Username too long');
                    await window.alert('L\'username non può superare i 20 caratteri.', 'Errore Validazione');
                    showPopup();
                    return;
                }

                if (!/^[a-zA-Z0-9_]+$/.test(trimmedUsername)) {
                    console.log('UsernameChecker - Username has invalid characters');
                    await window.alert('L\'username può contenere solo lettere, numeri e underscore.', 'Errore Validazione');
                    showPopup();
                    return;
                }

                // Show loading state
                console.log('UsernameChecker - Checking uniqueness...');
                if (window.showLoadingToast) {
                    window.showLoadingToast('Verifica disponibilità username...');
                }

                // Check if username is unique
                const isUnique = await isUsernameUnique(trimmedUsername);
                console.log('UsernameChecker - Username uniqueness result:', isUnique);
                
                // Hide loading state
                if (window.hideLoadingToast) {
                    window.hideLoadingToast();
                }

                if (!isUnique) {
                    console.log('UsernameChecker - Username not unique');
                    await window.alert('Questo username è già stato scelto da un altro utente. Scegline un altro.', 'Username Non Disponibile');
                    showPopup();
                    return;
                }

                console.log('UsernameChecker - Username validated and unique:', trimmedUsername);
                resolve(trimmedUsername);
            };

            showPopup();
        });
    }

    // Update user username in Firestore using simple update
    async function updateUserUsername(userId, username) {
        try {
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
                // User doesn't have username, show popup to choose one
                const username = await showUsernameSelectionPopup();
                console.log('UsernameChecker - Username selected:', username);
                
                if (username) {
                    console.log('UsernameChecker - Updating username in database');
                    // User chose a username, update it
                    const updated = await updateUserUsername(currentUser.uid, username);
                    console.log('UsernameChecker - Update result:', updated);
                    if (!updated) {
                        await window.alert('Errore nell\'aggiornamento dell\'username. Riprova più tardi.');
                        return false;
                    }
                    console.log('UsernameChecker - Username set successfully:', username);
                    return true;
                } else {
                    console.log('UsernameChecker - User cancelled username selection');
                    // User cancelled, sign them out
                    await auth.signOut();
                    await window.alert('L\'username è obbligatorio per utilizzare FitSuite.');
                    // Redirect to auth page
                    window.location.href = '../auth/auth.html';
                    return false;
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
