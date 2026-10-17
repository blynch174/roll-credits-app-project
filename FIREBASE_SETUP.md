# Setting up accounts (Firebase)

About 10 minutes, all in the browser. Free, no credit card. Until you do this, the app works exactly like before,
saving on the device only.

Firebase's screens get redesigned now and then, so a button may be worded a little differently than below.

## 1. Create the project

1. Go to **https://console.firebase.google.com** and sign in with a Google account.
2. Click **Create a project** (or **Add project**). Name it `roll-credits`.
3. When it asks about **Google Analytics**, turn it **off**. The app doesn't use it.
4. Click **Create project**, wait, then **Continue**.

You're on the free **Spark** plan by default. Leave it there.

## 2. Connect the app

1. On the project's home page, click the **web icon `</>`** ("Add an app" / "Web").
2. Nickname: `Roll Credits`. Leave **Firebase Hosting unchecked** (GitHub Pages hosts the app). Click **Register app**.
3. It shows code with a `firebaseConfig = { ... }` block. Copy just the `{ ... }` part.
4. In VS Code, open **`js/firebase-config.js`** and replace `null` with it, like this:

```js
export const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "roll-credits-xxxx.firebaseapp.com",
  projectId: "roll-credits-xxxx",
  storageBucket: "roll-credits-xxxx.firebasestorage.app",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abc123",
};
```

These values are fine to commit to GitHub. They only say which project to talk to. The rules in step 5 are
what protect the data.

## 3. Turn on email sign-in

1. Left menu: **Build → Authentication → Get started**.
2. **Sign-in method** tab → **Email/Password** → turn on the first switch (**Email/Password**). Leave
   "Email link (passwordless sign-in)" off. **Save**.
3. **Settings** tab → **Authorized domains** → **Add domain** → `blynch174.github.io`.
4. Optional: **Templates** tab → the pencil on any template → set **Sender name** to `Roll Credits`, so the
   confirmation and password emails don't come from "noreply" with no name.

## 4. Create the database

1. Left menu: **Build → Firestore Database → Create database**.
2. If it asks for an edition, pick **Standard**.
3. **Location:** pick **`nam5 (United States)`**. This can't be changed later.
4. Start in **production mode** → **Create**.

## 5. Paste the security rules

1. In Firestore Database, open the **Rules** tab.
2. Delete everything there, paste the whole contents of **`firestore.rules`** from the repo, and click **Publish**.

If you ever change `firestore.rules`, paste it in and publish again. The file in the repo doesn't update Firebase
by itself.

## 6. Make yourself an admin

1. Push the update (`git add .`, `git commit`, `git push`), wait a minute, and open the app.
2. **Settings → Account → Sign in or create an account → New here? Create an account.** Use your real email.
3. You'll get a confirmation email (check spam). The app will say **Not on the invite list yet**. That's expected.
4. Tap your email in Settings. At the bottom it shows **User ID** → **Copy**.
5. Back in Firebase: **Firestore Database → Data → Start collection**.
   - Collection ID: `admins` → **Next**
   - Document ID: paste your User ID
   - Add a field: name `email`, type `string`, value your email
   - **Save**
6. In the app, tap your email → **Check again**. You should see **Backed up just now**, and an
   **Admin tools** row under it.

## 7. Add Kyle (and testers)

- **Testers:** Settings → Admin tools → type their email → **Add**. Tell them to open the app, go to
  Settings → Account → create an account with that same email, and tap the link in the confirmation email.
- **Kyle as an admin:** add him to the invite list first so he can sign up. Then have him copy his User ID
  (Settings → tap his email) and add a second document under `admins` the same way as step 6.

Removing someone from the invite list stops their backups. Their app keeps working on their device.

## 8. Publish the official festivals (once)

Settings → Admin tools → **Publish the built-in festivals**. From then on you can edit them there and publish
updates to everyone.

**Already set up before v3.6?** The rules changed (official festivals and drafts). Paste the new
`firestore.rules` into Firestore → Rules and click **Publish** again before step 8.

## Checking it works

- Sign in on a second device (or a private browser window). Your festivals and history should show up.
- Change something on one device, then switch back to the other app. It picks up the change when it comes
  back to the front.

## Troubleshooting

| What you see | Usually means |
|---|---|
| No Account section in Settings | `js/firebase-config.js` is still `null`, or the phone has the old version cached. Pull down to refresh, or close and reopen. |
| "Not on the invite list yet" | The email on the invite list doesn't match the one they signed up with, or (for you) the `admins` document ID isn't exactly your User ID. |
| "Verify your email…" won't go away | They need to tap the link in the email, then tap **I've confirmed it**. The link sometimes lands in spam. |
| "Couldn't back up" | Most often the rules weren't published (step 5). |
| Sign-up says "Something went wrong" | Email/Password sign-in isn't turned on (step 3). |

## What's stored where

| Firestore collection | What's in it |
|---|---|
| `users/{User ID}` | One document per person: their whole Roll Credits data (festivals, tables, history, settings) |
| `invites/{email}` | The invite list, managed from Admin tools |
| `admins/{User ID}` | Admins, added by hand in the console |
| `official/{festival id}` | Published official festivals. Anyone can read them |
| `drafts/{festival id}` | Admins' unpublished edits |

Passwords are handled by Firebase Authentication and are never visible, not even to you.
