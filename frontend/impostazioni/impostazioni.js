document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.firestore();

    // Color Map for dynamic styling
    const colorMap = {
        'Arancione': '#ff6600',
        'Verde': '#4ade80',
        'Blu': '#3b82f6',
        'Rosa': '#f472b6'
    };

    // Set initial primary color based on user preferences
    function setPrimaryColor(colorName) {
        const hex = colorMap[colorName] || colorMap['Arancione']; // Default to orange
        document.documentElement.style.setProperty('--primary-color', hex);
    }

    // DOM Elements - Sidebar
    const userInitialSidebar = document.getElementById('user-initial-sidebar');
    const userNameSidebar = document.getElementById('user-name-sidebar');
    const routineListSidebar = document.getElementById('routine-list-sidebar');

    // DOM Elements - Main Profile
    const userInitialMain = document.getElementById('user-initial-main');
    const userEmailMain = document.getElementById('user-email-main');
    const userPhone = document.getElementById('user-phone');

    // DOM Elements - Subscription
    const subscriptionExpiry = document.getElementById('subscription-expiry');
    const paymentMethod = document.getElementById('payment-method');

    // DOM Elements - Preferences
    const currentColorLabel = document.getElementById('current-color');
    const userLanguage = document.getElementById('user-language');
    const languageFlagIcon = document.getElementById('language-flag-icon');
    const userNotifications = document.getElementById('user-notifications');
    const colorDots = document.querySelectorAll('.color-dot');

    // DOM Elements - Actions
    const changePasswordBtn = document.getElementById('change-password-btn');
    const changePhoneBtn = document.getElementById('change-phone-btn');
    const deleteModal = document.getElementById('delete-confirm-modal');
    const confirmDeleteBtn = document.getElementById('confirm-delete');
    const cancelDeleteBtn = document.getElementById('cancel-delete');

    // DOM Elements - New Modals and Buttons
    const changeLanguageBtn = document.getElementById('change-language-btn');
    const changeNotificationsBtn = document.getElementById('change-notifications-btn');
    const contactUsBtn = document.getElementById('contact-us-btn');
    const giveFeedbackBtn = document.getElementById('give-feedback-btn');
    const viewBillingHistoryBtn = document.getElementById('view-billing-history-btn');

    const changePasswordModal = document.getElementById('change-password-modal');
    const cancelPasswordChangeBtn = document.getElementById('cancel-password-change');
    const sendPasswordResetEmailBtn = document.getElementById('send-password-reset-email');

    const changePhoneModal = document.getElementById('change-phone-modal');
    const newPhoneInput = document.getElementById('new-phone-input');
    const cancelPhoneChangeBtn = document.getElementById('cancel-phone-change');
    const confirmPhoneChangeBtn = document.getElementById('confirm-phone-change');

    const changeLanguageModal = document.getElementById('change-language-modal');
    const languageOptions = document.querySelectorAll('.lang-option');
    const cancelLanguageChangeBtn = document.getElementById('cancel-language-change');

    const changeNotificationsModal = document.getElementById('change-notifications-modal');
    const notificationOptions = document.querySelectorAll('input[name="notifications"]');
    const cancelNotificationsChangeBtn = document.getElementById('cancel-notifications-change');
    const confirmNotificationsChangeBtn = document.getElementById('confirm-notifications-change');

    const contactUsModal = document.getElementById('contact-us-modal');
    const closeContactModalBtn = document.getElementById('close-contact-modal');

    const giveFeedbackModal = document.getElementById('give-feedback-modal');
    const feedbackTextarea = document.getElementById('feedback-text');
    const cancelFeedbackBtn = document.getElementById('cancel-feedback');
    const submitFeedbackBtn = document.getElementById('submit-feedback');

    const billingHistoryModal = document.getElementById('billing-history-modal');
    const closeBillingHistoryModalBtn = document.getElementById('close-billing-history-modal');

    // DOM Elements - Subscription
    const editSubscriptionExpiryBtn = document.getElementById('edit-subscription-expiry');
    const editPaymentMethodBtn = document.getElementById('edit-payment-method');
    const cancelSubscriptionBtn = document.getElementById('cancel-subscription-btn');
    const subscriptionEditModal = document.getElementById('subscription-edit-modal');
    const cancelSubscriptionEditBtn = document.getElementById('cancel-subscription-edit');
    const saveSubscriptionChangesBtn = document.getElementById('save-subscription-changes');
    const subscriptionTypeInput = document.getElementById('subscription-type');
    const subscriptionStartDateInput = document.getElementById('subscription-start-date');
    const subscriptionEndDateInput = document.getElementById('subscription-end-date');
    const paymentMethodInput = document.getElementById('payment-method-input');
    const autoRenewInput = document.getElementById('auto-renew-input');
    const lastPaymentDateInput = document.getElementById('last-payment-date-input');
    const nextPaymentDateInput = document.getElementById('next-payment-date-input');

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

                // Update Subscription Info
                if (data.subscription) {
                    subscriptionExpiry.textContent = data.subscription.endDate ? new Date(data.subscription.endDate.toDate()).toLocaleDateString() : "Nessun abbonamento attivo";
                    paymentMethod.textContent = data.subscription.paymentMethod || "Non impostato";
                    // Initialize new subscription fields
                    autoRenewInput.checked = data.subscription.autoRenew || false;
                    lastPaymentDateInput.value = data.subscription.lastPaymentDate ? new Date(data.subscription.lastPaymentDate.toDate()).toISOString().split('T')[0] : '';
                    nextPaymentDateInput.value = data.subscription.nextPaymentDate ? new Date(data.subscription.nextPaymentDate.toDate()).toISOString().split('T')[0] : '';
                } else {
                    subscriptionExpiry.textContent = "Nessun abbonamento attivo";
                    paymentMethod.textContent = "Non impostato";
                    // Reset new subscription fields
                    autoRenewInput.checked = false;
                    lastPaymentDateInput.value = '';
                    nextPaymentDateInput.value = '';
                }
                
                // Update Preferences
                if (data.preferences) {
                    currentColorLabel.textContent = data.preferences.color || "Arancione";
                    userLanguage.textContent = data.preferences.language || "Italiano";
                    userNotifications.textContent = data.preferences.notifications || "Consenti tutti";
                    
                    // Set active color dot
                    setActiveColorDot(data.preferences.color);
                    // Set primary color dynamically
                    setPrimaryColor(data.preferences.color);
                    // Update language flag
                    updateLanguageFlag(data.preferences.language);
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
                        subscription: {
                            type: "Nessuno",
                            startDate: null,
                            endDate: null,
                            status: "inactive",
                            autoRenew: false,
                            lastPaymentDate: null,
                            nextPaymentDate: null,
                            paymentMethod: "Non impostato"
                        },
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                // Set default primary color
                setPrimaryColor('Arancione');
            }
        } catch (error) {
            console.error("Error fetching user data:", error);
        }
    }

    // Fetch User Routines (Placeholder logic for now)
    async function fetchUserRoutines(uid) {
        const userRoutineListSidebar = document.getElementById('user-routine-list-sidebar');
        userRoutineListSidebar.innerHTML = ''; // Clear existing routines

        try {
            const routinesSnapshot = await db.collection('routines')
                                             .where('userId', '==', uid)
                                             .orderBy('createdAt', 'desc')
                                             .get();

            if (routinesSnapshot.empty) {
                const noRoutinesItem = document.createElement('li');
                noRoutinesItem.textContent = 'Nessuna scheda creata.';
                noRoutinesItem.style.fontStyle = 'italic';
                noRoutinesItem.style.color = '#888';
                userRoutineListSidebar.appendChild(noRoutinesItem);
            } else {
                routinesSnapshot.forEach(doc => {
                    const routine = doc.data();
                    const routineItem = document.createElement('li');
                    routineItem.textContent = routine.name || 'Scheda senza nome';
                    routineItem.classList.add('routine-item'); // Add a class for styling
                    routineItem.dataset.routineId = doc.id; // Store routine ID

                    routineItem.addEventListener('click', () => {
                        window.location.href = `../visualizza_scheda/visualizza_scheda.html?id=${doc.id}`;
                    });
                    userRoutineListSidebar.appendChild(routineItem);
                });
            }
        } catch (error) {
            console.error("Error fetching user routines:", error);
            const errorItem = document.createElement('li');
            errorItem.textContent = 'Errore nel caricamento delle schede.';
            errorItem.style.color = 'red';
            userRoutineListSidebar.appendChild(errorItem);
        }
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

    // Update Language Flag Icon
    function updateLanguageFlag(language) {
        if (language === 'Italiano') {
            languageFlagIcon.textContent = '🇮🇹';
        } else if (language === 'English') {
            languageFlagIcon.textContent = '🇬🇧';
        } else {
            languageFlagIcon.textContent = '🌐'; // Default globe icon
        }
    }

    // Change Password
    changePasswordBtn.addEventListener('click', () => {
        changePasswordModal.classList.add('active');
    });

    cancelPasswordChangeBtn.addEventListener('click', () => {
        changePasswordModal.classList.remove('active');
    });

    sendPasswordResetEmailBtn.addEventListener('click', async () => {
        const email = auth.currentUser.email;
        try {
            await auth.sendPasswordResetEmail(email);
            alert(`Email di reset password inviata a ${email}`);
            changePasswordModal.classList.remove('active'); // Close modal after sending email
        } catch (error) {
            alert("Errore nell'invio dell'email: " + error.message);
        }
    });

    // Change Phone
    changePhoneBtn.addEventListener('click', () => {
        newPhoneInput.value = userPhone.textContent === "Non impostato" ? "" : userPhone.textContent; // Pre-fill with current phone if available
        changePhoneModal.classList.add('active');
    });

    cancelPhoneChangeBtn.addEventListener('click', () => {
        changePhoneModal.classList.remove('active');
    });

    confirmPhoneChangeBtn.addEventListener('click', async () => {
        const newPhone = newPhoneInput.value.trim();
        if (newPhone) {
            try {
                await db.collection('users').doc(currentUser.uid).update({
                    phoneNumber: newPhone
                });
                userPhone.textContent = newPhone;
                alert("Numero di telefono aggiornato con successo!");
                changePhoneModal.classList.remove('active'); // Close modal after successful update
            } catch (error) {
                alert("Errore nell'aggiornamento: " + error.message);
            }
        } else {
            alert("Il numero di telefono non può essere vuoto.");
        }
    });

    // Change Language
    changeLanguageBtn.addEventListener('click', () => {
        changeLanguageModal.classList.add('active');
    });

    cancelLanguageChangeBtn.addEventListener('click', () => {
        changeLanguageModal.classList.remove('active');
    });

    languageOptions.forEach(option => {
        option.addEventListener('click', async () => {
            const newLanguage = option.dataset.lang;
            try {
                await db.collection('users').doc(currentUser.uid).update({
                    'preferences.language': newLanguage
                });
                userLanguage.textContent = newLanguage;
                updateLanguageFlag(newLanguage); // Update the flag icon
                changeLanguageModal.classList.remove('active');
                alert(`Lingua aggiornata a: ${newLanguage}`);
            } catch (error) {
                console.error("Error updating language:", error);
                alert("Errore durante l'aggiornamento della lingua: " + error.message);
            }
        });
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
                setPrimaryColor(color); // Update primary color dynamically
            } catch (error) {
                console.error("Error updating color:", error);
            }
        });
    });

    // Change Notifications
    changeNotificationsBtn.addEventListener('click', () => {
        changeNotificationsModal.classList.add('active');
        // Pre-select current notification preference
        const currentNotification = userNotifications.textContent;
        notificationOptions.forEach(radio => {
            if (radio.value === currentNotification) {
                radio.checked = true;
            }
        });
    });

    cancelNotificationsChangeBtn.addEventListener('click', () => {
        changeNotificationsModal.classList.remove('active');
    });

    confirmNotificationsChangeBtn.addEventListener('click', async () => {
        const selectedNotification = document.querySelector('input[name="notifications"]:checked').value;
        try {
            await db.collection('users').doc(currentUser.uid).update({
                'preferences.notifications': selectedNotification
            });
            userNotifications.textContent = selectedNotification;
            alert(`Preferenze notifiche aggiornate a: ${selectedNotification}`);
            changeNotificationsModal.classList.remove('active');
        } catch (error) {
            console.error("Error updating notifications:", error);
            alert("Errore durante l'aggiornamento delle notifiche: " + error.message);
        }
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

    // Contact Us Modal
    contactUsBtn.addEventListener('click', () => {
        contactUsModal.classList.add('active');
    });

    closeContactModalBtn.addEventListener('click', () => {
        contactUsModal.classList.remove('active');
    });

    // Give Feedback Modal
    giveFeedbackBtn.addEventListener('click', () => {
        giveFeedbackModal.classList.add('active');
    });

    cancelFeedbackBtn.addEventListener('click', () => {
        giveFeedbackModal.classList.remove('active');
        feedbackTextarea.value = ''; // Clear textarea on cancel
    });

    submitFeedbackBtn.addEventListener('click', async () => {
        const feedback = feedbackTextarea.value.trim();
        if (feedback) {
            // In a real application, send feedback to Firestore or a backend service
            console.log("Feedback submitted:", feedback);
            alert("Grazie per il tuo feedback!");
            giveFeedbackModal.classList.remove('active');
            feedbackTextarea.value = ''; // Clear textarea after submission
        } else {
            alert("Il campo feedback non può essere vuoto.");
        }
    });

    // Billing History Modal
    viewBillingHistoryBtn.addEventListener('click', () => {
        billingHistoryModal.classList.add('active');
        // In a real application, fetch and display billing history here
        console.log("Fetching billing history...");
    });

    closeBillingHistoryModalBtn.addEventListener('click', () => {
        billingHistoryModal.classList.remove('active');
    });

    // Subscription Edit Modal Logic
    const openSubscriptionEditModal = async () => {
        if (!currentUser) {
            alert("Devi essere loggato per modificare l'abbonamento.");
            return;
        }
        try {
            const doc = await db.collection('users').doc(currentUser.uid).get();
            if (doc.exists && doc.data().subscription) {
                const subData = doc.data().subscription;
                subscriptionTypeInput.value = subData.type || "Nessuno";
                subscriptionStartDateInput.value = subData.startDate ? new Date(subData.startDate.toDate()).toISOString().split('T')[0] : '';
                subscriptionEndDateInput.value = subData.endDate ? new Date(subData.endDate.toDate()).toISOString().split('T')[0] : '';
                paymentMethodInput.value = subData.paymentMethod || "";
                autoRenewInput.checked = subData.autoRenew || false;
                lastPaymentDateInput.value = subData.lastPaymentDate ? new Date(subData.lastPaymentDate.toDate()).toISOString().split('T')[0] : '';
                nextPaymentDateInput.value = subData.nextPaymentDate ? new Date(subData.nextPaymentDate.toDate()).toISOString().split('T')[0] : '';
            } else {
                // Set default values if no subscription data exists
                subscriptionTypeInput.value = "Nessuno";
                subscriptionStartDateInput.value = '';
                subscriptionEndDateInput.value = '';
                paymentMethodInput.value = '';
            }
            subscriptionEditModal.classList.add('active');
        } catch (error) {
            console.error("Error opening subscription edit modal:", error);
            alert("Errore nel caricamento dei dati dell'abbonamento.");
        }
    };

    editSubscriptionExpiryBtn.addEventListener('click', openSubscriptionEditModal);
    editPaymentMethodBtn.addEventListener('click', openSubscriptionEditModal);
    cancelSubscriptionBtn.addEventListener('click', openSubscriptionEditModal);

    cancelSubscriptionEditBtn.addEventListener('click', () => {
        subscriptionEditModal.classList.remove('active');
    });

    saveSubscriptionChangesBtn.addEventListener('click', async () => {
        if (!currentUser) {
            alert("Devi essere loggato per salvare le modifiche.");
            return;
        }

        const newSubscriptionType = subscriptionTypeInput.value;
        const newStartDate = subscriptionStartDateInput.value;
        const newEndDate = subscriptionEndDateInput.value;
        const newPaymentMethod = paymentMethodInput.value.trim();
        const newAutoRenew = autoRenewInput.checked;
        const newLastPaymentDate = lastPaymentDateInput.value;
        const newNextPaymentDate = nextPaymentDateInput.value;

        if (!newSubscriptionType || !newStartDate || !newEndDate || !newPaymentMethod) {
            alert("Tipo di abbonamento, Data Inizio, Data Scadenza e Metodo di Pagamento sono obbligatori.");
            return;
        }
        if (newAutoRenew && (!newLastPaymentDate || !newNextPaymentDate)) {
            alert("Se il rinnovo automatico è attivo, Data Ultimo Pagamento e Data Prossimo Pagamento sono obbligatori.");
            return;
        }

        try {
            await db.collection('users').doc(currentUser.uid).update({
                'subscription.type': newSubscriptionType,
                'subscription.startDate': firebase.firestore.Timestamp.fromDate(new Date(newStartDate)),
                'subscription.endDate': firebase.firestore.Timestamp.fromDate(new Date(newEndDate)),
                'subscription.paymentMethod': newPaymentMethod,
                'subscription.status': newSubscriptionType === "Nessuno" ? "inactive" : "active",
                'subscription.autoRenew': newAutoRenew,
                'subscription.lastPaymentDate': newLastPaymentDate ? firebase.firestore.Timestamp.fromDate(new Date(newLastPaymentDate)) : null,
                'subscription.nextPaymentDate': newNextPaymentDate ? firebase.firestore.Timestamp.fromDate(new Date(newNextPaymentDate)) : null
            });
            alert("Dati abbonamento aggiornati con successo!");
            subscriptionEditModal.classList.remove('active');
            fetchUserData(currentUser.uid); // Refresh displayed data
        } catch (error) {
            console.error("Error updating subscription data:", error);
            alert("Errore durante l'aggiornamento dei dati dell'abbonamento: " + error.message);
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
        if (event.target === changePasswordModal) {
            changePasswordModal.classList.remove('active');
        }
        if (event.target === changePhoneModal) {
            changePhoneModal.classList.remove('active');
        }
        if (event.target === changeLanguageModal) {
            changeLanguageModal.classList.remove('active');
        }
        if (event.target === changeNotificationsModal) {
            changeNotificationsModal.classList.remove('active');
        }
        if (event.target === contactUsModal) {
            contactUsModal.classList.remove('active');
        }
        if (event.target === giveFeedbackModal) {
            giveFeedbackModal.classList.remove('active');
        }
        if (event.target === billingHistoryModal) {
            billingHistoryModal.classList.remove('active');
        }
        if (event.target === subscriptionEditModal) {
            subscriptionEditModal.classList.remove('active');
        }
    });
});