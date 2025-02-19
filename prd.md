# Vibe Coder – Product Requirements Document

## 1. Overview
Vibe Coder is a voice-driven assistant for Versus Code (VS Code and its forks), designed to streamline development workflows via voice commands and dictation. By integrating Deepgram for speech recognition and an LLM for command parsing and text rewriting, Vibe Coder simplifies routine operations, code discussion, and content creation.

## 2. Core Features

1. **Voice Commands**
   - **Deepgram Integration**: Always-on or toggle-based speech recognition.
   - **Command Parser**: Automatic recognition of user intent, mapping spoken instructions to the appropriate VS Code APIs (e.g., open terminal, create file).
   - **Custom Command Set**: Extend or modify recognized commands via configuration.

2. **Dictation (Separate from Voice Agent)**
   - **Dedicated Dictation Mode**: Direct speech-to-text insertion at the cursor.
   - **Text Rewriting**: Submit recognized text to the LLM for user-defined rewriting style (technical, conversational, bullet points).
   - **Multi-Context Insertion**: Insert into active editor, chat panel, or terminal.

3. **User Interface**
   - **Toolbar/Overlay**: Simplify toggling voice modes.  
   - **AI Chat Panel**: Integrate with existing or additional AI panels for review and feedback.  
   - **Notifications**: Display ephemeral notifications for successful or failed command execution.

4. **Integration Points**
   - **VS Code API**: Use `vscode.commands.executeCommand` to trigger native commands.  
   - **Deepgram**: Exclusive voice-to-text provider, supporting global usage or localized models.  
   - **LLM**: Provide context-based rewriting, command interpretation, or code generation.  
   - **Optional External Services**:
     - Diagram Generation (e.g., Mermaid).
     - Market/Feature Research via external APIs.
     - Git or MCP Server operations through custom commands.

## 3. Technical Requirements

1. **Architecture**  
   - **Extension Activation**: Listen for voice or user-initiated triggers upon extension activation.  
   - **Commands Registry**: Maintain a central registry of voice commands mapped to VS Code commands or custom logic.  
   - **State Management**: Track session state (dictation, voice command, paused) to unify user experience.

2. **Performance**  
   - **Low Latency**: Cache LLM session or use an efficient streaming interface.  
   - **Lightweight Overlay**: Keep the UI minimal to avoid interrupting developer workflows.

3. **Security & Permissions**  
   - **Microphone Access**: Request and manage permissions carefully.  
   - **Data Handling**: Limit or anonymize any data sent externally, especially user or code context.

4. **Configuration & Extensibility**  
   - **User Settings**: Provide toggles for auto-listen, dictation language, rewriting style, etc.  
   - **Plugin Model**: Enable third-party services or advanced features (e.g., specialized scraping, file generation).

## 4. Use Cases

1. **Hands-Free Workflow**: Quickly open files, run tests, or commit changes with voice commands.  
2. **Touchless Refactoring**: Dictate code snippets or text, have them rewritten, and inserted at the cursor location.  
3. **Research & Summaries**: Voice query to external APIs, then summarize market data or documentation in the AI chat panel.

## 5. User Experience Flow

1. **Enable Voice**: User clicks the "Vibe Coder" mic icon or issues a dedicated keybind/command.  
2. **Dictation vs. Command**: Extension distinguishes short commands from longer dictation.  
3. **Rewrite & Insert**: For dictated text, user optionally rewrites it with an LLM.  
4. **Command Execution**: For recognized commands, extension confirms action, then calls VS Code commands.  
5. **Notifications**: Display success or error messages after each action.

## 6. Milestones & Roadmap

1. **MVP**  
   - Basic voice commands for core VS Code operations (open file, run terminal, etc.).  
   - Dictation mode with rewrite and insertion.  
2. **Enhanced Features**  
   - Integration with Git and external services (e.g., market research, doc scraping).  
   - Real-time Mermaid diagram generation from spoken instructions.  
3. **Future**  
   - Improved language model context management and personalization.  
   - Plugins or marketplace for external expansions (e.g., custom workflows, advanced rewriting styles).

## 7. Evaluation & Metrics

- **Voice Command Accuracy**: % of recognized commands correctly mapped to actions.  
- **Dictation Accuracy & Speed**: Time to transcription and rewriting fidelity.  
- **User Adoption**: # of active users, frequency of voice usage.  
- **Error Rates**: Command or dictation failures, LLM parse errors.

## 8. Risks & Mitigations

1. **Microphone Access**: Provide a clear toggle for enabling/disabling the mic to prevent privacy concerns.  
2. **Unintended Actions**: Implement a confirm step for destructive commands (e.g., removing files).  
3. **Latency**: Pre-initialize both Deepgram and LLM sessions to reduce waiting times.  
4. **Compatibility**: Maintain minimal references to VS Code specifics to ensure it runs on forks and variations (Cursor, Windsurf, etc.).

## 9. Appendices

- **Deepgram Integration Details**: Document the usage of Deepgram's API keys, streaming endpoints, and fallback strategies.  
- **LLM Interaction**: Outline how queries are formed and security measures for requests and responses.

--- 