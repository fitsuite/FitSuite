console.log('impostazioni.js caricato e in esecuzione');

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded - impostazioni.js');
    const auth = firebase.auth();
    const db = firebase.firestore();

    // Inizializza la loading screen
    window.LoadingManager.show([
        'Inizializzazione pagina...',
        'Caricamento preferenze utente...',
        'Caricamento dati profilo...',
        'Preparazione interfaccia...'
    ]);

    // Listen for username updates from other components
    window.addEventListener('usernameUpdated', (event) => {
        const { userId, username } = event.detail;
        
        if (currentUser && currentUser.uid === userId) {
            // Update username display
            if (userUsernameMain) {
                userUsernameMain.textContent = `@${username}`;
            }
            
            // Update avatar
            if (userInitialMain) {
                loadUserAvatar(currentUser.email, username, userInitialMain, 90);
            }
            
            // Update local cache
            updateLocalUserProfile(userId, { username });
            
            console.log('Username updated in settings page:', username);
        }
    });

    // Color Map for dynamic styling
    const colorMap = {
        'Arancione': '#ff6600',
        'Verde': '#4ade80',
        'Blu': '#3b82f6',
        'Rosa': '#f472b6'
    };

    const gradientMap = {
        'Arancione': 'linear-gradient(135deg, #2b1d16 0%, #1a1a1a 100%)',
        'Verde': 'linear-gradient(135deg, #1a2b16 0%, #1a1a1a 100%)',
        'Blu': 'linear-gradient(135deg, #161d2b 0%, #1a1a1a 100%)',
        'Rosa': 'linear-gradient(135deg, #2b1625 0%, #1a1a1a 100%)'
    };

    // Set initial primary color based on user preferences
    function setPrimaryColor(colorName) {
        const hex = colorMap[colorName] || colorMap['Arancione']; // Default to orange
        const gradient = gradientMap[colorName] || gradientMap['Arancione']; // Default to orange gradient
        document.documentElement.style.setProperty('--primary-color', hex);
        document.documentElement.style.setProperty('--background-gradient', gradient);
    }

    function waitForSidebar() {
        return new Promise(resolve => {
            const start = Date.now();
            const check = () => {
                if (document.querySelector('.sidebar')) {
                    resolve();
                } else if (Date.now() - start > 5000) {
                    console.warn("Sidebar load timeout");
                    resolve();
                } else {
                    requestAnimationFrame(check);
                }
            };
            check();
        });
    }



    // DOM Elements - Main Profile
    const userInitialMain = document.getElementById('user-initial-main');
    const userUsernameMain = document.getElementById('user-username-main');
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
    const logoutTrigger = document.getElementById('logout-trigger');
    const logoutConfirmModal = document.getElementById('logout-confirm-modal');
    const cancelLogoutBtn = document.getElementById('cancel-logout');
    const confirmLogoutBtn = document.getElementById('confirm-logout');
    const deleteAccountTrigger = document.getElementById('delete-account-trigger');

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

    // DOM Elements - SubscriptionDOM Elements - Subscription
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

    // Optimistic Load: Render immediately if we have a known user
    const lastUid = localStorage.getItem('lastUserId');
    if (lastUid) {
        console.log("Optimistic load for settings:", lastUid);
        applyThemeFromCache(lastUid);
        fetchUserData(lastUid);
    }

    // Check Auth State
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            
            // Update lastUserId
            if (user.uid !== lastUid) {
                localStorage.setItem('lastUserId', user.uid);
            }

            console.log('User is signed in:', user.email);
            
            // Populate basic info from Auth
            userEmailMain.textContent = user.email;
            
            // Load user avatar with Google profile picture fallback to initial
            loadUserAvatar(user.email, null, userInitialMain, 90);
            
            // Set username - will be loaded from database
            userUsernameMain.textContent = "@username";

            // Apply cached theme immediately
            applyThemeFromCache(user.uid);

            try {
                window.LoadingManager.nextStep('Caricamento dati profilo...');
                // Fetch additional data from Firestore and wait for sidebar
                await Promise.all([
                    fetchUserData(user.uid),
                    waitForSidebar()
                ]);
                
                window.LoadingManager.nextStep('Preparazione interfaccia completata');
            } catch (error) {
                console.error("Error during initialization:", error);
            } finally {
                window.LoadingManager.hide();
            }
        } else {
            console.log('No user signed in, redirecting to login...');
            window.location.href = '../auth/auth.html';
        }
    });

    
        function savePreferencesToCache(uid, newPrefs) {
        if (window.CacheManager) {
            const currentCache = window.CacheManager.getPreferences(uid) || {};
            const updatedCache = { ...currentCache, ...newPrefs };
            window.CacheManager.savePreferences(uid, updatedCache);
        } else {
            const cacheKey = `userPreferences_${uid}`;
            let currentCache = {};
            try {
                const stored = localStorage.getItem(cacheKey);
                if (stored) currentCache = JSON.parse(stored);
            } catch (e) {
                console.error("Error parsing cached preferences", e);
            }
            const updatedCache = { ...currentCache, ...newPrefs };
            localStorage.setItem(cacheKey, JSON.stringify(updatedCache));
        }
    }

    // Apply Theme from Cache
    function applyThemeFromCache(uid) {
        let prefs = null;
        if (window.CacheManager) {
            prefs = window.CacheManager.getPreferences(uid);
        } else {
            const cacheKey = `userPreferences_${uid}`;
            try {
                const cached = localStorage.getItem(cacheKey);
                if (cached) prefs = JSON.parse(cached);
            } catch (e) {
                console.error("Error applying cached theme:", e);
            }
        }

        if (prefs) {
            if (prefs.color) {
                setPrimaryColor(prefs.color);
                if (document.getElementById('current-color')) {
                    document.getElementById('current-color').textContent = prefs.color;
                }
                setActiveColorDot(prefs.color);
            }
            if (prefs.language) {
                if (document.getElementById('user-language')) {
                    document.getElementById('user-language').textContent = prefs.language;
                }
                updateLanguageFlag(prefs.language);
            }
            if (prefs.notifications) {
                if (document.getElementById('user-notifications')) {
                    document.getElementById('user-notifications').textContent = prefs.notifications;
                }
            }
        }
    }

    // Fetch User Data from Firestore
    async function fetchUserData(uid) {
        // 1. Try Cache FIRST
        if (window.CacheManager) {
            const cachedPrefs = window.CacheManager.getPreferences(uid);
            // We can't easily cache the *entire* user document with current CacheManager structure 
            // because it splits preferences and routines. 
            // However, we can at least use the preferences part if available.
            // Ideally, we should extend CacheManager or use localStorage for the full user profile if needed.
            // For now, let's check if we have preferences and if so, use them to avoid at least that part of the delay.
            
            // Actually, the user wants "NO DB calls" if cached. 
            // So we should probably cache the entire user profile in CacheManager or localStorage.
            
            const cachedProfile = localStorage.getItem(`userProfile_${uid}`);
            if (cachedProfile) {
                try {
                    const data = JSON.parse(cachedProfile);
                    updateUIWithUserData(data);
                    console.log("User data loaded from cache, skipping DB");
                    return; // SKIP DB CALL
                } catch (e) {
                    console.error("Error parsing cached profile", e);
                }
            }
        }

        try {
            console.log("User data not in cache, fetching from DB");
            const doc = await db.collection('users').doc(uid).get();
            if (doc.exists) {
                const data = doc.data();
                
                // Save to Cache (LocalStorage for full profile)
                localStorage.setItem(`userProfile_${uid}`, JSON.stringify(data));
                
                updateUIWithUserData(data);
                
                // Also update CacheManager for preferences specifically
                if (data.preferences && window.CacheManager) {
                    window.CacheManager.savePreferences(uid, data.preferences);
                }
            } else {
                console.log("No such document! Creating one...");
                // If doc doesn't exist for some reason, create it
                const newData = {
                        email: auth.currentUser.email,
                        username: null, // Sarà richiesto dal popup
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
                    };
                
                await db.collection('users').doc(uid).set(newData);
                
                // Cache the new data
                localStorage.setItem(`userProfile_${uid}`, JSON.stringify(newData));
                updateUIWithUserData(newData);
            }
        } catch (error) {
            console.error("Error fetching user data:", error);
        }
    }

    function updateUIWithUserData(data) {
        // Update Username - use actual username from database or placeholder
        if (userUsernameMain) {
            if (data.username) {
                userUsernameMain.textContent = data.username.startsWith('@') ? data.username : `@${data.username}`;
            } else {
                // No username set yet
                userUsernameMain.textContent = "@username";
            }
        } else {
            console.warn('Elemento con ID "user-username-main" non trovato nell\'HTML');
        }
        
        // Update user avatar with Google profile picture fallback to initial
        if (currentUser && userInitialMain) {
            const username = data.username || null;
            loadUserAvatar(currentUser.email, username, userInitialMain, 90);
        } else if (!userInitialMain) {
            console.warn('Elemento con ID "user-initial-main" non trovato nell\'HTML');
        }
        
        // Update Phone
        if (userPhone) {
            userPhone.textContent = data.phoneNumber || "Non impostato";
        } else {
            console.warn('Elemento con ID "user-phone" non trovato nell\'HTML');
        }

        // Update Subscription Info
        if (data.subscription) {
            // Handle dates which might be strings (from JSON) or Timestamps (from Firestore)
            const formatDate = (dateVal) => {
                if (!dateVal) return null;
                if (dateVal.toDate) return dateVal.toDate(); // Firestore Timestamp
                return new Date(dateVal); // String/Number
            };

            const endDate = formatDate(data.subscription.endDate);
            if (subscriptionExpiry) {
                subscriptionExpiry.textContent = endDate ? endDate.toLocaleDateString() : "Nessun abbonamento attivo";
            } else {
                console.warn('Elemento con ID "subscription-expiry" non trovato nell\'HTML');
            }
            
            if (paymentMethod) {
                paymentMethod.textContent = data.subscription.paymentMethod || "Non impostato";
            } else {
                console.warn('Elemento con ID "payment-method" non trovato nell\'HTML');
            }
            
            // Initialize new subscription fields
            if (autoRenewInput) {
                autoRenewInput.checked = data.subscription.autoRenew || false;
            } else {
                console.warn('Elemento con ID "auto-renew-input" non trovato nell\'HTML');
            }
            
            const lastPayment = formatDate(data.subscription.lastPaymentDate);
            if (lastPaymentDateInput) {
                lastPaymentDateInput.value = lastPayment ? lastPayment.toISOString().split('T')[0] : '';
            } else {
                console.warn('Elemento con ID "last-payment-date-input" non trovato nell\'HTML');
            }
            
            const nextPayment = formatDate(data.subscription.nextPaymentDate);
            if (nextPaymentDateInput) {
                nextPaymentDateInput.value = nextPayment ? nextPayment.toISOString().split('T')[0] : '';
            } else {
                console.warn('Elemento con ID "next-payment-date-input" non trovato nell\'HTML');
            }
        } else {
            if (subscriptionExpiry) {
                subscriptionExpiry.textContent = "Nessun abbonamento attivo";
            } else {
                console.warn('Elemento con ID "subscription-expiry" non trovato nell\'HTML');
            }
            
            if (paymentMethod) {
                paymentMethod.textContent = "Non impostato";
            } else {
                console.warn('Elemento con ID "payment-method" non trovato nell\'HTML');
            }
            
            // Reset new subscription fields
            if (autoRenewInput) {
                autoRenewInput.checked = false;
            } else {
                console.warn('Elemento con ID "auto-renew-input" non trovato nell\'HTML');
            }
            
            if (lastPaymentDateInput) {
                lastPaymentDateInput.value = '';
            } else {
                console.warn('Elemento con ID "last-payment-date-input" non trovato nell\'HTML');
            }
            
            if (nextPaymentDateInput) {
                nextPaymentDateInput.value = '';
            } else {
                console.warn('Elemento con ID "next-payment-date-input" non trovato nell\'HTML');
            }
        }
        
        // Update Preferences
        if (data.preferences) {
            // Save to localStorage (legacy/backup)
            savePreferencesToCache(currentUser ? currentUser.uid : '', data.preferences);

            if (currentColorLabel) {
                currentColorLabel.textContent = data.preferences.color || "Arancione";
            } else {
                console.warn('Elemento con ID "current-color" non trovato nell\'HTML');
            }
            
            if (userLanguage) {
                userLanguage.textContent = data.preferences.language || "Italiano";
            } else {
                console.warn('Elemento con ID "user-language" non trovato nell\'HTML');
            }
            
            if (userNotifications) {
                userNotifications.textContent = data.preferences.notifications || "Consenti tutti";
            } else {
                console.warn('Elemento con ID "user-notifications" non trovato nell\'HTML');
            }
            
            // Set active color dot
            setActiveColorDot(data.preferences.color);
            // Set primary color dynamically
            setPrimaryColor(data.preferences.color);
            // Update language flag
            updateLanguageFlag(data.preferences.language);
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

    // Helper to update local user profile cache
    function updateLocalUserProfile(uid, updates) {
        const cacheKey = `userProfile_${uid}`;
        try {
            const cached = localStorage.getItem(cacheKey);
            let profile = cached ? JSON.parse(cached) : {};
            
            for (const [key, value] of Object.entries(updates)) {
                if (key.includes('.')) {
                    const parts = key.split('.');
                    let current = profile;
                    for (let i = 0; i < parts.length - 1; i++) {
                        if (!current[parts[i]]) current[parts[i]] = {};
                        current = current[parts[i]];
                    }
                    current[parts[parts.length - 1]] = value;
                } else {
                    profile[key] = value;
                }
            }
            
            localStorage.setItem(cacheKey, JSON.stringify(profile));
        } catch (e) {
            console.error("Error updating local user profile cache", e);
        }
    }

    // Change Password
    if (changePasswordBtn) {
        changePasswordBtn.addEventListener('click', () => {
            changePasswordModal.classList.add('active');
        });
    } else {
        console.warn('Elemento con ID "change-password-btn" non trovato nell\'HTML');
    }

    if (cancelPasswordChangeBtn) {
        cancelPasswordChangeBtn.addEventListener('click', () => {
            changePasswordModal.classList.remove('active');
        });
    } else {
        console.warn('Elemento con ID "cancel-password-change" non trovato nell\'HTML');
    }

    if (sendPasswordResetEmailBtn) {
        sendPasswordResetEmailBtn.addEventListener('click', async () => {
            const email = auth.currentUser.email;
            try {
                await auth.sendPasswordResetEmail(email);
                if (window.showSuccessToast) {
                    window.showSuccessToast(`Email di reset password inviata a ${email}`);
                }
                changePasswordModal.classList.remove('active'); // Close modal after sending email
            } catch (error) {
                if (window.showErrorToast) {
                    window.showErrorToast("Errore nell'invio dell'email: " + error.message);
                }
            }
        });
    } else {
        console.warn('Elemento con ID "send-password-reset-email" non trovato nell\'HTML');
    }

    // Change Phone
    if (changePhoneBtn) {
        changePhoneBtn.addEventListener('click', () => {
            newPhoneInput.value = userPhone.textContent === "Non impostato" ? "" : userPhone.textContent; // Pre-fill with current phone if available
            changePhoneModal.classList.add('active');
        });
    } else {
        console.warn('Elemento con ID "change-phone-btn" non trovato nell\'HTML');
    }

    if (cancelPhoneChangeBtn) {
        cancelPhoneChangeBtn.addEventListener('click', () => {
            changePhoneModal.classList.remove('active');
        });
    } else {
        console.warn('Elemento con ID "cancel-phone-change" non trovato nell\'HTML');
    }

    if (confirmPhoneChangeBtn) {
        confirmPhoneChangeBtn.addEventListener('click', async () => {
            const newPhone = newPhoneInput.value.trim();
            
            // Regola di validazione: almeno 10 cifre, opzionale + all'inizio
            const phoneRegex = /^\+?[0-9]{10,15}$/;

            if (newPhone) {
                if (!phoneRegex.test(newPhone.replace(/\s/g, ''))) {
                    if (window.showErrorToast) {
                        window.showErrorToast("Per favore inserisci un numero di telefono valido (es. +39 333 1234567 o 3331234567). Deve contenere almeno 10 cifre.");
                    }
                    return;
                }

                try {
                    await db.collection('users').doc(currentUser.uid).update({
                        phoneNumber: newPhone
                    });
                    
                    // Update Cache
                    updateLocalUserProfile(currentUser.uid, { phoneNumber: newPhone });
                    
                    userPhone.textContent = newPhone;
                    if (window.showSuccessToast) {
                        window.showSuccessToast("Numero di telefono aggiornato con successo!");
                    }
                    changePhoneModal.classList.remove('active'); // Close modal after successful update
                } catch (error) {
                    if (window.showErrorToast) {
                        window.showErrorToast("Errore nell'aggiornamento: " + error.message);
                    }
                }
            } else {
                if (window.showErrorToast) {
                    window.showErrorToast("Il numero di telefono non può essere vuoto.");
                }
            }
        });
    } else {
        console.warn('Elemento con ID "confirm-phone-change" non trovato nell\'HTML');
    }

    // Change Language
    if (changeLanguageBtn) {
        changeLanguageBtn.addEventListener('click', () => {
            changeLanguageModal.classList.add('active');
        });
    } else {
        console.warn('Elemento con ID "change-language-btn" non trovato nell\'HTML');
    }

    if (cancelLanguageChangeBtn) {
        cancelLanguageChangeBtn.addEventListener('click', () => {
            changeLanguageModal.classList.remove('active');
        });
    } else {
        console.warn('Elemento con ID "cancel-language-change" non trovato nell\'HTML');
    }

    languageOptions.forEach(option => {
        option.addEventListener('click', async () => {
            const newLanguage = option.dataset.lang;
            try {
                await db.collection('users').doc(currentUser.uid).update({
                    'preferences.language': newLanguage
                });
                
                // Update cache
                savePreferencesToCache(currentUser.uid, { language: newLanguage });
                updateLocalUserProfile(currentUser.uid, { 'preferences.language': newLanguage });

                userLanguage.textContent = newLanguage;
                updateLanguageFlag(newLanguage); // Update the flag icon
                changeLanguageModal.classList.remove('active');
                if (window.showSuccessToast) {
                    window.showSuccessToast(`Lingua aggiornata a: ${newLanguage}`);
                }
            } catch (error) {
                console.error("Error updating language:", error);
                if (window.showErrorToast) {
                    window.showErrorToast("Errore durante l'aggiornamento della lingua: " + error.message);
                }
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
                // Optimistic Update: Update cache and UI immediately
                savePreferencesToCache(currentUser.uid, { color: color });
                updateLocalUserProfile(currentUser.uid, { 'preferences.color': color });
                
                currentColorLabel.textContent = color;
                setActiveColorDot(color);
                setPrimaryColor(color); // Update primary color dynamically

                await db.collection('users').doc(currentUser.uid).update({
                    'preferences.color': color
                });
            } catch (error) {
                console.error("Error updating color:", error);
                // Optional: Revert UI if needed, but for color it's minor
            }
        });
    });

    // Change Notifications
    if (changeNotificationsBtn) {
        changeNotificationsBtn.addEventListener('click', () => {
            if (changeNotificationsModal) {
                changeNotificationsModal.classList.add('active');
                // Pre-select current notification preference
                const currentNotification = userNotifications.textContent;
                notificationOptions.forEach(radio => {
                    if (radio.value === currentNotification) {
                        radio.checked = true;
                    }
                });
            } else {
                console.warn('Elemento con ID "change-notifications-modal" non trovato nell\'HTML');
            }
        });
    } else {
        console.warn('Elemento con ID "change-notifications-btn" non trovato nell\'HTML');
    }

    if (cancelNotificationsChangeBtn) {
        cancelNotificationsChangeBtn.addEventListener('click', () => {
            if (changeNotificationsModal) {
                changeNotificationsModal.classList.remove('active');
            }
        });
    } else {
        console.warn('Elemento con ID "cancel-notifications-change" non trovato nell\'HTML');
    }

    if (confirmNotificationsChangeBtn) {
        confirmNotificationsChangeBtn.addEventListener('click', async () => {
            const selectedNotification = document.querySelector('input[name="notifications"]:checked').value;
            try {
                await db.collection('users').doc(currentUser.uid).update({
                    'preferences.notifications': selectedNotification
                });
                
                // Update cache
                savePreferencesToCache(currentUser.uid, { notifications: selectedNotification });
                updateLocalUserProfile(currentUser.uid, { 'preferences.notifications': selectedNotification });

                userNotifications.textContent = selectedNotification;
                if (window.showSuccessToast) {
                    window.showSuccessToast(`Preferenze notifiche aggiornate a: ${selectedNotification}`);
                }
                changeNotificationsModal.classList.remove('active');
            } catch (error) {
                console.error("Error updating notifications:", error);
                if (window.showErrorToast) {
                    window.showErrorToast("Errore durante l'aggiornamento delle notifiche: " + error.message);
                }
            }
        });
    } else {
        console.warn('Elemento con ID "confirm-notifications-change" non trovato nell\'HTML');
    }

    // Delete Account Logic
    if (deleteAccountTrigger) {
        deleteAccountTrigger.addEventListener('click', () => {
            deleteModal.classList.add('active');
        });
    } else {
        console.warn('Elemento con ID "delete-account-trigger" non trovato nell\'HTML');
    }

    if (cancelDeleteBtn) {
        cancelDeleteBtn.addEventListener('click', () => {
            deleteModal.classList.remove('active');
        });
    } else {
        console.warn('Elemento con ID "cancel-delete" non trovato nell\'HTML');
    }

    if (confirmDeleteBtn) {
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
                    if (window.showWarningToast) {
                        window.showWarningToast("Per eliminare l'account è necessario aver effettuato l'accesso di recente. Effettua il logout e rientra prima di riprovare.");
                    }
                    auth.signOut().then(() => window.location.href = '../auth/auth.html');
                } else {
                    if (window.showErrorToast) {
                        window.showErrorToast("Errore durante l'eliminazione: " + error.message);
                    }
                }
            }
        });
    } else {
        console.warn('Elemento con ID "confirm-delete" non trovato nell\'HTML');
    }

    // Contact Us Modal
    if (contactUsBtn) {
        contactUsBtn.addEventListener('click', () => {
            contactUsModal.classList.add('active');
        });
    } else {
        console.warn('Elemento con ID "contact-us-btn" non trovato nell\'HTML');
    }

    if (closeContactModalBtn) {
        closeContactModalBtn.addEventListener('click', () => {
            contactUsModal.classList.remove('active');
        });
    } else {
        console.warn('Elemento con ID "close-contact-modal" non trovato nell\'HTML');
    }

    // Give Feedback Modal
    if (giveFeedbackBtn) {
        giveFeedbackBtn.addEventListener('click', () => {
            giveFeedbackModal.classList.add('active');
        });
    } else {
        console.warn('Elemento con ID "give-feedback-btn" non trovato nell\'HTML');
    }

    if (cancelFeedbackBtn) {
        cancelFeedbackBtn.addEventListener('click', () => {
            giveFeedbackModal.classList.remove('active');
            feedbackTextarea.value = ''; // Clear textarea on cancel
        });
    } else {
        console.warn('Elemento con ID "cancel-feedback" non trovato nell\'HTML');
    }

    if (submitFeedbackBtn) {
        submitFeedbackBtn.addEventListener('click', async () => {
            const feedback = feedbackTextarea.value.trim();
            
            if (!feedback) {
                if (window.showErrorToast) {
                    window.showErrorToast("Il campo feedback non può essere vuoto.");
                }
                return;
            }

            if (!currentUser) {
                if (window.showErrorToast) {
                    window.showErrorToast("Errore: Utente non identificato. Riprova a effettuare il login.");
                }
                return;
            }

            try {
                // Feedback visivo durante l'invio
                const originalBtnText = submitFeedbackBtn.textContent;
                submitFeedbackBtn.disabled = true;
                submitFeedbackBtn.textContent = "Invio...";

                // Salvataggio su Firestore nella raccolta 'feedback'
                await db.collection('feedback').add({
                    uid: currentUser.uid,
                    email: currentUser.email,
                    message: feedback,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    read: false // Campo utile per segnare se il feedback è stato letto dagli admin
                });

                console.log("Feedback submitted successfully");
                if (window.showSuccessToast) {
                    window.showSuccessToast("Grazie per il tuo feedback! La tua opinione è importante per noi.");
                }
                
                giveFeedbackModal.classList.remove('active');
                feedbackTextarea.value = ''; // Clear textarea after submission

            } catch (error) {
                console.error("Error submitting feedback:", error);
                if (window.showErrorToast) {
                    window.showErrorToast("Si è verificato un errore durante l'invio del feedback: " + error.message);
                }
            } finally {
                // Ripristina il bottone
                submitFeedbackBtn.disabled = false;
                submitFeedbackBtn.textContent = "Invia Feedback";
            }
        });
    } else {
        console.warn('Elemento con ID "submit-feedback" non trovato nell\'HTML');
    }

    // Billing History Modal
    if (viewBillingHistoryBtn) {
        viewBillingHistoryBtn.addEventListener('click', () => {
            billingHistoryModal.classList.add('active');
            // In a real application, fetch and display billing history here
            console.log("Fetching billing history...");
        });
    } else {
        console.warn('Elemento con ID "view-billing-history-btn" non trovato nell\'HTML');
    }

    if (closeBillingHistoryModalBtn) {
        closeBillingHistoryModalBtn.addEventListener('click', () => {
            billingHistoryModal.classList.remove('active');
        });
    } else {
        console.warn('Elemento con ID "close-billing-history-modal" non trovato nell\'HTML');
    }

    // Logout functionality
    if (logoutTrigger) {
        logoutTrigger.addEventListener('click', () => {
            console.log('Logout button clicked - Event Listener Triggered');
            logoutConfirmModal.classList.add('active');
        });
    } else {
        console.warn('Elemento con ID "logout-trigger" non trovato nell\'HTML');
    }

    if (cancelLogoutBtn) {
        cancelLogoutBtn.addEventListener('click', () => {
            console.log('Cancel Logout button clicked - Event Listener Triggered');
            logoutConfirmModal.classList.remove('active');
        });
    } else {
        console.warn('Elemento con ID "cancel-logout" non trovato nell\'HTML');
    }

    if (confirmLogoutBtn) {
        confirmLogoutBtn.addEventListener('click', async () => {
            console.log('Confirm Logout button clicked - Event Listener Triggered');
            try {
                console.log('Attempting to sign out...');
                await auth.signOut();
                console.log("User signed out successfully.");
                window.location.href = '../auth/auth.html'; // Redirect to login page
            } catch (error) {
                console.error("Error during logout:", error);
                if (window.showErrorToast) {
                    window.showErrorToast("Errore durante il logout: " + error.message);
                }
            }
        });
    } else {
        console.warn('Elemento con ID "confirm-logout" non trovato nell\'HTML');
    }

    // Subscription Edit Modal Logic
    const openSubscriptionEditModal = async () => {
        if (!currentUser) {
            if (window.showErrorToast) {
                window.showErrorToast("Devi essere loggato per modificare l'abbonamento.");
            }
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
            if (window.showErrorToast) {
                window.showErrorToast("Errore nel caricamento dei dati dell'abbonamento.");
            }
        }
    };

    if (editSubscriptionExpiryBtn) {
        editSubscriptionExpiryBtn.addEventListener('click', openSubscriptionEditModal);
    } else {
        console.warn('Elemento con ID "edit-subscription-expiry" non trovato nell\'HTML');
    }

    if (editPaymentMethodBtn) {
        editPaymentMethodBtn.addEventListener('click', openSubscriptionEditModal);
    } else {
        console.warn('Elemento con ID "edit-payment-method" non trovato nell\'HTML');
    }

    if (cancelSubscriptionBtn) {
        cancelSubscriptionBtn.addEventListener('click', openSubscriptionEditModal);
    } else {
        console.warn('Elemento con ID "cancel-subscription-btn" non trovato nell\'HTML');
    }

    if (cancelSubscriptionEditBtn) {
        cancelSubscriptionEditBtn.addEventListener('click', () => {
            subscriptionEditModal.classList.remove('active');
        });
    } else {
        console.warn('Elemento con ID "cancel-subscription-edit" non trovato nell\'HTML');
    }

    if (saveSubscriptionChangesBtn) {
        saveSubscriptionChangesBtn.addEventListener('click', async () => {
            if (!currentUser) {
                if (window.showErrorToast) {
                    window.showErrorToast("Devi essere loggato per salvare le modifiche.");
                }
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
                if (window.showErrorToast) {
                    window.showErrorToast("Tipo di abbonamento, Data Inizio, Data Scadenza e Metodo di Pagamento sono obbligatori.");
                }
                return;
            }
            if (newAutoRenew && (!newLastPaymentDate || !newNextPaymentDate)) {
                if (window.showErrorToast) {
                    window.showErrorToast("Se il rinnovo automatico è attivo, Data Ultimo Pagamento e Data Prossimo Pagamento sono obbligatori.");
                }
                return;
            }

            try {
                const subscriptionUpdates = {
                    'subscription.type': newSubscriptionType,
                    'subscription.startDate': firebase.firestore.Timestamp.fromDate(new Date(newStartDate)),
                    'subscription.endDate': firebase.firestore.Timestamp.fromDate(new Date(newEndDate)),
                    'subscription.paymentMethod': newPaymentMethod,
                    'subscription.status': newSubscriptionType === "Nessuno" ? "inactive" : "active",
                    'subscription.autoRenew': newAutoRenew,
                    'subscription.lastPaymentDate': newLastPaymentDate ? firebase.firestore.Timestamp.fromDate(new Date(newLastPaymentDate)) : null,
                    'subscription.nextPaymentDate': newNextPaymentDate ? firebase.firestore.Timestamp.fromDate(new Date(newNextPaymentDate)) : null
                };

                await db.collection('users').doc(currentUser.uid).update(subscriptionUpdates);
                
                // Update Cache with strings
                const cacheUpdates = { ...subscriptionUpdates };
                // Convert timestamps to strings for cache
                if (cacheUpdates['subscription.startDate']) cacheUpdates['subscription.startDate'] = new Date(newStartDate).toISOString();
                if (cacheUpdates['subscription.endDate']) cacheUpdates['subscription.endDate'] = new Date(newEndDate).toISOString();
                if (cacheUpdates['subscription.lastPaymentDate']) cacheUpdates['subscription.lastPaymentDate'] = newLastPaymentDate ? new Date(newLastPaymentDate).toISOString() : null;
                if (cacheUpdates['subscription.nextPaymentDate']) cacheUpdates['subscription.nextPaymentDate'] = newNextPaymentDate ? new Date(newNextPaymentDate).toISOString() : null;

                updateLocalUserProfile(currentUser.uid, cacheUpdates);

                if (window.showSuccessToast) {
                    window.showSuccessToast("Dati abbonamento aggiornati con successo!");
                }
                subscriptionEditModal.classList.remove('active');
                fetchUserData(currentUser.uid); // Refresh displayed data
            } catch (error) {
                console.error("Error updating subscription data:", error);
                if (window.showErrorToast) {
                    window.showErrorToast("Errore durante l'aggiornamento dei dati dell'abbonamento: " + error.message);
                }
            }
        });
    } else {
        console.warn('Elemento con ID "save-subscription-changes" non trovato nell\'HTML');
    }

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
        if (event.target === logoutConfirmModal) {
            logoutConfirmModal.classList.remove('active');
        }
    });
});