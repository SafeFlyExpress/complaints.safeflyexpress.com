import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  updateDoc,
  doc,
  serverTimestamp,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC77yW_lz1I5a-kZi4BCwLqU3FWes3-_xw",
  authDomain: "safe-fly-complaint-portal.firebaseapp.com",
  projectId: "safe-fly-complaint-portal",
  storageBucket: "safe-fly-complaint-portal.firebasestorage.app",
  messagingSenderId: "952760102417",
  appId: "1:952760102417:web:53223bb1e451d17b170bb0",
  measurementId: "G-SBM0G031PK"
};

const ADMIN_PIN = "1234";
const CATEGORIES = ["Suggestion","Academic","Facilities","Safety","Staff Conduct","Transport","Other"];
const STATUSES = ["New","In Progress","Resolved","Closed"];

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
let complaintsCache = [];

window.showPage = function(id) {
  ["submitPage","adminPage","reportPage"].forEach(p => document.getElementById(p).classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
  if (id === "reportPage") loadComplaints();
};

document.getElementById("identityType").addEventListener("change", function() {
  document.getElementById("namedFields").classList.toggle("hidden", this.value !== "Named");
});

document.getElementById("complaintForm").addEventListener("submit", async function(e) {
  e.preventDefault();
  const msg = document.getElementById("submitMessage");
  msg.textContent = "";

  const identityType = document.getElementById("identityType").value;
  const complaint = {
    createdAt: serverTimestamp(),
    createdAtText: new Date().toLocaleString(),
    reference: "SFEX-" + Date.now(),
    identityType,
    studentName: identityType === "Named" ? document.getElementById("studentName").value.trim() : "Anonymous",
    studentContact: identityType === "Named" ? document.getElementById("studentContact").value.trim() : "",
    unitNumber: document.getElementById("unitNumber").value.trim(),
    category: document.getElementById("category").value,
    details: document.getElementById("details").value.trim(),
    status: "New"
  };

  try {
    await addDoc(collection(db, "complaints"), complaint);
    msg.className = "ok";
    msg.textContent = "Submitted successfully. Reference: " + complaint.reference;
    this.reset();
    document.getElementById("namedFields").classList.add("hidden");
  } catch (err) {
    console.error(err);
    msg.className = "error";
    msg.textContent = "Could not submit. Check internet connection and Firebase rules.";
  }
});

window.adminLogin = async function() {
  if (document.getElementById("adminPin").value !== ADMIN_PIN) {
    alert("Wrong PIN");
    return;
  }
  document.getElementById("adminLogin").classList.add("hidden");
  document.getElementById("adminDashboard").classList.remove("hidden");
  await loadComplaints();
};

window.loadComplaints = async function() {
  try {
    const q = query(collection(db, "complaints"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    complaintsCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderComplaints();
    renderReports();
  } catch (err) {
    console.error(err);
    alert("Could not load complaints. Check Firebase rules/config.");
  }
};

function renderComplaints() {
  const tbody = document.getElementById("complaintsTable");
  if (!tbody) return;

  document.getElementById("totalCount").textContent = complaintsCache.length;
  document.getElementById("newCount").textContent = complaintsCache.filter(c => c.status === "New").length;
  document.getElementById("progressCount").textContent = complaintsCache.filter(c => c.status === "In Progress").length;
  document.getElementById("resolvedCount").textContent = complaintsCache.filter(c => c.status === "Resolved").length;

  tbody.innerHTML = complaintsCache.map(c => `
    <tr>
      <td>${escapeHtml(c.createdAtText || "")}</td>
      <td><span class="pill">${escapeHtml(c.reference || c.id)}</span></td>
      <td>${escapeHtml(c.identityType)}</td>
      <td>${escapeHtml(c.studentName)}</td>
      <td>${escapeHtml(c.studentContact)}</td>
      <td>${escapeHtml(c.unitNumber)}</td>
      <td>${escapeHtml(c.category)}</td>
      <td>${escapeHtml(c.details)}</td>
      <td>
        <select onchange="updateStatus('${c.id}', this.value)">
          ${STATUSES.map(s => `<option ${c.status===s?"selected":""}>${s}</option>`).join("")}
        </select>
      </td>
    </tr>
  `).join("");
}

window.updateStatus = async function(id, status) {
  try {
    await updateDoc(doc(db, "complaints", id), { status });
    const item = complaintsCache.find(c => c.id === id);
    if (item) item.status = status;
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
    <tr>
      <td>${escapeHtml(cat)}</td>
      <td>${r.total}</td>
      <td>${r.New || 0}</td>
      <td>${r["In Progress"] || 0}</td>
      <td>${r.Resolved || 0}</td>
      <td>${r.Closed || 0}</td>
    </tr>
  `).join("");
}

window.exportCSV = function() {
  const rows = [["Date","Reference","Type","Name","Contact","Unit Number","Category","Details","Status"]];
  complaintsCache.forEach(c => rows.push([
    c.createdAtText || "", c.reference || c.id, c.identityType || "", c.studentName || "",
    c.studentContact || "", c.unitNumber || "", c.category || "", c.details || "", c.status || ""
  ]));
  downloadCSV("safefly_complaints.csv", rows);
};

window.exportCategoryReportCSV = function() {
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
