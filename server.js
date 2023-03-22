const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const databaseHandler = require('./databaseHandler');

// Parse incoming requests
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Handle POST request
app.post('/', (req, res) => {
  // Decrypt data
  const decryptedData = decryptData(req.body);

  // Store data in database
  databaseHandler.storeData(decryptedData)
    .then(() => {
      res.send('Data stored successfully');
    })
    .catch(error => {
      console.error(error);
      res.status(500).send('Error storing data');
    });
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

  for (const [key, value] of Object.entries(data)) {
    if (key !== 'iv' && key !== 'key') {
      const ciphertext = value;

      const plaintext = window.crypto.subtle.decrypt(
        algorithm,
        key,
        ciphertext
      );

      decryptedData[key] = decoder.decode(plaintext);
    }
  }

  return decryptedData;
}
