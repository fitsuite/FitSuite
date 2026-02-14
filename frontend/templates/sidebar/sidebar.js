document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.firestore();

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
        const hex = colorMap[colorName] || colorMap['Arancione'];
        const gradient = gradientMap[colorName] || gradientMap['Arancione'];
        document.documentElement.style.setProperty('--primary-color', hex);
        document.documentElement.style.setProperty('--background-gradient', gradient);
    }

    // Check Auth State and populate sidebar
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            console.log('User is signed in for sidebar:', user.email);
            
            // Fetch user preferences and apply theme
            try {
                const userDoc = await db.collection('users').doc(user.uid).get();
                if (userDoc.exists) {
                    const data = userDoc.data();
                    if (data.preferences && data.preferences.color) {
                        setPrimaryColor(data.preferences.color);
                    } else {
                        setPrimaryColor('Arancione');
                    }
                } else {
                    setPrimaryColor('Arancione');
                }
            } catch (error) {
                console.error("Error fetching user preferences for theme:", error);
                setPrimaryColor('Arancione');
            }

            // Function to update sidebar elements
            const updateSidebar = () => {
                const userInitialSidebar = document.getElementById('user-initial-sidebar');
                const userRoutineListSidebar = document.getElementById('user-routine-list-sidebar');
                const userEmailSidebar = document.getElementById('user-email-sidebar');

                if (userEmailSidebar) {
                    userEmailSidebar.textContent = user.email.split('@')[0];
                }
                
                if (userInitialSidebar) {
                    const initial = (user.displayName || user.email).charAt(0).toUpperCase();
                    userInitialSidebar.textContent = initial;
                }

                if (userRoutineListSidebar) {
                    fetchUserRoutines(user.uid, userRoutineListSidebar);
                } else {
                    // If sidebar not loaded yet, try again in 100ms
                    setTimeout(updateSidebar, 100);
                }
            };

            updateSidebar();
        } else {
            console.log('No user signed in, redirecting to login...');
            window.location.href = '../auth/auth.html';
        }
    });


    // Fetch User Routines
    async function fetchUserRoutines(uid, container) {
        container.innerHTML = ''; // Clear existing routines

        try {
            const routinesSnapshot = await db.collection('routines')
                                             .where('userId', '==', uid)
                                             .orderBy('createdAt', 'desc')
                                             .get();

                if (routinesSnapshot.empty) {
                const noRoutinesItem = document.createElement('li');
                noRoutinesItem.textContent = 'Nessuna scheda creata.';
                noRoutinesItem.style.fontStyle = 'italic';
                noRoutinesItem.style.color = '#888';
                container.appendChild(noRoutinesItem);
            } else {
                routinesSnapshot.forEach(doc => {
                    const routine = doc.data();
                    const routineItem = document.createElement('li');
                    routineItem.textContent = routine.name || 'Scheda senza nome';
                    routineItem.classList.add('routine-item'); // Add a class for styling
                    routineItem.dataset.routineId = doc.id; // Store routine ID

                    routineItem.addEventListener('click', () => {
                        window.location.href = `../visualizza_scheda/visualizza_scheda.html?id=${doc.id}`;
                    });
                    container.appendChild(routineItem);
                });
            }
        } catch (error) {
            console.error("Error fetching user routines for sidebar:", error);
            const errorItem = document.createElement('li');
            errorItem.textContent = 'Errore nel caricamento delle schede.';
            errorItem.style.color = 'red';
            container.appendChild(errorItem);
        }
    }
});