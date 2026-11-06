
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
  setDoc,
  deleteDoc,
  getDocs,
  collection,
  query,
  where,
  limit,
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

const logoutBtn = document.getElementById("logoutBtn");

const sidebarAvatar = document.getElementById("sidebarAvatar");
const sidebarName = document.getElementById("sidebarName");
const sidebarEmail = document.getElementById("sidebarEmail");
const sidebarUsername = document.getElementById("sidebarUsername");
const sidebarDigiId = document.getElementById("sidebarDigiId");

const listTitle = document.getElementById("listTitle");

const navButtons = document.querySelectorAll(".nav-item");

const searchForm = document.getElementById("searchForm");
const searchInput = document.getElementById("searchInput");
const searchResults = document.getElementById("searchResults");
const conversationsList = document.getElementById("conversationsList");

const newChatBtn = document.getElementById("newChatBtn");

// =============================================
// 3. APPLICATION STATE
// =============================================

let currentMode = "login";
let usernameTimer = null;
let isCreatingAccount = false;
let currentUserProfile = null;

// =============================================
// 4. COMMON HELPERS
// =============================================

function showMessage(text, type = "success") {
  if (!message) return;

  message.textContent = text;
  message.style.color =
    type === "error" ? "#ff7777" : "#4be3a1";
}

function normalizeUsername(value) {
  return value.trim().toLowerCase().replace(/^@/, "");
}

function validUsername(value) {
  return /^[a-z0-9](?:[a-z0-9._]{1,18}[a-z0-9])$/.test(value);
}

function usernameRef(username) {
  return doc(db, "usernames", username);
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);

  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;

  return element;
}

// =============================================
// 5. USERNAME AVAILABILITY
// =============================================

async function checkUsernameAvailability() {
  const username = normalizeUsername(usernameInput.value);

  if (username.length < 3 || username.length > 20) {
    usernameStatus.textContent = "Username must be 3–20 characters.";
    usernameStatus.style.color = "#ff7777";
    return false;
  }

  if (!validUsername(username)) {
    usernameStatus.textContent =
      "Use letters, numbers, dots and underscores. Start and end with a letter or number.";

    usernameStatus.style.color = "#ff7777";
    return false;
  }

  usernameStatus.textContent = "Checking...";
  usernameStatus.style.color = "#94a3b8";

  try {
    const snapshot = await getDoc(usernameRef(username));

    if (normalizeUsername(usernameInput.value) !== username) {
      return false;
    }

    if (snapshot.exists()) {
      usernameStatus.textContent = "Username already taken.";
      usernameStatus.style.color = "#ff7777";
      return false;
    }

    usernameStatus.textContent = "Username available!";
    usernameStatus.style.color = "#4be3a1";
    return true;

  } catch (error) {
    console.error(error);

    usernameStatus.textContent =
      "Could not check username. Check Firestore Rules.";

    usernameStatus.style.color = "#ff7777";
    return false;
  }
}

usernameInput?.addEventListener("input", () => {
  usernameInput.value = usernameInput.value
    .toLowerCase()
    .replace(/^@/, "");

  clearTimeout(usernameTimer);
  usernameStatus.textContent = "";

  if (usernameInput.value.length < 3) return;

  usernameTimer = setTimeout(checkUsernameAvailability, 500);
});

// =============================================
// 6. LOGIN / REGISTER SWITCH
// =============================================

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
  usernameStatus.textContent = "";
  message.textContent = "";

  clearTimeout(usernameTimer);
}

loginTab.addEventListener("click", () => setMode("login"));
registerTab.addEventListener("click", () => setMode("register"));

// =============================================
// 7. SAVE NEW USER PROFILE
// =============================================

async function saveUserProfile(user, name, username) {
  const publicRef = doc(db, "publicProfiles", user.uid);
  const privateRef = doc(db, "privateUsers", user.uid);
  const nameRef = usernameRef(username);

  await runTransaction(db, async (transaction) => {
    const usernameSnap = await transaction.get(nameRef);

    if (usernameSnap.exists()) {
      throw new Error("USERNAME_TAKEN");
    }

    transaction.set(nameRef, {
      uid: user.uid,
      username,
      createdAt: serverTimestamp()
    });

    transaction.set(publicRef, {
      name,
      username,
      usernameLower: username,
      uniqueId: "DGC-" + user.uid,
      photoURL: user.photoURL || "",
      status: "active",
      createdAt: serverTimestamp()
    });

    transaction.set(privateRef, {
      email: user.email,
      createdAt: serverTimestamp()
    });
  });
}

// =============================================
// 8. RESTORE EXISTING USER PROFILE
// =============================================

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

  const updated = await getDoc(publicRef);
  return updated.data();
}

// =============================================
// 9. DISPLAY PROFILE
// =============================================

function displayUserProfile(user, profile) {
  currentUserProfile = profile;

  const name = profile.name || user.displayName || "DigiChat User";

  sidebarName.textContent = name;
  sidebarEmail.textContent = user.email || "";

  sidebarUsername.textContent = profile.username
    ? "@" + profile.username
    : "Username not set";

  sidebarDigiId.textContent =
    profile.uniqueId || "DGC-" + user.uid;

  if (profile.photoURL) {
    sidebarAvatar.style.backgroundImage =
      `url("${profile.photoURL}")`;

    sidebarAvatar.style.backgroundSize = "cover";
    sidebarAvatar.style.backgroundPosition = "center";
    sidebarAvatar.textContent = "";
  } else {
    sidebarAvatar.style.backgroundImage = "none";
    sidebarAvatar.textContent = name.charAt(0).toUpperCase();
  }
}

async function showDashboard(user) {
  authView.hidden = true;
  appView.hidden = false;

  try {
    const profile = await ensureUserProfile(user);
    displayUserProfile(user, profile);
    console.log("DigiChat Dashboard Loaded");
  } catch (error) {
    console.error("Profile loading error:", error);
  }
}

// =============================================
// 10. REGISTRATION AND LOGIN
// =============================================

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
        throw new Error("Please enter a valid username.");
      }

      if (password.length < 6) {
        throw new Error("Password must contain at least 6 characters.");
      }

      if (password !== confirmInput.value) {
        throw new Error("Passwords do not match.");
      }

      const usernameSnap = await getDoc(usernameRef(username));

      if (usernameSnap.exists()) {
        throw new Error("USERNAME_TAKEN");
      }

      isCreatingAccount = true;

      const result = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      try {
        await updateProfile(result.user, {
          displayName: name
        });

        await saveUserProfile(result.user, name, username);

        isCreatingAccount = false;
        await showDashboard(result.user);

      } catch (error) {
        isCreatingAccount = false;

        try {
          await deleteUser(result.user);
        } catch (deleteError) {
          console.error("Account cleanup error:", deleteError);
        }

        throw error;
      }

    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }

  } catch (error) {
    isCreatingAccount = false;

    const errors = {
      "USERNAME_TAKEN": "Username already taken. Try another.",
      "auth/email-already-in-use": "Email already registered.",
      "auth/invalid-email": "Enter a valid email address.",
      "auth/weak-password": "Password must be at least 6 characters.",
      "auth/invalid-credential": "Incorrect email or password.",
      "auth/user-not-found": "Account not found.",
      "auth/wrong-password": "Incorrect password.",
      "auth/network-request-failed": "Check your internet connection.",
      "auth/too-many-requests": "Too many attempts. Try again later."
    };

    showMessage(errors[error.code] || errors[error.message] || error.message, "error");

    console.error("Authentication error:", error);

  } finally {
    submitBtn.disabled = false;

    submitBtn.textContent =
      currentMode === "register" ? "Create Account" : "Login";
  }
});

// =============================================
// 11. AUTHENTICATION STATE
// =============================================

onAuthStateChanged(auth, async (user) => {
  if (isCreatingAccount) return;

  if (user) {
    await showDashboard(user);
  } else {
    currentUserProfile = null;
    appView.hidden = true;
    authView.hidden = false;
    setMode("login");
  }
});

// =============================================
// 12. LOGOUT
// =============================================

logoutBtn.addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Logout error:", error);
    alert("Logout failed: " + error.message);
  }
});

// =============================================
// 13. SEARCH USERS
// =============================================

function showSearchMessage(text) {
  searchResults.replaceChildren();

  const p = createElement("p", "search-info", text);
  searchResults.appendChild(p);

  searchResults.hidden = false;
}

async function findUser(searchValue) {
  const term = searchValue.trim();

  if (!term) return null;

  // Search by username
  if (term.startsWith("@") || !term.toUpperCase().startsWith("DGC-")) {
    const username = normalizeUsername(term);

    if (!validUsername(username)) return null;

    const usernameSnap = await getDoc(usernameRef(username));

    if (!usernameSnap.exists()) return null;

    const uid = usernameSnap.data().uid;

    if (uid === auth.currentUser.uid) {
      return { ownAccount: true };
    }

    const profileSnap = await getDoc(
      doc(db, "publicProfiles", uid)
    );

    if (!profileSnap.exists()) return null;

    return {
      uid,
      ...profileSnap.data()
    };
  }

  // Search by DigiChat ID
  const idQuery = query(
    collection(db, "publicProfiles"),
    where("uniqueId", "==", term),
    limit(1)
  );

  const result = await getDocs(idQuery);

  if (result.empty) return null;

  const profileDoc = result.docs[0];

  if (profileDoc.id === auth.currentUser.uid) {
    return { ownAccount: true };
  }

  return {
    uid: profileDoc.id,
    ...profileDoc.data()
  };
}

// =============================================
// 14. RENDER SEARCH RESULT
// =============================================

async function isAlreadyContact(uid) {
  const contactRef = doc(
    db,
    "contacts",
    auth.currentUser.uid,
    "items",
    uid
  );

  const snap = await getDoc(contactRef);
  return snap.exists();
}

function renderSearchResult(profile, alreadyAdded) {
  searchResults.replaceChildren();

  const card = createElement("div", "user-result-card");

  const avatar = createElement(
    "div",
    "avatar",
    (profile.name || "U").charAt(0).toUpperCase()
  );

  const info = createElement("div", "user-result-info");
  const name = createElement("h3", "", profile.name || "DigiChat User");
  const username = createElement(
    "p",
    "",
    profile.username ? "@" + profile.username : "Username unavailable"
  );
  const digiId = createElement(
    "small",
    "",
    profile.uniqueId || ""
  );

  info.append(name, username, digiId);

  const addButton = createElement(
    "button",
    "add-contact-btn",
    alreadyAdded ? "Added" : "Add Contact"
  );

  addButton.type = "button";
  addButton.disabled = alreadyAdded;

  if (!alreadyAdded) {
    addButton.addEventListener("click", async () => {
      addButton.disabled = true;
      addButton.textContent = "Adding...";

      try {
        await addContact(profile);

        addButton.textContent = "Added";
        await loadContacts();

      } catch (error) {
        console.error("Add contact error:", error);
        addButton.disabled = false;
        addButton.textContent = "Add Contact";
        alert("Could not add contact: " + error.message);
      }
    });
  }

  card.append(avatar, info, addButton);
  searchResults.appendChild(card);
  searchResults.hidden = false;
}

// =============================================
// 15. SEARCH ACTION
// =============================================

async function performUserSearch() {
  const term = searchInput.value.trim();

  if (!term) {
    searchResults.hidden = true;
    searchResults.replaceChildren();
    return;
  }

  if (!auth.currentUser) return;

  showSearchMessage("Searching DigiChat users...");

  try {
    const profile = await findUser(term);

    if (!profile) {
      showSearchMessage("No user found. Check the username or DigiChat ID.");
      return;
    }

    if (profile.ownAccount) {
      showSearchMessage("This is your own account.");
      return;
    }

    const alreadyAdded = await isAlreadyContact(profile.uid);

    renderSearchResult(profile, alreadyAdded);

  } catch (error) {
    console.error("Search error:", error);

    showSearchMessage(
      "Search failed. Please check your internet connection and Firestore Rules."
    );
  }
}

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  performUserSearch();
});

let searchTimer;

searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);

  searchTimer = setTimeout(() => {
    const term = searchInput.value.trim();

    if (term.length >= 3) {
      performUserSearch();
    } else {
      searchResults.hidden = true;
      searchResults.replaceChildren();
    }
  }, 600);
});

newChatBtn.addEventListener("click", () => {
  searchInput.focus();
  searchInput.placeholder = "Enter @username or DigiChat ID";
});

// =============================================
// 16. ADD CONTACT
// =============================================

async function addContact(profile) {
  const currentUid = auth.currentUser.uid;

  if (profile.uid === currentUid) {
    throw new Error("You cannot add yourself.");
  }

  const contactRef = doc(
    db,
    "contacts",
    currentUid,
    "items",
    profile.uid
  );

  const existing = await getDoc(contactRef);

  if (existing.exists()) {
    throw new Error("This user is already in your contacts.");
  }

  await setDoc(contactRef, {
    uid: profile.uid,
    name: profile.name || "DigiChat User",
    username: profile.username || "",
    uniqueId: profile.uniqueId || "",
    addedAt: serverTimestamp()
  });
}

// =============================================
// 17. LOAD CONTACTS
// =============================================

async function loadContacts() {
  if (!auth.currentUser) return;

  conversationsList.replaceChildren();

  const loading = createElement(
    "p",
    "search-info",
    "Loading contacts..."
  );

  conversationsList.appendChild(loading);

  try {
    const contactsRef = collection(
      db,
      "contacts",
      auth.currentUser.uid,
      "items"
    );

    const snapshot = await getDocs(contactsRef);

    conversationsList.replaceChildren();

    if (snapshot.empty) {
      const empty = createElement("div", "empty-state");

      empty.append(
        createElement("div", "empty-icon", "♟"),
        createElement("h3", "", "No contacts yet"),
        createElement(
          "p",
          "",
          "Search for people using their username or DigiChat ID."
        )
      );

      conversationsList.appendChild(empty);
      return;
    }

    snapshot.forEach((contactDoc) => {
      const contact = contactDoc.data();

      const card = createElement("div", "contact-card");

      const avatar = createElement(
        "div",
        "avatar",
        (contact.name || "U").charAt(0).toUpperCase()
      );

      const info = createElement("div", "contact-info");

      info.append(
        createElement("h3", "", contact.name || "DigiChat User"),
        createElement(
          "p",
          "",
          contact.username ? "@" + contact.username : "No username"
        ),
        createElement("small", "", contact.uniqueId || "")
      );

      const removeButton = createElement(
        "button",
        "remove-contact-btn",
        "Remove"
      );

      removeButton.type = "button";

      removeButton.addEventListener("click", async () => {
        const confirmed = confirm(
          "Remove " + (contact.name || "this user") + " from contacts?"
        );

        if (!confirmed) return;

        try {
          await deleteDoc(
            doc(
              db,
              "contacts",
              auth.currentUser.uid,
              "items",
              contactDoc.id
            )
          );

          await loadContacts();

        } catch (error) {
          console.error("Remove contact error:", error);
          alert("Could not remove contact: " + error.message);
        }
      });

      card.append(avatar, info, removeButton);
      conversationsList.appendChild(card);
    });

  } catch (error) {
    console.error("Load contacts error:", error);

    conversationsList.replaceChildren(
      createElement(
        "p",
        "search-info",
        "Could not load contacts. Check Firestore Rules."
      )
    );
  }
}

// =============================================
// 18. SIDEBAR NAVIGATION
// =============================================

navButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    navButtons.forEach((item) => {
      item.classList.remove("active");
    });

    button.classList.add("active");

    const page = button.dataset.page;

    const titles = {
      messages: "Messages",
      contacts: "Contacts",
      profile: "My Profile",
      settings: "Settings"
    };

    listTitle.textContent = titles[page] || "DigiChat";

    if (page === "contacts") {
      searchResults.hidden = true;
      await loadContacts();
    }

    if (page === "messages") {
      conversationsList.replaceChildren();

      const empty = createElement("div", "empty-state");

      empty.append(
        createElement("div", "empty-icon", "☏"),
        createElement("h3", "", "No conversations yet"),
        createElement(
          "p",
          "",
          "Find people and start your first conversation."
        )
      );

      conversationsList.appendChild(empty);
    }

    if (page === "profile") {
      conversationsList.replaceChildren();

      const info = createElement("div", "empty-state");

      info.append(
        createElement("h3", "", currentUserProfile?.name || "My Profile"),
        createElement(
          "p",
          "",
          currentUserProfile?.username
            ? "@" + currentUserProfile.username
            : "Username not set"
        ),
        createElement(
          "p",
          "",
          currentUserProfile?.uniqueId || ""
        )
      );

      conversationsList.appendChild(info);
    }

    if (page === "settings") {
      conversationsList.replaceChildren();

      const info = createElement("div", "empty-state");

      info.append(
        createElement("h3", "", "Settings"),
        createElement(
          "p",
          "",
          "More account settings will be available soon."
        )
      );

      conversationsList.appendChild(info);
    }
  });
});

// =============================================
// 19. INITIAL APPLICATION STATE
// =============================================

console.log("DigiChat User Search & Contacts Ready!");
