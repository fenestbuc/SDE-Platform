const fs = require('fs');

module.exports = {
  storeData(data) {
    const csvData = Object.entries(data).map(([key, value]) => `${key},${value}`).join('\n');

    fs.appendFileSync('data.csv', csvData + '\n');
  }
};