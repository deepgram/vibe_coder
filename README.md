# Vibe Coder

Vibe Coder is a voice-first coding assistant for VS Code, enabling effortless speech-to-code, speech-driven commands, and quick dictation. It provides two distinct operating modes—**Vibe Mode** and **Code Mode**—to match different workflows.

---

## Table of Contents
1. [Features Overview](#features-overview)  
2. [Modes](#modes)  
   - [Vibe Mode](#vibe-mode)  
   - [Code Mode](#code-mode)  
3. [Installation](#installation)  
   - [Prerequisites](#prerequisites)  
   - [Packaging](#packaging)  
   - [Installation Steps](#installation-steps)  
4. [Running the Extension](#running-the-extension)  
5. [Obtaining API Keys](#obtaining-api-keys)  
   - [Deepgram API Key](#deepgram-api-key)  
   - [OpenAI API Key](#openai-api-key)  
6. [Usage Tips](#usage-tips)  
7. [Contributing](#contributing)  
8. [License](#license)  

---

## Features Overview
- **Voice Commands**: Quickly open files, toggle terminals, and manage your workspace through spoken commands.  
- **Dictation**: Dictate code or text directly into VS Code via "Code Mode."  
- **LLM Integration**: Rewrite or transform dictated text with OpenAI GPT-4.  
- **Spec Generation**: Condense conversation history into a structured project specification with a simple command.  

---

## Modes

### Vibe Mode
- Focuses on voice-driven commands and AI assistance for general tasks.  
- Executes recognized speech as commands (e.g., opening files, navigating lines, searching for text).  
- Displays an animated sphere in a panel to indicate listening state and agent activity.  

### Code Mode
- Dedicated to real-time dictation.  
- Inserts recognized text at the current cursor position without automatically interpreting them as commands.  
- Helpful for writing code, documentation, or notes without leaving the editor.  

---

## Installation

### Prerequisites
- **Node.js ≥ 16**  
- **VS Code ≥ 1.92**  
- Properly installed **vsce** (Visual Studio Code Extension manager)  

### Packaging
1. Clone or download this repository.  
2. Run all necessary build steps (compilation, lint checks, bundling).  
3. Generate the `.vsix` package with the following command:
   ```
   vsce package
   ```
4. This process creates a `vibe-coder-x.x.x.vsix` file.

### Installation Steps
1. Open VS Code.  
2. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS) to open the Command Palette.  
3. Run `Extensions: Install from VSIX...`.  
4. Select the `vibe-coder-x.x.x.vsix` file generated in the previous step.  
5. After successful installation, `Vibe Coder` is ready for use.

---

## Running the Extension
- **Direct from VSIX**: Once the `.vsix` file is installed, reload VS Code, and the extension automatically activates.  
- **In Development Mode**:  
  1. From the project root, run `npm install` to install dependencies.  
  2. Run `npm run watch` in one terminal (to watch and rebuild).  
  3. Press `F5` in VS Code (or select `Run and Debug` → `Launch Extension`) to open a new window with the extension loaded in development mode.

---

## Obtaining API Keys

### Deepgram API Key
1. Sign up at [Deepgram](https://deepgram.com).  
2. Create or retrieve a **Deepgram API key**.  
3. On first use, the extension will prompt you to provide this key. Alternatively, you can store it by running command:  
   ```
   Vibe Coder: Prompt for Deepgram API Key
   ```
4. The API key is stored securely in VS Code's secrets storage.

### OpenAI API Key
1. Sign up or log in at [OpenAI](https://platform.openai.com).  
2. Navigate to `View API Keys` and create a new key.  
3. Provide the key when prompted by Vibe Coder (similar to Deepgram).  
4. This key allows the extension to rewrite, summarize, or generate text through GPT-4.

---

## Usage Tips
- **Starting Vibe Mode**:  
  - Press `Ctrl+Shift+A` (Win/Linux) or `Cmd+Shift+A` (Mac).  
  - You will see an animated panel, and voice commands become active.  
- **Starting Code Mode**:  
  - Press `Ctrl+Shift+D` (Win/Linux) or `Cmd+Shift+D` (Mac).  
  - Dictation begins, and transcribed text is inserted at your cursor's location in the editor.  
- **Spec Generation**:  
  - Use `Vibe Coder: Generate Spec` to create a `project_spec.md` from your conversation logs.  

---

## Contributing
Contributions are welcome!  
1. Fork the repo and create a feature branch.  
2. Ensure linter and type checks pass before submitting a PR.  
3. Add tests for any new functionality.  

---

## License
This project is [MIT licensed](LICENSE).  

## Extension Settings

This extension contributes the following settings:

* None yet

## Known Issues

None yet

## Release Notes

### 0.0.1

Initial release of Vibe Coder

---

## Following extension guidelines

Ensure that you've read through the extensions guidelines and follow the best practices for creating your extension.

* [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)

## Working with Markdown

You can author your README using Visual Studio Code. Here are some useful editor keyboard shortcuts:

* Split the editor (`Cmd+\` on macOS or `Ctrl+\` on Windows and Linux).
* Toggle preview (`Shift+Cmd+V` on macOS or `Shift+Ctrl+V` on Windows and Linux).
* Press `Ctrl+Space` (Windows, Linux, macOS) to see a list of Markdown snippets.

## For more information

* [Visual Studio Code's Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
* [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)

**Enjoy!**
