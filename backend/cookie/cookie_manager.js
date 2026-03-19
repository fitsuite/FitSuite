/**
 * FitSuite Cookie Manager
 * Conforme alle normative italiane (GDPR e Garante della Privacy 2021).
 * Gestisce il consenso e il settaggio dei cookie in modo granulare.
 */

// 1. Inizializza dataLayer e gtag immediatamente
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;

const CookieManager = {
    // Nome del cookie per il consenso
    CONSENT_COOKIE_NAME: 'fitsuite_cookie_consent',
    CONSENT_EXPIRY_DAYS: 180, // 6 mesi (come raccomandato dal Garante)

    // ID degli strumenti di terze parti
    MEASUREMENT_ID: 'G-W4ME455MH5',
    ADSENSE_CLIENT_ID: 'ca-pub-7857800406057346',
    FB_PIXEL_ID: 'YOUR_PIXEL_ID', // Da configurare se necessario
    CLARITY_ID: 'YOUR_CLARITY_ID', // Da configurare se necessario

    // Definizioni delle categorie
    CATEGORIES: {
        NECESSARY: 'necessary',
        PREFERENCES: 'preferences',
        ANALYTICS: 'analytics',
        MARKETING: 'marketing'
    },

    /**
     * Inizializza il gestore dei cookie e Google Consent Mode v2
     */
    init: function() {
        console.log('CookieManager: Inizializzato');
        
        // 2. Recupera lo stato del consenso esistente
        const consent = this.getConsentState();
        
        // 3. Imposta lo stato di default (Basic Consent Mode)
        // Se non c'è consenso, tutto è 'denied' tranne i necessari
        const defaultConsent = {
            'ad_storage': consent && consent.marketing ? 'granted' : 'denied',
            'ad_user_data': consent && consent.marketing ? 'granted' : 'denied',
            'ad_personalization': consent && consent.marketing ? 'granted' : 'denied',
            'analytics_storage': consent && consent.analytics ? 'granted' : 'denied',
            'functionality_storage': consent && consent.preferences ? 'granted' : 'denied',
            'personalization_storage': consent && consent.preferences ? 'granted' : 'denied',
            'security_storage': 'granted', // Sempre attivo
            'wait_for_update': 500
        };

        gtag('consent', 'default', defaultConsent);
        
        // 4. Se abbiamo già il consenso, carichiamo gli script necessari
        if (consent) {
            this.updateThirdPartyTools(consent);
        }

        this.checkConsent();
    },

    /**
     * Carica condizionalmente o DISATTIVA gli script di terze parti
     * @param {Object} consent Stato attuale del consenso
     */
    updateThirdPartyTools: function(consent) {
        console.log('CookieManager: Aggiornamento strumenti di terze parti', consent);

        // Google Consent Mode v2 Update
        if (window.gtag) {
            gtag('consent', 'update', {
                'ad_storage': consent.marketing ? 'granted' : 'denied',
                'ad_user_data': consent.marketing ? 'granted' : 'denied',
                'ad_personalization': consent.marketing ? 'granted' : 'denied',
                'analytics_storage': consent.analytics ? 'granted' : 'denied',
                'functionality_storage': consent.preferences ? 'granted' : 'denied',
                'personalization_storage': consent.preferences ? 'granted' : 'denied'
            });
        }

        // 1. GESTIONE ANALYTICS (GA4)
        const gaDisableKey = 'ga-disable-' + this.MEASUREMENT_ID;
        if (consent.analytics) {
            window[gaDisableKey] = false;
            this.loadGtag(this.MEASUREMENT_ID);
            // Microsoft Clarity
            if (this.CLARITY_ID !== 'YOUR_CLARITY_ID') {
                this.loadClarity(this.CLARITY_ID);
            }
        } else {
            // DISATTIVA GA4 immediatamente senza refresh
            window[gaDisableKey] = true;
            console.log('CookieManager: GA4 disattivato (ga-disable)');
        }

        // 2. GESTIONE MARKETING (Facebook Pixel, AdSense)
        if (consent.marketing) {
            // Consenso Facebook Pixel
            if (window.fbq) {
                fbq('consent', 'grant');
            }
            
            this.loadAdSense(this.ADSENSE_CLIENT_ID);
            if (this.FB_PIXEL_ID !== 'YOUR_PIXEL_ID') {
                this.loadFacebookPixel(this.FB_PIXEL_ID);
            }
            
            // AdSense personalizzato
            window.adsbygoogle = window.adsbygoogle || [];
            window.adsbygoogle.requestNonPersonalizedAds = 0;
        } else {
            // DISATTIVA Facebook Pixel immediatamente
            if (window.fbq) {
                fbq('consent', 'revoke');
                console.log('CookieManager: Facebook Pixel revocato');
            }
            
            // Forza AdSense su NON personalizzato
            window.adsbygoogle = window.adsbygoogle || [];
            window.adsbygoogle.requestNonPersonalizedAds = 1;
        }

        // 3. PULIZIA COOKIE E PREFERENZE (Sempre eseguita per sicurezza)
        this.cleanupCookies(consent);
        
        if (!consent.preferences) {
            this.cleanupPreferences();
        }
    },

    /**
     * Pulisce le preferenze locali se il consenso viene revocato
     */
    cleanupPreferences: function() {
        console.log('CookieManager: Pulizia preferenze locali...');
        // Rimuovi il tema globale salvato in CacheManager se presente
        if (window.CacheManager && window.CacheManager.GLOBAL_THEME_KEY) {
            localStorage.removeItem(window.CacheManager.GLOBAL_THEME_KEY);
        }
        
        // Se c'è un evento per resettare il tema ai valori predefiniti, lo lanciamo
        window.dispatchEvent(new CustomEvent('cookiePreferencesRevoked'));
    },

    /**
     * Carica lo script di Google AdSense
     */
    loadAdSense: function(client) {
        if (document.querySelector(`script[src*="adsbygoogle.js"]`)) return;
        
        const script = document.createElement('script');
        script.async = true;
        script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`;
        script.crossOrigin = "anonymous";
        document.head.appendChild(script);
    },

    /**
     * Carica lo script di Google Analytics 4
     */
    loadGtag: function(id) {
        if (document.querySelector(`script[src*="${id}"]`)) return;
        
        const script = document.createElement('script');
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
        document.head.appendChild(script);

        script.onload = () => {
            gtag('js', new Date());
            gtag('config', id, {
                'anonymize_ip': true,
                'cookie_flags': 'SameSite=Lax;Secure'
            });
        };
    },

    /**
     * Carica lo script di Facebook Pixel
     */
    loadFacebookPixel: function(id) {
        if (window.fbq && window.fbq.loaded) return;
        
        !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
        n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
        document,'script','https://connect.facebook.net/en_US/fbevents.js');
        
        fbq('consent', 'grant'); // Lo carichiamo perché abbiamo il consenso
        fbq('init', id);
        fbq('track', 'PageView');
    },

    /**
     * Carica lo script di Microsoft Clarity
     */
    loadClarity: function(id) {
        if (window.clarity) return;
        (function(c,l,a,r,i,t,y){
            c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
            t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
            y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
        })(window, document, "clarity", "script", id);
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
        console.log('CookieManager: Salvataggio preferenze...', preferences);
        
        const consent = {
            necessary: true,
            preferences: !!preferences.preferences,
            analytics: !!preferences.analytics,
            marketing: !!preferences.marketing,
            timestamp: new Date().toISOString(),
            version: '1.2'
        };

        // 1. Salva nel cookie
        const consentValue = encodeURIComponent(JSON.stringify(consent));
        this.setCookie(this.CONSENT_COOKIE_NAME, consentValue, this.CONSENT_EXPIRY_DAYS, this.CATEGORIES.NECESSARY);
        
        // 2. Applica immediatamente le modifiche agli strumenti (SENZA REFRESH)
        this.updateThirdPartyTools(consent);
        
        // 3. Notifica il sistema
        window.dispatchEvent(new CustomEvent('cookieConsentChanged', { detail: consent }));
        
        // 4. Esegui callback pendenti
        this.triggerCallbacks(consent);

        console.log('CookieManager: Preferenze salvate e applicate in tempo reale.');
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
     * Rimuove i cookie delle categorie non autorizzate in modo aggressivo
     * @param {Object} consent Stato attuale del consenso
     */
    cleanupCookies: function(consent) {
        const domains = [
            window.location.hostname,
            '.' + window.location.hostname,
            window.location.hostname.split('.').slice(-2).join('.'),
            '.' + window.location.hostname.split('.').slice(-2).join('.')
        ];
        const paths = [
            '/',
            window.location.pathname.includes('/FitSuite/') ? '/FitSuite/' : '/'
        ];

        const removeCookieEverywhere = (name) => {
            this.deleteCookie(name);
            domains.forEach(domain => {
                paths.forEach(path => {
                    document.cookie = `${name}=; Path=${path}; Domain=${domain}; Expires=Thu, 01 Jan 1970 00:00:01 GMT;`;
                });
            });
        };

        // 1. Pulizia Analytics (GA4)
        if (!consent.analytics) {
            const gaCookies = ['_ga', '_gid', '_gat'];
            const allCookies = document.cookie.split(';');
            allCookies.forEach(cookie => {
                const name = cookie.split('=')[0].trim();
                if (gaCookies.includes(name) || name.startsWith('_ga_')) {
                    removeCookieEverywhere(name);
                }
            });
            console.log('CookieManager: Cookie Analytics rimossi.');
        }

        // 2. Pulizia Marketing (Facebook, AdSense, etc)
        if (!consent.marketing) {
            const marketingCookies = [
                '__gads', '__gpi', '_gcl_au', '_fbp', 'fr', '_fbc', 
                'IDE', 'test_cookie', '_uetsid', '_uetvid'
            ];
            marketingCookies.forEach(name => removeCookieEverywhere(name));
            console.log('CookieManager: Cookie Marketing rimossi.');
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

// Esegui l'inizializzazione del Consent Mode il prima possibile
CookieManager.init();

// Inizializzazione della UI quando il DOM è pronto
const initializeUI = () => {
    if (window.CookieUI) {
        window.CookieUI.init();
    } else {
        // Riprova tra poco se CookieUI non è ancora caricato
        setTimeout(initializeUI, 100);
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeUI);
} else {
    initializeUI();
}
