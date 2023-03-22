const form = document.querySelector('form');

form.addEventListener('submit', e => {
  e.preventDefault();

  // Encrypt data
  const formData = new FormData(form);
  const encryptedData = encryptData(formData);

  // Send data to server
  fetch('/server.js', {
    method: 'POST',
    body: encryptedData
  })
    .then(response => response.text())
    .then(data => console.log(data));
});

function encryptData(data) {
  const encryptedData = new FormData();

  // Use AES encryption algorithm to encrypt the data
  const algorithm = {
    name: 'AES-GCM',
    length: 256
  };

  const key = crypto.getRandomValues(new Uint8Array(32));

  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encoder = new TextEncoder();

  for (const pair of data.entries()) {
    const plaintext = encoder.encode(pair[1]);

    const ciphertext = window.crypto.subtle.encrypt(
      algorithm,
      key,
      plaintext
    ).then(function(encrypted) {
      encryptedData.append(pair[0], encrypted);
    });
  }

  encryptedData.append('iv', iv);
  encryptedData.append('key', key);

  return encryptedData;
}
