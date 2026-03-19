/**
 * scelta_piano.js
 * Gestisce la selezione del piano, l'integrazione con Stripe e l'aggiornamento del profilo utente.
 */

document.addEventListener('DOMContentLoaded', async () => {
    // AuthGuard check
    if (window.AuthGuard) {
        const isAuthorized = await window.AuthGuard.verify();
        if (!isAuthorized) return; // AuthGuard handles redirect
    }
    
    // Initialize loading screen if available
    if (window.LoadingManager) {
        window.LoadingManager.show(['Caricamento piani...', 'Preparazione Stripe...']);
    }

    const auth = firebase.auth();
    const db = firebase.firestore();
    const loading = window.LoadingManager;
    
    let stripe = null;
    let currentUser = null;

    // Inizializza Stripe recuperando la chiave dal database
    async function initStripe() {
        try {
            // Tentativo di recupero della chiave pubblica dal DB (se le regole Firestore lo permettono)
            const configDoc = await db.collection('config').doc('stripe').get();
            if (configDoc.exists && configDoc.data().STRIPE_PUBLISHABLE_KEY) {
                stripe = Stripe(configDoc.data().STRIPE_PUBLISHABLE_KEY);
            } else {
                throw new Error("Chiave non trovata nel DB");
            }
        } catch (e) {
            // Fallback silenzioso alla chiave fornita se non presente o errore permessi
            stripe = Stripe('pk_test_51T9iVb2Hrb9wTJ3aRbGMBCSfJmVQHPqcq18KZF4hCozCqCQMfzRQlWYvVqjxkGmlpwCLOUEhqftw4sfqPVNifl7f00r5L4IudA');
        }
    }

    // Chiamiamo initStripe all'avvio
    await initStripe();
    
    // Hide loading screen when everything is ready
    if (loading) {
        loading.hide();
    }
    
    // DOM Elements
    const selectionContainer = document.getElementById('selection-container');
    const successContainer = document.getElementById('success-container');
    const goHomeBtn = document.getElementById('go-home-btn');
    
    let selectedPlan = null;

    // Check for success parameter in URL (if returning from Stripe)
    const urlParams = new URLSearchParams(window.location.search);
    const successParam = urlParams.get('payment_success');
    const planParam = urlParams.get('plan');

    // Check Authentication
    auth.onAuthStateChanged(async user => {
        if (user) {
            currentUser = user;
            
            // If we just returned from a "successful" payment
            if (successParam === 'true' && planParam) {
                if (loading) loading.show(['Conferma pagamento...', 'Aggiornamento profilo...']);
                try {
                    await updateUserDataAfterPayment(planParam);
                    
                    // Clear URL parameters without reloading
                    const newUrl = window.location.origin + window.location.pathname;
                    window.history.replaceState({}, document.title, newUrl);
                    
                    showSuccessStep();
                } catch (err) {
                    console.error('Error updating profile after redirect:', err);
                    if (window.showErrorToast) window.showErrorToast('Errore durante l\'aggiornamento del profilo.');
                } finally {
                    if (loading) loading.hide();
                }
            }
        } else {
            window.location.href = '../auth/auth.html';
        }
    });

    // Plan Selection Buttons
    const planButtons = document.querySelectorAll('.pricing-btn[data-plan-id]');
    planButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            selectedPlan = btn.getAttribute('data-plan-id');
            startStripeCheckout(selectedPlan);
        });
    });

    /**
     * Starts Stripe Checkout via Firebase Cloud Function
     */
    async function startStripeCheckout(planId) {
        if (!currentUser) {
            if (window.showErrorToast) window.showErrorToast('Devi essere autenticato.');
            return;
        }

        if (loading) loading.show(['Inizializzazione Stripe Checkout...', 'Preparazione sessione...']);
        
        try {
            console.log(`[StripeCheckout] Inizio sessione per piano: ${planId}`);
            // Chiama la Cloud Function per creare la sessione di checkout
            const createSession = firebase.app().functions('us-central1').httpsCallable('createStripeCheckoutSession');
            
            console.log(`[StripeCheckout] Chiamata Cloud Function 'createStripeCheckoutSession'...`);
            const result = await createSession({ 
                planId: planId,
                origin: window.location.origin
            });

            console.log(`[StripeCheckout] Risultato ricevuto:`, result.data);

            if (result.data && result.data.url) {
                console.log(`[StripeCheckout] Reindirizzamento a: ${result.data.url}`);
                window.location.href = result.data.url;
            } else {
                throw new Error("URL della sessione non ricevuto dal server.");
            }
        } catch (error) {
            console.error('[StripeCheckout] ERRORE DETTAGLIATO:', error);
            console.error('[StripeCheckout] Messaggio:', error.message);
            console.error('[StripeCheckout] Codice:', error.code);
            console.error('[StripeCheckout] Dettagli:', error.details);
            
            if (loading) loading.hide();
            
            let userMessage = 'Errore durante l\'avvio del pagamento.';
            if (error.code === 'internal') {
                userMessage = 'Errore interno del server (internal). Controlla i log di Firebase Functions.';
            } else if (error.message) {
                userMessage = error.message;
            }

            if (window.showErrorToast) {
                window.showErrorToast(userMessage);
            }
        }
    }

    async function updateUserDataAfterPayment(planId) {
        if (!currentUser) return;
        
        const userRef = db.collection('users').doc(currentUser.uid);
        
        // Calculate end date (30 days from now)
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(startDate.getDate() + 30);
        
        const updateData = {
            'subscription.plan': planId,
            'subscription.status': 'active',
            'subscription.startDate': firebase.firestore.Timestamp.fromDate(startDate),
            'subscription.endDate': firebase.firestore.Timestamp.fromDate(endDate),
            'role': planId, // Sync role with plan
            'updatedAt': firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // Special logic for PT plan if needed (e.g., initializing client lists)
        if (planId === 'pt') {
            updateData['clients_count'] = 0;
        }

        await userRef.update(updateData);
        
        // Update Local Cache
        if (window.CacheManager) {
            const cachedProfile = localStorage.getItem(`userProfile_${currentUser.uid}`);
            if (cachedProfile) {
                const profile = JSON.parse(cachedProfile);
                profile.subscription = {
                    plan: planId,
                    status: 'active',
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString()
                };
                profile.role = planId;
                localStorage.setItem(`userProfile_${currentUser.uid}`, JSON.stringify(profile));
            }
        }
        
        // Force refresh for other components
        localStorage.setItem(`lastProfileRefresh_${currentUser.uid}`, Date.now().toString());
        
        // Trigger event for sidebar if loaded
        window.dispatchEvent(new CustomEvent('planUpdated', { 
            detail: { planId: planId } 
        }));
    }

    function showSuccessStep() {
        selectionContainer.style.display = 'none';
        successContainer.style.display = 'flex';
        
        if (window.showSuccessToast) {
            window.showSuccessToast('Abbonamento attivato con successo!');
        }
    }

    goHomeBtn.addEventListener('click', () => {
        window.location.href = '../lista_schede/lista_scheda.html';
    });
});