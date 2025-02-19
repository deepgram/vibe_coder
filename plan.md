# Vibe Coder – Implementation Plan (Revised)

## Phase 1: Basic Dictation

1. **Core Dictation Setup**
   - Implement WebSocket-based audio streaming with Deepgram
   - Create status bar item to show dictation state
   - Handle cursor position tracking and text insertion
   - Add basic error handling and user feedback

2. **Audio Pipeline**
   - Implement microphone access and audio streaming
   - Set up Deepgram real-time transcription
   - Add visual feedback for audio levels
   - Handle connection/disconnection gracefully

3. **Text Insertion**
   - Insert transcribed text at cursor position
   - Handle multi-line input
   - Support basic punctuation commands
   - Add undo/redo support

4. **User Experience**
   - Add clear visual indicators for:
     - Microphone state (on/off)
     - Connection status
     - Current transcription
   - Implement hotkey toggle
   - Add basic settings (language, etc.)

## Phase 2: Voice Agent (Future)

1. **Agent Integration**
   - Implement Deepgram Voice Agent API
   - Create command registry
   - Add VS Code command execution
   - Implement context awareness

2. **LLM Features**
   - Add text rewriting capabilities
   - Implement custom prompts
   - Add command interpretation
   - Create AI chat panel

## Phase 3: Advanced Features (Future)

1. **Enhanced Dictation**
   - Add custom vocabulary
   - Implement context-aware formatting
   - Add code snippet support
   - Implement multi-cursor support

2. **Integration Features**
   - Add Git commands
   - Implement diagram generation
   - Add API research capabilities
   - Create extension points

---

This revised plan focuses on getting a solid dictation feature working first, which will:
1. Prove out the core audio pipeline
2. Provide immediate value to users
3. Create a foundation for more advanced features
4. Allow for faster iteration and feedback

---

## 1. Project Setup

1. **Repo & Extension Structure**  
   - Initialize a new VS Code extension project (e.g., using `yo code`).  
   - Organize the workspace for "Vibe Coder," including directories for:
     - `src`  
     - `test`  
     - `assets`  
     - `docs`
     - Additional libraries (if needed)  
   - Configure basic TypeScript and linting settings.

2. **Local Development Environment**  
   - Confirm Node.js version compatibility.  
   - Install TypeScript, ESLint, and Prettier.  
   - Set up scripts in `package.json` for building and launching the extension in a VS Code instance.

3. **Dependency Management**  
   - Include necessary packages:
     - `@deepgram/sdk` (for speech recognition).
     - `vscode` (extension development).
     - LLM integration libraries or custom client.  

---

## 2. MVP Features

1. **Voice Agent Integration**  
   - **Initialize Deepgram**:
     - Provide a configuration flow for API keys.
     - Connect a minimal audio streaming pipeline.
   - **Command Interpretation**:
     - Use LLM or a rules-based approach to match recognized text to known commands.
     - Define placeholders for custom commands (e.g., "close terminal," "open file," etc.).

2. **Dictation Engine**  
   - **Dedicated Dictation Mode**:
     - Listen for speech and directly insert recognized text at the current cursor.
     - Provide user feedback (e.g., show temporary transcript).
   - **LLM Rewriting**:
     - Build out a small function to send recognized text to the LLM for rewriting.
     - Insert the transformed text at the cursor.

3. **Basic VS Code Command Execution**  
   - **Command Registry**:
     - In `extension.ts` (or a similar main file), register commands for:
       - Toggling mic on/off.
       - Setting dictation mode.
       - Executing select built-in VS Code commands (open file, run terminal, etc.).
   - **User Interface**:
     - Create a status bar icon or toolbar overlay to show mic status.
     - Provide an output channel for debug logs.

---

## 3. Enhancements and Additional Features

1. **Mermaid Diagram Generation**  
   - Accept user input ("Draw a flowchart with steps A, B, C") and convert it to Mermaid syntax.
   - Insert or preview the diagram in an open editor or a dedicated webview.

2. **External Integrations**  
   - **Git**: "Commit changes," "switch branch," "push to repo," etc.  
   - **Market/API Research**: Use contextual queries to external APIs for summarizing results in the AI chat panel.

3. **User Configurations & Settings**  
   - Provide a dedicated settings panel in the Versus Code extension for specifying deepGramLocale, rewriting style, etc.
   - Let advanced users define new voice commands or modify existing ones.

4. **Testing & QA**  
   - Write unit tests and integration tests, focusing on voice command recognition, dictation accuracy, and edge cases (e.g., conflicting commands).
   - Include automated lint checks and formatting to ensure high code quality.

---

## 4. Deployment & Distribution

1. **Package the Extension**  
   - Use `vsce` (Visual Studio Code Extension Manager) or a similar tool to package and publish to the marketplace.
   - Ensure consistent versioning and changelog documentation.

2. **Fork Compatibility**  
   - Validate that references to `vscode` APIs remain stable in forks like Cursor, Windsurf, etc.
   - Provide documentation for installing the `.vsix` extension file in these forks if needed.

---

## 5. Maintenance & Roadmap

1. **Ongoing Release Cycle**  
   - Plan short sprints or version increments to address feature requests, bug fixes, and performance improvements.
   - Maintain continuous integration workflows for linting, testing, and packaging.

2. **Performance Monitoring & Logging**  
   - Track errors with a lightweight logging solution.
   - Gather user feedback for voice command success rates and rewriting preferences.

3. **Future Features**  
   - Expand third-party integrations (MCP server, doc scraping).
   - Add user-friendly handles for diagram or screenshot features.
   - Enhance personalization in the LLM for context-based suggestions.

---

## 6. Summary

This plan provides a step-by-step roadmap for implementing "Vibe Coder," from initial project setup to feature enhancements and maintenance. By focusing on an MVP-first approach and gradual improvements, the extension can deliver value early while retaining flexibility for future expansion. 