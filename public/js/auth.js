import { apiFetch } from "./api.js";
import { generateKeypair, encryptPrivateKey, decryptPrivateKey } from "./crypto.js";

const registerForm = document.getElementById("register-form");
if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value;
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    const status = document.getElementById("status");
    
    status.innerText = "Generating keys...";
    try {
      const keys = await generateKeypair();
      status.innerText = "Encrypting private key...";
      const { encryptedPrivKey, salt, iv } = await encryptPrivateKey(keys.privKeyHex, password);
      
      status.innerText = "Registering...";
      await apiFetch("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email, username, password,
          publicKey: keys.pubKeyHex,
          encryptedPrivKey, salt, iv
        })
      });
      status.innerText = "Success! Redirecting to login...";
      setTimeout(() => window.location.href = "login.html", 1000);
    } catch (err) {
      status.innerText = "Error: " + err.message;
      status.className = "mt-2 text-sm text-red-600";
    }
  });
}

const loginForm = document.getElementById("login-form");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    
    try {
      const { accessToken } = await apiFetch("/auth/login", {
        method: "POST", body: JSON.stringify({ username, password })
      });
      sessionStorage.setItem("accessToken", accessToken);
      
      // fetch profile to get encrypted private key
      const profile = await apiFetch("/users/me");
      const privKeyHex = await decryptPrivateKey(profile.encryptedPrivKey, profile.salt, profile.iv, password);
      sessionStorage.setItem("privKey", privKeyHex);
      sessionStorage.setItem("username", profile.username);
      
      if (profile.role === "admin") {
        sessionStorage.setItem("isAdmin", "true");
      }
      
      window.location.href = "dashboard.html";
    } catch (err) {
      alert("Login failed: " + err.message);
    }
  });
}
