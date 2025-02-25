/**
 * Script to create prebuilds from locally built native modules
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// Determine platform and architecture
const platform = os.platform();
const arch = os.arch();

// Map platform to directory name
const platformMap = {
  'win32': 'win32',
  'darwin': 'darwin',
  'linux': 'linux'
};

// Create prebuilds directory structure
const platformDir = `${platformMap[platform]}-${arch}`;
const prebuildsDir = path.join(__dirname, '..', 'prebuilds', platformDir);

console.log(`Creating prebuilds for ${platformDir}...`);

// Create directory if it doesn't exist
if (!fs.existsSync(prebuildsDir)) {
  fs.mkdirSync(prebuildsDir, { recursive: true });
  console.log(`Created directory: ${prebuildsDir}`);
}

// Ensure modules are built
console.log('Ensuring native modules are built...');
try {
  // Attempt to rebuild the modules to ensure they exist
  execSync('npm rebuild', { stdio: 'inherit' });
  console.log('Native modules rebuilt successfully');
} catch (error) {
  console.error('Error rebuilding native modules:', error.message);
  console.log('Will attempt to continue with existing builds if available...');
}

// Process each module
let success = true;

// 1. Handle speaker (true native module)
try {
  console.log('Processing speaker module (native)...');
  const speakerPath = path.join(__dirname, '..', 'node_modules', 'speaker');
  const speakerBuildPath = path.join(speakerPath, 'build', 'Release');
  
  if (fs.existsSync(speakerBuildPath)) {
    const files = fs.readdirSync(speakerBuildPath);
    const nodeFile = files.find(file => file.endsWith('.node'));
    
    if (nodeFile) {
      const sourcePath = path.join(speakerBuildPath, nodeFile);
      const destPath = path.join(prebuildsDir, 'speaker.node');
      fs.copyFileSync(sourcePath, destPath);
      console.log(`Copied ${sourcePath} to ${destPath}`);
    } else {
      console.error('Could not find .node file for speaker');
      success = false;
    }
  } else {
    console.error('Speaker build directory not found');
    success = false;
  }
} catch (error) {
  console.error('Error processing speaker module:', error.message);
  success = false;
}

// 2. Handle node-microphone (JavaScript wrapper, not a native module)
try {
  console.log('Processing node-microphone module (JS wrapper)...');
  const microphonePath = path.join(__dirname, '..', 'node_modules', 'node-microphone');
  
  // Check if the required command-line tools are installed
  let commandAvailable = false;
  
  if (platform === 'darwin') {
    try {
      execSync('which rec', { stdio: 'ignore' });
      commandAvailable = true;
      console.log('Found "rec" command for macOS');
    } catch (e) {
      console.warn('The "rec" command is not available. Install SoX: brew install sox');
    }
  } else if (platform === 'win32') {
    try {
      execSync('where sox', { stdio: 'ignore' });
      commandAvailable = true;
      console.log('Found "sox" command for Windows');
    } catch (e) {
      console.warn('The "sox" command is not available. Install SoX for Windows.');
    }
  } else {
    try {
      execSync('which arecord', { stdio: 'ignore' });
      commandAvailable = true;
      console.log('Found "arecord" command for Linux');
    } catch (e) {
      console.warn('The "arecord" command is not available. Install ALSA tools: sudo apt-get install alsa-utils');
    }
  }
  
  // Create a special marker file for node-microphone
  const destPath = path.join(prebuildsDir, 'node-microphone.js');
  
  // Create a simple JS file that will be used to indicate this is a JS module
  const jsContent = `
/**
 * This is a marker file for the node-microphone module.
 * 
 * node-microphone is not a native module with a .node binary.
 * It's a JavaScript wrapper that uses command-line tools:
 * - macOS: 'rec' (part of SoX)
 * - Windows: 'sox'
 * - Linux: 'arecord'
 * 
 * Required command-line tool available: ${commandAvailable}
 * Platform: ${platform}
 * Architecture: ${arch}
 */
module.exports = {
  isJsWrapper: true,
  commandAvailable: ${commandAvailable},
  platform: '${platform}',
  architecture: '${arch}'
};
`;
  
  fs.writeFileSync(destPath, jsContent);
  console.log(`Created marker file for node-microphone at ${destPath}`);
  
  // Also copy the actual index.js file for reference
  const indexPath = path.join(microphonePath, 'index.js');
  if (fs.existsSync(indexPath)) {
    const indexDestPath = path.join(prebuildsDir, 'node-microphone-original.js');
    fs.copyFileSync(indexPath, indexDestPath);
    console.log(`Copied original node-microphone implementation to ${indexDestPath}`);
  }
  
  // Check for command-line tool and warn if not available
  if (!commandAvailable) {
    console.warn(`WARNING: The required command-line tool for node-microphone is not available on this system.`);
    console.warn(`Audio input will not work without installing the appropriate tool.`);
    
    if (platform === 'darwin') {
      console.warn('Install SoX on macOS: brew install sox');
    } else if (platform === 'win32') {
      console.warn('Install SoX for Windows: https://sourceforge.net/projects/sox/');
    } else {
      console.warn('Install ALSA tools on Linux: sudo apt-get install alsa-utils');
    }
  }
} catch (error) {
  console.error('Error processing node-microphone module:', error.message);
  // Don't mark as failure since this is a JS module
}

if (success) {
  console.log(`Successfully created prebuilds for ${platformDir}`);
} else {
  console.error('There were errors creating prebuilds');
  console.log('Continuing anyway to allow partial testing... Some features may not work.');
} 