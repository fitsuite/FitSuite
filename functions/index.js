const {onCall} = require("firebase-functions/v2/https");
const {setGlobalOptions} = require("firebase-functions");
const {onRequest} = require("firebase-functions/https");
const logger = require("firebase-functions/logger");
const nodemailer = require("nodemailer");

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({ maxInstances: 10 });

// Configurazione Nodemailer
// NOTA: Dovresti usare variabili d'ambiente per questi valori in produzione
// firebase functions:config:set email.user="latuaemail@gmail.com" email.pass="latuapassword"
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || "fitsuite.app@gmail.com",
        pass: process.env.EMAIL_PASS || "vostra-password-app"
    }
});

// Importa le funzioni di generazione routine
const { generateWorkoutRoutine, testGeminiConnection } = require("./generateRoutine");

// Esporta le funzioni
exports.generateWorkoutRoutine = generateWorkoutRoutine;
exports.testGeminiConnection = testGeminiConnection;

// Funzione per inviare l'email di verifica
exports.sendVerificationEmail = onCall(async (request) => {
    const { email, code } = request.data;
    
    if (!email || !code) {
        throw new Error("Email e codice sono richiesti");
    }

    const mailOptions = {
        from: '"FitSuite" <fitsuite.app@gmail.com>',
        to: email,
        subject: 'Codice di verifica FitSuite',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                <h2 style="color: #ff6600; text-align: center;">Benvenuto su FitSuite!</h2>
                <p>Grazie per esserti registrato. Per completare la creazione del tuo account, inserisci il seguente codice di verifica nell'app:</p>
                <div style="background-color: #f4f4f4; padding: 15px; text-align: center; border-radius: 5px; margin: 20px 0;">
                    <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #333;">${code}</span>
                </div>
                <p>Il codice scadrà tra 15 minuti.</p>
                <p>Se non hai richiesto questo codice, puoi ignorare questa email.</p>
                <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="font-size: 12px; color: #888; text-align: center;">© 2025 FitSuite - Il primo servizio di creazione schede totalmente gratuito</p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        logger.info(`Email di verifica inviata con successo a ${email}`);
        return { success: true };
    } catch (error) {
        logger.error(`Errore nell'invio dell'email a ${email}:`, error);
        throw new Error("Errore nell'invio dell'email");
    }
});

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });
