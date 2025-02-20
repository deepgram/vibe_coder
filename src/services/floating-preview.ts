import * as vscode from 'vscode'

export class FloatingPreview {
  private panel: vscode.WebviewPanel | null = null
  
  constructor(private context: vscode.ExtensionContext) {
    this.createPanel()
  }

  private createPanel() {
    this.panel = vscode.window.createWebviewPanel(
      'vibeCoder.preview',
      'Voice Preview',
      {
        viewColumn: vscode.ViewColumn.Beside,  // Show in side panel
        preserveFocus: true
      },
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    )

    this.panel.webview.html = `
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
            .container {
              display: flex;
              flex-direction: column;
              gap: 16px;
            }
            .transcript-container {
              display: flex;
              flex-direction: column;
              gap: 8px;
            }
            .label {
              font-size: 12px;
              color: var(--vscode-descriptionForeground);
            }
            #transcript {
              min-height: 100px;
              padding: 12px;
              background: var(--vscode-input-background);
              border: 1px solid var(--vscode-input-border);
              border-radius: 4px;
              font-size: 14px;
              line-height: 1.4;
            }
            .actions {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 8px;
            }
            button {
              padding: 8px 16px;
              background: var(--vscode-button-background);
              color: var(--vscode-button-foreground);
              border: none;
              border-radius: 4px;
              cursor: pointer;
              font-size: 13px;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 6px;
            }
            button:hover {
              background: var(--vscode-button-hoverBackground);
            }
            .status {
              font-size: 12px;
              color: var(--vscode-descriptionForeground);
              display: flex;
              align-items: center;
              gap: 6px;
            }
            .status.active {
              color: var(--vscode-gitDecoration-addedResourceForeground);
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="status">
              <span class="codicon codicon-record"></span>
              Listening...
            </div>
            
            <div class="transcript-container">
              <div class="label">Transcription</div>
              <div id="transcript">Waiting for speech...</div>
            </div>

            <div class="actions">
              <button onclick="insertRaw()">
                <span class="codicon codicon-arrow-right"></span>
                Insert
              </button>
              <button onclick="convertToCode()">
                <span class="codicon codicon-code"></span>
                To Code
              </button>
              <button onclick="executeCommand()">
                <span class="codicon codicon-play"></span>
                Execute
              </button>
            </div>
          </div>

          <script>
            const vscode = acquireVsCodeApi();
            let currentText = '';

            window.addEventListener('message', event => {
              const message = event.data;
              switch (message.type) {
                case 'updateTranscript':
                  currentText = message.text;
                  document.getElementById('transcript').textContent = currentText;
                  break;
              }
            });

            function insertRaw() {
              vscode.postMessage({ type: 'insertRaw', text: currentText });
            }

            function convertToCode() {
              vscode.postMessage({ type: 'convertToCode', text: currentText });
            }

            function executeCommand() {
              vscode.postMessage({ type: 'executeCommand', text: currentText });
            }
          </script>
        </body>
      </html>
    `

    this.panel.onDidDispose(() => {
      this.panel = null
    })
  }

  updateTranscription(text: string) {
    if (this.panel) {
      this.panel.webview.postMessage({ 
        type: 'updateTranscript',
        text 
      })
    }
  }

  dispose() {
    if (this.panel) {
      this.panel.dispose()
      this.panel = null
    }
  }

  onDidReceiveMessage(callback: (message: any) => Promise<void>) {
    if (this.panel) {
      return this.panel.webview.onDidReceiveMessage(callback)
    }
  }
} 