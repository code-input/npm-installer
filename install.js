#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const VERSION = 'v0.0.3';
const REPO = 'code-input/cli';
const BINARY_NAME = 'ci';

function getPlatform() {
  const platform = os.platform();
  const arch = os.arch();

  const platformMap = {
    'linux': 'linux',
    'darwin': 'macos',
    'win32': 'windows'
  };

  const archMap = {
    'x64': 'x86_64',
    'arm64': 'aarch64'
  };

  const osName = platformMap[platform];
  if (!osName) {
    throw new Error(`Unsupported platform: ${platform}`);
  }

  const archName = archMap[arch];
  if (!archName) {
    throw new Error(`Unsupported architecture: ${arch}`);
  }

  return { os: osName, arch: archName };
}

function getBinaryUrl(platform, arch) {
  const ext = platform === 'windows' ? '.exe' : '';
  return `https://github.com/${REPO}/releases/download/${VERSION}/ci-${platform}-${arch}${ext}`;
}

function getInstallPath() {
  // For npm global install, use the configured prefix
  try {
    const npmPrefix = execSync('npm prefix -g', { encoding: 'utf-8' }).trim();
    return path.join(npmPrefix, process.platform === 'win32' ? '' : 'bin');
  } catch {
    return path.join(os.homedir(), '.npm-global', 'bin');
  }
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        downloadFile(response.headers.location, dest).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }

      const file = fs.createWriteStream(dest);
      response.pipe(file);

      file.on('finish', () => {
        file.close();
        // Make executable on Unix
        if (process.platform !== 'win32') {
          fs.chmodSync(dest, 0o755);
        }
        resolve();
      });

      file.on('error', (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
    }).on('error', reject);
  });
}

async function main() {
  try {
    const { os: platform, arch } = getPlatform();
    const url = getBinaryUrl(platform, arch);
    const installDir = getInstallPath();
    const ext = platform === 'windows' ? '.exe' : '';
    const destPath = path.join(installDir, `${BINARY_NAME}${ext}`);

    console.log(`Downloading ${BINARY_NAME} ${VERSION} for ${platform}-${arch}...`);

    // Ensure install directory exists
    fs.mkdirSync(installDir, { recursive: true });

    await downloadFile(url, destPath);

    console.log(`Installed ${BINARY_NAME} to ${destPath}`);
  } catch (error) {
    console.error(`Failed to install: ${error.message}`);
    process.exit(1);
  }
}

main();
