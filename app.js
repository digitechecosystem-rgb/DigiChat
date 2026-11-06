
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  onAuthStateChanged,
  signOut,
  deleteUser
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  runTransaction,
  writeBatch,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";

// =============================================
// 1. FIREBASE CONFIGURATION
// =============================================

const firebaseConfig = {
  apiKey: "AIzaSyBmpAPdpt6XWZMgdIr-4ZHJmCQrHUgnPlg",
  authDomain: "digichat-eb330.firebaseapp.com",
  projectId: "digichat-eb330",
  storageBucket: "digichat-eb330.firebasestorage.app",
  messagingSenderId: "662827144743",
  appId: "1:662827144743:web:64be21badf4d25e7aba002"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// =============================================
// 2. HTML ELEMENTS
// =============================================

// Authentication
const authView = document.getElementById("authView");
const appView = document.getElementById("appView");
const authForm = document.getElementById("authForm");

const loginTab = document.getElementById("loginTab");
const registerTab = document.getElementById("registerTab");

const nameGroup = document.getElementById("nameGroup");
const usernameGroup = document.getElementById("usernameGroup");
const confirmGroup = document.getElementById("confirmGroup");

const nameInput = document.getElementById("name");
const usernameInput = document.getElementById("username");
const usernameStatus = document.getElementById("usernameStatus");

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const confirmInput = document.getElementById("confirmPassword");

const submitBtn = document.getElementById("submitBtn");
const message = document.getElementById("message");

const formTitle = document.getElementById("formTitle");
const formSubtitle = document.getElementById("formSubtitle");

// Dashboard
const logoutBtn = document.getElementById("logoutBtn");

const sidebarAvatar = document.getElementById("sidebarAvatar");
const sidebarName = document.getElementById("sidebarName");
const sidebarEmail = document.getElementById("sidebarEmail");
const sidebarUsername = document.getElementById("sidebarUsername");
const sidebarDigiId = document.getElementById("sidebarDigiId");

const listTitle = document.getElementById("listTitle");

const navButtons = document.querySelectorAll(".nav-item");

const searchForm = document.getElementById("searchForm");
const messageForm = document.getElementById("messageForm");

// =============================================
// 3. APPLICATION STATE
// =============================================

let currentMode = "login";
let usernameTimer = null;
let usernameAvailable = false;
let registrationInProgress = false;

// =============================================
// 4. MESSAGE DISPLAY
// =============================================

function showMessage(text, type = "success") {
  if (!message) return;

  message.textContent = text;

  message.style.color =
    type === "error" ? "#ff7777" : "#4be3a1";
}

// =============================================
// 5. USERNAME VALIDATION
// =============================================

function normalizeUsername(value) {
  return value.trim().toLowerCase().replace(/^@/, "");
}

function validUsername(value) {
  return /^[a-z0-9](?:[a-z0-9._]{1,18}[a-z0-9])$/.test(value);
}

function usernameRef(username) {
  return doc(db, "usernames", username);
}

// =============================================
// 6. CHECK USERNAME AVAILABILITY
// =============================================

async function checkUsernameAvailability() {
  if (!usernameInput || !usernameStatus) return false;

  const username = normalizeUsername(usernameInput.value);

  usernameAvailable = false;

  if (username.length < 3 || username.length > 20) {
    usernameStatus.textContent =
      "Username must be 3–20 characters.";

    usernameStatus.style.color = "#ff7777";
    return false;
  }

  if (!validUsername(username)) {
    usernameStatus.textContent =
      "Use letters, numbers, dots and underscores. Start and end with a letter or number.";

    usernameStatus.style.color = "#ff7777";
    return false;
  }

  usernameStatus.textContent = "Checking availability...";
  usernameStatus.style.color = "#aaaabc";

  try {
    const snapshot = await getDoc(usernameRef(username));

    // Ignore old results if username has changed
    if (normalizeUsername(usernameInput.value) !== username) {
      return false;
    }

    if (snapshot.exists()) {
      usernameStatus.textContent =
        "Username already taken. Try another.";

      usernameStatus.style.color = "#ff7777";
      usernameAvailable = false;

    } else {
      usernameStatus.textContent =
        "Username available!";

      usernameStatus.style.color = "#4be3a1";
      usernameAvailable = true;
    }

    return usernameAvailable;

  } catch (error) {
    console.error("Username check error:", error);

    usernameStatus.textContent =
      "Could not check username. Check Firestore Rules.";

    usernameStatus.style.color = "#ff7777";

    return false;
  }
}

// =============================================
// 7. LIVE USERNAME CHECK
// =============================================

if (usernameInput) {
  usernameInput.addEventListener("input", () => {

    usernameInput.value =
      usernameInput.value.toLowerCase().replace(/^@/, "");

    usernameAvailable = false;

    clearTimeout(usernameTimer);

    if (usernameStatus) {
      usernameStatus.textContent = "";
    }

    if (usernameInput.value.length < 3) return;

    usernameTimer = setTimeout(() => {
      checkUsernameAvailability();
    }, 500);

  });
}

// =============================================
// 8. LOGIN / REGISTER SWITCH
// =============================================

function setMode(mode) {

  currentMode = mode;

  const isRegister = mode === "register";

  if (nameGroup) nameGroup.hidden = !isRegister;
  if (usernameGroup) usernameGroup.hidden = !isRegister;
  if (confirmGroup) confirmGroup.hidden = !isRegister;

  if (nameInput) nameInput.required = isRegister;
  if (usernameInput) usernameInput.required = isRegister;
  if (confirmInput) confirmInput.required = isRegister;

  if (loginTab) {
    loginTab.classList.toggle("active", !isRegister);
  }

  if (registerTab) {
    registerTab.classList.toggle("active", isRegister);
  }

  if (formTitle) {
    formTitle.textContent = isRegister
      ? "Create Your Account"
      : "Welcome Back!";
  }

  if (formSubtitle) {
    formSubtitle.textContent = isRegister
      ? "Join DigiChat today"
      : "Login to continue to DigiChat";
  }

  if (submitBtn) {
    submitBtn.textContent = isRegister
      ? "Create Account"
      : "Login";
  }

  if (authForm) authForm.reset();

  usernameAvailable = false;

  clearTimeout(usernameTimer);

  if (usernameStatus) {
    usernameStatus.textContent = "";
  }

  if (message) {
    message.textContent = "";
  }
}

loginTab?.addEventListener("click", () => {
  setMode("login");
});

registerTab?.addEventListener("click", () => {
  setMode("register");
});

// =============================================
// 9. SAVE NEW USER PROFILE
// =============================================

async function saveUserProfile(user, displayName, username) {

  const uniqueId = "DGC-" + user.uid;

  const publicRef = doc(db, "publicProfiles", user.uid);
  const privateRef = doc(db, "privateUsers", user.uid);
  const nameRef = usernameRef(username);

  await runTransaction(db, async (transaction) => {

    // Check whether username is already reserved
    const usernameSnap = await transaction.get(nameRef);

    if (usernameSnap.exists()) {
      throw new Error("USERNAME_TAKEN");
    }

    // Reserve username
    transaction.set(nameRef, {
      uid: user.uid,
      username: username,
      createdAt: serverTimestamp()
    });

    // Public profile
    transaction.set(publicRef, {
      name: displayName,
      username: username,
      usernameLower: username,
      uniqueId: uniqueId,
      photoURL: user.photoURL || "",
      status: "active",
      createdAt: serverTimestamp()
    });

    // Private profile
    transaction.set(privateRef, {
      email: user.email,
      createdAt: serverTimestamp()
    });

  });

  return uniqueId;
}

// =============================================
// 10. RESTORE EXISTING USER PROFILE
// =============================================

async function ensureUserProfile(user) {

  const publicRef = doc(db, "publicProfiles", user.uid);
  const privateRef = doc(db, "privateUsers", user.uid);

  const [publicSnap, privateSnap] = await Promise.all([
    getDoc(publicRef),
    getDoc(privateRef)
  ]);

  // Both profiles already exist
  if (publicSnap.exists() && privateSnap.exists()) {
    return publicSnap.data();
  }

  const batch = writeBatch(db);

  // Create missing public profile
  if (!publicSnap.exists()) {

    batch.set(publicRef, {
      name: user.displayName || user.email.split("@")[0],
      uniqueId: "DGC-" + user.uid,
      photoURL: user.photoURL || "",
      status: "active",
      createdAt: serverTimestamp()
    });

  }

  // Create missing private profile
  if (!privateSnap.exists()) {

    batch.set(privateRef, {
      email: user.email,
      createdAt: serverTimestamp()
    });

  }

  await batch.commit();

  const updatedProfile = await getDoc(publicRef);

  return updatedProfile.data();
}

// =============================================
// 11. DISPLAY USER PROFILE
// =============================================

function displayUserProfile(user, profile) {

  const displayName =
    profile.name || user.displayName || "DigiChat User";

  if (sidebarName) {
    sidebarName.textContent = displayName;
  }

  if (sidebarEmail) {
    sidebarEmail.textContent = user.email || "";
  }

  if (sidebarUsername) {

    sidebarUsername.textContent = profile.username
      ? "@" + profile.username
      : "Username not set";

  }

  if (sidebarDigiId) {

    sidebarDigiId.textContent =
      profile.uniqueId || "DGC-" + user.uid;

  }

  if (sidebarAvatar) {

    if (profile.photoURL) {

      sidebarAvatar.style.backgroundImage =
        `url("${profile.photoURL}")`;

      sidebarAvatar.style.backgroundSize = "cover";
      sidebarAvatar.style.backgroundPosition = "center";
      sidebarAvatar.textContent = "";

    } else {

      sidebarAvatar.style.backgroundImage = "none";

      sidebarAvatar.textContent =
        displayName.charAt(0).toUpperCase();

    }
  }
}

// =============================================
// 12. SHOW DASHBOARD
// =============================================

async function showDashboard(user) {

  authView.hidden = true;
  appView.hidden = false;

  try {

    const profile = await ensureUserProfile(user);

    displayUserProfile(user, profile);

    console.log("DigiChat Dashboard Loaded");

  } catch (error) {

    console.error("Profile loading error:", error);

    console.error(
      "Please check your Firestore Security Rules."
    );

  }
}

// =============================================
// 13. REGISTRATION AND LOGIN
// =============================================

authForm?.addEventListener("submit", async (event) => {

  event.preventDefault();

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  const name = nameInput?.value.trim() || "";

  const username = normalizeUsername(
    usernameInput?.value || ""
  );

  submitBtn.disabled = true;
  submitBtn.textContent = "Please wait...";

  try {

    // =================================
    // REGISTRATION
    // =================================

    if (currentMode === "register") {

      if (name.length < 2) {
        throw new Error("Please enter your full name.");
      }

      if (!validUsername(username)) {
        throw new Error(
          "Username must be 3–20 characters. Use letters, numbers, dots or underscores."
        );
      }

      if (password.length < 6) {
        throw new Error(
          "Password must contain at least 6 characters."
        );
      }

      if (password !== confirmInput.value) {
        throw new Error("Passwords do not match.");
      }

      // Check username again before registration
      const availability = await getDoc(
        usernameRef(username)
      );

      if (availability.exists()) {
        throw new Error("USERNAME_TAKEN");
      }

      // Prevent auth-state callback from creating a profile
      // before the username transaction completes.
      registrationInProgress = true;

      // Create Firebase Authentication account
      const result = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      try {

        // Save display name
        await updateProfile(result.user, {
          displayName: name
        });

        // Save Firestore profiles and username
        await saveUserProfile(
          result.user,
          name,
          username
        );

        registrationInProgress = false;

        showMessage(
          "Account created successfully! Your username is @" + username
        );

        // Open dashboard after successful profile creation
        await showDashboard(result.user);

      } catch (profileError) {

        registrationInProgress = false;

        // Delete newly created account if profile creation fails
        try {
          await deleteUser(result.user);
        } catch (deleteError) {
          console.error(
            "Account rollback failed:",
            deleteError
          );
        }

        throw profileError;
      }

    }

    // =================================
    // LOGIN
    // =================================

    else {

      await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      showMessage("Login successful!");

    }

  } catch (error) {

    registrationInProgress = false;

    const errors = {

      "USERNAME_TAKEN":
        "This username is already taken. Please choose another.",

      "auth/email-already-in-use":
        "This email is already registered.",

      "auth/invalid-email":
        "Please enter a valid email address.",

      "auth/weak-password":
        "Password must be at least 6 characters.",

      "auth/invalid-credential":
        "Incorrect email or password.",

      "auth/user-not-found":
        "No account found with this email.",

      "auth/wrong-password":
        "Incorrect password.",

      "auth/network-request-failed":
        "Check your internet connection.",

      "auth/too-many-requests":
        "Too many attempts. Try again later.",

      "permission-denied":
        "Database permission denied. Check Firestore Rules."

    };

    showMessage(
      errors[error.code] || error.message,
      "error"
    );

    console.error("DigiChat Error:", error);

  } finally {

    submitBtn.disabled = false;

    submitBtn.textContent =
      currentMode === "register"
        ? "Create Account"
        : "Login";

  }

});

// =============================================
// 14. FIREBASE AUTHENTICATION STATE
// =============================================

onAuthStateChanged(auth, async (user) => {

  if (user) {

    // Registration handler will open dashboard
    // after both username and profile are saved.
    if (registrationInProgress) return;

    await showDashboard(user);

  } else {

    appView.hidden = true;
    authView.hidden = false;

    setMode("login");

  }

});

// =============================================
// 15. LOGOUT
// =============================================

logoutBtn?.addEventListener("click", async () => {

  try {

    await signOut(auth);

    setMode("login");

    console.log("User logged out.");

  } catch (error) {

    console.error("Logout error:", error);

    showMessage(error.message, "error");

  }

});

// =============================================
// 16. SIDEBAR NAVIGATION
// =============================================

navButtons.forEach((button) => {

  button.addEventListener("click", () => {

    // Remove active state from all buttons
    navButtons.forEach((item) => {
      item.classList.remove("active");
    });

    // Activate clicked button
    button.classList.add("active");

    const page = button.dataset.page;

    const titles = {
      messages: "Messages",
      contacts: "Contacts",
      profile: "My Profile",
      settings: "Settings"
    };

    if (listTitle) {
      listTitle.textContent = titles[page] || "DigiChat";
    }

    console.log("Selected page:", page);

  });

});

// =============================================
// 17. SEARCH FORM PLACEHOLDER
// =============================================

searchForm?.addEventListener("submit", (event) => {

  event.preventDefault();

  // User search will be connected to Firestore
  // in the next development step.

});

// =============================================
// 18. MESSAGE FORM PLACEHOLDER
// =============================================

messageForm?.addEventListener("submit", (event) => {

  event.preventDefault();

  // Real-time messaging will be connected
  // to Firestore in the next development step.

});

// =============================================
// 19. APPLICATION READY
// =============================================

console.log("DigiChat Application Initialized!");
