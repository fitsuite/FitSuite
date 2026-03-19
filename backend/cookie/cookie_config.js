// backend/cookie/cookie_config.js

/**
 * Configurazione dei cookie per FitSuite
 * Conforme alle linee guida del Garante della Privacy (Italia) 2021.
 */

export const COOKIE_CATEGORIES = {
    NECESSARY: {
        id: 'necessary',
        label: 'Tecnici (Necessari)',
        description: 'Questi cookie sono indispensabili per il corretto funzionamento del sito, la sicurezza e il salvataggio delle tue preferenze (come il tema o la lingua). Non possono essere disattivati.',
        required: true,
        default: true
    },
    ANALYTICS: {
        id: 'analytics',
        label: 'Statistici (Analytics)',
        description: 'Ci aiutano a capire come i visitatori interagiscono con il sito, raccogliendo e trasmettendo informazioni in forma anonima per migliorare le prestazioni.',
        required: false,
        default: false
    },
    MARKETING: {
        id: 'marketing',
        label: 'Marketing e Profilazione',
        description: 'Vengono utilizzati per tracciare i visitatori sui siti web. L\'intento è quello di mostrare annunci pertinenti e coinvolgenti per il singolo utente.',
        required: false,
        default: false
    }
};

export const CONSENT_COOKIE_NAME = 'fitsuite_cookie_consent';
export const CONSENT_EXPIRY_DAYS = 180; // 6 mesi come raccomandato dal Garante
