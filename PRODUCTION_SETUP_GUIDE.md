# Nexus Machinery Solutions — Production Setup Guide

This document provides a step-by-step guide on how to set up the production Google Firebase project under your business Gmail account, migrate the settings, and transition the website and apps from the local testing phase to live production.

---

## Part 1: Google Account Setup
1. **Create a Dedicated Gmail Address**:
   - Create a clean business email (e.g., `nexusmachinerysolutions@gmail.com` or a custom email like `admin@nexusmachinery.in` via Google Workspace).
   - Do **NOT** use your personal Gmail account, as employees/developers may eventually need access, and it controls all business operations.
2. **Enable 2-Factor Authentication (2FA)**:
   - Go to Google Account Settings -> Security -> 2-Step Verification.
   - Enable it with a secure phone number or backup codes. This is critical to prevent database takeovers.

---

## Part 2: Firebase Project Initialization
1. Go to the [Firebase Console](https://console.firebase.google.com) and log in with your business Gmail.
2. Click **Add Project**.
3. Name the project `nexus-machinery-solutions`.
4. (Optional) Disable Google Analytics (not required for our core app database, but can be enabled if you want web traffic metrics later).
5. Click **Create Project** and wait for it to provision.

---

## Part 3: Database & Storage Configuration

### 1. Cloud Firestore Setup (NoSQL Database)
- In the left sidebar of the Firebase Console, click **Firestore Database**.
- Click **Create Database**.
- **Database Location**: Select `asia-south1 (Mumbai)`. 
  > [!IMPORTANT]
  > This location cannot be changed later. Choosing Mumbai guarantees the lowest database latency for your customers and engineers in Rajkot, Gujarat.
- **Security Rules**: Select **Start in Test Mode** (we will apply production rules later). Click **Next** and click **Enable**.

### 2. Firebase Storage Setup (Media Bucket)
- In the left sidebar, click **Storage**.
- Click **Get Started**.
- Select **Start in Test Mode**.
- **Location**: Ensure it is set to `asia-south1 (Mumbai)` (matching Firestore). Click **Done**.

### 3. Authentication Setup
- In the left sidebar, click **Authentication**.
- Click **Get Started**.
- In the **Sign-in Method** tab, enable the following providers:
  1. **Email/Password**: Used by the Admin/Owner accounts.
  2. **Anonymous**: Used for secure client-side database connections if desired.

---

## Part 4: Production Security Rules

To protect your database and storage bucket from unauthorized writes, reads, or deletions:

### 1. Firestore Database Rules
Go to **Firestore Database** -> **Rules** tab, replace the rules with the following, and click **Publish**:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ENQUIRY COLLECTIONS: Public can only CREATE (submit enquiry).
    // Authenticated admin users can read, update, and delete.
    match /breakdown_enquiries/{docId} {
      allow create: if true;
      allow read, write: if request.auth != null;
    }
    match /part_enquiries/{docId} {
      allow create: if true;
      allow read, write: if request.auth != null;
    }
    match /other_service_enquiries/{docId} {
      allow create: if true;
      allow read, write: if request.auth != null;
    }
    match /automation_enquiries/{docId} {
      allow create: if true;
      allow read, write: if request.auth != null;
    }
    match /general_enquiries/{docId} {
      allow create: if true;
      allow read, write: if request.auth != null;
    }
    match /new_product_enquiries/{docId} {
      allow create: if true;
      allow read, write: if request.auth != null;
    }
    match /used_product_enquiries/{docId} {
      allow create: if true;
      allow read, write: if request.auth != null;
    }

    // PRODUCTS: Anyone can read listings (public website), only authenticated admins can write.
    match /products/{docId} {
      allow read: if true;
      allow write: if request.auth != null;
    }

    // OTP VERIFICATION: Authenticated users can read/write their own OTP document.
    match /admin_otps/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // TRUSTED IPS: Authenticated users can read/write their own trusted IP documents.
    match /trusted_ips/{docId} {
      allow read, write: if request.auth != null;
    }

    // OTHER COLLECTIONS (Employees, Customers, Login Codes): Authenticated admin access only.
    match /employees/{docId} {
      allow read, write: if request.auth != null;
    }
    match /login_codes/{docId} {
      allow read, write: if request.auth != null;
    }
    match /customers/{docId} {
      allow read, write: if request.auth != null;
    }

    // Default fallback
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```
```

### 2. Firebase Storage Rules
Go to **Storage** -> **Rules** tab, replace with the following, and click **Publish**:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {

    // Public can upload files under 20MB, but cannot read them from browser.
    match /enquiries/{allPaths=**} {
      allow write: if request.resource.size < 20 * 1024 * 1024;
      allow read: if false;
    }

    // Product Images: Public can view, write is disabled.
    match /products/{allPaths=**} {
      allow read: if true;
      allow write: if false;
    }
  }
}
```

---

## Part 5: Connecting Website and Apps

### 1. Generating Credentials
1. Click the gear icon (⚙️) next to **Project Overview** in the left sidebar -> **Project settings**.
2. Scroll down to **Your apps**, click the web icon (`</>`), and register your app as `nexus-website`.
3. Copy the generated `firebaseConfig` object, which looks like this:
   ```javascript
   const firebaseConfig = {
     apiKey: "YOUR_ACTUAL_API_KEY",
     authDomain: "nexus-machinery-solutions.firebaseapp.com",
     projectId: "nexus-machinery-solutions",
     storageBucket: "nexus-machinery-solutions.firebasestorage.app",
     messagingSenderId: "SENDER_ID",
     appId: "APP_ID"
   };
   ```

### 2. Adding Config to the Website
- Open `/website/index.html`.
- Scroll to the bottom near `</body>` and replace the placeholder credentials inside the `<script type="module">` tag with your new production `firebaseConfig` object.

### 3. Restricting API Key (Highly Recommended for Production)
- Go to the [Google Cloud Console](https://console.cloud.google.com/) and log in with your business Gmail.
- Select your `nexus-machinery-solutions` project.
- Go to **APIs & Services** -> **Credentials**.
- Click the edit icon next to your browser API key (usually named `Browser key (auto-created by Firebase)`).
- Under **Website restrictions**, select **Websites** and add your official domain:
  - `https://nexusmachinery.in/*`
  - `https://nexus-machinery-solutions.web.app/*`
- Under **API restrictions**, restrict the key to only allow:
  - `Identity Toolkit API` (Auth)
  - `Cloud Firestore API`
  - `Google Cloud Storage API`
- Save changes. This prevents hackers from copying your API key and using it on other sites.
