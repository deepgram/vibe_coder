# Vibe-Coder

A voice-powered coding assistant for VS Code that helps you navigate, control, and code through natural voice commands.

## Features

- Voice-controlled coding assistant
- Deepgram AI-powered voice recognition
- Execute VS Code commands by voice
- Generate project specifications from your conversation
- Navigate file structure and open files
- Get coding assistance through natural conversation

## Prerequisites

Vibe-Coder requires the following external tools for audio input:

- **macOS**: SoX - Install with `brew install sox`
- **Windows**: SoX - Download from [SourceForge](https://sourceforge.net/projects/sox/)
- **Linux**: ALSA tools - Install with `sudo apt-get install alsa-utils`

These tools are used by the microphone component to capture audio input. The extension will still install without them, but voice input functionality will not work.

## Installation

### From VS Code Marketplace

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "Vibe-Coder"
4. Click Install

### Manual Installation (VSIX)

1. Download the latest .vsix file from the [Releases page](https://github.com/deepgram/vibe_coder/releases)
2. In VS Code, go to Extensions (Ctrl+Shift+X)
3. Click on the "..." menu (top-right)
4. Select "Install from VSIX..."
5. Choose the downloaded .vsix file

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

### Microphone Not Working

If you see an error about the microphone not working:

1. Ensure you have installed the required command-line tool for your platform:
   - macOS: Install SoX with `brew install sox`
   - Windows: Install SoX from [SourceForge](https://sourceforge.net/projects/sox/)
   - Linux: Install ALSA tools with `sudo apt-get install alsa-utils`

2. After installing the required tool, restart VS Code

3. Ensure your system's microphone is working and VS Code has permission to access it

### Other Issues

If you encounter other issues:

1. Check the Output panel in VS Code (select "Vibe-Coder" from the dropdown)
2. Check the Developer Tools console (Help > Toggle Developer Tools)
3. File an issue on our [GitHub repository](https://github.com/deepgram/vibe_coder/issues)

## Privacy

Vibe-Coder sends audio data to Deepgram for processing. Your conversations are processed according to Deepgram's privacy policy. No audio data is stored by the extension itself.

## License

[MIT License](LICENSE)
