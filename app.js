import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getFirestore, collection, addDoc, getDocs, updateDoc, deleteDoc, doc, serverTimestamp,
  query, orderBy, where, limit, runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyC77yW_lz1I5a-kZi4BCwLqU3FWes3-_xw",
  authDomain: "safe-fly-complaint-portal.firebaseapp.com",
  projectId: "safe-fly-complaint-portal",
  storageBucket: "safe-fly-complaint-portal.firebasestorage.app",
  messagingSenderId: "952760102417",
  appId: "1:952760102417:web:53223bb1e451d17b170bb0",
  measurementId: "G-SBM0G031PK"
};

const ALLOWED_ADMIN_EMAILS = [
  "seif@birdaviation.co.za",
  "chenee.coetzer@safeflyexpress.com",
  "viantha.chetty@safeflyexpress.com",
  "ma.sebaei@safeflyexpress.com",
  "omar@safeflyexpress.com",
  "azzam@safeflyexpress.com",
  "qsm@safeflyexpress.com"
];
const SUPER_ADMIN_EMAIL = "azzam@safeflyexpress.com";
const CATEGORIES = ["Suggestion","Academic","Facilities","Safety","Staff Conduct","Transport","Other"];
const STATUSES = ["New","In Progress","Resolved","Closed"];

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let complaintsCache = [];
let currentAdmin = null;
let lastSubmittedReference = "";

window.showPage = function(id) {
  if (id === "reportPage" && (!currentAdmin || !isAllowedAdmin(currentAdmin.email))) {
    alert("Admin login required to view reports.");
    return;
  }

  ["submitPage","thankYouPage","lookupPage","adminPage","reportPage"].forEach(p => document.getElementById(p).classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
  if (id === "reportPage") loadComplaints();
  window.scrollTo({ top: 0, behavior: "smooth" });
};

window.startNewComplaint = function() {
  document.getElementById("submitMessage").textContent = "";
  window.showPage("submitPage");
};

window.goToTrackFromThanks = function() {
  window.showPage("lookupPage");
  document.getElementById("lookupReference").value = lastSubmittedReference;
  studentLookup();
};

document.getElementById("identityType").addEventListener("change", function() {
  document.getElementById("namedFields").classList.toggle("hidden", this.value !== "Named");
});

onAuthStateChanged(auth, async user => {
  if (user && isAllowedAdmin(user.email)) {
    currentAdmin = user;
    document.getElementById("loggedInEmail").textContent = user.email;
    document.getElementById("adminLogin").classList.add("hidden");
    document.getElementById("adminDashboard").classList.remove("hidden");
    document.getElementById("reportsBtn").classList.remove("hidden");
    await loadComplaints();
  } else {
    currentAdmin = null;
    document.getElementById("reportsBtn").classList.add("hidden");
    document.getElementById("adminLogin").classList.remove("hidden");
    document.getElementById("adminDashboard").classList.add("hidden");
    if (!document.getElementById("reportPage").classList.contains("hidden")) {
      window.showPage("submitPage");
    }
  }
});

function isSuperAdmin(email) {
  return String(email || "").toLowerCase() === SUPER_ADMIN_EMAIL;
}

function isAllowedAdmin(email) {
  return ALLOWED_ADMIN_EMAILS.includes(String(email || "").toLowerCase());
}

async function getNextReference() {
  const year = new Date().getFullYear();
  const counterRef = doc(db, "counters", "complaints");
  const next = await runTransaction(db, async transaction => {
    const snap = await transaction.get(counterRef);
    let current = 0;
    if (snap.exists()) current = snap.data().value || 0;
    const newValue = current + 1;
    transaction.set(counterRef, { value: newValue, year }, { merge: true });
    return newValue;
  });
  return "SFEX-" + year + "-" + String(next).padStart(6, "0");
}

document.getElementById("complaintForm").addEventListener("submit", async function(e) {
  e.preventDefault();
  const msg = document.getElementById("submitMessage");
  msg.textContent = "Submitting...";

  try {
    const identityType = document.getElementById("identityType").value;
    const reference = await getNextReference();
    const createdText = new Date().toLocaleString();

    const complaint = {
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdAtText: createdText,
      updatedAtText: createdText,
      reference,
      identityType,
      studentName: identityType === "Named" ? document.getElementById("studentName").value.trim() : "Anonymous",
      studentContact: identityType === "Named" ? document.getElementById("studentContact").value.trim() : "",
      unitNumber: "",
      category: document.getElementById("category").value,
      details: document.getElementById("details").value.trim(),
      status: "New",
      history: [{
        timestamp: createdText,
        user: "System",
        action: "Complaint created",
        detail: "Initial status: New"
      }],
      comments: []
    };

    await addDoc(collection(db, "complaints"), complaint);

    lastSubmittedReference = complaint.reference;
    document.getElementById("thankYouReference").textContent = complaint.reference;
    msg.textContent = "";
    this.reset();
    document.getElementById("namedFields").classList.add("hidden");
    window.showPage("thankYouPage");
  } catch (err) {
    console.error(err);
    msg.className = "error";
    msg.textContent = "Could not submit. Check internet connection or Firebase rules.";
  }
});

window.studentLookup = async function() {
  const ref = document.getElementById("lookupReference").value.trim().toUpperCase();
  const box = document.getElementById("lookupResult");
  box.classList.remove("hidden");
  box.innerHTML = "Searching...";

  try {
    const q = query(collection(db, "complaints"), where("reference", "==", ref), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) {
      box.innerHTML = "<p class='error'>No complaint found with that reference.</p>";
      return;
    }

    const c = snap.docs[0].data();
    box.innerHTML = `
      <h3>${escapeHtml(c.reference)}</h3>
      <p><b>Status:</b> ${escapeHtml(c.status)}</p>
      <p><b>Category:</b> ${escapeHtml(c.category)}</p>
      
      <p><b>Submitted:</b> ${escapeHtml(c.createdAtText)}</p>
      <p><b>Last Updated:</b> ${escapeHtml(c.updatedAtText || c.createdAtText)}</p>
      <h4>Admin Comments</h4>
      ${(c.comments || []).length ? (c.comments || []).map(x => `
        <div class="historyItem">
          <span class="small">${escapeHtml(x.timestamp || "")}</span><br>
          ${escapeHtml(x.comment || "")}
        </div>
      `).join("") : "<p class='small'>No admin comments yet.</p>"}
    `;
  } catch (err) {
    console.error(err);
    box.innerHTML = "<p class='error'>Could not search. Please try again later.</p>";
  }
};

window.adminLogin = async function() {
  const email = document.getElementById("adminEmail").value.trim().toLowerCase();
  const password = document.getElementById("adminPassword").value;
  const loginMessage = document.getElementById("loginMessage");
  loginMessage.textContent = "";

  if (!isAllowedAdmin(email)) {
    loginMessage.className = "error";
    loginMessage.textContent = "This email is not allowed as an admin.";
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    console.error(err);
    loginMessage.className = "error";
    loginMessage.textContent = "Login failed. Check email/password.";
  }
};


window.changeAdminPassword = async function() {
  const msg = document.getElementById("passwordChangeMessage");
  const currentPassword = document.getElementById("currentPassword").value;
  const newPassword = document.getElementById("newPassword").value;
  const confirmNewPassword = document.getElementById("confirmNewPassword").value;

  msg.textContent = "";
  msg.className = "";

  if (!currentAdmin || !auth.currentUser) {
    msg.className = "error";
    msg.textContent = "Please login first.";
    return;
  }

  if (!currentPassword || !newPassword || !confirmNewPassword) {
    msg.className = "error";
    msg.textContent = "Please complete all password fields.";
    return;
  }

  if (newPassword.length < 6) {
    msg.className = "error";
    msg.textContent = "New password must be at least 6 characters.";
    return;
  }

  if (newPassword !== confirmNewPassword) {
    msg.className = "error";
    msg.textContent = "New passwords do not match.";
    return;
  }

  try {
    const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
    await reauthenticateWithCredential(auth.currentUser, credential);
    await updatePassword(auth.currentUser, newPassword);

    document.getElementById("currentPassword").value = "";
    document.getElementById("newPassword").value = "";
    document.getElementById("confirmNewPassword").value = "";

    msg.className = "ok";
    msg.textContent = "Password changed successfully.";
  } catch (err) {
    console.error(err);
    msg.className = "error";
    if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
      msg.textContent = "Current password is incorrect.";
    } else if (err.code === "auth/weak-password") {
      msg.textContent = "New password is too weak.";
    } else {
      msg.textContent = "Could not change password. Please login again and try.";
    }
  }
};

window.logout = async function() {
  document.getElementById("reportsBtn").classList.add("hidden");
  await signOut(auth);
  window.showPage("submitPage");
};

window.loadComplaints = async function() {
  if (!currentAdmin || !isAllowedAdmin(currentAdmin.email)) {
    document.getElementById("categoryCards").innerHTML = "<div class='stat'>Login as admin to view reports.</div>";
    document.getElementById("categoryReportTable").innerHTML = "";
    return;
  }

  try {
    const q = query(collection(db, "complaints"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    complaintsCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderComplaints();
    renderReports();
  } catch (err) {
    console.error(err);
    alert("Could not load complaints. Check Firebase rules.");
  }
};

function getFilteredComplaints() {
  const term = String(document.getElementById("adminSearch")?.value || "").toLowerCase().trim();
  if (!term) return complaintsCache;
  return complaintsCache.filter(c => [
    c.reference, c.identityType, c.studentName, c.studentContact, 
    c.category, c.details, c.status
  ].some(v => String(v || "").toLowerCase().includes(term)));
}

window.renderComplaints = function() {
  const tbody = document.getElementById("complaintsTable");
  if (!tbody) return;

  document.getElementById("totalCount").textContent = complaintsCache.length;
  document.getElementById("newCount").textContent = complaintsCache.filter(c => c.status === "New").length;
  document.getElementById("progressCount").textContent = complaintsCache.filter(c => c.status === "In Progress").length;
  document.getElementById("resolvedCount").textContent = complaintsCache.filter(c => c.status === "Resolved").length;

  tbody.innerHTML = getFilteredComplaints().map(c => `
    <tr>
      <td>${escapeHtml(c.createdAtText || "")}</td>
      <td><span class="pill">${escapeHtml(c.reference || c.id)}</span></td>
      <td>${escapeHtml(c.identityType)}</td>
      <td>${escapeHtml(c.studentName)}</td>
      
      <td>${escapeHtml(c.category)}</td>
      <td>${escapeHtml(c.details).slice(0, 140)}</td>
      <td>
        <select onchange="updateStatus('${c.id}', this.value)">
          ${STATUSES.map(s => `<option ${c.status===s?"selected":""}>${s}</option>`).join("")}
        </select>
      </td>
      <td><button class="light" onclick="openComplaint('${c.id}')">Open</button>
        ${isSuperAdmin(currentAdmin?.email) ? `<button style="background:#b00020;color:white" onclick="deleteComplaint('${c.id}', '${escapeHtml(c.reference || c.id)}')">Delete</button>` : ""}</td>
    </tr>
  `).join("");
};

window.openComplaint = function(id) {
  const c = complaintsCache.find(x => x.id === id);
  if (!c) return;

  const box = document.getElementById("complaintDetails");
  box.classList.remove("hidden");

  box.innerHTML = `
    <h3>${escapeHtml(c.reference)}</h3>
    <p><b>Status:</b> ${escapeHtml(c.status)} | <b>Category:</b> ${escapeHtml(c.category)}</p>
    <p><b>Submitted:</b> ${escapeHtml(c.createdAtText)}</p>
    <p><b>Type:</b> ${escapeHtml(c.identityType)} | <b>Name:</b> ${escapeHtml(c.studentName)} | <b>Contact:</b> ${escapeHtml(c.studentContact || "N/A")}</p>
    <p><b>Details:</b><br>${escapeHtml(c.details)}</p>

    ${isSuperAdmin(currentAdmin?.email) ? `<p><button style="background:#b00020;color:white" onclick="deleteComplaint('${id}', '${escapeHtml(c.reference || c.id)}')">Delete Complaint</button></p>` : ""}

    <h4>Add Admin Comment</h4>
    <textarea id="comment_${id}" placeholder="Add internal admin comment..."></textarea>
    <button onclick="addAdminComment('${id}')">Save Comment</button>

    <h4>Admin Comments</h4>
    ${(c.comments || []).map(x => `
      <div class="historyItem">
        <b>${escapeHtml(x.user)}</b> <span class="small">${escapeHtml(x.timestamp)}</span><br>
        ${escapeHtml(x.comment)}
      </div>
    `).join("") || "<p class='small'>No comments yet.</p>"}

    <h4>Status History</h4>
    ${(c.history || []).map(x => `
      <div class="historyItem">
        <b>${escapeHtml(x.action)}</b> <span class="small">${escapeHtml(x.timestamp)}</span><br>
        <span>${escapeHtml(x.user)}</span><br>
        <span>${escapeHtml(x.detail || "")}</span>
      </div>
    `).join("") || "<p class='small'>No history yet.</p>"}
  `;
};


window.deleteComplaint = async function(id, reference) {
  if (!currentAdmin || !isSuperAdmin(currentAdmin.email)) {
    alert("Only the Super Admin can delete complaints.");
    return;
  }

  const entered = prompt("This will permanently delete complaint " + reference + ". Type DELETE to confirm:");

  if (entered !== "DELETE") {
    alert("Delete cancelled.");
    return;
  }

  try {
    await deleteDoc(doc(db, "complaints", id));
    complaintsCache = complaintsCache.filter(c => c.id !== id);

    const detailsBox = document.getElementById("complaintDetails");
    if (detailsBox) {
      detailsBox.classList.add("hidden");
      detailsBox.innerHTML = "";
    }

    renderComplaints();
    renderReports();
    alert("Complaint deleted successfully.");
  } catch (err) {
    console.error(err);
    alert("Could not delete complaint. Check Firebase rules.");
  }
};

window.addAdminComment = async function(id) {
  if (!currentAdmin) return alert("Please login as admin first.");
  const input = document.getElementById("comment_" + id);
  const commentText = input.value.trim();
  if (!commentText) return alert("Enter a comment first.");

  const item = complaintsCache.find(c => c.id === id);
  const now = new Date().toLocaleString();

  const newComment = { timestamp: now, user: currentAdmin.email, comment: commentText };
  const newHistory = { timestamp: now, user: currentAdmin.email, action: "Comment added", detail: commentText };

  const comments = [...(item.comments || []), newComment];
  const history = [...(item.history || []), newHistory];

  try {
    await updateDoc(doc(db, "complaints", id), {
      comments,
      history,
      updatedAt: serverTimestamp(),
      updatedAtText: now
    });
    item.comments = comments;
    item.history = history;
    item.updatedAtText = now;
    openComplaint(id);
  } catch (err) {
    console.error(err);
    alert("Could not save comment.");
  }
};

window.updateStatus = async function(id, newStatus) {
  if (!currentAdmin) return alert("Please login as admin first.");

  const item = complaintsCache.find(c => c.id === id);
  if (!item) return;
  const oldStatus = item.status || "New";
  if (oldStatus === newStatus) return;

  const now = new Date().toLocaleString();
  const newHistory = {
    timestamp: now,
    user: currentAdmin.email,
    action: "Status changed",
    detail: oldStatus + " → " + newStatus
  };
  const history = [...(item.history || []), newHistory];

  try {
    await updateDoc(doc(db, "complaints", id), {
      status: newStatus,
      history,
      updatedAt: serverTimestamp(),
      updatedAtText: now
    });
    item.status = newStatus;
    item.history = history;
    item.updatedAtText = now;
    renderComplaints();
    renderReports();
  } catch (err) {
    console.error(err);
    alert("Could not update status.");
  }
};

function buildCategoryReport() {
  const report = {};
  CATEGORIES.forEach(cat => report[cat] = { total:0, New:0, "In Progress":0, Resolved:0, Closed:0 });
  complaintsCache.forEach(c => {
    const cat = c.category || "Other";
    const status = c.status || "New";
    if (!report[cat]) report[cat] = { total:0, New:0, "In Progress":0, Resolved:0, Closed:0 };
    report[cat].total++;
    report[cat][status] = (report[cat][status] || 0) + 1;
  });
  return report;
}

function renderReports() {
  const report = buildCategoryReport();
  document.getElementById("categoryCards").innerHTML = Object.entries(report).map(([cat, r]) => `
    <div class="stat"><span>${escapeHtml(cat)}</span><br><strong>${r.total}</strong></div>
  `).join("");
  document.getElementById("categoryReportTable").innerHTML = Object.entries(report).map(([cat, r]) => `
    <tr><td>${escapeHtml(cat)}</td><td>${r.total}</td><td>${r.New || 0}</td><td>${r["In Progress"] || 0}</td><td>${r.Resolved || 0}</td><td>${r.Closed || 0}</td></tr>
  `).join("");
}

window.exportCSV = function() {
  if (!currentAdmin) return alert("Please login as admin first.");
  const rows = [["Date","Reference","Type","Name","Contact","Category","Details","Status","Last Updated"]];
  complaintsCache.forEach(c => rows.push([c.createdAtText || "", c.reference || c.id, c.identityType || "", c.studentName || "", c.studentContact || "",  c.category || "", c.details || "", c.status || "", c.updatedAtText || ""]));
  downloadCSV("safefly_complaints.csv", rows);
};

window.exportCategoryReportCSV = function() {
  if (!currentAdmin) return alert("Please login as admin first.");
  const report = buildCategoryReport();
  const rows = [["Category","Total","New","In Progress","Resolved","Closed"]];
  Object.entries(report).forEach(([cat, r]) => rows.push([cat, r.total, r.New, r["In Progress"], r.Resolved, r.Closed]));
  downloadCSV("safefly_category_report.csv", rows);
};

function downloadCSV(filename, rows) {
  const csv = rows.map(r => r.map(v => `"${String(v || "").replaceAll('"','""')}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = filename;
  a.click();
}

function escapeHtml(text) {
  return String(text || "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}
