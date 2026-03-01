// Default configuration - OVERRIDE with config.local.js
if (typeof window.CONFIG === 'undefined') {
    window.CONFIG = {
        FIREBASE: {
            apiKey: "PLACEHOLDER - SET IN config.local.js",
            authDomain: "fitsuite-a7b6c.firebaseapp.com",
            projectId: "fitsuite-a7b6c",
            storageBucket: "fitsuite-a7b6c.firebasestorage.app",
            messagingSenderId: "721614273457",
            appId: "1:721614273457:web:195f48279fafd01a1f5b90",
            measurementId: "G-W4ME455MH5"
        },
        GEMINI: {
            API_KEY: "PLACEHOLDER - SET IN config.local.js"
        }
    };
}
