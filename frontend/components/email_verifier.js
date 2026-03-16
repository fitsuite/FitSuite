/**
 * Email Verifier Module
 * Verifica che gli utenti abbiano l'email verificata.
 * Se non verificata, mostra un popup per richiedere la verifica.
 */

(function() {
    'use strict';

    // Check if user has verified email in Firestore
    async function checkEmailVerifiedInDb(userId) {
        try {
            const db = firebase.firestore();
            const userDoc = await db.collection('users').doc(userId).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                // Treat missing field or 0 as unverified
                return userData.is_verified === 1;
            }
            return false;
        } catch (error) {
            console.error('EmailVerifier - Error checking email verification in DB:', error);
            return false;
        }
    }

    // Update email verification status in Firestore
    async function updateEmailVerifiedInDb(userId) {
        try {
            const db = firebase.firestore();
            await db.collection('users').doc(userId).update({
                is_verified: 1
            });
            console.log('EmailVerifier - Email verification status updated in DB');
            return true;
        } catch (error) {
            console.error('EmailVerifier - Error updating email verification status in DB:', error);
            return false;
        }
    }

    // Show email verification popup
    async function showEmailVerificationPopup() {
        console.log('EmailVerifier - Showing verification popup');
        const auth = firebase.auth();
        const user = auth.currentUser;

        if (!user) return;

        return new Promise(async (resolve) => {
            const showPopup = async () => {
                const message = `La tua email (${user.email}) non è ancora stata verificata. <br><br>1. Controlla la tua casella di posta (anche nello spam).<br>2. Clicca sul link di verifica.<br>3. Una volta verificata, clicca su "HO VERIFICATO".<br><br>Se non hai ricevuto l'email, clicca su "REINVIA".`;
                
                // We'll use a custom approach since showConfirm only has two buttons
                // But we can use window.alert for simplicity or a custom modal
                // Let's use window.showConfirm but change the button text temporarily if possible
                // Or just use it as: OK = Ho verificato, Cancel = Logout/Reinvia? 
                // Better: OK = Ho verificato, Cancel = Reinvia/Logout
                
                const okBtn = document.getElementById('customPopupOk');
                const cancelBtn = document.getElementById('customPopupCancel');
                
                const originalOkText = okBtn.textContent;
                const originalCancelText = cancelBtn.textContent;
                
                okBtn.textContent = 'HO VERIFICATO';
                cancelBtn.textContent = 'REINVIA EMAIL';
                cancelBtn.style.display = 'inline-block';

                const result = await window.showConfirm(
                    message,
                    'Verifica Email Richiesta'
                );

                // Restore original button texts
                okBtn.textContent = originalOkText;
                cancelBtn.textContent = originalCancelText;

                if (result) {
                    // User clicked "HO VERIFICATO"
                    if (window.showLoadingToast) window.showLoadingToast('Verifica in corso...');
                    
                    await user.reload();
                    const isVerifiedNow = firebase.auth().currentUser.emailVerified;
                    
                    if (window.hideLoadingToast) window.hideLoadingToast();

                    if (isVerifiedNow) {
                        await updateEmailVerifiedInDb(user.uid);
                        if (window.showSuccessToast) window.showSuccessToast('Email verificata con successo!');
                        resolve(true);
                    } else {
                        if (window.showErrorToast) window.showErrorToast('L\'email non risulta ancora verificata. Controlla la tua posta.');
                        showPopup(); // Show again
                    }
                } else {
                    // User clicked "REINVIA EMAIL"
                    try {
                        if (window.showLoadingToast) window.showLoadingToast('Invio email...');
                        await user.sendEmailVerification();
                        if (window.hideLoadingToast) window.hideLoadingToast();
                        if (window.showSuccessToast) window.showSuccessToast('Email di verifica reinviata!');
                    } catch (error) {
                        if (window.hideLoadingToast) window.hideLoadingToast();
                        console.error('EmailVerifier - Error resending email:', error);
                        if (window.showErrorToast) window.showErrorToast('Errore nel reinvio. Riprova più tardi.');
                    }
                    showPopup(); // Show again
                }
            };

            showPopup();
        });
    }

    // Main function to enforce email verification
    async function enforceEmailVerification() {
        try {
            console.log('EmailVerifier - Starting enforcement');
            if (typeof firebase === 'undefined') return false;

            const auth = firebase.auth();
            
            // Wait for auth to initialize if needed
            if (!auth.currentUser) {
                await new Promise(resolve => {
                    const unsubscribe = auth.onAuthStateChanged(user => {
                        unsubscribe();
                        resolve(user);
                    });
                });
            }

            const user = auth.currentUser;
            if (!user) {
                console.log('EmailVerifier - No user logged in');
                return true;
            }

            // 1. Check DB status FIRST (allows manual override)
            const isDbVerified = await checkEmailVerifiedInDb(user.uid);
            if (isDbVerified) {
                console.log('EmailVerifier - User is already verified in DB (manual override or synced)');
                return true;
            }

            // 2. Not verified in DB, show popup. 
            // The DB will ONLY be updated when the user clicks "HO VERIFICATO" in the popup.
            return await showEmailVerificationPopup();
        } catch (error) {
            console.error('EmailVerifier - Error enforcing email verification:', error);
            return false;
        }
    }

    // Expose functions globally
    window.EmailVerifier = {
        enforceEmailVerification,
        checkEmailVerifiedInDb,
        updateEmailVerifiedInDb
    };

    // Auto-enforce when page loads
    document.addEventListener('DOMContentLoaded', async () => {
        // Wait for Firebase and other components
        setTimeout(async () => {
            await enforceEmailVerification();
        }, 1200); // Slightly after username checker
    });

})();
