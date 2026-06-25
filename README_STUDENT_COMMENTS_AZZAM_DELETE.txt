SAFE FLY EXPRESS PORTAL - STUDENT COMMENTS + SUPER ADMIN DELETE

New changes:
- Students can view admin comments when tracking a complaint by reference number.
- Only azzam@safeflyexpress.com can delete complaints from the Admin Dashboard.
- Other admins cannot delete complaints.

Upload to GitHub Pages:
- index.html
- app.js
- manifest.json

IMPORTANT FIREBASE RULES UPDATE

Publish these Firestore rules:

rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    match /complaints/{document} {
      allow create: if true;
      allow read: if true;
      allow update: if request.auth != null;
      allow delete: if request.auth != null
                    && request.auth.token.email == "azzam@safeflyexpress.com";
    }

    match /counters/{document} {
      allow read, write: if true;
    }
  }
}

After publishing the rules, log in as azzam@safeflyexpress.com to see and use the Delete button.
