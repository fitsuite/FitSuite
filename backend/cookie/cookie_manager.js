/**
 * FitSuite Cookie Manager
 * Conforme alle normative italiane (GDPR e Garante della Privacy 2021).
 * Gestisce il consenso e il settaggio dei cookie in modo granulare.
 */

const CookieManager = {
    // Nome del cookie per il consenso
    CONSENT_COOKIE_NAME: 'fitsuite_cookie_consent',
    CONSENT_EXPIRY_DAYS: 180, // 6 mesi (come raccomandato dal Garante)

    // Definizioni delle categorie
    CATEGORIES: {
        NECESSARY: 'necessary',
        PREFERENCES: 'preferences',
        ANALYTICS: 'analytics',
        MARKETING: 'marketing'
    },

    /**
     * Inizializza il gestore dei cookie
     */
    init: function() {
        console.log('CookieManager: Inizializzato');
        this.checkConsent();
    },

    /**
     * Imposta un cookie
     * @param {string} name Nome del cookie
     * @param {string} value Valore del cookie
     * @param {number} days Durata in giorni
     * @param {string} category Categoria del cookie (default: 'necessary')
     */
    setCookie: function(name, value, days, category = 'necessary') {
        // Verifica il consenso prima di impostare cookie non necessari
        if (category !== this.CATEGORIES.NECESSARY && !this.hasConsent(category)) {
            console.warn(`CookieManager: Impossibile impostare il cookie "${name}" perché non c'è il consenso per la categoria "${category}".`);
            return false;
        }

        let expires = "";
        if (days) {
            const date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            expires = "; expires=" + date.toUTCString();
        }
        
        // Determina il path corretto (essenziale per GitHub Pages o sottocartelle)
        // Se siamo su GitHub Pages, il path è "/FitSuite/", non "/"
        const currentPath = window.location.pathname.includes('/FitSuite/') ? '/FitSuite/' : '/';
        
        // Impostazioni di sicurezza: SameSite=Lax e Secure (se su HTTPS)
        const secure = window.location.protocol === 'https:' ? '; Secure' : '';
        
        document.cookie = `${name}=${value || ""}${expires}; path=${currentPath}; SameSite=Lax${secure}`;
        
        console.log(`CookieManager: Cookie "${name}" impostato con path "${currentPath}".`);
        return true;
    },

    /**
     * Ottiene il valore di un cookie
     * @param {string} name Nome del cookie
     */
    getCookie: function(name) {
        const nameEQ = name + "=";
        const ca = document.cookie.split(';');
        for (let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) === ' ') c = c.substring(1, c.length);
            if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
        }
        return null;
    },

    /**
     * Elimina un cookie
     * @param {string} name Nome del cookie
     */
    deleteCookie: function(name) {
        const currentPath = window.location.pathname.includes('/FitSuite/') ? '/FitSuite/' : '/';
        document.cookie = name + '=; Path=' + currentPath + '; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    },

    /**
     * Verifica se è stato dato il consenso per una categoria
     * @param {string} category Categoria da controllare
     */
    hasConsent: function(category) {
        if (category === this.CATEGORIES.NECESSARY) return true;
        
        const consent = this.getConsentState();
        if (!consent) return false;
        
        return !!consent[category];
    },

    /**
     * Ottiene lo stato attuale del consenso
     */
    getConsentState: function() {
        const consentJson = this.getCookie(this.CONSENT_COOKIE_NAME);
        if (!consentJson) return null;
        
        try {
            return JSON.parse(decodeURIComponent(consentJson));
        } catch (e) {
            console.error('CookieManager: Errore nel parsing del consenso', e);
            return null;
        }
    },

    /**
     * Salva le preferenze di consenso dell'utente
     * @param {Object} preferences Oggetto con le preferenze { analytics: true, ... }
     */
    saveConsent: function(preferences) {
        const consent = {
            necessary: true, // Sempre true
            preferences: !!preferences.preferences,
            analytics: !!preferences.analytics,
            marketing: !!preferences.marketing,
            timestamp: new Date().toISOString(),
            version: '1.0' // Utile per futuri aggiornamenti della policy
        };

        const consentValue = encodeURIComponent(JSON.stringify(consent));
        this.setCookie(this.CONSENT_COOKIE_NAME, consentValue, this.CONSENT_EXPIRY_DAYS, this.CATEGORIES.NECESSARY);
        
        // Gestisci il flag di disabilitazione GA in base al nuovo consenso
        const measurementId = 'G-W4ME455MH5';
        window['ga-disable-' + measurementId] = !consent.analytics;
        
        // Gestisci AdSense: se marketing è false, chiedi annunci non personalizzati
        window.adsbygoogle = window.adsbygoogle || [];
        window.adsbygoogle.requestNonPersonalizedAds = consent.marketing ? 0 : 1;
        
        // Trigger evento per notificare il cambiamento del consenso
        window.dispatchEvent(new CustomEvent('cookieConsentChanged', { detail: consent }));
        
        // Esegui i callback registrati per le categorie accettate
        this.triggerCallbacks(consent);
        
        // Se il consenso per certe categorie è stato rimosso, pulisci i cookie relativi
        this.cleanupCookies(consent);
    },

    /**
     * Registro dei callback per il consenso
     */
    callbacks: [],

    /**
     * Registra un callback da eseguire quando viene dato il consenso per una categoria
     * @param {string} category Categoria del cookie
     * @param {function} callback Funzione da eseguire
     */
    onConsent: function(category, callback) {
        if (this.hasConsent(category)) {
            callback();
        } else {
            this.callbacks.push({ category, callback });
        }
    },

    /**
     * Esegue i callback registrati se il consenso è presente
     * @param {Object} consent Stato attuale del consenso
     */
    triggerCallbacks: function(consent) {
        this.callbacks = this.callbacks.filter(item => {
            if (consent[item.category]) {
                try {
                    item.callback();
                } catch (e) {
                    console.error('CookieManager: Errore nell\'esecuzione del callback', e);
                }
                return false; // Rimuovi dai pendenti
            }
            return true; // Mantieni se non ancora autorizzato
        });
    },

    /**
     * Rimuove i cookie delle categorie non autorizzate
     * @param {Object} consent Stato attuale del consenso
     */
    cleanupCookies: function(consent) {
        // Se analytics è false, pulisci i cookie di Google Analytics
        if (!consent.analytics) {
            const gaCookies = ['_ga', '_gid', '_gat'];
            // Cerca anche i cookie _ga_XXXXXX
            const allCookies = document.cookie.split(';');
            allCookies.forEach(cookie => {
                const name = cookie.split('=')[0].trim();
                if (gaCookies.includes(name) || name.startsWith('_ga_')) {
                    this.deleteCookie(name);
                    // Prova a cancellare anche per il dominio principale se siamo su sottodominio
                    const domain = window.location.hostname;
                    const currentPath = window.location.pathname.includes('/FitSuite/') ? '/FitSuite/' : '/';
                    document.cookie = name + '=; Path=' + currentPath + '; Domain=' + domain + '; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
                    const parts = domain.split('.');
                    if (parts.length > 2) {
                        const rootDomain = parts.slice(-2).join('.');
                        document.cookie = name + '=; Path=' + currentPath + '; Domain=.' + rootDomain + '; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
                    }
                }
            });
            console.log('CookieManager: Pulizia cookie analytics completata');
        }

        // Se marketing è false, pulisci eventuali cookie pubblicitari noti
        if (!consent.marketing) {
            const marketingCookies = ['__gads', '__gpi', '_gcl_au'];
            marketingCookies.forEach(name => this.deleteCookie(name));
            console.log('CookieManager: Pulizia cookie marketing completata');
        }
    },

    /**
     * Resetta il consenso (es. per il pulsante "Revoca consenso")
     */
    revokeConsent: function() {
        this.deleteCookie(this.CONSENT_COOKIE_NAME);
        location.reload(); // Ricarica per resettare lo stato degli script
    },

    /**
     * Controlla se mostrare il banner
     */
    checkConsent: function() {
        const consent = this.getConsentState();
        if (!consent) {
            // Il banner deve essere mostrato (gestito dalla UI)
            return false;
        }
        return true;
    }
};

// Inizializzazione globale
window.CookieManager = CookieManager;

// Impostazioni di default immediate per la privacy (prima del caricamento di altri script)
(function() {
    const measurementId = 'G-W4ME455MH5';
    // Disabilita GA di default
    window['ga-disable-' + measurementId] = true;
    // Imposta AdSense su NON personalizzato di default
    window.adsbygoogle = window.adsbygoogle || [];
    window.adsbygoogle.requestNonPersonalizedAds = 1;

    // Se esiste già un consenso, applicalo subito
    const consent = CookieManager.getConsentState();
    if (consent) {
        if (consent.analytics) window['ga-disable-' + measurementId] = false;
        if (consent.marketing) window.adsbygoogle.requestNonPersonalizedAds = 0;
    }
})();

document.addEventListener('DOMContentLoaded', () => CookieManager.init());
