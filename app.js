
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
  writeBatch,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";

// ===================================
// 1. FIREBASE CONFIGURATION
// ===================================

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

// ===================================
// 2. HTML ELEMENTS
// ===================================

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

const userPanel = document.getElementById("userPanel");
const userEmail = document.getElementById("userEmail");
const logoutBtn = document.getElementById("logoutBtn");

const formTitle = document.getElementById("formTitle");
const formSubtitle = document.getElementById("formSubtitle");

const tabs = document.querySelector(".tabs");
const authHeading = document.querySelector(".auth-heading");

let currentMode = "login";
let usernameTimer = null;
let usernameAvailable = false;
let usernameChecking = false;

// ===================================
// 3. MESSAGE SYSTEM
// ===================================

function showMessage(text, type = "success") {
  message.textContent = text;
  message.style.color =
    type === "error" ? "#ff7777" : "#4be3a1";
}

// ===================================
// 4. USERNAME VALIDATION
// ===================================

function normalizeUsername(value) {
  return value.trim().toLowerCase().replace(/^@/, "");
}

function validUsername(value) {
  return /^[a-z0-9](?:[a-z0-9._]{1,18}[a-z0-9])$/.test(value);
}

function usernameRef(username) {
  return doc(db, "usernames", username);
}

// ===================================
// 5. CHECK USERNAME AVAILABILITY
// ===================================

async function checkUsernameAvailability() {

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

  usernameChecking = true;
  usernameStatus.textContent = "Checking availability...";
  usernameStatus.style.color = "#aaaabc";

  try {

    const snapshot = await getDoc(usernameRef(username));

    // Prevent outdated availability responses
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

    usernameStatus.textContent =
      "Could not check username. Check your connection.";
    usernameStatus.style.color = "#ff7777";

    console.error(error);
    return false;

  } finally {
    usernameChecking = false;
  }
}

// ===================================
// 6. LIVE USERNAME CHECK
// ===================================

usernameInput.addEventListener("input", () => {

  usernameInput.value =
    usernameInput.value.toLowerCase().replace(/^@/, "");

  usernameAvailable = false;

  clearTimeout(usernameTimer);

  usernameStatus.textContent = "";

  if (usernameInput.value.length < 3) return;

  usernameTimer = setTimeout(
    checkUsernameAvailability,
    500
  );

});

// ===================================
// 7. SWITCH LOGIN / REGISTER
// ===================================

function setMode(mode) {

  currentMode = mode;

  const isRegister = mode === "register";

  nameGroup.hidden = !isRegister;
  usernameGroup.hidden = !isRegister;
  confirmGroup.hidden = !isRegister;

  nameInput.required = isRegister;
  usernameInput.required = isRegister;
  confirmInput.required = isRegister;

  loginTab.classList.toggle("active", !isRegister);
  registerTab.classList.toggle("active", isRegister);

  formTitle.textContent = isRegister
    ? "Create Your Account"
    : "Welcome Back!";

  formSubtitle.textContent = isRegister
    ? "Join DigiChat today"
    : "Login to continue to DigiChat";

  submitBtn.textContent = isRegister
    ? "Create Account"
    : "Login";

  authForm.reset();

  usernameAvailable = false;
  usernameStatus.textContent = "";
  message.textContent = "";

}

loginTab.addEventListener("click", () => setMode("login"));
registerTab.addEventListener("click", () => setMode("register"));

// ===================================
// 8. CREATE FIRESTORE PROFILE
// ===================================

async function saveUserProfile(user, displayName, username) {

  const uniqueId = "DGC-" + user.uid;

  const publicRef = doc(db, "publicProfiles", user.uid);
  const privateRef = doc(db, "privateUsers", user.uid);
  const nameRef = usernameRef(username);

  await runTransaction(db, async (transaction) => {

    // Read username first
    const usernameSnap = await transaction.get(nameRef);

    if (usernameSnap.exists()) {
      throw new Error("USERNAME_TAKEN");
    }

    // Reserve unique username
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

// ===================================
// 9. RESTORE EXISTING USER PROFILE
// ===================================

async function ensureUserProfile(user) {

  const publicRef = doc(db, "publicProfiles", user.uid);
  const privateRef = doc(db, "privateUsers", user.uid);

  const [publicSnap, privateSnap] = await Promise.all([
    getDoc(publicRef),
    getDoc(privateRef)
  ]);

  if (publicSnap.exists() && privateSnap.exists()) {
    return publicSnap.data();
  }

  const batch = writeBatch(db);

  if (!publicSnap.exists()) {

    batch.set(publicRef, {
      name: user.displayName || user.email.split("@")[0],
      uniqueId: "DGC-" + user.uid,
      photoURL: user.photoURL || "",
      status: "active",
      createdAt: serverTimestamp()
    });

  }

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

// ===================================
// 10. REGISTRATION AND LOGIN
// ===================================

authForm.addEventListener("submit", async (event) => {

  event.preventDefault();

  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const name = nameInput.value.trim();
  const username = normalizeUsername(usernameInput.value);

  submitBtn.disabled = true;
  submitBtn.textContent = "Please wait...";

  try {

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

      // Check username before account creation
      const availability = await getDoc(usernameRef(username));

      if (availability.exists()) {
        throw new Error("USERNAME_TAKEN");
      }

      // Create Firebase account
      const result = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      try {

        // Set display name
        await updateProfile(result.user, {
          displayName: name
        });

        // Save username and profiles atomically
        await saveUserProfile(
          result.user,
          name,
          username
        );

      } catch (profileError) {

        // Roll back Auth account if profile creation fails
        try {
          await deleteUser(result.user);
        } catch (deleteError) {
          console.error("Account rollback failed:", deleteError);
        }

        throw profileError;
      }

      showMessage(
        "Account created successfully! Your username is @" + username
      );

    } else {

      // Existing email/password login
      await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      showMessage("Login successful!");

    }

  } catch (error) {

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

// ===================================
// 11. AUTHENTICATION STATE
// ===================================

onAuthStateChanged(auth, async (user) => {

  if (user) {

    authForm.hidden = true;
    tabs.hidden = true;
    authHeading.hidden = true;
    userPanel.hidden = false;

    userEmail.textContent = "Loading profile...";

    try {

      const profile = await ensureUserProfile(user);

      userEmail.textContent =
        user.email +
        "\nUsername: " +
        (profile.username
          ? "@" + profile.username
          : "Not set - username claim required");

    } catch (error) {

      userEmail.textContent =
        "Profile loading failed. Please contact support.";

      console.error("Profile Error:", error);

    }

  } else {

    authForm.hidden = false;
    tabs.hidden = false;
    authHeading.hidden = false;
    userPanel.hidden = true;

  }

});

// ===================================
// 12. LOGOUT
// ===================================

logoutBtn.addEventListener("click", async () => {

  try {

    await signOut(auth);
    setMode("login");

    showMessage("Logged out successfully!");

  } catch (error) {

    showMessage(error.message, "error");

  }

});

console.log("DigiChat Username & Authentication System Ready!");
