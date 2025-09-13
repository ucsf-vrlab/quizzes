import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";

import {
  getAuth,
  signOut,
  signInWithEmailAndPassword,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyC6H2NaGIybnyu2tH0nT7royeibAebJAIY",
  authDomain: "model-191ff.firebaseapp.com",
  projectId: "model-191ff",
  storageBucket: "model-191ff.appspot.com",
  messagingSenderId: "715464346435",
  appId: "1:715464346435:web:9e7a2105772e38a903bdf6",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Elements
const form = document.getElementById("login-form");
const message = document.getElementById("message");
const signoutButton = document.getElementById("signout-button");
const viewModeSelect = document.getElementById("view-mode");
const resultsContainer = document.getElementById("study-results");
const search = document.getElementById("search-input");
// Handle login
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );
    const user = userCredential.user;
    message.textContent = `✅ Signed in as ${user.email}`;
    message.style.color = "green";
    location.reload();
  } catch (error) {
    message.textContent = error.message;
    message.style.color = "red";
  }
});

// Handle auth state
onAuthStateChanged(auth, (user) => {
  const isLoggedIn = !!user;
  loadStudyData();

  search.style.display = isLoggedIn ? "inline-block" : "none";

  signoutButton.style.display = isLoggedIn ? "inline-block" : "none";
  viewModeSelect.style.display = isLoggedIn ? "inline-block" : "none";
  form.style.display = isLoggedIn ? "none" : "block";
});

// Handle signout
signoutButton.addEventListener("click", async () => {
  await signOut(auth);
  alert("Signed out successfully!");
  location.reload();
});

// Main data loader
async function loadStudyData() {
  resultsContainer.innerHTML = "";
  const mode = viewModeSelect.value;
  const search = document.getElementById("search-input").value.toLowerCase();

  if (mode === "by-user") {
    await loadByUser(resultsContainer, search);
  } else if (mode === "all-attempts") {
    await loadAllAttempts(resultsContainer, search);
  }
}

viewModeSelect.addEventListener("change", loadStudyData);
document
  .getElementById("search-input")
  .addEventListener("input", loadStudyData);

// View Mode 1: Grouped by user
async function loadByUser(container, search) {
  container.innerHTML = ""; // 🔧 CLEAR previous content before adding new results

  const usersSnap = await getDocs(collection(db, "users"));

  for (const userDoc of usersSnap.docs) {
    const userData = userDoc.data();
    const userId = userDoc.id;
    const courseType = userData.courseType?.toLowerCase() || "";

    // 🔍 Filter by courseType (not quizType)
    if (search && !courseType.includes(search.toLowerCase())) {
      continue; // Skip this user if courseType doesn't match
    }

    const pastAttemptsRef = collection(db, "users", userId, "pastAttempts");
    const pastAttemptsSnap = await getDocs(pastAttemptsRef);

    let html = `<div><h2>User: ${userId}</h2>`;
    html += `<p><strong>Course Type:</strong> ${userData.courseType ?? "N/A"}</p>`;
    html += `<pre>${JSON.stringify(userData, null, 2)}</pre>`;

    if (!pastAttemptsSnap.empty) {
      for (const quizTypeDoc of pastAttemptsSnap.docs) {
        const quizTypeId = quizTypeDoc.id;

        html += `<h4>Quiz Type: ${quizTypeId}</h4>`;

        const attemptsRef = collection(
          db,
          "users",
          userId,
          "pastAttempts",
          quizTypeId,
          "attempts"
        );
        const attemptsQuery = query(
          attemptsRef,
          orderBy("finalizedAt", "desc")
        );
        const attemptsSnap = await getDocs(attemptsQuery);

        if (!attemptsSnap.empty) {
          html += `<table><tr><th>Date</th><th>Correct</th><th>Incorrect</th><th>Unanswered</th></tr>`;

          attemptsSnap.forEach((attemptDoc) => {
            const attempt = attemptDoc.data();
            const date =
              attempt.finalizedAt?.toDate().toLocaleString() || "Unknown date";

            html += `<tr>
              <td>${date}</td>
              <td>${attempt.correct ?? "N/A"}</td>
              <td>${attempt.incorrect ?? "N/A"}</td>
              <td>${attempt.unanswered ?? "N/A"}</td>
            </tr>`;
          });

          html += `</table>`;
        } else {
          html += `<p>No attempts for this quiz.</p>`;
        }
      }
    } else {
      html += `<p>No past attempts found.</p>`;
    }

    html += `</div><hr>`;
    container.innerHTML += html;
  }
}

// View Mode 2: All attempts across all users
async function loadAllAttempts(container, search) {
  const allAttempts = [];
  const usersSnap = await getDocs(collection(db, "users"));

  for (const userDoc of usersSnap.docs) {
    const userData = userDoc.data();
    const userId = userDoc.id;
    const courseType = userData.courseType?.toLowerCase() || "";

    // ❌ Skip users that don't match the courseType search
    if (search && !courseType.includes(search.toLowerCase())) {
      continue;
    }

    const pastAttemptsSnap = await getDocs(
      collection(db, "users", userId, "pastAttempts")
    );

    for (const quizTypeDoc of pastAttemptsSnap.docs) {
      const quizTypeId = quizTypeDoc.id;

      const attemptsRef = collection(
        db,
        "users",
        userId,
        "pastAttempts",
        quizTypeId,
        "attempts"
      );
      const attemptsSnap = await getDocs(attemptsRef);

      attemptsSnap.forEach((attemptDoc) => {
        const data = attemptDoc.data();
        allAttempts.push({
          userId,
          courseType: userData.courseType ?? "N/A",
          quizType: quizTypeId,
          date: data.finalizedAt?.toDate() || new Date(0),
          correct: data.correct ?? "N/A",
          incorrect: data.incorrect ?? "N/A",
          unanswered: data.unanswered ?? "N/A",
        });
      });
    }
  }

  // Sort all attempts by date (newest first)
  allAttempts.sort((a, b) => b.date - a.date);

  let html = `<h2>All Attempts (Newest First)</h2>`;
  html += `<table border="1" cellpadding="5"><tr>
    <th>Date</th>
    <th>User</th>
    <th>Course Type</th>
    <th>Quiz Type</th>
    <th>Correct</th>
    <th>Incorrect</th>
    <th>Unanswered</th>
  </tr>`;

  allAttempts.forEach((a) => {
    html += `<tr>
      <td>${a.date.toLocaleString()}</td>
      <td>${a.userId}</td>
      <td>${a.courseType}</td>
      <td>${a.quizType}</td>
      <td>${a.correct}</td>
      <td>${a.incorrect}</td>
      <td>${a.unanswered}</td>
    </tr>`;
  });

  html += `</table>`;
  container.innerHTML = html;
}
