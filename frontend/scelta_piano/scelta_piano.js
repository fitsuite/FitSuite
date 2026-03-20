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
    
    // Hide loading screen when everything is ready
    if (loading) {
        loading.hide();
    }
    
    // Stripe Initialization
    const stripe = Stripe('pk_test_51T9iVb2Hrb9wTJ3aRbGMBCSfJmVQHPqcq18KZF4hCozCqCQMfzRQlWYvVqjxkGmlpwCLOUEhqftw4sfqPVNifl7f00r5L4IudA');
    
    // Price IDs Mapping (Replace with actual IDs from Stripe Dashboard)
    const PRICE_IDS = {
        pro: {
            monthly: 'PRICE_MENSILE_PRO',
            yearly: 'PRICE_ANNUALE_PRO'
        },
        pt: {
            monthly: 'PRICE_MENSILE_PT',
            yearly: 'PRICE_ANNUALE_PT'
        }
    };

    const PRICES = {
        pro: { monthly: '€4.99', yearly: '€50' },
        pt: { monthly: '€9.99', yearly: '€100' }
    };

    // DOM Elements
    const selectionContainer = document.getElementById('selection-container');
    const successContainer = document.getElementById('success-container');
    const pricingToggle = document.getElementById('pricing-toggle');
    const proPriceText = document.getElementById('pro-price');
    const ptPriceText = document.getElementById('pt-price');
    const toggleLabels = document.querySelectorAll('.toggle-label');
    const goHomeBtn = document.getElementById('go-home-btn');
    
    let isYearly = false;
    let currentUser = null;

    // Pricing Toggle Logic
    pricingToggle.addEventListener('change', () => {
        isYearly = pricingToggle.checked;
        updatePricingUI();
    });

    function updatePricingUI() {
        const period = isYearly ? 'yearly' : 'monthly';
        const suffix = isYearly ? '<span>/anno</span>' : '<span>/mese</span>';
        
        proPriceText.innerHTML = `${PRICES.pro[period]}${suffix}`;
        ptPriceText.innerHTML = `${PRICES.pt[period]}${suffix}`;
        
        // Update label active state
        toggleLabels.forEach(label => {
            if (label.classList.contains(period)) {
                label.classList.add('active');
            } else {
                label.classList.remove('active');
            }
        });
    }

    // Check Authentication
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
        } else {
            window.location.href = '../auth/auth.html';
        }
    });

    // Plan Selection Buttons
    const planButtons = document.querySelectorAll('.pricing-btn[data-plan-id]');
    planButtons.forEach(btn => {
        btn.addEventListener('click', async () => {
            const planId = btn.getAttribute('data-plan-id');
            await handleCheckout(planId);
        });
    });

    async function handleCheckout(planId) {
        if (!currentUser) {
            window.location.href = '../auth/auth.html';
            return;
        }

        const period = isYearly ? 'yearly' : 'monthly';
        const priceId = PRICE_IDS[planId][period];

        // Se siamo ancora con i placeholder, avvisa l'utente
        if (priceId.includes('PRICE_MENSILE_PRO')) {
            if (window.showErrorToast) {
                window.showErrorToast('Configura i tuoi Price ID in scelta_piano.js prima di procedere.');
            }
            return;
        }

        if (window.LoadingManager) {
            window.LoadingManager.show(['Inizializzazione pagamento...', 'Reindirizzamento a Stripe...']);
        }

        try {
            const functionsBaseUrl = (window.CONFIG && window.CONFIG.STRIPE && window.CONFIG.STRIPE.CLOUD_FUNCTIONS_URL) 
                ? window.CONFIG.STRIPE.CLOUD_FUNCTIONS_URL 
                : 'https://europe-west1-fitsuite-a7b6c.cloudfunctions.net';

            if (functionsBaseUrl.includes('your_region-your_project')) {
                throw new Error('Configurazione Cloud Functions mancante. Imposta CLOUD_FUNCTIONS_URL in config.local.js');
            }

            const response = await fetch(`${functionsBaseUrl}/createCheckoutSession`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                mode: 'cors', // Assicura che la richiesta sia CORS
                body: JSON.stringify({
                    priceId: priceId,
                    userId: currentUser.uid,
                    userEmail: currentUser.email,
                    successUrl: window.location.origin + window.location.pathname + '?session_id={CHECKOUT_SESSION_ID}',
                    cancelUrl: window.location.href
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Errore durante la creazione della sessione.');
            }

            const session = await response.json();

            if (session.id) {
                // Reindirizzamento a Stripe Checkout
                const result = await stripe.redirectToCheckout({
                    sessionId: session.id,
                });

                if (result.error) {
                    throw new Error(result.error.message);
                }
            } else {
                throw new Error('Impossibile creare la sessione di pagamento.');
            }

        } catch (error) {
            console.error('Checkout error:', error);
            if (window.showErrorToast) {
                window.showErrorToast('Errore durante l\'avvio del pagamento: ' + error.message);
            }
        } finally {
            if (window.LoadingManager) {
                window.LoadingManager.hide();
            }
        }
    }

    // Check for success redirect
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');
    if (sessionId) {
        showSuccessStep();
    }

    function showSuccessStep() {
        selectionContainer.style.display = 'none';
        successContainer.style.display = 'flex';
        
        if (window.showSuccessToast) {
            window.showSuccessToast('Pagamento completato con successo!');
        }
    }

    goHomeBtn.addEventListener('click', () => {
        window.location.href = '../lista_schede/lista_scheda.html';
    });
});