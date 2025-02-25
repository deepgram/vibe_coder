# Vibe-Coder

A voice-powered coding assistant for VS Code that helps you navigate, control, and code through natural voice commands.

## Features

- Voice-controlled coding assistant
- Deepgram AI-powered voice recognition
- Execute VS Code commands by voice
- Generate project specifications from your conversation
- Navigate file structure and open files
- Get coding assistance through natural conversation

## Setup

### 1. Install Required Dependencies

Vibe-Coder requires specific command-line tools for audio capture on each platform:

#### macOS
```bash
# Install SoX (Sound eXchange) using Homebrew
brew install sox

# Verify installation
which rec
rec --version
```

If `rec` command is not found after installing SoX, run:
```bash
brew link --force sox
```

#### Windows
1. Download SoX from [SourceForge](https://sourceforge.net/projects/sox/files/sox/)
2. Run the installer and follow the instructions
3. Ensure SoX is added to your PATH during installation
4. Verify installation by opening Command Prompt and running:
```cmd
where sox
sox --version
```

#### Linux (Ubuntu/Debian)
```bash
# Install ALSA utilities
sudo apt-get update
sudo apt-get install alsa-utils

# Verify installation
which arecord
arecord --version
```

For other Linux distributions, use the appropriate package manager.

### 2. Install the Extension

#### From VS Code Marketplace
1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "Vibe-Coder"
4. Click Install

#### Manual Installation (VSIX)
1. Download the latest .vsix file from the [Releases page](https://github.com/deepgram/vibe_coder/releases)
2. In VS Code, go to Extensions (Ctrl+Shift+X)
3. Click on the "..." menu (top-right)
4. Select "Install from VSIX..."
5. Choose the downloaded .vsix file

### 3. Configure Microphone Settings

1. Test your microphone:
   - Open the Command Palette (Ctrl+Shift+P or Cmd+Shift+P on macOS)
   - Run "Vibe-Coder: Test Microphone"
   - If successful, you'll see a confirmation message

2. If the test fails or you want to use a specific microphone:
   - Run "Vibe-Coder: List Available Microphone Devices"
   - Note the device ID/name you want to use
   - Open VS Code Settings (File > Preferences > Settings)
   - Search for "vibeCoder.microphone"
   - Set the appropriate device setting for your platform:
     - macOS: `vibeCoder.microphone.deviceMacOS`
     - Windows: `vibeCoder.microphone.deviceWindows`
     - Linux: `vibeCoder.microphone.deviceLinux`

#### Platform-Specific Device Settings

- **macOS**: Usually "default" works, but you can specify a device name from the list
- **Windows**: Use "default" or a numeric index (0, 1, 2) from the device list
- **Linux**: Common formats are "default", "plughw:0,0" (first card, first device), or "plughw:1,0" (second card, first device)

### 4. Set Up Deepgram API Key

1. Sign up at [Deepgram](https://console.deepgram.com/signup)
2. Create a new project
3. Generate an API key with the appropriate permissions
4. When you first start Vibe-Coder, you'll be prompted to enter your API key
   - Alternatively, open the Command Palette and run "Vibe-Coder: Start Voice Agent"
   - Enter your Deepgram API key when prompted

### 5. Verify Setup

1. Open the Command Palette (Ctrl+Shift+P or Cmd+Shift+P on macOS)
2. Run "Vibe-Coder: Start Voice Agent"
3. If everything is set up correctly, you should see a notification that the agent is connected
4. Start speaking to interact with the voice agent

### Troubleshooting Setup Issues

If you encounter issues during setup:

1. **Command Not Found**:
   - Ensure the required command-line tool is installed and in your PATH
   - For macOS, try `brew link --force sox`
   - For Windows, restart your computer after installing SoX
   - For Linux, ensure your user has permission to access audio devices

2. **Permission Issues**:
   - Ensure VS Code has permission to access your microphone
   - On macOS, check System Preferences > Security & Privacy > Microphone
   - On Windows, check Settings > Privacy > Microphone
   - On Linux, ensure your user is in the `audio` group: `sudo usermod -a -G audio $USER`

3. **Device Selection Issues**:
   - Run "Vibe-Coder: List Available Microphone Devices" to see available devices
   - Try using "default" as the device name
   - On Linux, try different device formats (e.g., "plughw:0,0", "hw:0,0", "default")

For more detailed troubleshooting, see [MICROPHONE_TESTING.md](MICROPHONE_TESTING.md).

## Prerequisites

Vibe-Coder requires the following external tools for audio input:

- **macOS**: SoX - Install with `brew install sox`
- **Windows**: SoX - Download from [SourceForge](https://sourceforge.net/projects/sox/)
- **Linux**: ALSA tools - Install with `sudo apt-get install alsa-utils`

These tools are used by the microphone component to capture audio input. The extension will still install without them, but voice input functionality will not work.

## Supported Platforms

The extension includes pre-compiled binaries for the following platforms:

- Windows 10/11 (x64)
- macOS (Intel x64 and Apple Silicon arm64)
- Linux (Ubuntu/Debian x64)

If your platform is not listed, the extension will try to compile the native modules automatically, which requires additional development tools. See the Troubleshooting section for more information.

## Getting Started

1. Install the extension
2. Open the command palette (Ctrl+Shift+P or Cmd+Shift+P on macOS)
3. Run the command "Vibe-Coder: Start Voice Agent"
4. When prompted, enter your Deepgram API key
5. Start talking to the assistant!

### Obtaining a Deepgram API Key

1. Sign up at [Deepgram](https://console.deepgram.com/signup)
2. Create a new project
3. Generate an API key with the appropriate permissions
4. Copy the API key for use in Vibe-Coder

## Voice Commands

Here are some example commands you can use:

- "Open the file index.js"
- "Create a new file called utils.js"
- "Show me the explorer view"
- "Generate a project specification"
- "Tell me about this codebase"

## Troubleshooting

### Missing Platform Support

If you see an error about missing native modules for your platform:

1. Ensure you have the following installed:
   - Node.js and npm
   - Python 2.7 or 3.x
   - C++ build tools
   
2. For Windows: Visual Studio Build Tools with C++ workload
3. For macOS: Xcode Command Line Tools and Homebrew
4. For Linux: build-essential and libasound2-dev

### Microphone Configuration

Vibe-Coder now supports configuring microphone devices for each operating system:

1. To list available microphone devices, run the command:
   `Vibe-Coder: List Available Microphone Devices`

2. Configure your preferred microphone device in VS Code settings:
   - Open Settings (File > Preferences > Settings)
   - Search for "vibeCoder.microphone"
   - Set the appropriate device setting for your platform:
     - macOS: `vibeCoder.microphone.deviceMacOS`
     - Windows: `vibeCoder.microphone.deviceWindows`
     - Linux: `vibeCoder.microphone.deviceLinux`

3. Restart any active recording sessions for the changes to take effect

### Microphone Not Working

If you see an error about the microphone not working:

1. Ensure you have installed the required command-line tool for your platform:
   - macOS: Install SoX with `brew install sox`
   - Windows: Install SoX from [SourceForge](https://sourceforge.net/projects/sox/)
   - Linux: Install ALSA tools with `sudo apt-get install alsa-utils`

2. After installing the required tool, restart VS Code

3. Ensure your system's microphone is working and VS Code has permission to access it

4. If you're still having issues, try listing available devices and configuring a specific device in settings

For more detailed troubleshooting, see [MICROPHONE_TESTING.md](MICROPHONE_TESTING.md)

### Other Issues

If you encounter other issues:

1. Check the Output panel in VS Code (select "Vibe-Coder" from the dropdown)
2. Check the Developer Tools console (Help > Toggle Developer Tools)
3. File an issue on our [GitHub repository](https://github.com/deepgram/vibe_coder/issues)

## Privacy

Vibe-Coder sends audio data to Deepgram for processing. Your conversations are processed according to Deepgram's privacy policy. No audio data is stored by the extension itself.

## License

[MIT License](LICENSE)
