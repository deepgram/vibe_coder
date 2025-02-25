import * as vscode from 'vscode';

export class MicPermissionWebViewProvider {
  private _panel: vscode.WebviewPanel | undefined;
  private _extensionUri: vscode.Uri;

  constructor(extensionUri: vscode.Uri) {
    this._extensionUri = extensionUri;
  }

  public async showPermissionCheck(): Promise<void> {
    // Create and show a new webview panel
    this._panel = vscode.window.createWebviewPanel(
      'vibe-coder.micPermissionCheck',
      'Microphone Permission Check',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: false,
        localResourceRoots: [this._extensionUri]
      }
    );

    // Set the HTML content
    this._panel.webview.html = this._getHtmlForWebview();

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      message => {
        switch (message.type) {
          case 'permissionStatus':
            // Log the permission status
            console.log(`Microphone permission status: ${message.status}`);
            
            // Show a notification with the permission status
            const statusText = this._getStatusText(message.status);
            vscode.window.showInformationMessage(`Microphone permission: ${statusText}`);
            break;
            
          case 'error':
            // Show an error message
            vscode.window.showErrorMessage(`Error checking microphone permission: ${message.message}`);
            break;
        }
      }
    );
  }

  private _getStatusText(status: string): string {
    switch (status) {
      case 'granted':
        return 'Granted ✅';
      case 'denied':
        return 'Denied ❌';
      case 'prompt':
        return 'Not yet requested (will prompt)';
      default:
        return status;
    }
  }

  private _getHtmlForWebview(): string {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; media-src blob: mediastream:; connect-src blob: mediastream:;">
      <title>Microphone Permission Check</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
          padding: 20px;
          color: var(--vscode-foreground);
          background-color: var(--vscode-editor-background);
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
        }
        h1 {
          font-size: 1.5em;
          margin-bottom: 20px;
        }
        .status-container {
          margin: 20px 0;
          padding: 15px;
          border-radius: 5px;
          background-color: var(--vscode-editor-inactiveSelectionBackground);
        }
        .status {
          font-size: 1.2em;
          font-weight: bold;
          margin-bottom: 10px;
        }
        .status.granted {
          color: #4CAF50;
        }
        .status.denied {
          color: #F44336;
        }
        .status.prompt {
          color: #FFC107;
        }
        button {
          background-color: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
          border: none;
          padding: 8px 16px;
          font-size: 14px;
          border-radius: 2px;
          cursor: pointer;
          margin-top: 10px;
        }
        button:hover {
          background-color: var(--vscode-button-hoverBackground);
        }
        .instructions {
          margin-top: 20px;
          padding: 15px;
          border-radius: 5px;
          background-color: var(--vscode-editor-inactiveSelectionBackground);
        }
        .instructions h2 {
          font-size: 1.2em;
          margin-bottom: 10px;
        }
        .instructions ol {
          padding-left: 20px;
        }
        .instructions li {
          margin-bottom: 8px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Microphone Permission Check</h1>
        
        <div class="status-container">
          <div id="status-display">Checking permission status...</div>
          <div id="button-container">
            <button id="request-button" style="display: none;">Request Microphone Access</button>
          </div>
        </div>
        
        <div id="denied-instructions" class="instructions" style="display: none;">
          <h2>How to Reset Microphone Permissions</h2>
          <p>Your browser has denied microphone access. To reset permissions:</p>
          
          <ol>
            <li><strong>Chrome/Edge:</strong> Click the lock/info icon in the address bar → Site settings → Reset permissions</li>
            <li><strong>Firefox:</strong> Click the lock icon in the address bar → Clear Permissions</li>
            <li><strong>Safari:</strong> Preferences → Websites → Microphone → Find VS Code entry and change permission</li>
          </ol>
          
          <p>After resetting, reload VS Code and try again.</p>
        </div>
      </div>
      
      <script>
        (function() {
          const vscode = acquireVsCodeApi();
          const statusDisplay = document.getElementById('status-display');
          const requestButton = document.getElementById('request-button');
          const deniedInstructions = document.getElementById('denied-instructions');
          
          // Check microphone permission
          async function checkMicrophonePermission() {
            try {
              // Check if the Permissions API is available
              if (navigator.permissions && navigator.permissions.query) {
                const permissionStatus = await navigator.permissions.query({ name: 'microphone' });
                
                // Update UI based on permission status
                updatePermissionUI(permissionStatus.state);
                
                // Send status back to extension
                vscode.postMessage({
                  type: 'permissionStatus',
                  status: permissionStatus.state
                });
                
                // Listen for permission changes
                permissionStatus.onchange = function() {
                  updatePermissionUI(this.state);
                  vscode.postMessage({
                    type: 'permissionStatus',
                    status: this.state
                  });
                };
              } else {
                // Permissions API not available, try getUserMedia directly
                statusDisplay.textContent = "Permissions API not available. Trying direct microphone access...";
                requestButton.style.display = 'block';
                requestButton.textContent = 'Test Microphone Access';
              }
            } catch (error) {
              console.error('Error checking permission:', error);
              statusDisplay.textContent = "Error checking microphone permission. Please try again.";
              vscode.postMessage({
                type: 'error',
                message: error.message || 'Unknown error checking permission'
              });
            }
          }
          
          // Update UI based on permission status
          function updatePermissionUI(state) {
            statusDisplay.className = 'status ' + state;
            
            switch (state) {
              case 'granted':
                statusDisplay.innerHTML = "✅ <strong>Microphone access is granted!</strong><br>You can use voice features without issues.";
                requestButton.style.display = 'none';
                deniedInstructions.style.display = 'none';
                break;
              case 'denied':
                statusDisplay.innerHTML = "❌ <strong>Microphone access is denied!</strong><br>Voice features will not work until you reset permissions.";
                requestButton.style.display = 'none';
                deniedInstructions.style.display = 'block';
                break;
              case 'prompt':
                statusDisplay.innerHTML = "⚠️ <strong>Microphone permission not yet requested.</strong><br>Click the button below to request access.";
                requestButton.style.display = 'block';
                requestButton.textContent = 'Request Microphone Access';
                deniedInstructions.style.display = 'none';
                break;
              default:
                statusDisplay.textContent = "Unknown permission state: " + state;
                requestButton.style.display = 'block';
                deniedInstructions.style.display = 'none';
            }
          }
          
          // Request microphone access
          async function requestMicrophoneAccess() {
            try {
              statusDisplay.textContent = "Requesting microphone access...";
              
              // Request microphone access
              const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
              
              // Access granted
              updatePermissionUI('granted');
              vscode.postMessage({
                type: 'permissionStatus',
                status: 'granted'
              });
              
              // Stop all tracks to release the microphone
              stream.getTracks().forEach(track => track.stop());
              
            } catch (error) {
              console.error('Error requesting microphone:', error);
              
              // Access denied
              if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                updatePermissionUI('denied');
                vscode.postMessage({
                  type: 'permissionStatus',
                  status: 'denied'
                });
              } else {
                // Other error
                statusDisplay.innerHTML = "❌ <strong>Error accessing microphone:</strong><br>" + error.message;
                vscode.postMessage({
                  type: 'error',
                  message: error.message || 'Unknown error accessing microphone'
                });
              }
            }
          }
          
          // Add event listener to request button
          requestButton.addEventListener('click', requestMicrophoneAccess);
          
          // Check permission on load
          checkMicrophonePermission();
        })();
      </script>
    </body>
    </html>`;
  }
} 