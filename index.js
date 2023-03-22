const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const databaseHandler = require('./databaseHandler');
const path = require('path');

// Parse incoming requests
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Define static directory for serving CSS and JS files
app.use(express.static(path.join(__dirname, 'public')));

// Handle POST request
app.post('/server', (req, res) => {
  // Decrypt data
  const decryptedData = decryptData(req.body);

  // Store data in database
  databaseHandler.storeData(decryptedData);

  res.send('Data stored successfully');
});

// Define route handler for root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Create server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});

function decryptData(data) {
  const decryptedData = {};

  // Use AES encryption algorithm to decrypt the data
  const algorithm = {
    name: 'AES-GCM',
    length: 256
  };

  const key = data.key;

  const iv = data.iv;

  const decoder = new TextDecoder();

  for (const pair of data.entries()) {
    const ciphertext = pair[1];

    const plaintext = window.crypto.subtle.decrypt(
      algorithm,
      key,
      ciphertext
    ).then(function(decrypted) {
      decryptedData[pair[0]] = decoder.decode(decrypted);
    });
  }

  return decryptedData;
