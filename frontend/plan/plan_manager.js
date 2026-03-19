/**
 * PlanManager.js
 * Gestisce i limiti e i permessi in base al piano dell'utente.
 */

(function() {
    'use strict';

    const PLANS = {
        FREE: {
            id: 'free',
            label: 'Free',
            maxRoutines: 3,
            canChangeColor: false,
            hasAds: true,
            canShare: false,
            maxAIRoutines: 1,
            isMonthlyAI: false, // 1 totale per prova
            unlimitedSharedView: true
        },
        PRO: {
            id: 'pro',
            label: 'Pro',
            maxRoutines: 10,
            canChangeColor: true,
            hasAds: false,
            canShare: false,
            maxAIRoutines: 7,
            isMonthlyAI: true, // 7 al mese
            unlimitedSharedView: true
        },
        PT: {
            id: 'pt',
            label: 'PT',
            maxRoutines: 1000,
            canChangeColor: true,
            hasAds: false,
            canShare: true,
            maxAIRoutines: 100,
            isMonthlyAI: true, // 100 al mese
            unlimitedSharedView: true
        }
    };

    const PlanManager = {
        /**
         * Recupera il profilo utente dalla cache.
         */
        getUserProfile: function() {
            const currentUser = firebase.auth().currentUser;
            if (!currentUser) return null;
            
            const cachedProfile = localStorage.getItem(`userProfile_${currentUser.uid}`);
            return cachedProfile ? JSON.parse(cachedProfile) : null;
        },

        /**
         * Recupera il piano attuale dell'utente.
         */
        getCurrentPlan: function() {
            const profile = this.getUserProfile();
            if (!profile || !profile.subscription || !profile.subscription.plan) {
                return PLANS.FREE;
            }
            
            const planId = profile.subscription.plan.toLowerCase();
            if (planId === 'pro') return PLANS.PRO;
            if (planId === 'pt') return PLANS.PT;
            return PLANS.FREE;
        },

        /**
         * Verifica se l'utente può creare una nuova scheda.
         * @param {number} currentRoutinesCount Numero attuale di schede salvate.
         */
        canCreateRoutine: function(currentRoutinesCount) {
            const plan = this.getCurrentPlan();
            return currentRoutinesCount < plan.maxRoutines;
        },

        /**
         * Verifica se l'utente può cambiare il colore della scheda.
         */
        canChangeColor: function() {
            const plan = this.getCurrentPlan();
            return plan.canChangeColor;
        },

        /**
         * Verifica se l'utente deve vedere la pubblicità.
         */
        hasAds: function() {
            const plan = this.getCurrentPlan();
            return plan.hasAds;
        },

        /**
         * Applica la visibilità delle pubblicità in base al piano.
         */
        applyAdsVisibility: function() {
            const showAds = this.hasAds();
            const adsElements = document.querySelectorAll('.adsense-banner');
            adsElements.forEach(el => {
                el.style.display = showAds ? 'block' : 'none';
            });
        },

        /**
         * Aggiorna il badge del piano nella sidebar se presente.
         */
        updateSidebarPlanBadge: function() {
            const plan = this.getCurrentPlan();
            const badge = document.getElementById('user-plan-sidebar');
            if (badge) {
                badge.textContent = plan.label;
                badge.className = `user-plan-badge plan-${plan.id}`;
            }
        },

        /**
         * Verifica se l'utente può condividere schede.
         */
        canShare: function() {
            const plan = this.getCurrentPlan();
            return plan.canShare;
        },

        /**
         * Verifica se l'utente può generare una scheda con AI.
         */
        canUseAI: function() {
            const profile = this.getUserProfile();
            const plan = this.getCurrentPlan();
            
            if (!profile) return false;

            const usage = profile.ai_usage || { count: 0, lastReset: null };
            
            // Se è mensile, controlliamo se dobbiamo resettare
            if (plan.isMonthlyAI) {
                if (this._shouldResetAIUsage(usage.lastReset)) {
                    return true; // Sarà resettato al momento dell'uso
                }
                return usage.count < plan.maxAIRoutines;
            } else {
                // Per il piano Free è un totale di 1
                return usage.count < plan.maxAIRoutines;
            }
        },

        /**
         * Restituisce i limiti rimanenti per l'AI.
         */
        getAIRemaining: function() {
            const profile = this.getUserProfile();
            const plan = this.getCurrentPlan();
            if (!profile) return 0;

            const usage = profile.ai_usage || { count: 0, lastReset: null };
            
            if (plan.isMonthlyAI && this._shouldResetAIUsage(usage.lastReset)) {
                return plan.maxAIRoutines;
            }
            
            return Math.max(0, plan.maxAIRoutines - usage.count);
        },

        /**
         * Mostra il popup Pro se un limite è stato raggiunto.
         */
        showProPopup: function(reason = '') {
            if (window.showPremiumPopup) {
                window.showPremiumPopup(reason);
            } else {
                console.warn('Popup Pro non caricato.');
                // Fallback a un messaggio generico se il modulo non è pronto
                if (window.showErrorToast) {
                    window.showErrorToast(`Hai raggiunto il limite del tuo piano ${this.getCurrentPlan().label}. Passa a Pro per sbloccare questa funzione!`);
                }
            }
        },

        /**
         * Helper interno per verificare se il contatore AI mensile deve essere resettato.
         */
        _shouldResetAIUsage: function(lastResetValue) {
            if (!lastResetValue) return true;
            
            let lastReset;
            if (typeof lastResetValue === 'string') {
                lastReset = new Date(lastResetValue);
            } else if (lastResetValue.toDate) {
                lastReset = lastResetValue.toDate();
            } else if (lastResetValue.seconds) {
                lastReset = new Date(lastResetValue.seconds * 1000);
            } else {
                lastReset = new Date(lastResetValue);
            }

            const now = new Date();
            
            return lastReset.getMonth() !== now.getMonth() || lastReset.getFullYear() !== now.getFullYear();
        }
    };

    // Esponi globalmente
    window.PlanManager = PlanManager;
    window.PLANS = PLANS;
})();
