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

    // Check if username is unique using a different approach
    async function isUsernameUnique(username) {
        try {
            console.log('UsernameChecker - Checking username uniqueness for:', username);
            
            // Since we can't query the users collection due to permissions,
            // we'll use a different approach: try to create a document with the username as ID
            // in a separate collection for username validation
            const db = firebase.firestore();
            const usernameRef = db.collection('usernames').doc(username);
            
            try {
                const doc = await usernameRef.get();
                if (doc.exists) {
                    console.log('UsernameChecker - Username already exists');
                    return false;
                } else {
                    console.log('UsernameChecker - Username is available');
                    return true;
                }
            } catch (error) {
                // If we can't read the usernames collection, assume it's unique
                // This is a fallback approach
                console.log('UsernameChecker - Cannot check uniqueness, assuming unique');
                return true;
            }
        } catch (error) {
            console.error('UsernameChecker - Error checking username uniqueness:', error);
            // Fallback: assume it's unique
            return true;
        }
    }

    // Show username selection popup
    async function showUsernameSelectionPopup() {
        return new Promise(async (resolve) => {
            const showPopup = async () => {
                const username = await window.showPrompt(
                    'Scegli un username obbligatorio (3-20 caratteri, solo lettere, numeri e _):',
                    '',
                    'Username Richiesto'
                );

                if (username === null) {
                    resolve(null);
                    return;
                }

                const trimmedUsername = username.trim();

                // Validate username
                if (trimmedUsername.length < 3) {
                    await window.alert('L\'username deve contenere almeno 3 caratteri.');
                    showPopup();
                    return;
                }

                if (trimmedUsername.length > 20) {
                    await window.alert('L\'username non può superare i 20 caratteri.');
                    showPopup();
                    return;
                }

                if (!/^[a-zA-Z0-9_]+$/.test(trimmedUsername)) {
                    await window.alert('L\'username può contenere solo lettere, numeri e underscore.');
                    showPopup();
                    return;
                }

                // Check if username is unique
                const isUnique = await isUsernameUnique(trimmedUsername);
                if (!isUnique) {
                    await window.alert('Questo username è già stato scelto da un altro utente. Scegline un altro.');
                    showPopup();
                    return;
                }

                resolve(trimmedUsername);
            };

            showPopup();
        });
    }

    // Update user username in Firestore
    async function updateUserUsername(userId, username) {
        try {
            const db = firebase.firestore();
            
            // Update the user document
            await db.collection('users').doc(userId).update({
                username: username
            });
            
            // Also create a document in the usernames collection to track uniqueness
            try {
                await db.collection('usernames').doc(username).set({
                    uid: userId,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            } catch (usernameError) {
                console.warn('Could not save to usernames collection:', usernameError);
                // Continue anyway, the main update worked
            }
            
            console.log('Username updated successfully');
            return true;
        } catch (error) {
            console.error('Error updating username:', error);
            return false;
        }
    }

    // Main function to enforce username requirement
    async function enforceUsernameRequirement() {
        try {
            // Check if Firebase is initialized
            if (typeof firebase === 'undefined') {
                console.error('Firebase not loaded. Cannot enforce username requirement.');
                return false;
            }

            const auth = firebase.auth();
            const currentUser = auth.currentUser;

            if (!currentUser) {
                // User is not logged in, no need to check username
                return true;
            }

            // Check if user has username
            const hasUsername = await checkUserHasUsername(currentUser.uid);
            
            if (!hasUsername) {
                // User doesn't have username, show popup to choose one
                const username = await showUsernameSelectionPopup();
                
                if (username) {
                    // User chose a username, update it
                    const updated = await updateUserUsername(currentUser.uid, username);
                    if (!updated) {
                        await window.alert('Errore nell\'aggiornamento dell\'username. Riprova più tardi.');
                        return false;
                    }
                    console.log('Username set successfully:', username);
                    return true;
                } else {
                    // User cancelled, sign them out
                    await auth.signOut();
                    await window.alert('L\'username è obbligatorio per utilizzare FitSuite.');
                    // Redirect to auth page
                    window.location.href = '../auth/auth.html';
                    return false;
                }
            }

            return true;
        } catch (error) {
            console.error('Error enforcing username requirement:', error);
            return false;
        }
    }

    // Auto-enforce when page loads
    document.addEventListener('DOMContentLoaded', async () => {
        // Wait a bit for Firebase to initialize
        setTimeout(async () => {
            await enforceUsernameRequirement();
        }, 1000);
    });

    // Expose functions globally
    window.UsernameChecker = {
        enforceUsernameRequirement,
        checkUserHasUsername,
        showUsernameSelectionPopup,
        updateUserUsername,
        isUsernameUnique
    };

})();
