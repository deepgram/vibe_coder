import * as vscode from 'vscode'
import { DeepgramService } from './deepgram-service'
import { VoiceAgentService } from './voice-agent-service'
import { LLMService } from './llm-service'
import { PromptManagementService } from './prompt-management-service'

export type Mode = 'vibe' | 'code'

export class ModeManagerService {
  public readonly deepgramService: DeepgramService
  public readonly voiceAgentService: VoiceAgentService
  private readonly llmService: LLMService
  public readonly promptManager: PromptManagementService
  public currentMode: Mode = 'code'
  private panel: vscode.WebviewPanel | undefined
  private isInitialized = false
  private transcriptBuffer = ''
  private isDictationActive = false

  constructor(private context: vscode.ExtensionContext) {
    console.log('ModeManagerService constructor')
    this.deepgramService = new DeepgramService(context)
    
    // Pass update functions to VoiceAgentService
    this.voiceAgentService = new VoiceAgentService(
      context,
      (status: string) => {
        this.panel?.webview.postMessage({ 
          type: 'updateStatus', 
          text: status 
        })
      },
      (text: string) => {
        this.panel?.webview.postMessage({ 
          type: 'updateTranscript', 
          text,
          target: 'agent-transcript'
        })
      }
    )
    
    this.llmService = new LLMService(context)
    this.promptManager = new PromptManagementService(context)

    // Replace PTT commands with toggle command
    context.subscriptions.push(
      vscode.commands.registerCommand('vibe-coder.toggleDictation', async () => {
        if (this.currentMode !== 'code') return
        await this.toggleDictation()
      })
    )
  }

  async initialize(): Promise<void> {
    console.log('ModeManagerService initializing...')
    // Initialize both services
    await this.deepgramService.initialize()
    await this.voiceAgentService.initialize()

    // Set up transcript listeners after initialization
    this.setupTranscriptListeners()
    
    this.isInitialized = true
    console.log('ModeManagerService initialized successfully')
  }

  private setupTranscriptListeners() {
    console.log('Setting up transcript listeners')
    this.deepgramService.onTranscript((text) => {
      console.log('Received transcript in mode manager:', text, 
        'Mode:', this.currentMode, 
        'Dictation Active:', this.isDictationActive
      )
      
      if (this.currentMode === 'code' && this.isDictationActive) {
        // Append to buffer with space
        this.transcriptBuffer += (this.transcriptBuffer ? ' ' : '') + text
        
        // Update UI with current buffer
        this.panel?.webview.postMessage({ 
          type: 'updateTranscript', 
          text: this.transcriptBuffer,
          target: 'transcript' 
        })
      }
    })
  }

  private createPanel() {
    this.panel = vscode.window.createWebviewPanel(
      'vibeCoder.panel',
      'Vibe Coder',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    )

    this.panel.webview.html = this.getWebviewContent()
    this.setupMessageHandling()

    this.panel.onDidDispose(() => {
      this.cleanup()
    })
  }

  private getWebviewContent() {
    const matrixGreen = '#00FF41'
    const matrixDarkGreen = '#003B00'
    const matrixBlack = '#0D0208'

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              padding: 20px;
              font-family: var(--vscode-font-family);
              color: var(--vscode-editor-foreground);
              background-color: var(--vscode-editor-background);
            }
            .mode-toggle {
              display: flex;
              background: ${matrixBlack};
              border: 1px solid ${matrixGreen};
              border-radius: 24px;
              padding: 4px;
              margin-bottom: 20px;
              width: fit-content;
              position: relative;
              overflow: hidden;
            }
            .mode-button {
              padding: 8px 24px;
              border-radius: 20px;
              border: none;
              cursor: pointer;
              font-family: 'Courier New', monospace;
              font-size: 14px;
              text-transform: uppercase;
              letter-spacing: 1px;
              position: relative;
              transition: all 0.3s ease;
              z-index: 1;
              background: transparent;
              color: ${matrixGreen};
            }
            .mode-button.active {
              background: ${matrixDarkGreen};
              color: ${matrixGreen};
              text-shadow: 0 0 8px ${matrixGreen};
              box-shadow: 0 0 12px rgba(0, 255, 65, 0.2);
            }
            .mode-button:not(.active) {
              background: transparent;
              color: ${matrixGreen};
              opacity: 0.7;
            }
            .mode-button:hover:not(.active) {
              opacity: 1;
              text-shadow: 0 0 8px ${matrixGreen};
            }
            .mode-button.active::before {
              content: '';
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              background: ${matrixGreen};
              opacity: 0.1;
              filter: blur(8px);
              border-radius: 20px;
              z-index: -1;
            }
            #content-area {
              min-height: 300px;
            }
            .vibe-mode, .code-mode {
              display: none;
            }
            .vibe-mode.active, .code-mode.active {
              display: block;
            }
            .orb-container {
              display: flex;
              justify-content: center;
              align-items: center;
              height: 200px;
            }
            .orb {
              width: 100px;
              height: 100px;
              border-radius: 50%;
              background: radial-gradient(circle at 30% 30%, var(--vscode-button-background), transparent);
              box-shadow: 0 0 20px var(--vscode-button-background);
              opacity: 0.8;
              transition: all 0.3s;
            }
            .orb.speaking {
              transform: scale(1.1);
              opacity: 1;
            }
            .status {
              display: flex;
              align-items: center;
              gap: 8px;
              margin-bottom: 12px;
              color: var(--vscode-descriptionForeground);
            }

            /* Matrix Theme Styles */
            .code-mode {
              background: ${matrixBlack};
              padding: 20px;
              font-family: 'Courier New', monospace;
              height: 100vh;
              display: grid;
              grid-template-rows: auto 60px 1fr;
              gap: 20px;
              position: relative;
              overflow: hidden;
            }

            /* Transcription Section */
            .transcription-container {
              background: rgba(0, 59, 0, 0.3);
              border: 1px solid ${matrixGreen};
              border-radius: 4px;
              margin-top: 24px;
              position: relative;
              overflow: hidden;
            }

            .container-label {
              position: absolute;
              top: -24px;
              left: 0;
              color: ${matrixGreen};
              font-size: 12px;
              text-transform: uppercase;
              letter-spacing: 1px;
              padding: 4px 8px;
              background: ${matrixBlack};
              border: 1px solid ${matrixGreen};
              border-radius: 4px;
              z-index: 10;
            }

            #transcript {
              color: ${matrixGreen};
              font-size: 14px;
              line-height: 1.4;
              text-shadow: 0 0 10px rgba(0, 255, 65, 0.4);
              height: 100%;
              overflow-y: auto;
              margin: 0;
              padding: 0;
            }

            /* Processing Section */
            .processing-container {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              padding: 4px 0;
              position: relative;
              margin: 20px 0;
            }

            .status-display {
              display: flex;
              align-items: center;
              gap: 10px;
              color: ${matrixGreen};
              border-bottom: 1px solid ${matrixDarkGreen};
              width: 100%;
              padding-bottom: 4px;
              justify-content: center;
            }

            .success-message {
              color: ${matrixGreen};
              font-size: 12px;
              opacity: 0;
              transition: opacity 0.3s ease;
              padding-top: 4px;
              font-family: 'Courier New', monospace;
            }

            /* Prompt Output Section */
            .prompt-container {
              background: rgba(0, 59, 0, 0.2);
              border: 1px solid ${matrixGreen};
              border-radius: 4px;
              padding: 20px;
              position: relative;
              height: calc(100% - 40px);
              margin-top: 40px;
              overflow: hidden;
            }

            .container-label {
              position: absolute;
              top: -24px;
              left: 0;
              color: ${matrixGreen};
              font-size: 12px;
              text-transform: uppercase;
              letter-spacing: 1px;
              padding: 4px 8px;
              background: ${matrixBlack};
              border: 1px solid ${matrixGreen};
              border-radius: 4px;
              z-index: 10;
            }

            #prompt-output {
              color: ${matrixGreen};
              font-size: 13px;
              line-height: 1.5;
              white-space: pre-wrap;
              font-family: 'Courier New', monospace;
              height: 100%;
              overflow-y: auto;
              padding-right: 10px;
            }

            /* Matrix Rain Background */
            .matrix-background {
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              pointer-events: none;
              opacity: 0.1;
            }

            @keyframes pulse {
              0% { opacity: 1; }
              50% { opacity: 0.3; }
              100% { opacity: 1; }
            }

            /* Control Button Styling */
            .controls {
              position: absolute;
              top: 10px;
              right: 0;
              z-index: 100;
              display: flex;
              align-items: center;
              gap: 10px;
            }

            #dictation-toggle {
              background: transparent;
              border: 1px solid ${matrixGreen};
              color: ${matrixGreen};
              padding: 8px 16px;
              cursor: pointer;
              font-family: 'Courier New', monospace;
              font-size: 12px;
              text-transform: uppercase;
              letter-spacing: 1px;
              transition: all 0.3s ease;
              outline: none;
              border-radius: 4px;
              position: relative;
            }

            .hotkey-hint {
              color: ${matrixGreen};
              opacity: 0.9;
              font-size: 12px;
              font-family: 'Courier New', monospace;
              text-transform: uppercase;
              letter-spacing: 1px;
            }

            /* Add scrollbar styling */
            .transcription-container, .prompt-container {
              scrollbar-width: thin;
              scrollbar-color: ${matrixGreen} ${matrixBlack};
            }

            .transcription-container::-webkit-scrollbar,
            .prompt-container::-webkit-scrollbar {
              width: 6px;
            }

            .transcription-container::-webkit-scrollbar-track,
            .prompt-container::-webkit-scrollbar-track {
              background: ${matrixBlack};
            }

            .transcription-container::-webkit-scrollbar-thumb,
            .prompt-container::-webkit-scrollbar-thumb {
              background-color: ${matrixGreen};
              border-radius: 3px;
            }

            /* Add success message styling */
            .success-message {
              color: ${matrixGreen};
              font-size: 12px;
              opacity: 0;
              transition: opacity 0.3s ease;
              text-align: center;
              margin-top: 4px;
              font-family: 'Courier New', monospace;
            }

            .success-message.visible {
              opacity: 0.8;
            }
          </style>
        </head>
        <body>
          <div class="mode-toggle">
            <button class="mode-button ${this.currentMode === 'vibe' ? 'active' : ''}" 
                    onclick="switchMode('vibe')">Vibe</button>
            <button class="mode-button ${this.currentMode === 'code' ? 'active' : ''}" 
                    onclick="switchMode('code')">Code</button>
          </div>

          <div id="content-area">
            <div class="vibe-mode ${this.currentMode === 'vibe' ? 'active' : ''}">
              <div class="status">
                <span class="codicon codicon-broadcast"></span>
                <span id="vibe-status">Ready</span>
              </div>
              <div class="orb-container">
                <div class="orb"></div>
              </div>
              <div id="agent-transcript"></div>
            </div>
            
            <div class="code-mode ${this.currentMode === 'code' ? 'active' : ''}">
              <div class="matrix-background" id="matrix-rain"></div>
              
              <div class="transcription-container">
                <div class="container-label">LIVE TRANSCRIPTION</div>
                <div id="transcript"></div>
              </div>

              <div class="processing-container">
                <div class="status-display">
                  <span id="code-status-icon"></span>
                  <span id="code-status">Ready</span>
                </div>
                <div id="success-message" class="success-message">Copied to clipboard</div>
              </div>

              <div class="prompt-container">
                <div class="container-label">COMPILED PROMPT</div>
                <div id="prompt-output"></div>
              </div>

              <div class="controls">
                <button id="dictation-toggle" onclick="toggleDictation()">Start Dictation</button>
                <span class="hotkey-hint">[⌘⇧D]</span>
              </div>
            </div>
          </div>

          <script>
            const vscode = acquireVsCodeApi();
            let currentMode = '${this.currentMode}';  // Track current mode
            
            function switchMode(mode) {
              currentMode = mode;  // Update tracked mode
              vscode.postMessage({ type: 'switchMode', mode });
            }

            function toggleDictation() {
              vscode.postMessage({ type: 'toggleDictation' });
            }

            window.addEventListener('message', event => {
              const message = event.data;
              switch (message.type) {
                case 'updateMode':
                  currentMode = message.mode;
                  updateModeUI(message.mode);
                  break;
                case 'updateTranscript':
                  if (message.target === 'transcript') {
                    const transcriptEl = document.getElementById('transcript');
                    if (transcriptEl) transcriptEl.textContent = message.text;
                  } else if (message.target === 'prompt-output') {
                    const promptEl = document.getElementById('prompt-output');
                    if (promptEl) {
                      promptEl.textContent = message.text;
                      // Auto-scroll to bottom
                      promptEl.scrollTop = promptEl.scrollHeight;
                    }
                  }
                  break;
                case 'updateStatus':
                  const statusElement = document.getElementById(
                    message.target === 'code-status' ? 'code-status' : 'vibe-status'
                  );
                  if (statusElement) {
                    statusElement.textContent = message.text;
                    if (message.target === 'code-status') {
                      const isRecording = message.text === 'Recording...';
                      const toggleBtn = document.getElementById('dictation-toggle');
                      const successMsg = document.getElementById('success-message');
                      if (toggleBtn) {
                        toggleBtn.textContent = isRecording ? 'Stop Dictation' : 'Start Dictation';
                        toggleBtn.classList.toggle('recording', isRecording);
                      }
                      // Hide success message when recording starts
                      if (isRecording && successMsg) {
                        successMsg.classList.remove('visible');
                      }
                    }
                  }
                  break;
                case 'appendTranscript':
                  if (message.target === 'prompt-output') {
                    const promptEl = document.getElementById('prompt-output');
                    if (promptEl) {
                      promptEl.textContent += message.text;
                      // Auto-scroll to bottom
                      promptEl.scrollTop = promptEl.scrollHeight;
                    }
                  }
                  break;
                case 'showSuccess':
                  const successMsg = document.getElementById('success-message');
                  if (successMsg) {
                    successMsg.classList.add('visible');
                  }
                  break;
              }
            });

            function updateModeUI(mode) {
              document.querySelectorAll('.mode-button').forEach(btn => {
                btn.classList.toggle('active', btn.textContent.toLowerCase() === mode);
              });
              document.querySelectorAll('.vibe-mode, .code-mode').forEach(div => {
                div.classList.toggle('active', div.className.includes(mode));
              });
            }

            // Add Matrix rain animation
            function setupMatrixRain() {
              const canvas = document.createElement('canvas');
              canvas.id = 'matrix-canvas';
              document.querySelector('.matrix-background').appendChild(canvas);
              
              // Matrix rain implementation coming in next pass...
            }

            // Initialize when document loads
            document.addEventListener('DOMContentLoaded', () => {
              setupMatrixRain();
            });
          </script>
        </body>
      </html>
    `
  }

  private setupMessageHandling() {
    if (!this.panel) return

    this.panel.webview.onDidReceiveMessage(async message => {
      console.log('Received message:', message)  // Add logging
      switch (message.type) {
        case 'switchMode':
          await this.setMode(message.mode as Mode)
          break
        case 'toggleDictation':
          await this.toggleDictation()  // Add this case
          break
      }
    })
  }

  async setMode(mode: Mode) {
    console.log(`setMode called with mode: ${mode}, current mode: ${this.currentMode}`)
    if (mode === this.currentMode) return

    // Cleanup current mode
    if (this.currentMode === 'vibe') {
      console.log('Cleaning up vibe mode...')
      await this.voiceAgentService.cleanup()
      console.log('Vibe mode cleanup complete')
    } else {
      console.log('Cleaning up code mode...')
      await this.deepgramService.stopDictation()
      console.log('Code mode cleanup complete')
    }

    this.currentMode = mode
    console.log(`Mode switched to: ${mode}`)
    
    // Initialize new mode
    if (mode === 'vibe') {
      console.log('Starting vibe mode...')
      await this.voiceAgentService.startAgent()
      console.log('Vibe mode started')
    }

    // Update UI
    this.panel?.webview.postMessage({ 
      type: 'updateMode', 
      mode: this.currentMode 
    })
  }

  show() {
    console.log('ModeManagerService show called')
    if (!this.isInitialized) {
      throw new Error('Mode manager not initialized')
    }
    
    if (!this.panel) {
      this.createPanel()
    }
    this.panel?.reveal()
  }

  private cleanup() {
    if (this.currentMode === 'vibe')
      this.voiceAgentService.cleanup()
    else if (this.isDictationActive)
      this.deepgramService.stopDictation()
      
    this.panel = undefined
  }

  dispose() {
    this.cleanup()
    this.panel?.dispose()
  }

  public async toggleDictation() {
    console.log(`toggleDictation called. Current state: isDictationActive=${this.isDictationActive}, mode=${this.currentMode}`)
    if (this.isDictationActive) {
      await this.stopDictation()
    } else {
      await this.startDictation()
    }
  }

  private async startDictation() {
    console.log('startDictation called')
    if (this.isDictationActive) {
      console.log('Dictation already active, ignoring start request')
      return
    }

    try {
      this.isDictationActive = true
      this.transcriptBuffer = ''
      
      console.log('Starting dictation in DeepgramService...')
      await this.deepgramService.startDictation()
      console.log('Dictation started successfully')

      // Update UI
      this.panel?.webview.postMessage({ 
        type: 'updateStatus', 
        text: 'Recording...',
        target: 'code-status'
      })
    } catch (error) {
      console.error('Failed to start dictation:', error)
      this.isDictationActive = false
      this.panel?.webview.postMessage({ 
        type: 'updateStatus', 
        text: 'Error starting recording',
        target: 'code-status'
      })
    }
  }

  private async stopDictation() {
    console.log('Stopping dictation')
    if (!this.isDictationActive) return
    this.isDictationActive = false

    try {
      await this.deepgramService.stopDictation()

      if (this.transcriptBuffer.trim()) {
        this.panel?.webview.postMessage({ 
          type: 'updateStatus', 
          text: 'Processing...',
          target: 'code-status'
        })

        // Clear previous prompt output
        this.panel?.webview.postMessage({
          type: 'updateTranscript',
          text: '',
          target: 'prompt-output'
        })

        // Stream the response
        const streamResponse = await this.llmService.streamProcessText({
          text: this.transcriptBuffer,
          prompt: this.promptManager.getCurrentPrompt(),
          onToken: (token: string) => {
            this.panel?.webview.postMessage({
              type: 'appendTranscript',
              text: token,
              target: 'prompt-output'
            })
          }
        })

        if (streamResponse.error) {
          vscode.window.showErrorMessage(streamResponse.error)
        } else {
          await vscode.env.clipboard.writeText(streamResponse.text)
          // Show success message
          this.panel?.webview.postMessage({
            type: 'showSuccess'
          })
        }
      }
    } catch (error) {
      console.error('Failed to stop dictation:', error)
    } finally {
      this.panel?.webview.postMessage({ 
        type: 'updateStatus', 
        text: 'Ready',
        target: 'code-status'
      })
    }
  }
} 