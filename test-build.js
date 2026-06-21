
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

async function runBuild() {
  try {
    const { stdout, stderr } = await execAsync('npm run build');
    console.log('STDOUT:', stdout);
    if (stderr) console.warn('STDERR:', stderr);
  } catch (err) {
    console.error('ERROR:', err);
  }
}

runBuild();
