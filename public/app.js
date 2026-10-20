const form = document.querySelector("#listing-form");
const notes = document.querySelector("#notes");
const charCount = document.querySelector("#char-count");
const photoInput = document.querySelector("#photo");
const photoPreview = document.querySelector("#photo-preview");
const uploadZone = document.querySelector("#upload-zone");
const uploadContent = document.querySelector("#upload-content");
const removePhotoButton = document.querySelector("#remove-photo");
const generateButton = document.querySelector("#generate-button");
const buttonLabel = document.querySelector("#button-label");
const errorMessage = document.querySelector("#error-message");
const result = document.querySelector("#result");
let photoDataUrl = "";

notes.addEventListener("input", () => {
  charCount.textContent = `${notes.value.length.toLocaleString()} / 2,000`;
});

function setPhoto(file) {
  if (!file) return;
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    showError("Choose a JPEG, PNG, or WebP image.");
    return;
  }
  if (file.size > 8 * 1024 * 1024) {
    showError("That image is over 8 MB. Choose a smaller photo.");
    return;
  }

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    photoDataUrl = reader.result;
    photoPreview.src = photoDataUrl;
    photoPreview.hidden = false;
    uploadContent.hidden = true;
    removePhotoButton.hidden = false;
    uploadZone.classList.add("has-photo");
    errorMessage.hidden = true;
  });
  reader.readAsDataURL(file);
}

function clearPhoto() {
  photoDataUrl = "";
  photoInput.value = "";
  photoPreview.removeAttribute("src");
  photoPreview.hidden = true;
  uploadContent.hidden = false;
  removePhotoButton.hidden = true;
  uploadZone.classList.remove("has-photo");
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = false;
}

photoInput.addEventListener("change", () => setPhoto(photoInput.files[0]));
removePhotoButton.addEventListener("click", clearPhoto);

uploadZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  uploadZone.classList.add("dragging");
});
uploadZone.addEventListener("dragleave", () => uploadZone.classList.remove("dragging"));
uploadZone.addEventListener("drop", (event) => {
  event.preventDefault();
  uploadZone.classList.remove("dragging");
  setPhoto(event.dataTransfer.files[0]);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorMessage.hidden = true;
  result.hidden = true;
  generateButton.disabled = true;
  buttonLabel.textContent = "Making your listing…";

  try {
    const response = await fetch("/api/listing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        notes: notes.value,
        marketplace: document.querySelector("#marketplace").value,
        tone: document.querySelector("#tone").value,
        price: document.querySelector("#price").value.trim(),
        image: photoDataUrl || undefined,
      }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Couldn't make that listing. Please try again.");

    renderListing(payload.listing, payload.model);
    result.hidden = false;
    result.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    showError(error.message || "Couldn't reach the local listing model. Check that Ollama is running.");
  } finally {
    generateButton.disabled = false;
    buttonLabel.textContent = "Make my listing";
  }
});

function renderListing(listing, model) {
  document.querySelector("#result-title").textContent = listing.title || "";
  document.querySelector("#result-description").textContent = listing.description || "";
  document.querySelector("#result-category").textContent = listing.category || "No category suggested.";
  document.querySelector("#result-price").textContent = listing.price_guidance || "No pricing guidance provided.";
  document.querySelector("#model-chip").textContent = `LOCAL · ${model}`;

  const tags = document.querySelector("#result-tags");
  tags.replaceChildren();
  (Array.isArray(listing.tags) ? listing.tags : []).forEach((tag) => {
    const chip = document.createElement("span");
    chip.className = "tag";
    chip.textContent = tag;
    tags.append(chip);
  });

  const checklist = Array.isArray(listing.seller_checklist) ? listing.seller_checklist : [];
  const checklistWrap = document.querySelector("#seller-checklist-wrap");
  const checklistList = document.querySelector("#seller-checklist");
  checklistList.replaceChildren();
  checklist.forEach((item) => {
    const row = document.createElement("li");
    row.textContent = item;
    checklistList.append(row);
  });
  checklistWrap.hidden = checklist.length === 0;
}

document.querySelectorAll(".copy-button").forEach((button) => {
  button.addEventListener("click", async () => {
    const text = document.querySelector(`#${button.dataset.copy}`).textContent;
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = "Copied!";
      window.setTimeout(() => { button.textContent = "Copy"; }, 1400);
    } catch {
      showError("Couldn't copy to clipboard. Select the text to copy it manually.");
    }
  });
});

document.querySelector("#start-over").addEventListener("click", () => {
  result.hidden = true;
  form.reset();
  charCount.textContent = "0 / 2,000";
  clearPhoto();
  notes.focus();
  window.scrollTo({ top: 0, behavior: "smooth" });
});
