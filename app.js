
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
  serverTimestamp,
  onSnapshot,
  orderBy
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";

// ==========================================
// 1. FIREBASE
// ==========================================

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

// ==========================================
// 2. HTML ELEMENTS
// ==========================================

const $ = (id) => document.getElementById(id);

const authView = $("authView");
const appView = $("appView");
const authForm = $("authForm");

const loginTab = $("loginTab");
const registerTab = $("registerTab");

const nameGroup = $("nameGroup");
const usernameGroup = $("usernameGroup");
const confirmGroup = $("confirmGroup");

const nameInput = $("name");
const usernameInput = $("username");
const usernameStatus = $("usernameStatus");

const emailInput = $("email");
const passwordInput = $("password");
const confirmInput = $("confirmPassword");

const submitBtn = $("submitBtn");
const message = $("message");

const formTitle = $("formTitle");
const formSubtitle = $("formSubtitle");

const logoutBtn = $("logoutBtn");

const sidebarAvatar = $("sidebarAvatar");
const sidebarName = $("sidebarName");
const sidebarEmail = $("sidebarEmail");
const sidebarUsername = $("sidebarUsername");
const sidebarDigiId = $("sidebarDigiId");

const listTitle = $("listTitle");
const navButtons = document.querySelectorAll(".nav-item");

const searchForm = $("searchForm");
const searchInput = $("searchInput");
const searchResults = $("searchResults");
const conversationsList = $("conversationsList");
const newChatBtn = $("newChatBtn");

const chatWelcome = $("chatWelcome");
const chatPanel = $("chatPanel");
const chatAvatar = $("chatAvatar");
const activeChatName = $("activeChatName");
const activeChatUsername = $("activeChatUsername");
const messagesContainer = $("messagesContainer");
const messageForm = $("messageForm");
const messageInput = $("messageInput");
const sendBtn = $("sendBtn");
const emojiBtn = $("emojiBtn");

// ==========================================
// 3. APP STATE
// ==========================================

let currentMode = "login";
let currentUserProfile = null;
let currentChat = null;
let isCreatingAccount = false;

let usernameTimer = null;
let searchTimer = null;

let unsubscribeMessages = null;
let unsubscribeChats = null;

let chatCache = [];

// ==========================================
// 4. HELPERS
// ==========================================

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

function createElement(tag, className = "", text = "") {
  const element = document.createElement(tag);

  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;

  return element;
}

function usernameRef(username) {
  return doc(db, "usernames", username);
}

function getChatId(uid1, uid2) {
  return [uid1, uid2].sort().join("_");
}

function formatTime(timestamp) {
  if (!timestamp?.toDate) return "";

  return timestamp.toDate().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function showListMessage(text) {
  conversationsList.replaceChildren(
    createElement("p", "search-info", text)
  );
}

function stopChatListeners() {
  if (unsubscribeMessages) {
    unsubscribeMessages();
    unsubscribeMessages = null;
  }

  if (unsubscribeChats) {
    unsubscribeChats();
    unsubscribeChats = null;
  }
}

// ==========================================
// 5. USERNAME CHECK
// ==========================================

async function checkUsernameAvailability() {
  const username = normalizeUsername(usernameInput.value);

  if (username.length < 3 || username.length > 20) {
    usernameStatus.textContent = "Username must be 3–20 characters.";
    usernameStatus.style.color = "#ff7777";
    return false;
  }

  if (!validUsername(username)) {
    usernameStatus.textContent =
      "Use letters, numbers, dots or underscores. Start and end with a letter or number.";
    usernameStatus.style.color = "#ff7777";
    return false;
  }

  usernameStatus.textContent = "Checking...";
  usernameStatus.style.color = "#94a3b8";

  try {
    const snap = await getDoc(usernameRef(username));

    if (normalizeUsername(usernameInput.value) !== username) {
      return false;
    }

    if (snap.exists()) {
      usernameStatus.textContent = "Username already taken.";
      usernameStatus.style.color = "#ff7777";
      return false;
    }

    usernameStatus.textContent = "Username available!";
    usernameStatus.style.color = "#4be3a1";
    return true;

  } catch (error) {
    console.error(error);
    usernameStatus.textContent = "Could not check username. Check Firestore Rules.";
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

// ==========================================
// 6. LOGIN / REGISTER TABS
// ==========================================

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

// ==========================================
// 7. CREATE USER PROFILE
// ==========================================

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

// ==========================================
// 8. EXISTING USER PROFILE
// ==========================================

async function ensureUserProfile(user) {
  const publicRef = doc(db, "publicProfiles", user.uid);
  const privateRef = doc(db, "privateUsers", user.uid);

  const [publicSnap, privateSnap] = await Promise.all([
    getDoc(publicRef),
    getDoc(privateRef)
  ]);

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

  if (!publicSnap.exists() || !privateSnap.exists()) {
    await batch.commit();
  }

  const updated = await getDoc(publicRef);
  return updated.data();
}

// ==========================================
// 9. SHOW PROFILE
// ==========================================

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
    sidebarAvatar.style.backgroundImage = `url("${profile.photoURL}")`;
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
    startChatsListener();
  } catch (error) {
    console.error("Profile loading error:", error);
    alert("Could not load your profile: " + error.message);
  }
}

// ==========================================
// 10. REGISTER / LOGIN
// ==========================================

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
        await updateProfile(result.user, { displayName: name });
        await saveUserProfile(result.user, name, username);
        isCreatingAccount = false;
        await showDashboard(result.user);

      } catch (error) {
        isCreatingAccount = false;

        try {
          await deleteUser(result.user);
        } catch (cleanupError) {
          console.error(cleanupError);
        }

        throw error;
      }

    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }

  } catch (error) {
    isCreatingAccount = false;

    const errors = {
      USERNAME_TAKEN: "Username already taken. Try another.",
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
    console.error(error);

  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent =
      currentMode === "register" ? "Create Account" : "Login";
  }
});

// ==========================================
// 11. AUTH STATE
// ==========================================

onAuthStateChanged(auth, async (user) => {
  if (isCreatingAccount) return;

  if (user) {
    await showDashboard(user);
  } else {
    stopChatListeners();
    currentChat = null;
    currentUserProfile = null;
    appView.hidden = true;
    authView.hidden = false;
    setMode("login");
  }
});

// ==========================================
// 12. LOGOUT
// ==========================================

logoutBtn.addEventListener("click", async () => {
  try {
    stopChatListeners();
    await signOut(auth);
  } catch (error) {
    console.error(error);
    alert("Logout failed: " + error.message);
  }
});

// ==========================================
// 13. USER SEARCH
// ==========================================

function showSearchMessage(text) {
  searchResults.replaceChildren(
    createElement("p", "search-info", text)
  );
  searchResults.hidden = false;
}

async function findUser(value) {
  const term = value.trim();

  if (!term) return null;

  if (term.toUpperCase().startsWith("DGC-")) {
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

    return { uid: profileDoc.id, ...profileDoc.data() };
  }

  const username = normalizeUsername(term);

  if (!validUsername(username)) return null;

  const usernameSnap = await getDoc(usernameRef(username));

  if (!usernameSnap.exists()) return null;

  const uid = usernameSnap.data().uid;

  if (uid === auth.currentUser.uid) {
    return { ownAccount: true };
  }

  const profileSnap = await getDoc(doc(db, "publicProfiles", uid));

  if (!profileSnap.exists()) return null;

  return { uid, ...profileSnap.data() };
}

async function isAlreadyContact(uid) {
  const ref = doc(db, "contacts", auth.currentUser.uid, "items", uid);
  const snap = await getDoc(ref);
  return snap.exists();
}

async function addContact(profile) {
  const currentUid = auth.currentUser.uid;

  if (profile.uid === currentUid) {
    throw new Error("You cannot add yourself.");
  }

  const contactRef = doc(db, "contacts", currentUid, "items", profile.uid);
  const existing = await getDoc(contactRef);

  if (existing.exists()) {
    throw new Error("Already in your contacts.");
  }

  await setDoc(contactRef, {
    uid: profile.uid,
    name: profile.name || "DigiChat User",
    username: profile.username || "",
    uniqueId: profile.uniqueId || "",
    addedAt: serverTimestamp()
  });
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

  info.append(
    createElement("h3", "", profile.name || "DigiChat User"),
    createElement("p", "", profile.username ? "@" + profile.username : ""),
    createElement("small", "", profile.uniqueId || "")
  );

  const addButton = createElement(
    "button",
    "add-contact-btn",
    alreadyAdded ? "Added" : "Add Contact"
  );

  addButton.type = "button";
  addButton.disabled = alreadyAdded;

  addButton.addEventListener("click", async () => {
    if (alreadyAdded) return;

    addButton.disabled = true;
    addButton.textContent = "Adding...";

    try {
      await addContact(profile);
      addButton.textContent = "Added";
    } catch (error) {
      console.error(error);
      addButton.disabled = false;
      addButton.textContent = "Add Contact";
      alert(error.message);
    }
  });

  card.append(avatar, info, addButton);
  searchResults.appendChild(card);
  searchResults.hidden = false;
}

async function performUserSearch() {
  const term = searchInput.value.trim();

  if (!term || !auth.currentUser) {
    searchResults.hidden = true;
    return;
  }

  showSearchMessage("Searching...");

  try {
    const profile = await findUser(term);

    if (!profile) {
      showSearchMessage("No user found. Check username or DigiChat ID.");
      return;
    }

    if (profile.ownAccount) {
      showSearchMessage("This is your own account.");
      return;
    }

    const added = await isAlreadyContact(profile.uid);
    renderSearchResult(profile, added);

  } catch (error) {
    console.error(error);
    showSearchMessage("Search failed. Check Firestore Rules.");
  }
}

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  performUserSearch();
});

searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);

  searchTimer = setTimeout(() => {
    if (searchInput.value.trim().length >= 3) {
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

// ==========================================
// 14. CONTACTS LIST
// ==========================================

async function loadContacts() {
  if (!auth.currentUser) return;

  showListMessage("Loading contacts...");

  try {
    const ref = collection(db, "contacts", auth.currentUser.uid, "items");
    const snapshot = await getDocs(ref);

    conversationsList.replaceChildren();

    if (snapshot.empty) {
      const empty = createElement("div", "empty-state");

      empty.append(
        createElement("div", "empty-icon", "♟"),
        createElement("h3", "", "No contacts yet"),
        createElement("p", "", "Search for people to add contacts.")
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
        createElement("p", "", contact.username ? "@" + contact.username : ""),
        createElement("small", "", contact.uniqueId || "")
      );

      const openButton = createElement("button", "open-chat-btn", "Message");
      openButton.type = "button";

      openButton.addEventListener("click", () => {
        openChat({
          uid: contact.uid,
          name: contact.name,
          username: contact.username,
          uniqueId: contact.uniqueId
        });
      });

      const removeButton = createElement("button", "remove-contact-btn", "Remove");
      removeButton.type = "button";

      removeButton.addEventListener("click", async () => {
        if (!confirm("Remove this contact?")) return;

        try {
          await deleteDoc(
            doc(db, "contacts", auth.currentUser.uid, "items", contactDoc.id)
          );
          await loadContacts();
        } catch (error) {
          alert("Could not remove contact: " + error.message);
        }
      });

      card.append(avatar, info, openButton, removeButton);
      conversationsList.appendChild(card);
    });

  } catch (error) {
    console.error(error);
    showListMessage("Could not load contacts. Check Firestore Rules.");
  }
}

// ==========================================
// 15. OPEN OR CREATE CHAT
// ==========================================

async function openChat(user) {
  if (!auth.currentUser) return;

  if (user.uid === auth.currentUser.uid) {
    alert("You cannot chat with yourself.");
    return;
  }

  try {
    const chatId = getChatId(auth.currentUser.uid, user.uid);
    const chatRef = doc(db, "chats", chatId);

    const chatSnap = await getDoc(chatRef);

    if (!chatSnap.exists()) {
      await setDoc(chatRef, {
        members: [auth.currentUser.uid, user.uid].sort(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastMessage: "",
        lastSenderId: ""
      });
    }

    currentChat = {
      id: chatId,
      otherUser: user
    };

    chatWelcome.hidden = true;
    chatPanel.hidden = false;

    activeChatName.textContent = user.name || "DigiChat User";
    activeChatUsername.textContent = user.username
      ? "@" + user.username
      : "";

    chatAvatar.textContent = (user.name || "U").charAt(0).toUpperCase();

    if (user.photoURL) {
      chatAvatar.style.backgroundImage = `url("${user.photoURL}")`;
      chatAvatar.style.backgroundSize = "cover";
      chatAvatar.style.backgroundPosition = "center";
      chatAvatar.textContent = "";
    } else {
      chatAvatar.style.backgroundImage = "none";
    }

    messagesContainer.replaceChildren(
      createElement("p", "search-info", "Loading messages...")
    );

    listenToMessages(chatId);
    messageInput.focus();

  } catch (error) {
    console.error("Open chat error:", error);
    alert("Could not open chat: " + error.message);
  }
}

// ==========================================
// 16. REAL-TIME MESSAGE LISTENER
// ==========================================

function listenToMessages(chatId) {
  if (unsubscribeMessages) {
    unsubscribeMessages();
  }

  const messagesRef = collection(db, "chats", chatId, "messages");
  const messagesQuery = query(
    messagesRef,
    orderBy("createdAt", "asc"),
    limit(100)
  );

  unsubscribeMessages = onSnapshot(
    messagesQuery,
    (snapshot) => {
      messagesContainer.replaceChildren();

      if (snapshot.empty) {
        messagesContainer.appendChild(
          createElement("div", "empty-state", "Start your conversation!")
        );
        return;
      }

      snapshot.forEach((messageDoc) => {
        const data = messageDoc.data();
        const mine = data.senderId === auth.currentUser.uid;

        const bubble = createElement(
          "div",
          mine ? "message-bubble sent" : "message-bubble received"
        );

        const text = createElement("p", "message-text", data.text || "");
        const time = createElement(
          "small",
          "message-time",
          formatTime(data.createdAt)
        );

        bubble.append(text, time);
        messagesContainer.appendChild(bubble);
      });

      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    },
    (error) => {
      console.error("Message listener error:", error);
      messagesContainer.replaceChildren(
        createElement("p", "search-info", "Could not load messages.")
      );
    }
  );
}

// ==========================================
// 17. SEND MESSAGE
// ==========================================

messageForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const text = messageInput.value.trim();

  if (!text || !currentChat || !auth.currentUser) return;

  if (text.length > 5000) {
    alert("Message is too long.");
    return;
  }

  sendBtn.disabled = true;

  try {
    const chatRef = doc(db, "chats", currentChat.id);
    const messageRef = doc(
      collection(db, "chats", currentChat.id, "messages")
    );

    const batch = writeBatch(db);

    batch.set(messageRef, {
      text,
      senderId: auth.currentUser.uid,
      createdAt: serverTimestamp()
    });

    batch.update(chatRef, {
      lastMessage: text,
      lastSenderId: auth.currentUser.uid,
      updatedAt: serverTimestamp()
    });

    await batch.commit();

    messageInput.value = "";
    messageInput.focus();

  } catch (error) {
    console.error("Send message error:", error);
    alert("Message could not be sent: " + error.message);
  } finally {
    sendBtn.disabled = false;
  }
});

// ==========================================
// 18. EMOJI BUTTON
// ==========================================

emojiBtn.addEventListener("click", () => {
  const emojis = ["😀", "😂", "❤️", "😍", "👍", "🙏", "🔥", "🎉", "😊", "😎"];

  const emoji = emojis[Math.floor(Math.random() * emojis.length)];

  const start = messageInput.selectionStart;
  const end = messageInput.selectionEnd;
  const value = messageInput.value;

  messageInput.value =
    value.slice(0, start) + emoji + value.slice(end);

  messageInput.focus();

  const cursor = start + emoji.length;
  messageInput.setSelectionRange(cursor, cursor);
});

// ==========================================
// 19. REAL-TIME CHAT LIST
// ==========================================

function startChatsListener() {
  if (!auth.currentUser) return;

  if (unsubscribeChats) unsubscribeChats();

  const chatsQuery = query(
    collection(db, "chats"),
    where("members", "array-contains", auth.currentUser.uid)
  );

  unsubscribeChats = onSnapshot(
    chatsQuery,
    async (snapshot) => {
      const chats = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data()
      }));

      chats.sort((a, b) => {
        const timeA = a.updatedAt?.toMillis?.() || 0;
        const timeB = b.updatedAt?.toMillis?.() || 0;
        return timeB - timeA;
      });

      chatCache = chats;

      const activePage = document.querySelector(".nav-item.active")?.dataset.page;

      if (activePage === "messages") {
        await renderChatList(chats);
      }
    },
    (error) => {
      console.error("Chat list listener error:", error);
      showListMessage("Could not load chats. Check Firestore Rules.");
    }
  );
}

async function renderChatList(chats) {
  conversationsList.replaceChildren();

  if (!chats.length) {
    const empty = createElement("div", "empty-state");

    empty.append(
      createElement("div", "empty-icon", "☏"),
      createElement("h3", "", "No conversations yet"),
      createElement("p", "", "Open a contact and send your first message.")
    );

    conversationsList.appendChild(empty);
    return;
  }

  for (const chat of chats) {
    const otherUid = chat.members.find(
      (uid) => uid !== auth.currentUser.uid
    );

    if (!otherUid) continue;

    try {
      const profileSnap = await getDoc(
        doc(db, "publicProfiles", otherUid)
      );

      if (!profileSnap.exists()) continue;

      const profile = {
        uid: otherUid,
        ...profileSnap.data()
      };

      const card = createElement("button", "conversation-card");
      card.type = "button";

      const avatar = createElement(
        "div",
        "avatar",
        (profile.name || "U").charAt(0).toUpperCase()
      );

      const info = createElement("div", "conversation-info");

      info.append(
        createElement("h3", "", profile.name || "DigiChat User"),
        createElement(
          "p",
          "",
          chat.lastMessage || "Start a conversation"
        )
      );

      const time = createElement(
        "small",
        "conversation-time",
        formatTime(chat.updatedAt)
      );

      card.append(avatar, info, time);

      card.addEventListener("click", () => openChat(profile));

      conversationsList.appendChild(card);

    } catch (error) {
      console.error("Chat profile load error:", error);
    }
  }
}

// ==========================================
// 20. SIDEBAR NAVIGATION
// ==========================================

navButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    navButtons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");

    const page = button.dataset.page;

    const titles = {
      messages: "Messages",
      contacts: "Contacts",
      profile: "My Profile",
      settings: "Settings"
    };

    listTitle.textContent = titles[page] || "DigiChat";
    searchResults.hidden = true;

    if (page === "messages") {
      await renderChatList(chatCache);
    }

    if (page === "contacts") {
      await loadContacts();
    }

    if (page === "profile") {
      conversationsList.replaceChildren();

      const profile = currentUserProfile || {};

      const box = createElement("div", "empty-state");

      box.append(
        createElement("h3", "", profile.name || "My Profile"),
        createElement("p", "", profile.username ? "@" + profile.username : "Username not set"),
        createElement("p", "", profile.uniqueId || "")
      );

      conversationsList.appendChild(box);
    }

    if (page === "settings") {
      conversationsList.replaceChildren();

      const box = createElement("div", "empty-state");

      box.append(
        createElement("h3", "", "Settings"),
        createElement("p", "", "More settings will be available soon.")
      );

      conversationsList.appendChild(box);
    }
  });
});

// ==========================================
// 21. INITIAL STATE
// ==========================================

chatWelcome.hidden = false;
chatPanel.hidden = true;

console.log("DigiChat Real-Time Messaging Loaded");
