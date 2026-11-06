
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  writeBatch,
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

// Initialize Firebase
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
const confirmGroup = document.getElementById("confirmGroup");

const nameInput = document.getElementById("name");
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

// ===================================
// 3. MESSAGE SYSTEM
// ===================================

function showMessage(text, type = "success") {
  message.textContent = text;

  message.style.color =
    type === "error" ? "#ff7777" : "#4be3a1";
}

// ===================================
// 4. SWITCH LOGIN / REGISTER
// ===================================

function setMode(mode) {

  currentMode = mode;

  const isRegister = mode === "register";

  nameGroup.hidden = !isRegister;
  confirmGroup.hidden = !isRegister;

  nameInput.required = isRegister;
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
  message.textContent = "";
}

loginTab.addEventListener("click", () => setMode("login"));

registerTab.addEventListener("click", () => setMode("register"));

// ===================================
// 5. CREATE FIRESTORE USER PROFILE
// ===================================

async function saveUserProfile(user, displayName) {

  const uniqueId = "DGC-" + user.uid;

  const publicRef = doc(db, "publicProfiles", user.uid);
  const privateRef = doc(db, "privateUsers", user.uid);

  const batch = writeBatch(db);

  batch.set(publicRef, {
    name: displayName,
    uniqueId: uniqueId,
    photoURL: user.photoURL || "",
    status: "active",
    createdAt: serverTimestamp()
  });

  batch.set(privateRef, {
    email: user.email,
    createdAt: serverTimestamp()
  });

  await batch.commit();

  return uniqueId;
}

// ===================================
// 6. RESTORE MISSING PROFILE
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
// 7. REGISTRATION AND LOGIN
// ===================================

authForm.addEventListener("submit", async (event) => {

  event.preventDefault();

  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const name = nameInput.value.trim();

  submitBtn.disabled = true;
  submitBtn.textContent = "Please wait...";

  try {

    if (currentMode === "register") {

      if (name.length < 2) {
        throw new Error("Please enter your full name.");
      }

      if (password.length < 6) {
        throw new Error("Password must contain at least 6 characters.");
      }

      if (password !== confirmInput.value) {
        throw new Error("Passwords do not match.");
      }

      // Create Firebase Authentication Account
      const result = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      // Save display name in Authentication
      await updateProfile(result.user, {
        displayName: name
      });

      // Create Firestore Profile
      const uniqueId = await saveUserProfile(
        result.user,
        name
      );

      showMessage(
        "Account created successfully! Your ID: " + uniqueId
      );

    } else {

      // Login Existing User
      await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      showMessage("Login successful!");

    }

  } catch (error) {

    const errors = {

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

    const errorMessage =
      errors[error.code] || error.message;

    showMessage(errorMessage, "error");

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
// 8. AUTHENTICATION STATE
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
        "\nDigiChat ID: " +
        profile.uniqueId;

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
// 9. LOGOUT
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

console.log("DigiChat Authentication & Firestore Ready!");
