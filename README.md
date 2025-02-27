# Vibe-Coder

A voice-powered coding assistant for AI-enabled VS Code forks that helps you navigate, control, and code through natural voice commands. This is a first cut at Deepgram's vision of the future. It is a very early view, an experiment in Voice first programming. As such, there will be bugs, future developments. We'd love to hear your ideas on how you're using it and how to make it better. 

## Getting Started

1. Install the extension*
2. Press cmd/ctrl+shift+V to open the extension
3. Enter Deepgram API key if needed
4. Choose to either Vibe or Code!

*Windsurf does not use the standard VS Code Marketplace; therefore, you must download the VSIX from this repo and install manually.

## Features

###Vibe Mode 
- Integrated with Deepgram's Voice Agent API
- Brainstorm new ideas, validate opinions, get in the flow
- Ask it to generate a product spec at the end of your conversation to guide your development work

###Code Mode
- Voice dication with customizable AI rewrite prompts
- Generate a prompt for any scenario: Typo Corrections, Debugging, Language/Project Specific
- The rewrite gets automatically copied to your clipboard, which you can then paste anywhere you want
- This is particularly suited for vibe-coding with AI IDE's such as Cursor or Windsurf, with a separate AI chat panel
- Start and stop dication with Cmd/Ctrl+shift+D. Stopping the dictation triggers the rewrite

##Future Improvements 

In no particular order:
- Add/improve VS Code command recognition in Vibe mode
- Add additional function calling capability in Vibe mode
- Bug quashing
- Implement Microphone settings in the webview panel menu
- Explore accessibility controls on each platform to allow automatic pasting of transcripts into AI chat panel
- Give the Vibe mode agent full context of your project
- Add memory to the Vibe mode agent
- Add MCP capability to the Vibe mode agent
- Echo cancellation


## Setup

##### API Keys

You will need a Deepgram API key and an OpenAI API key. 

For Deepgram: 
1. Sign up at [Deepgram](https://console.deepgram.com/signup)
2. Create a new project
3. Generate an API key with the appropriate permissions
4. When you first start Vibe-Coder, you'll be prompted to enter your API key
Note: new signups will get $200 in free credit automatically. If you burn through that while vibe coding, let us know so we can arrange more credits!


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

(Note: the Microphone settings in the settings menu is a placeholder for now)

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

### 4. Verify Setup

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


## Voice Commands

Here are some example commands you can use:

- "Open the file index.js"
- "Create a new file"
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

## Contributing

We welcome contributions to Vibe Coder! If you're interested in helping improve this extension, please check out our [contribution guidelines](CONTRIBUTING.md) for information on how to get started, report issues, and submit pull requests.
