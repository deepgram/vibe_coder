import * as vscode from 'vscode'

export class AgentPanel {
  private panel: vscode.WebviewPanel | null = null
  private isListening = false
  
  constructor(private context: vscode.ExtensionContext) {
    this.createPanel()
  }

  private createPanel() {
    this.panel = vscode.window.createWebviewPanel(
      'vibeCoder.agent',
      'Voice Agent',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    )

    this.panel.webview.html = this.getWebviewContent()
    this.setupMessageHandling()
  }

  private getWebviewContent() {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              background: var(--vscode-editor-background);
              color: var(--vscode-editor-foreground);
              font-family: var(--vscode-font-family);
              padding: 20px;
              display: flex;
              flex-direction: column;
              align-items: center;
            }

            .agent-sphere {
              width: 200px;
              height: 200px;
              position: relative;
              margin: 20px 0;
            }

            .sphere {
              position: absolute;
              width: 100%;
              height: 100%;
              border-radius: 50%;
              background: 
                radial-gradient(circle at 30% 30%,
                  rgba(90, 200, 255, 0.8),
                  rgba(90, 200, 255, 0.4) 30%,
                  rgba(90, 200, 255, 0.1) 60%
                );
              box-shadow: 0 0 20px rgba(90, 200, 255, 0.4);
              opacity: 0.8;
              transition: all 0.3s ease;
            }

            .pulse {
              position: absolute;
              width: 100%;
              height: 100%;
              border-radius: 50%;
              border: 2px solid rgba(90, 200, 255, 0.4);
              animation: pulse 2s infinite;
            }

            @keyframes pulse {
              0% {
                transform: scale(1);
                opacity: 1;
              }
              100% {
                transform: scale(1.5);
                opacity: 0;
              }
            }

            .listening .sphere {
              background: 
                radial-gradient(circle at 30% 30%,
                  rgba(255, 90, 90, 0.8),
                  rgba(255, 90, 90, 0.4) 30%,
                  rgba(255, 90, 90, 0.1) 60%
                );
              box-shadow: 0 0 20px rgba(255, 90, 90, 0.4);
            }

            .listening .pulse {
              border-color: rgba(255, 90, 90, 0.4);
            }

            .status {
              font-size: 14px;
              margin-top: 20px;
              color: var(--vscode-descriptionForeground);
            }

            .transcript {
              margin-top: 20px;
              padding: 15px;
              background: var(--vscode-input-background);
              border: 1px solid var(--vscode-input-border);
              border-radius: 4px;
              width: 90%;
              min-height: 100px;
              font-family: var(--vscode-editor-font-family);
            }

            .ascii-sphere {
              font-family: monospace;
              white-space: pre;
              line-height: 1.2;
              color: var(--vscode-textLink-foreground);
            }

            .processed-text {
              margin-top: 20px;
              padding: 15px;
              background: var(--vscode-input-background);
              border: 1px solid var(--vscode-input-border);
              border-radius: 4px;
              width: 90%;
              min-height: 100px;
              font-family: var(--vscode-editor-font-family);
              white-space: pre-wrap;
            }

            .success-message {
              color: #4CAF50;
              margin-top: 10px;
              font-weight: 500;
              opacity: 0;
              transition: opacity 0.3s ease;
            }

            .success-message.visible {
              opacity: 1;
            }
          </style>
        </head>
        <body>
          <div class="agent-sphere">
            <div class="sphere"></div>
            <div class="pulse"></div>
            <pre class="ascii-sphere">
   .-""""""-.
 .'          '.
/              \\
|              |
\\              /
 '.          .'
   '-......-'
            </pre>
          </div>
          <div class="status">Ready</div>
          <div class="transcript"></div>
          <div class="success-message"></div>
          <div class="processed-text"></div>

          <audio id="agentAudio" style="display: none;"></audio>

          <script>
            const vscode = acquireVsCodeApi();
            let isListening = false;

            window.addEventListener('message', event => {
              const message = event.data;
              
              switch (message.type) {
                case 'updateStatus':
                  document.querySelector('.status').textContent = message.text;
                  break;
                case 'updateTranscript':
                  document.querySelector('.transcript').textContent = message.text;
                  break;
                case 'setListening':
                  isListening = message.value;
                  const sphere = document.querySelector('.agent-sphere');
                  if (isListening) {
                    sphere.classList.add('listening');
                  } else {
                    sphere.classList.remove('listening');
                  }
                  break;
                case 'playAudio':
                  const audio = document.getElementById('agentAudio');
                  // Create audio blob from base64
                  const audioData = atob(message.audio);
                  const arrayBuffer = new Uint8Array(audioData.length);
                  for (let i = 0; i < audioData.length; i++) {
                    arrayBuffer[i] = audioData.charCodeAt(i);
                  }
                  const blob = new Blob([arrayBuffer], { 
                    type: 'audio/wav' 
                  });
                  
                  // Clean up previous URL
                  if (audio.src) {
                    URL.revokeObjectURL(audio.src);
                  }
                  
                  const url = URL.createObjectURL(blob);
                  audio.src = url;
                  audio.play();
                  break;
                case 'updateProcessedText':
                  document.querySelector('.processed-text').textContent = message.text;
                  break;
                case 'showSuccess':
                  const successEl = document.querySelector('.success-message');
                  successEl.textContent = message.text;
                  successEl.classList.add('visible');
                  setTimeout(() => {
                    successEl.classList.remove('visible');
                  }, 3000);
                  break;
              }
            });
          </script>
        </body>
      </html>
    `
  }

  updateStatus(text: string) {
    if (this.panel) {
      this.panel.webview.postMessage({ 
        type: 'updateStatus', 
        text 
      })
    }
  }

  updateTranscript(text: string) {
    if (this.panel) {
      this.panel.webview.postMessage({ 
        type: 'updateTranscript', 
        text 
      })
    }
  }

  setListening(value: boolean) {
    this.isListening = value
    if (this.panel) {
      this.panel.webview.postMessage({ 
        type: 'setListening', 
        value 
      })
    }
  }

  dispose() {
    if (this.panel) {
      this.panel.dispose()
      this.panel = null
    }
  }

  private setupMessageHandling() {
    if (this.panel) {
      this.panel.webview.onDidReceiveMessage(async message => {
        switch (message.type) {
          // Handle any UI interactions here
          // For now, we'll just have the agent listening
          // We can add controls later if needed
        }
      })
    }
  }

  // Add WAV header helper
  private createWavHeader(sampleRate: number, bitsPerSample: number, dataLength: number): Buffer {
    const buffer = Buffer.alloc(44)

    // "RIFF"
    buffer.write('RIFF', 0)
    // File size
    buffer.writeUInt32LE(36 + dataLength, 4)
    // "WAVE"
    buffer.write('WAVE', 8)
    // "fmt "
    buffer.write('fmt ', 12)
    // Chunk size (16)
    buffer.writeUInt32LE(16, 16)
    // Audio format (1 for PCM)
    buffer.writeUInt16LE(1, 20)
    // Number of channels (1)
    buffer.writeUInt16LE(1, 22)
    // Sample rate
    buffer.writeUInt32LE(sampleRate, 24)
    // Byte rate
    buffer.writeUInt32LE(sampleRate * (bitsPerSample / 8), 28)
    // Block align
    buffer.writeUInt16LE(bitsPerSample / 8, 32)
    // Bits per sample
    buffer.writeUInt16LE(bitsPerSample, 34)
    // "data"
    buffer.write('data', 36)
    // Data length
    buffer.writeUInt32LE(dataLength, 40)

    return buffer
  }

  playAudio(audio: { data: string, encoding: string, sample_rate: number }) {
    if (this.panel) {
      this.panel.webview.postMessage({
        type: 'playAudio',
        audio: audio.data,  // Already base64 encoded WAV
        encoding: audio.encoding,
        sampleRate: audio.sample_rate
      })
    }
  }

  updateProcessedText(text: string) {
    if (this.panel) {
      this.panel.webview.postMessage({ 
        type: 'updateProcessedText',
        text 
      })
      this.panel.webview.postMessage({ 
        type: 'showSuccess',
        text: 'Copied to clipboard! ✨' 
      })
    }
  }

  public postMessage(message: unknown): Thenable<boolean> | undefined {
    return this.panel?.webview.postMessage(message)
  }
} 