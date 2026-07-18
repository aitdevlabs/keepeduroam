// ============================================================
// KeepEduroam - Send Contact Emails (Debug Version)
// ============================================================

const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

console.log('🔍 Debug: Starting script...');

// Check if secret exists
const secret = process.env.FIREBASE_SERVICE_ACCOUNT;
console.log(`📌 FIREBASE_SERVICE_ACCOUNT exists: ${!!secret}`);
console.log(`📌 FIREBASE_SERVICE_ACCOUNT length: ${secret?.length || 0}`);

if (!secret || secret.length < 10) {
  console.error('❌ FIREBASE_SERVICE_ACCOUNT secret is missing or too short!');
  process.exit(1);
}

// Try to parse JSON
let serviceAccount;
try {
  serviceAccount = JSON.parse(secret);
  console.log('✅ JSON parsed successfully!');
  console.log(`📌 Project ID: ${serviceAccount.project_id || 'missing'}`);
  console.log(`📌 Client Email: ${serviceAccount.client_email || 'missing'}`);
} catch (error) {
  console.error('❌ Failed to parse JSON:', error.message);
  console.error('📌 Secret starts with:', secret.substring(0, 50) + '...');
  process.exit(1);
}

// Initialize Firebase
try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log('✅ Firebase initialized successfully!');
} catch (error) {
  console.error('❌ Firebase init failed:', error.message);
  process.exit(1);
}

const db = admin.firestore();

// Email setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

const SUPPORT_EMAIL = process.env.EMAIL_USER;

async function sendEmails() {
  console.log('🔍 Checking for new contacts...');

  try {
    const snapshot = await db.collection('contacts')
      .where('sent', '!=', true)
      .limit(50)
      .get();

    if (snapshot.empty) {
      console.log('✅ No new contacts to send.');
      return;
    }

    console.log(`📬 Found ${snapshot.size} new contact(s).`);

    let sentCount = 0;
    let errorCount = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const docId = doc.id;
      const userEmail = data.email;
      const userName = data.name || 'Anonymous';
      const category = data.category || 'General';
      const message = data.message || 'No message';

      console.log(`📧 Forwarding message from: ${userEmail}`);

      try {
        await transporter.sendMail({
          from: userEmail,
          to: SUPPORT_EMAIL,
          replyTo: userEmail,
          subject: `📬 New Contact: ${category} - from ${userName}`,
          html: `
            <html>
            <body style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #0A0E1A; color: #ECF0F1;">
              <div style="background: #1A2035; padding: 24px; border-radius: 12px; border: 1px solid #2D3748;">
                <h1 style="color: #4ECDC4; margin-top: 0;">📬 New Contact Form Submission</h1>
                <hr style="border: 1px solid #2D3748;">
                <p><strong style="color: #95A5A6;">From:</strong> ${userName}</p>
                <p><strong style="color: #95A5A6;">Email:</strong> <a href="mailto:${userEmail}" style="color: #4ECDC4;">${userEmail}</a></p>
                <p><strong style="color: #95A5A6;">Category:</strong> <span style="background: #4ECDC4; color: #0A0E1A; padding: 4px 12px; border-radius: 20px; font-weight: bold;">${category}</span></p>
                <p><strong style="color: #95A5A6;">Message:</strong></p>
                <div style="background: #0A0E1A; padding: 16px; border-radius: 8px; border: 1px solid #2D3748;">
                  <p style="color: #ECF0F1; margin: 0; white-space: pre-wrap;">${message}</p>
                </div>
                <hr style="border: 1px solid #2D3748; margin-top: 20px;">
                <p style="color: #95A5A6; font-size: 12px;">
                  <strong>💡 Reply to this email</strong> to respond directly to ${userName}
                </p>
                <p style="color: #95A5A6; font-size: 12px;">
                  <a href="https://console.firebase.google.com/project/keepeduroam/firestore/data/contacts/${docId}" style="color: #4ECDC4;">
                    View in Firebase Console
                  </a>
                </p>
              </div>
            </body>
            </html>
          `
        });

        await doc.ref.update({
          sent: true,
          sentAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`✅ Forwarded message from: ${userEmail}`);
        sentCount++;

      } catch (error) {
        console.error(`❌ Failed to forward from ${userEmail}:`, error.message);
        errorCount++;
      }
    }

    console.log(`\n📊 Summary: ${sentCount} forwarded, ${errorCount} failed`);

  } catch (error) {
    console.error('❌ Error querying Firestore:', error.message);
    process.exit(1);
  }
}

sendEmails()
  .then(() => {
    console.log('✅ Job complete.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
