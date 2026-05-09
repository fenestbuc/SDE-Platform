import { apiFetch, setupWS } from "./api.js";
import { encryptPayload, decryptPayload, encryptPayloadWithEphemeral } from "./crypto.js";

const display = document.getElementById("user-display");
if (display) display.innerText = sessionStorage.getItem("username");

if (sessionStorage.getItem("isAdmin") === "true") {
  const adminLink = document.createElement("a");
  adminLink.href = "admin.html";
  adminLink.className = "text-yellow-300 underline mr-4";
  adminLink.innerText = "Admin Area";
  display.parentNode.insertBefore(adminLink, display);
}

document.getElementById("logout-btn")?.addEventListener("click", async () => {
  await apiFetch("/auth/logout", { method: "POST" }).catch(()=>null);
  sessionStorage.clear();
  window.location.href = "index.html";
});

setupWS((msg) => {
  if (msg.type === "new_message") {
    // Show toast or refresh inbox
    alert(`New message! Refreshing inbox.`);
    loadInbox();
  }
});

const list = document.getElementById("message-list");
const privKey = sessionStorage.getItem("privKey");

async function loadInbox() {
  document.getElementById("tab-inbox").className = "px-4 py-2 font-bold border-b-2 border-blue-600";
  document.getElementById("tab-sent").className = "px-4 py-2 text-gray-500 hover:text-black";
  list.innerHTML = "Loading...";
  const msgs = await apiFetch("/messages/inbox");
  renderMessages(msgs, "sender");
}

async function loadSent() {
  document.getElementById("tab-sent").className = "px-4 py-2 font-bold border-b-2 border-blue-600";
  document.getElementById("tab-inbox").className = "px-4 py-2 text-gray-500 hover:text-black";
  list.innerHTML = "Loading...";
  const msgs = await apiFetch("/messages/sent");
  renderMessages(msgs, "recipient");
}

function renderMessages(msgs, otherPartyField) {
  list.innerHTML = "";
  if (msgs.length === 0) list.innerHTML = "<p class='text-gray-500'>No messages found.</p>";
  
  msgs.forEach(m => {
    const div = document.createElement("div");
    div.className = "bg-white p-4 rounded shadow cursor-pointer hover:bg-gray-50";
    const status = m.readAt ? "" : `<span class="bg-red-500 text-white text-xs px-2 py-1 rounded ml-2">NEW</span>`;
    const attach = m.hasAttachment ? " 📎" : "";
    const otherName = m[otherPartyField].displayName || m[otherPartyField].username;
    div.innerHTML = `
      <div class="flex justify-between items-center">
        <div class="font-bold">${otherPartyField === "sender" ? "From" : "To"}: ${otherName} ${status}${attach}</div>
        <div class="text-xs text-gray-500">${new Date(m.createdAt).toLocaleString()}</div>
      </div>
    `;
    div.onclick = () => openMessage(m.id);
    list.appendChild(div);
  });
}

document.getElementById("tab-inbox")?.addEventListener("click", loadInbox);
document.getElementById("tab-sent")?.addEventListener("click", loadSent);

loadInbox();

const modal = document.getElementById("message-modal");
const closeBtn = document.getElementById("modal-close");
closeBtn?.addEventListener("click", () => {
  modal.classList.add("hidden");
  document.getElementById("modal-attachment").classList.add("hidden");
  loadInbox(); // refresh read status
});

async function openMessage(id) {
  modal.classList.remove("hidden");
  document.getElementById("modal-body").innerText = "Decrypting...";
  document.getElementById("modal-title").innerText = "Message";
  
  try {
    const m = await apiFetch(`/messages/${id}`);
    const text = await decryptPayload(m.ciphertext, m.iv, m.tag, m.ephemeralPubKey, privKey);
    document.getElementById("modal-body").innerText = text;
    
    if (m.attachment) {
      document.getElementById("modal-attachment").classList.remove("hidden");
      const dlBtn = document.getElementById("download-btn");
      dlBtn.onclick = async () => {
        dlBtn.innerText = "Decrypting file...";
        const blob = await apiFetch(`/messages/${id}/attachment`);
        const arrBuf = await blob.arrayBuffer();
        const decryptedBuf = await decryptPayload(arrBuf, m.attachment.iv, m.attachment.tag, m.ephemeralPubKey, privKey, false, "sde-file-v1");
        
        const fileBlob = new Blob([decryptedBuf], { type: m.attachment.contentType });
        const url = URL.createObjectURL(fileBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = m.attachment.filename;
        a.click();
        dlBtn.innerText = "Download Attachment";
      };
    }
    
    if (m.recipientId === sessionStorage.getItem("userId")) {
      await apiFetch(`/messages/${id}/read`, { method: "POST" });
    }
  } catch(e) {
    document.getElementById("modal-body").innerText = "Error decrypting: " + e.message;
  }
}

document.getElementById("compose-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const toUser = document.getElementById("compose-to").value;
  const body = document.getElementById("compose-body").value;
  const fileInput = document.getElementById("compose-file");
  const status = document.getElementById("compose-status");
  
  status.innerText = "Looking up recipient...";
  status.className = "mt-2 text-sm text-blue-600";
  
  try {
    const recipient = await apiFetch(`/users/${toUser}`);
    status.innerText = "Encrypting message...";
    
    const msgPayload = await encryptPayload(body, recipient.publicKey);
    
    const formData = new FormData();
    formData.append("recipientId", recipient.id);
    formData.append("ephemeralPubKey", msgPayload.ephemeralPubKey);
    formData.append("ciphertext", msgPayload.ciphertext);
    formData.append("iv", msgPayload.iv);
    formData.append("tag", msgPayload.tag);
    
    if (fileInput.files[0]) {
      status.innerText = "Encrypting file...";
      const file = fileInput.files[0];
      const arrBuf = await file.arrayBuffer();
      const filePayload = await encryptPayloadWithEphemeral(arrBuf, recipient.publicKey, msgPayload.ePrivHex, msgPayload.ephemeralPubKey, "sde-file-v1");
      
      formData.append("fileIv", filePayload.iv);
      formData.append("fileTag", filePayload.tag);
      
      const encryptedFile = new File([filePayload.rawEncryptedBuf], file.name, { type: file.type });
      formData.append("file", encryptedFile);
    }
    
    status.innerText = "Sending...";
    await apiFetch(`/messages`, {
      method: "POST",
      body: formData
    });
    
    status.innerText = "Message sent successfully!";
    status.className = "mt-2 text-sm text-green-600";
    document.getElementById("compose-body").value = "";
    fileInput.value = "";
    loadSent();
    
  } catch(e) {
    status.innerText = "Error: " + e.message;
    status.className = "mt-2 text-sm text-red-600";
  }
});
