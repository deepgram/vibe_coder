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
  private readonly promptManager: PromptManagementService
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
              background: var(--vscode-input-background);
              border-radius: 20px;
              padding: 4px;
              margin-bottom: 20px;
              width: fit-content;
            }
            .mode-button {
              padding: 8px 16px;
              border-radius: 16px;
              border: none;
              cursor: pointer;
              font-size: 13px;
              transition: all 0.2s;
            }
            .mode-button.active {
              background: var(--vscode-button-background);
              color: var(--vscode-button-foreground);
            }
            .mode-button:not(.active) {
              background: transparent;
              color: var(--vscode-foreground);
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
              <div class="status">
                <span class="codicon codicon-record" id="code-status-icon"></span>
                <span id="code-status">Ready</span>
              </div>
              <div class="controls">
                <button onclick="toggleDictation()" id="dictation-toggle">
                  Start Dictation
                </button>
              </div>
              <div id="transcript"></div>
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
                  currentMode = message.mode;  // Update tracked mode
                  updateModeUI(message.mode);
                  break;
                case 'updateTranscript':
                  const element = document.getElementById(message.target || 'transcript');
                  if (element) element.textContent = message.text;
                  break;
                case 'updateStatus':
                  const statusElement = document.getElementById(
                    message.target === 'code-status' ? 'code-status' : 'vibe-status'
                  );
                  if (statusElement) {
                    statusElement.textContent = message.text;
                    // Update icon and button state
                    if (message.target === 'code-status') {
                      const isRecording = message.text === 'Recording...';
                      document.getElementById('code-status-icon').style.color = 
                        isRecording ? 'var(--vscode-errorForeground)' : '';
                      document.getElementById('dictation-toggle').textContent = 
                        isRecording ? 'Stop Dictation' : 'Start Dictation';
                    }
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
          </script>
        </body>
      </html>
    `
  }

  private setupMessageHandling() {
    if (!this.panel) return

    this.panel.webview.onDidReceiveMessage(async message => {
      switch (message.type) {
        case 'switchMode':
          await this.setMode(message.mode as Mode)
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

      // Process the accumulated text
      if (this.transcriptBuffer.trim()) {
        this.panel?.webview.postMessage({ 
          type: 'updateStatus', 
          text: 'Processing...',
          target: 'code-status'
        })

        const result = await this.llmService.processText({
          text: this.transcriptBuffer,
          prompt: this.promptManager.getDefaultPrompt()
        })

        if (result.error) {
          vscode.window.showErrorMessage(result.error)
        } else {
          await vscode.env.clipboard.writeText(result.text)
          this.panel?.webview.postMessage({ 
            type: 'updateTranscript', 
            text: result.text,
            target: 'transcript'
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