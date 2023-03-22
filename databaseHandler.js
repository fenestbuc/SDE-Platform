const fs = require('fs').promises;

module.exports = {
  async storeData(data) {
    const csvData = Object.entries(data).map(([key, value]) => `${key},${value}`).join('\n');

    try {
      await fs.appendFile('data.csv', csvData + '\n');
    } catch (error) {
      console.error(error);
      throw new Error('Error storing data in database');
    }
  }
};
