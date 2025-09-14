import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import {
  getFirestore,
  doc,
  collection,
  addDoc,
  setDoc,
  getDoc,
  deleteDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  setPersistence,
  browserLocalPersistence,
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

async function loadCurrentAttempt(userId, quizType) {
  const attemptRef = doc(
    db,
    "users",
    userId,
    "currentAttempts",
    `${quizType}_current`
  );

  const snapshot = await getDoc(attemptRef);
  return snapshot.exists() ? snapshot.data() : null;
}

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
const auth = getAuth(app);

let currentUserId = null;

onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUserId = user.uid;
    console.log("User signed in:", currentUserId);
  } else {
    console.warn("No user signed in");
    window.location.href = "index.html";
  }
});
let annotations = [];
let score = 0;
const questions = [];
let answerChecked = false;
const questionResults = []; // { index: 0, status: 'correct' | 'incorrect' | 'unanswered' }
let quizName;

window.addEventListener("DOMContentLoaded", function () {
  const urlParams = new URLSearchParams(window.location.search);
  const quizType = urlParams.get("uid") || "2976f868447f433bbec2a3a53c71ab99"; // fallback default

  const url = `https://api.sketchfab.com/v3/models/${quizType}`;

  fetch(url)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      quizName = data.name.replaceAll("/", "-");
    })
    .catch((error) => {
      console.error("Error fetching model:", error);
    });

  console.log(quizName);

  const iframe = document.getElementById("api-frame");

  const client = new Sketchfab("1.12.1", iframe);

  client.init(quizType, {
    success: function (api) {
      api.start();

      api.addEventListener("viewerready", function () {
        api.getAnnotationList(function (err, annots) {
          if (!err) {
            annotations = annots;
            emptyAnnotations(api);
            makeQuestions(); // create all questions initially

            (async () => {
              let attemptData = null;
              const shouldReset = urlParams.get("reset") === "1";

              if (currentUserId && !shouldReset) {
                attemptData = await loadCurrentAttempt(currentUserId, quizName);

                if (attemptData?.questionOrder) {
                  reorderQuestions(attemptData.questionOrder); // restore saved order
                } else {
                  shuffleQuestions(questions); // only shuffle for new quizzes
                }
              }

              displayQuestions();

              if (attemptData?.questionResults) {
                restoreAnswers(attemptData.questionResults);
              }

              document.getElementById("quiz-container").style.display = "block";
            })();
          }
        });
      });
    },
    error: function () {
      console.error("Sketchfab API error");
    },
    autostart: 1,
    preload: 1,
  });
});

function emptyAnnotations(api) {
  annotations.forEach((_, i) => {
    api.updateAnnotation(i, { title: "---", content: undefined });
  });
}

function makeQuestions() {
  annotations.forEach((annot, i) => {
    const correctIndex = (i + 1).toString();
    const options = new Set([correctIndex]);
    while (options.size < 5) {
      const rand = Math.floor(Math.random() * annotations.length) + 1;
      options.add(rand.toString());
    }

    questions.push({
      question: `Where is ${annot.name}?`,
      correctAnswerIndex: correctIndex,
      options: Array.from(options).sort(() => Math.random() - 0.5),
    });
  });
}

function shuffleQuestions(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function reorderQuestions(savedOrder) {
  questions.sort((a, b) => {
    return (
      savedOrder.indexOf(a.correctAnswerIndex) -
      savedOrder.indexOf(b.correctAnswerIndex)
    );
  });
}

function displayQuestions() {
  const questionElement = document.getElementById("question");
  const optionsElement = document.getElementById("options");
  const result = document.getElementById("result");

  result.textContent = "";

  let html = "";
  questions.forEach((q, index) => {
    html += `<div class="question-block" id="q-block-${index}">
      <p><strong>Q${index + 1}: ${q.question}</strong></p>`;
    q.options.forEach((option) => {
      html += `
        <label>
          <input type="radio" name="answer-${index}" value="${option}"> Annotation ${option}
        </label><br/>`;
    });
    html += `
      <button id="submit-${index}" disabled>Submit Answer</button>
      <p id="feedback-${index}" class="feedback"></p>
    </div><br/>`;
  });

  questionElement.innerHTML = "";
  optionsElement.innerHTML = html;

  // Add event listeners for radios and submit buttons
  questions.forEach((q, index) => {
    const radios = document.querySelectorAll(`input[name="answer-${index}"]`);
    const submitBtn = document.getElementById(`submit-${index}`);

    radios.forEach((radio) => {
      radio.addEventListener("change", () => {
        submitBtn.disabled = false;
      });
    });

    submitBtn.addEventListener("click", () => handleAnswer(q, index));
  });
}

function handleAnswer(question, index) {
  const selected = document.querySelector(
    `input[name="answer-${index}"]:checked`
  );
  const feedback = document.getElementById(`feedback-${index}`);
  const submitBtn = document.getElementById(`submit-${index}`);

  if (!selected) return;

  const isCorrect = selected.value === question.correctAnswerIndex;
  feedback.textContent = isCorrect
    ? "✅ Correct!"
    : `❌ Incorrect. Correct answer is Annotation ${question.correctAnswerIndex}`;
  feedback.style.color = isCorrect ? "green" : "red";

  if (isCorrect) score++;

  document
    .querySelectorAll(`input[name="answer-${index}"]`)
    .forEach((radio) => {
      radio.disabled = true;
    });
  submitBtn.disabled = true;

  // Ensure the result array has a slot for every question
  if (!questionResults[index]) {
    questionResults[index] = {};
  }

  questionResults[index] = {
    index,
    status: isCorrect ? "correct" : "incorrect",
    selectedAnswer: selected.value,
  };

  // ✅ Save progress
  if (currentUserId) {
    saveCurrentAttempt(currentUserId, quizName, score);
  }
}

function fillUnanswered() {
  for (let i = 0; i < questions.length; i++) {
    if (!questionResults[i]) {
      questionResults[i] = {
        index: i,
        status: "unanswered",
        selectedAnswer: null,
      };
    }
  }
}

async function saveCurrentAttempt(userId, quizName, score) {
  fillUnanswered();
  const currentAttemptRef = doc(
    db,
    "users",
    userId,
    "currentAttempts",
    `${quizName}_current`
  );

  const questionOrder = questions.map((q) => q.correctAnswerIndex); // or another identifier

  await setDoc(
    currentAttemptRef,
    {
      score,
      questionResults,
      questionOrder, // ✅ Save order
      timestamp: serverTimestamp(),
      finalized: false,
    },
    { merge: true }
  );
}

async function finalizeCurrentAttempt(userId, quizName) {
  const currentRef = doc(
    db,
    "users",
    userId,
    "currentAttempts",
    `${quizName}_current`
  );

  const snapshot = await getDoc(currentRef);

  if (snapshot.exists()) {
    const data = snapshot.data();

    // Save to attempts collection
    const attemptsCol = collection(
      db,
      "users",
      userId,
      "pastAttempts",
      quizName,
      "attempts"
    );
    const correct = questionResults.filter(
      (r) => r.status === "correct"
    ).length;
    const incorrect = questionResults.filter(
      (r) => r.status === "incorrect"
    ).length;
    const unanswered = questionResults.filter(
      (r) => r.status === "unanswered"
    ).length;

    await addDoc(attemptsCol, {
      correct: `${correct} `,
      incorrect: `${incorrect}`,
      unanswered: `${unanswered}`,
      finalized: true,
      finalizedAt: serverTimestamp(),
    });

    // Clear current attempt
    await deleteDoc(currentRef);

    async function ensureQuizTypeField(userId, quizTypeId) {
      const quizTypeRef = doc(db, "users", userId, "pastAttempts", quizTypeId);

      await setDoc(
        quizTypeRef,
        {
          myField: "", // 👈 this is the field you want to ensure is always ""
        },
        { merge: true } // ✅ prevents overwriting existing fields
      );
    }

    await ensureQuizTypeField(userId, quizName);
  }
}

document
  .getElementById("end-button")
  .addEventListener("click", () => showScore());

async function showScore() {
  const end = document.getElementById("end-button");
  end.style.display = "none";
  const totalQuestions = questions.length;

  // Fill in unanswered questions
  for (let i = 0; i < totalQuestions; i++) {
    if (!questionResults[i]) {
      questionResults[i] = { index: i, status: "unanswered" };
    }
  }

  document.querySelectorAll('input[type="radio"]').forEach((radio) => {
    radio.disabled = true;
  });
  document.querySelectorAll('button[id^="submit-"]').forEach((btn) => {
    btn.disabled = true;
  });

  const correct = questionResults.filter((r) => r.status === "correct").length;
  const incorrect = questionResults.filter(
    (r) => r.status === "incorrect"
  ).length;
  const unanswered = questionResults.filter(
    (r) => r.status === "unanswered"
  ).length;

  const container = document.getElementById("quiz-container");
  const resultBlock = document.createElement("div");
  const percent = (score / totalQuestions) * 100;

  resultBlock.innerHTML = `
    <h2>Quiz Completed!</h2>
    <p>Your score: ${percent}%</p>
    <ul>
      <li>✅ Correct: ${correct}</li>
      <li>❌ Incorrect: ${incorrect}</li>
      <li>❓ Unanswered: ${unanswered}</li>
    </ul>
    <button onclick="location.reload()">Take Quiz Again</button>
  `;

  container.appendChild(resultBlock);
  // Firestore/form submission
  const urlParams = new URLSearchParams(window.location.search);
  const quizType = urlParams.get("uid") || "2976f868447f433bbec2a3a53c71ab99";
  const courseNum = "not set";
  finalizeCurrentAttempt(currentUserId, quizName);

  const docRef = doc(db, "users", currentUserId);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    const data = docSnap.data();
    courseNum=data.courseType;
    console.log("courseType:", data.courseType || "not set");
    } else {
    console.warn("No coursenum doc found");
  }



  const form = document.getElementById("form");
  form.innerHTML = `
    <input type="hidden" name="modelId" value="${quizType}" />
    <input type="hidden" name="user" value="${currentUserId}" />
    <input type="hidden" name="score" value="${score}/${totalQuestions}" />
    <input type="hidden" name="course" value="${courseNum}" />

  `;
  form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
}

document.getElementById("form").addEventListener("submit", function (event) {
  event.preventDefault();

  const formData = new FormData(this);

  fetch(this.action, {
    method: "POST",
    body: formData, // ✅ Drop manual encoding
  })
    .then(() => {
      this.reset();
    })
    .catch(() => {});
});

function restoreAnswers(savedResults) {
  savedResults.forEach(({ index, status, selectedAnswer }) => {
    const feedback = document.getElementById(`feedback-${index}`);
    const submitBtn = document.getElementById(`submit-${index}`);

    if (status === "correct" || status === "incorrect") {
      const radios = document.querySelectorAll(`input[name="answer-${index}"]`);

      radios.forEach((radio) => {
        radio.disabled = true;
        if (radio.value === selectedAnswer) {
          radio.checked = true;
        }
      });

      if (status === "correct") {
        feedback.textContent = "✅ Correct!";
        feedback.style.color = "green";
        score++;
      } else {
        const correctAnswerIndex = questions[index].correctAnswerIndex;
        feedback.textContent = `❌ Incorrect. Correct answer is Annotation ${correctAnswerIndex}`;
        feedback.style.color = "red";
      }
      submitBtn.disabled = true;
      questionResults[index] = { index, status, selectedAnswer };
    }
  });
}

document.getElementById("logout-button").addEventListener("click", () => {
  signOut(auth)
    .then(() => {
      console.log("User signed out.");
      // Redirect to login or homepage
      window.location.href = "index.html"; // Change as needed
    })
    .catch((error) => {
      console.error("Sign-out error:", error);
    });
});

document.getElementById("home-button").addEventListener("click", () => {
  window.location.href =
    "https://ohns.ucsf.edu/sinus/virtual-reality-anatomic-lab"; // Change as needed
});
