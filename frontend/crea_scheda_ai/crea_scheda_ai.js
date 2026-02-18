document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('ai-workout-form');
    const loadingScreen = document.getElementById('loading-screen');
    const auth = firebase.auth();
    const db = firebase.firestore();

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

    function setPrimaryColor(colorName) {
        const hex = colorMap[colorName] || colorMap['Arancione'];
        const gradient = gradientMap[colorName] || gradientMap['Arancione'];
        document.documentElement.style.setProperty('--primary-color', hex);
        document.documentElement.style.setProperty('--background-gradient', gradient);
    }

    // Helper to wait for sidebar
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

    // --- Authentication & Initialization ---
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            try {
                await Promise.all([
                    loadUserPreferences(user.uid),
                    waitForSidebar()
                ]);
            } catch (error) {
                console.error("Error during initialization:", error);
            } finally {
                if (loadingScreen) loadingScreen.style.display = 'none';
            }
        } else {
            window.location.href = '../auth/auth.html';
        }
    });

    async function loadUserPreferences(uid) {
        try {
            const doc = await db.collection('users').doc(uid).get();
            if (doc.exists) {
                const data = doc.data();
                if (data.preferences && data.preferences.color) {
                    setPrimaryColor(data.preferences.color);
                }
            }
        } catch (error) {
            console.error("Error loading preferences:", error);
        }
    }
    
    // Update range value display
    const daysRange = document.getElementById('giorni');
    const daysVal = document.getElementById('giorni-val');
    
    if (daysRange && daysVal) {
        daysRange.addEventListener('input', (e) => {
            daysVal.textContent = e.target.value;
        });
    }

    // Handle form submission
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Gather form data
            const formData = new FormData(form);
            const data = {};
            
            // Handle checkboxes specifically for arrays
            const equipment = [];
            const focus = [];
            
            for (let [key, value] of formData.entries()) {
                if (key === 'attrezzatura') {
                    equipment.push(value);
                } else if (key === 'focus') {
                    focus.push(value);
                } else {
                    data[key] = value;
                }
            }
            
            data.attrezzatura = equipment;
            data.focus = focus;

            console.log("Form Data Collected:", data);

            // Validation
            if (data.focus.length === 0) {
                alert("Seleziona almeno un focus muscolare o 'Full Body'.");
                return;
            }
            
            if (data.attrezzatura.length === 0) {
                alert("Seleziona almeno un tipo di attrezzatura.");
                return;
            }

            // TODO: Construct prompt and call AI API
            alert("Funzionalità AI in arrivo! I dati sono stati raccolti correttamete.");
            
            // Future implementation:
            // 1. Send data to AI endpoint
            // 2. Receive JSON response
            // 3. Save JSON to localStorage or pass to crea_scheda.html
            // 4. window.location.href = '../crea_scheda/crea_scheda.html?from_ai=true';
        });
    }
});
