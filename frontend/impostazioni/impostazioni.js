document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.firestore();

    // DOM Elements - Sidebar
    const userInitialSidebar = document.getElementById('user-initial-sidebar');
    const userNameSidebar = document.getElementById('user-name-sidebar');
    const routineListSidebar = document.getElementById('routine-list-sidebar');

    // DOM Elements - Main Profile
    const userInitialMain = document.getElementById('user-initial-main');
    const userEmailMain = document.getElementById('user-email-main');
    const userPhone = document.getElementById('user-phone');

    // DOM Elements - Preferences
    const currentColorLabel = document.getElementById('current-color');
    const userLanguage = document.getElementById('user-language');
    const userNotifications = document.getElementById('user-notifications');
    const colorDots = document.querySelectorAll('.color-dot');

    // DOM Elements - Actions
    const changePasswordBtn = document.getElementById('change-password-btn');
    const changePhoneBtn = document.getElementById('change-phone-btn');
    const deleteAccountTrigger = document.getElementById('delete-account-trigger');
    const deleteModal = document.getElementById('delete-confirm-modal');
    const confirmDeleteBtn = document.getElementById('confirm-delete');
    const cancelDeleteBtn = document.getElementById('cancel-delete');

    // State
    let currentUser = null;

    // Check Auth State
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            console.log('User is signed in:', user.email);
            
            // Populate basic info from Auth
            userEmailMain.textContent = user.email;
            userNameSidebar.textContent = user.displayName || user.email.split('@')[0];
            const initial = (user.displayName || user.email).charAt(0).toUpperCase();
            userInitialSidebar.textContent = initial;
            userInitialMain.textContent = initial;

            // Fetch additional data from Firestore
            fetchUserData(user.uid);
            fetchUserRoutines(user.uid);
        } else {
            console.log('No user signed in, redirecting to login...');
            window.location.href = '../auth/auth.html';
        }
    });

    // Fetch User Data from Firestore
    async function fetchUserData(uid) {
        try {
            const doc = await db.collection('users').doc(uid).get();
            if (doc.exists) {
                const data = doc.data();
                
                // Update Phone
                userPhone.textContent = data.phoneNumber || "Non impostato";
                
                // Update Preferences
                if (data.preferences) {
                    currentColorLabel.textContent = data.preferences.color || "Arancione";
                    userLanguage.textContent = data.preferences.language || "Italiano";
                    userNotifications.textContent = data.preferences.notifications || "Consenti tutti";
                    
                    // Set active color dot
                    setActiveColorDot(data.preferences.color);
                }
            } else {
                console.log("No such document! Creating one...");
                // If doc doesn't exist for some reason, create it
                await db.collection('users').doc(uid).set({
                    email: auth.currentUser.email,
                    phoneNumber: "",
                    preferences: {
                        color: "Arancione",
                        language: "Italiano",
                        notifications: "Consenti tutti"
                    },
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        } catch (error) {
            console.error("Error fetching user data:", error);
        }
    }

    // Fetch User Routines (Placeholder logic for now)
    async function fetchUserRoutines(uid) {
        // This will be expanded later when the routines collection is ready
        // For now, we use the static list in HTML or clear it if needed
        console.log("Fetching routines for user:", uid);
    }

    // Set Active Color Dot
    function setActiveColorDot(colorName) {
        colorDots.forEach(dot => {
            dot.classList.remove('active');
            if (dot.classList.contains(colorName.toLowerCase())) {
                dot.classList.add('active');
            }
        });
    }

    // Change Password
    changePasswordBtn.addEventListener('click', async () => {
        const email = auth.currentUser.email;
        try {
            await auth.sendPasswordResetEmail(email);
            alert(`Email di reset password inviata a ${email}`);
        } catch (error) {
            alert("Errore nell'invio dell'email: " + error.message);
        }
    });

    // Change Phone (Simple Prompt for now)
    changePhoneBtn.addEventListener('click', async () => {
        const newPhone = prompt("Inserisci il nuovo numero di telefono:", userPhone.textContent);
        if (newPhone !== null) {
            try {
                await db.collection('users').doc(currentUser.uid).update({
                    phoneNumber: newPhone
                });
                userPhone.textContent = newPhone;
                alert("Numero di telefono aggiornato con successo!");
            } catch (error) {
                alert("Errore nell'aggiornamento: " + error.message);
            }
        }
    });

    // Color Dot Click
    colorDots.forEach(dot => {
        dot.addEventListener('click', async () => {
            const color = dot.classList.contains('orange') ? 'Arancione' :
                          dot.classList.contains('green') ? 'Verde' :
                          dot.classList.contains('blue') ? 'Blu' : 'Rosa';
            
            try {
                await db.collection('users').doc(currentUser.uid).update({
                    'preferences.color': color
                });
                currentColorLabel.textContent = color;
                setActiveColorDot(color);
            } catch (error) {
                console.error("Error updating color:", error);
            }
        });
    });

    // Delete Account Logic
    deleteAccountTrigger.addEventListener('click', () => {
        deleteModal.classList.add('active');
    });

    cancelDeleteBtn.addEventListener('click', () => {
        deleteModal.classList.remove('active');
    });

    confirmDeleteBtn.addEventListener('click', async () => {
        try {
            const user = auth.currentUser;
            const uid = user.uid;

            // 1. Delete Firestore Data
            await db.collection('users').doc(uid).delete();
            
            // Note: You might want to delete routines/subcollections here too
            
            // 2. Delete Auth Account
            await user.delete();
            
            console.log("Account deleted successfully");
            window.location.href = '../auth/auth.html';
        } catch (error) {
            if (error.code === 'auth/requires-recent-login') {
                alert("Per eliminare l'account è necessario aver effettuato l'accesso di recente. Effettua il logout e rientra prima di riprovare.");
                auth.signOut().then(() => window.location.href = '../auth/auth.html');
            } else {
                alert("Errore durante l'eliminazione: " + error.message);
            }
        }
    });

    // Support Actions
    const contactBtn = document.querySelector('.card-btn.primary');
    if (contactBtn) {
        contactBtn.addEventListener('click', () => {
            window.location.href = 'mailto:Fitsuite.company@gmail.com';
        });
    }

    // Close modal on click outside
    window.addEventListener('click', (event) => {
        if (event.target === deleteModal) {
            deleteModal.classList.remove('active');
        }
    });
});