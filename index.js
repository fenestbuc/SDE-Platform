const form = document.querySelector('#data-form');

form.addEventListener('submit', async e => {
  e.preventDefault();

  // Encrypt data
  const formData = new FormData(form);
  const encryptedData = await encryptData(formData);

  // Send data to server
  const response = await fetch('/data', {
    method: 'POST',
    body: encryptedData
  });

  const result = await response.json();
  console.log(result.message);
});

async function encryptData(data) {
  const encryptedData = new FormData();

  // Use AES encryption algorithm to encrypt the data
  const algorithm = {
    name: 'AES-GCM',
    length: 256
  };

  const key = await window.crypto.subtle.generateKey(algorithm, true, ['encrypt', 'decrypt']);
  const exportedKey = await window.crypto.subtle.exportKey('jwk', key);

  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encoder = new TextEncoder();

  for (const pair of data.entries()) {
    const plaintext = encoder.encode(pair[1]);

    const ciphertext = await window.crypto.subtle.encrypt(
      algorithm,
      key,
      plaintext,
      iv
    );

    encryptedData.append(pair[0], new Blob([ciphertext], { type: 'application/octet-stream' }));
  }

  encryptedData.append('iv', new Blob([iv], { type: 'application/octet-stream' }));
  encryptedData.append('key', JSON.stringify(exportedKey));

  return encryptedData;
}
