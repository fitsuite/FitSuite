// Script to update existing user with username "Kevinck8"
// This should be run once to update the database

const firebaseConfig = {
    apiKey: "AIzaSyCEgbB9rBBKOov3aDma0DMn-EuU0bGMMYo",
    authDomain: "fitsuite-a7b6c.firebaseapp.com",
    projectId: "fitsuite-a7b6c",
    storageBucket: "fitsuite-a7b6c.firebasestorage.app",
    messagingSenderId: "721614273457",
    appId: "1:721614273457:web:195f48279fafd01a1f5b90",
    measurementId: "G-W4ME455MH5"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Update current user with username Kevinck8
auth.onAuthStateChanged(async (user) => {
    if (user) {
        try {
            console.log("Updating user:", user.uid);
            
            // Update the user document with username
            await db.collection('users').doc(user.uid).update({
                username: "Kevinck8"
            });
            
            console.log("Username updated successfully to Kevinck8");
            
            // Clear any cached profile to force refresh
            localStorage.removeItem(`userProfile_${user.uid}`);
            
            console.log("Cache cleared. Please refresh the settings page.");
            
        } catch (error) {
            if (error.code === 'not-found') {
                // Document doesn't exist, create it
                console.log("User document not found, creating new one...");
                const newData = {
                    email: user.email,
                    username: "Kevinck8",
                    phoneNumber: "",
                    preferences: {
                        color: "Arancione",
                        language: "Italiano",
                        notifications: "Consenti tutti"
                    },
                    subscription: {
                        type: "Nessuno",
                        startDate: null,
                        endDate: null,
                        status: "inactive",
                        autoRenew: false,
                        lastPaymentDate: null,
                        nextPaymentDate: null,
                        paymentMethod: "Non impostato"
                    },
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                
                await db.collection('users').doc(user.uid).set(newData);
                console.log("New user document created with username Kevinck8");
            } else {
                console.error("Error updating username:", error);
            }
        }
    } else {
        console.log("No user is signed in. Please login first.");
    }
});
