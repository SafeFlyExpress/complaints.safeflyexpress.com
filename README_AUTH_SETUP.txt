SAFE FLY EXPRESS PORTAL - FIREBASE AUTH VERSION

This version removes the simple admin PIN and uses Firebase Email/Password Authentication.

WHAT TO DO IN FIREBASE

1. Enable Email/Password login
   Firebase Console > Authentication > Get started > Sign-in method
   Enable Email/Password.

2. Create admin user
   Firebase Console > Authentication > Users > Add user
   Email: azzam@safeflyexpress.com
   Password: choose your password

3. Update Firestore Rules
   Firebase Console > Firestore Database > Rules

   Paste and Publish:

   rules_version = '2';

   service cloud.firestore {
     match /databases/{database}/documents {
       match /complaints/{document} {
         allow create: if true;
         allow read, update: if request.auth != null;
         allow delete: if false;
       }
     }
   }

4. Upload to GitHub Pages
   Upload:
   - index.html
   - app.js
   - manifest.json
   - assets folder

ADMIN EMAIL CURRENTLY ALLOWED
azzam@safeflyexpress.com

TO ADD MORE ADMINS
Open app.js and update this section:

const ALLOWED_ADMIN_EMAILS = [
  "azzam@safeflyexpress.com",
  "anotheradmin@safeflyexpress.com"
];

Then create those users in Firebase Authentication.

IMPORTANT
Students can submit complaints without login.
Only authenticated admins can read, export, report, and update statuses.
