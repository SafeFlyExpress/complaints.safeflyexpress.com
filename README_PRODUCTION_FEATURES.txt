SAFE FLY EXPRESS PORTAL - PRODUCTION FEATURES VERSION

NEW FEATURES INCLUDED
1. Email notification record for ma.sebaei@safeflyexpress.com
2. Reference search in admin dashboard
3. Status history / audit trail
4. Student complaint status lookup
5. Admin internal comments
6. Professional reference numbers like SFEX-2026-000001

UPLOAD TO GITHUB PAGES
Upload:
- index.html
- app.js
- manifest.json

IMPORTANT FIREBASE RULES
Because this version uses counters and mail records, update Firestore Rules:

rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    match /complaints/{document} {
      allow create: if true;
      allow read: if true;
      allow update: if request.auth != null;
      allow delete: if false;
    }

    match /counters/{document} {
      allow read, write: if true;
    }

    match /mail/{document} {
      allow create: if true;
      allow read, update, delete: if false;
    }
  }
}

EMAIL NOTIFICATIONS
This app creates documents in the Firestore collection named "mail".
To actually send emails, install Firebase Extension:
- Trigger Email from Firestore
- Collection: mail
- Recipient field: to
- Message field: message

Send-to address is already set to:
ma.sebaei@safeflyexpress.com

NOTE
Until the Firebase Email extension is installed, the system will save notification requests but will not send real emails.
