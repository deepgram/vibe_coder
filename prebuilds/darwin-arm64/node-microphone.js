
/**
 * This is a marker file for the node-microphone module.
 * 
 * node-microphone is not a native module with a .node binary.
 * It's a JavaScript wrapper that uses command-line tools:
 * - macOS: 'rec' (part of SoX)
 * - Windows: 'sox'
 * - Linux: 'arecord'
 * 
 * Required command-line tool available: true
 * Platform: darwin
 * Architecture: arm64
 */
module.exports = {
  isJsWrapper: true,
  commandAvailable: true,
  platform: 'darwin',
  architecture: 'arm64'
};
