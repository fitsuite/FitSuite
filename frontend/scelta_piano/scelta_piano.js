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
    const elements = stripe.elements();
    
    // Custom styling for Stripe Elements
    const style = {
        base: {
            color: '#ffffff',
            fontFamily: '"Segoe UI", Roboto, sans-serif',
            fontSmoothing: 'antialiased',
            fontSize: '16px',
            '::placeholder': {
                color: '#888888'
            }
        },
        invalid: {
            color: '#ff4d4d',
            iconColor: '#ff4d4d'
        }
    };
    
    const card = elements.create('card', { style: style });
    card.mount('#card-element');
    
    // DOM Elements
    const selectionContainer = document.getElementById('selection-container');
    const paymentContainer = document.getElementById('payment-container');
    const successContainer = document.getElementById('success-container');
    const paymentForm = document.getElementById('payment-form');
    const selectedPlanText = document.getElementById('selected-plan-text');
    const submitBtn = document.getElementById('submit-payment');
    const backBtn = document.getElementById('back-to-plans');
    const goHomeBtn = document.getElementById('go-home-btn');
    const cardErrors = document.getElementById('card-errors');
    const spinner = document.getElementById('spinner');
    const buttonText = document.getElementById('button-text');
    
    let selectedPlan = null;
    let currentUser = null;

    // Check Authentication
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
        } else {
            // auth_guard should handle this, but as a fallback:
            window.location.href = '../auth/auth.html';
        }
    });

    // Plan Selection Buttons
    const planButtons = document.querySelectorAll('.pricing-btn[data-plan-id]');
    planButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            selectedPlan = btn.getAttribute('data-plan-id');
            showPaymentStep(selectedPlan);
        });
    });

    // Step Navigation
    function showPaymentStep(planId) {
        const planName = planId.toUpperCase();
        selectedPlanText.innerHTML = `Stai acquistando il piano <strong>${planName}</strong>`;
        
        selectionContainer.style.display = 'none';
        paymentContainer.style.display = 'flex';
        
        // Clear any previous errors
        cardErrors.textContent = '';
    }

    backBtn.addEventListener('click', () => {
        paymentContainer.style.display = 'none';
        selectionContainer.style.display = 'block';
        selectedPlan = null;
    });

    // Payment Form Submission
    paymentForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        
        if (!selectedPlan || !currentUser) return;
        
        setLoading(true);
        
        // In a real app, you would first call your backend to create a PaymentIntent
        // and get a client_secret. Since we are doing a frontend-only flow for this task:
        
        const { token, error } = await stripe.createToken(card);
        
        if (error) {
            cardErrors.textContent = error.message;
            setLoading(false);
        } else {
            // Token created successfully!
            // Now we simulate the successful payment and update the database.
            // In a real app, you'd send 'token.id' to your server to process the charge.
            
            console.log('Stripe Token created:', token.id);
            
            try {
                await updateUserDataAfterPayment(selectedPlan);
                showSuccessStep();
            } catch (err) {
                console.error('Error updating database:', err);
                cardErrors.textContent = 'Errore durante l\'aggiornamento del profilo. Contatta l\'assistenza.';
                setLoading(false);
            }
        }
    });

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
        paymentContainer.style.display = 'none';
        successContainer.style.display = 'flex';
        
        if (window.showSuccessToast) {
            window.showSuccessToast('Abbonamento attivato con successo!');
        }
    }

    goHomeBtn.addEventListener('click', () => {
        window.location.href = '../lista_schede/lista_scheda.html';
    });

    function setLoading(isLoading) {
        if (isLoading) {
            submitBtn.disabled = true;
            spinner.classList.remove('hidden');
            buttonText.textContent = 'Elaborazione...';
        } else {
            submitBtn.disabled = false;
            spinner.classList.add('hidden');
            buttonText.textContent = 'Paga ora';
        }
    }
    
    // Listen for card changes to show errors immediately
    card.on('change', (event) => {
        if (event.error) {
            cardErrors.textContent = event.error.message;
        } else {
            cardErrors.textContent = '';
        }
    });
});