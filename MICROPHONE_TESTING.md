# Microphone Testing Guide

This guide provides instructions for testing the microphone functionality across different operating systems.

## Prerequisites

Before testing, ensure you have the required command-line tools installed:

- **macOS**: SoX (`rec` command)
  ```
  brew install sox
  ```

- **Windows**: SoX
  Download from [SourceForge](https://sourceforge.net/projects/sox/)

- **Linux**: ALSA tools
  ```
  sudo apt-get install alsa-utils
  ```

## Testing Steps

### 1. Basic Functionality Test

1. Open VS Code with the Vibe-Coder extension installed
2. Run the command: `Vibe-Coder: List Available Microphone Devices`
   - This should display available microphone devices in the output panel
   - If you see an error, check that the required command-line tool is installed

3. Start dictation or voice agent mode
   - If the microphone works, you should see audio data being processed
   - Check the Output panel (select "Vibe-Coder" from the dropdown) for logs

### 2. Device Configuration Test

1. Run the command: `Vibe-Coder: List Available Microphone Devices`
2. Note a specific device ID from the list
3. Open VS Code settings (File > Preferences > Settings)
4. Search for "vibeCoder.microphone"
5. Set the appropriate device setting for your platform:
   - macOS: `vibeCoder.microphone.deviceMacOS`
   - Windows: `vibeCoder.microphone.deviceWindows`
   - Linux: `vibeCoder.microphone.deviceLinux`
6. Start dictation or voice agent mode again
7. Verify in the logs that the specified device is being used

## OS-Specific Testing Notes

### macOS

- The `rec` command should be available after installing SoX
- If you installed SoX but `rec` is not found, try running:
  ```
  brew link --force sox
  ```
- Common device names: "default", specific device names from `system_profiler SPAudioDataType`

### Windows

- After installing SoX, ensure it's in your PATH
- You may need to restart VS Code after installation
- Common device names: "default", numeric indices (0, 1, 2)

### Linux

- The `arecord` command should be available after installing ALSA tools
- Common device formats:
  - `plughw:0,0` (first card, first device)
  - `plughw:1,0` (second card, first device)
  - `default`
  - Device names from `arecord -L` output

## Troubleshooting

### Command Not Found

If you see "Command not found" errors:

1. Verify the tool is installed using terminal:
   - macOS: `which rec`
   - Windows: `where sox`
   - Linux: `which arecord`
2. If installed but not found, check your PATH environment variable
3. For macOS, try `brew link --force sox`

### Device Errors

If you see device-related errors:

1. List available devices using `Vibe-Coder: List Available Microphone Devices`
2. Try using "default" as the device name
3. Check system permissions for microphone access
4. Try different device names/IDs from the list

### Audio Format Errors

If you encounter audio format errors:

1. Check the logs for specific error messages
2. Try modifying the audio format settings in code if necessary
3. Ensure your microphone supports the requested format

## Reporting Issues

When reporting issues, please include:

1. Your operating system version
2. The command-line tool version:
   - macOS/Windows: `sox --version`
   - Linux: `arecord --version`
3. The exact error message from the Output panel
4. Steps to reproduce the issue
5. Any custom configuration you've applied

## Advanced Testing

For developers wanting to test changes to the microphone wrapper:

1. Enable verbose logging by adding `console.log` statements
2. Test with different audio formats by modifying the options
3. Test error handling by intentionally using invalid device names
4. Test with different microphone hardware if available 