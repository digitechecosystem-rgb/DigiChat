
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";

// Firebase Configuration
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

// HTML Elements
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

let currentMode = "login";

// Display message
function showMessage(text, type = "info") {
  message.textContent = text;
  message.style.color =
    type === "error" ? "#ff7777" : "#4be3a1";
}

// Switch Login / Register
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

  message.textContent = "";
  authForm.reset();
}

loginTab.addEventListener("click", () => setMode("login"));
registerTab.addEventListener("click", () => setMode("register"));

// Register / Login
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

      if (password !== confirmInput.value) {
        throw new Error("Passwords do not match.");
      }

      const result = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      await updateProfile(result.user, {
        displayName: name
      });

      showMessage("Account created successfully!");

    } else {

      await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      showMessage("Login successful!");
    }

  } catch (error) {

    const errors = {
      "auth/email-already-in-use": "This email is already registered.",
      "auth/invalid-email": "Please enter a valid email.",
      "auth/weak-password": "Password must be at least 6 characters.",
      "auth/invalid-credential": "Incorrect email or password.",
      "auth/network-request-failed": "Check your internet connection.",
      "auth/too-many-requests": "Too many attempts. Try again later."
    };

    showMessage(
      errors[error.code] || error.message,
      "error"
    );

  } finally {

    submitBtn.disabled = false;
    submitBtn.textContent =
      currentMode === "register" ? "Create Account" : "Login";
  }
});

// Check Login Status
onAuthStateChanged(auth, (user) => {

  if (user) {

    authForm.hidden = true;
    document.querySelector(".tabs").hidden = true;
    document.querySelector(".auth-heading").hidden = true;

    userPanel.hidden = false;
    userEmail.textContent = user.email;

    showMessage("You are logged in!");

  } else {

    authForm.hidden = false;
    document.querySelector(".tabs").hidden = false;
    document.querySelector(".auth-heading").hidden = false;

    userPanel.hidden = true;
  }
});

// Logout
logoutBtn.addEventListener("click", async () => {

  try {
    await signOut(auth);
    setMode("login");
    showMessage("Logged out successfully!");

  } catch (error) {
    showMessage(error.message, "error");
  }

});

console.log("DigiChat Firebase Initialized!");
