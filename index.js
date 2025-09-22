import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence,
} from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  query,
  where,
  getDocs,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";

// ✅ Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyC6H2NaGIybnyu2tH0nT7royeibAebJAIY",
  authDomain: "model-191ff.firebaseapp.com",
  projectId: "model-191ff",
  storageBucket: "model-191ff.appspot.com", // 🔄 Fix URL
  messagingSenderId: "715464346435",
  appId: "1:715464346435:web:9e7a2105772e38a903bdf6",
  measurementId: "G-Y1X9FJZ082",
};

// ✅ Initialize Firebase
const app = initializeApp(firebaseConfig);

const db = getFirestore(app);
const auth = getAuth();

setPersistence(auth, browserLocalPersistence); // Stays logged in across sessions

function getIdFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get("uid");
  return id;
}

const id = getIdFromUrl();
console.log(id);
// ✅ Utility function to show messages
function showMessage(message, divId) {
  var messageDiv = document.getElementById(divId);
  messageDiv.style.display = "block";
  messageDiv.innerHTML = message;
  messageDiv.style.opacity = 1;
  setTimeout(function () {
    messageDiv.style.opacity = 0;
  }, 5000);
}

const courseNumber = document.getElementById("courseNumber");

// ✅ Wrap in DOMContentLoaded
const signUp = document.getElementById("submitSignUp");

signUp.addEventListener("click", (event) => {
  event.preventDefault();

  const email = document.getElementById("rEmail").value;
  const password = document.getElementById("rPassword").value;
  const level = document.getElementById("educationLevel").value;
  const country = document.getElementById("country").value;
  const type = courseNumber.value;
  const institution = document.getElementById("institution").value;

  createUserWithEmailAndPassword(auth, email, password)
    .then(async (userCredential) => {
      const user = userCredential.user;

      await setDoc(doc(db, "users", user.uid), {
        email: email,
        levelOfEducation: level,
        country: country,
        courseType: type,
        institution: institution,
      });

      // ✅ Redirect to homepage after successful signup and login
      window.location.href = `https://ucsf-vrlab.github.io/quizzes/homepage.html?uid=${id}`; // replace with your actual homepage
    })
    .catch((error) => {
      console.error("Signup error:", error);
      alert(error.message); // optional user feedback
    });
});

const signIn = document.getElementById("submitSignIn");

signIn.addEventListener("click", async (event) => {
  event.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const auth = getAuth();
  const db = getFirestore();

  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );
    const user = userCredential.user;

    showMessage("Login is successful", "signInMessage");

    localStorage.setItem("loggedInUserId", user.uid);

    const userDocRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(userDocRef);

    if (!docSnap.exists()) {
      // Create new user document
      await setDoc(userDocRef, {
        email: user.email,
        createdAt: new Date(), // or serverTimestamp()
        displayName: user.displayName || "",
      });
      console.log("✅ New user document created.");
    } else {
      console.log("👤 User document already exists.");
    }

    window.location.href = `https://ucsf-vrlab.github.io/quizzes/homepage.html?uid=${id}`; // replace with your actual homepage
  } catch (error) {
    console.error("❌ Sign-in error:", error);
    showMessage("Login failed: " + error.message, "signInMessage");
  }
});

const resetForm = document.getElementById("resetForm");

resetForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document
    .getElementById("resetEmail")
    .value.trim()
    .toLowerCase();

  if (!email) {
    showMessage("❌ Please enter an email address.", "resetMessage");
    return;
  }

  try {
    // Check Firestore users collection for the email
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("email", "==", email));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      showMessage("❌ No account found with that email.", "resetMessage");
      return;
    }

    // Email exists in Firestore, now send password reset email
    await sendPasswordResetEmail(auth, email);
    showMessage("✅ Password reset email sent!", "resetMessage");
  } catch (error) {
    showMessage("❌ Error: " + error.message, "resetMessage");
  }
});
