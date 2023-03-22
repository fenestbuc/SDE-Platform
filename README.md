# Secure Data Exchange Platform

This is a simple web application for securely exchanging data between users. The application allows users to enter their name and description into a form, encrypt the data using AES-GCM encryption algorithm and store the encrypted data in a database file.

## Getting Started

These instructions will help you set up the project on your local machine for development and testing purposes.

### Prerequisites

You need to have the following installed on your machine:

- Node.js
- Express
- Body-parser

### Installing

Clone the repository from GitHub and install the required packages using the following commands:

```
git clone https://github.com/fenestbuc/SDE-Platform.git
cd repo
npm install
```

### Setting up the Database

Create a `data.csv` file in the root directory of the project. This file will be used to store the data that is sent to the server.

### Running the Project

Start the server by running the following command:

```
node server.js
```

The server will now be running on port 3000. You can test the project by opening `http://localhost:3000` in your browser.

## Usage

The project consists of the following files:

- `index.html`: This file contains the HTML code for the web page.
- `styles.css`: This file contains the CSS code for styling the web page.
- `index.js`: This file contains the JavaScript code for the web page.
- `server.js`: This file contains the code for handling requests from the web page.
- `databaseHandler.js`: This file contains the code for interacting with the database.
- `data.csv`: This file contains the data that is stored in the database.

### Submitting Data

When the user submits the form on the web page, the data is encrypted using AES encryption and then sent to the server. The server then decrypts the data and stores it in the `data.csv` file.

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.