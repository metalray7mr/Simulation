const STORAGE_KEY = "delhi-medical-card-guide-progress";
const TOTAL_STEPS = 4;

const progressFill = document.getElementById("progressFill");
const progressText = document.getElementById("progressText");
const progressBar = document.querySelector(".progress-bar");
const toast = document.getElementById("toast");
const schemeButtons = document.querySelectorAll(".scheme-btn");
const schemeNote = document.getElementById("schemeNote");
const checkboxes = document.querySelectorAll("[data-step-key]");

const schemeNotes = {
  dgehs:
    "DGEHS duplicates are issued by your salary or pension department. There is no single online reprint portal for all beneficiaries.",
  cghs:
    "CGHS duplicates are handled by Additional Director, CGHS Headquarters, Delhi. You may also use the 'Print your own card' option on the CGHS website.",
};

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveProgress(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function updateProgressUI() {
  const state = loadProgress();
  const completed = checkboxes.reduce((count, box) => count + (state[box.dataset.stepKey] ? 1 : 0), 0);

  checkboxes.forEach((box) => {
    const done = Boolean(state[box.dataset.stepKey]);
    box.checked = done;
    box.closest(".step-card")?.classList.toggle("done", done);
  });

  const percent = (completed / TOTAL_STEPS) * 100;
  progressFill.style.width = `${percent}%`;
  progressText.textContent = `${completed} of ${TOTAL_STEPS} steps completed`;
  progressBar.setAttribute("aria-valuenow", String(completed));
}

function setScheme(scheme) {
  schemeButtons.forEach((button) => {
    const active = button.dataset.scheme === scheme;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });

  document.querySelectorAll(".dgehs-only").forEach((el) => {
    el.classList.toggle("hidden", scheme !== "dgehs");
  });
  document.querySelectorAll(".cghs-only").forEach((el) => {
    el.classList.toggle("hidden", scheme !== "cghs");
  });

  schemeNote.textContent = schemeNotes[scheme];
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.remove("hidden");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toast.classList.add("hidden");
  }, 2200);
}

async function copyText(elementId) {
  const element = document.getElementById(elementId);
  if (!element) return;

  const text = element.textContent.trim();
  try {
    await navigator.clipboard.writeText(text);
    showToast("Copied to clipboard");
  } catch {
    showToast("Could not copy. Please select and copy manually.");
  }
}

checkboxes.forEach((box) => {
  box.addEventListener("change", () => {
    const state = loadProgress();
    state[box.dataset.stepKey] = box.checked;
    saveProgress(state);
    updateProgressUI();
  });
});

schemeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setScheme(button.dataset.scheme);
  });
});

document.querySelectorAll("[data-copy]").forEach((button) => {
  button.addEventListener("click", () => {
    copyText(button.dataset.copy);
  });
});

setScheme("dgehs");
updateProgressUI();
