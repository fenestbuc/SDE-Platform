import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

async function globalSetup() {
  const dbPath = path.join(__dirname, '../../test.db');
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }
  execSync('npx prisma db push --accept-data-loss', {
    env: { ...process.env, DATABASE_URL: 'file:./test.db' },
    stdio: 'inherit'
  });
}

export default globalSetup;
