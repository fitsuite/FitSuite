document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.firestore();

    // Check Auth State and populate sidebar
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            console.log('User is signed in for sidebar:', user.email);
            
            // Function to update sidebar elements
            const updateSidebar = () => {
                const userInitialSidebar = document.getElementById('user-initial-sidebar');
                const userRoutineListSidebar = document.getElementById('user-routine-list-sidebar');
                const userEmailSidebar = document.getElementById('user-email-sidebar');

                if (userEmailSidebar) {
                    userEmailSidebar.textContent = user.email;
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