import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class AudioWebViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'vibe-coder.audioInterface';
  private _view?: vscode.WebviewView;
  private _eventEmitter = new vscode.EventEmitter<any>();
  private _audioInterfaceHtml: string = '';
  
  constructor(
    private readonly _extensionUri: vscode.Uri
  ) {
    console.log('AudioWebViewProvider: Initializing');
    // Load the audio interface HTML content
    this._loadAudioInterfaceHtml();
  }
  
  private _loadAudioInterfaceHtml() {
    try {
      const filePath = path.join(this._extensionUri.fsPath, 'media', 'audioInterface.html');
      this._audioInterfaceHtml = fs.readFileSync(filePath, 'utf8');
      console.log('AudioWebViewProvider: Loaded audio interface HTML');
    } catch (error) {
      console.error('AudioWebViewProvider: Failed to load audio interface HTML:', error);
      this._audioInterfaceHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Audio Interface</title>
        </head>
        <body>
          <div style="color: red;">Failed to load audio interface. Please restart VS Code.</div>
        </body>
        </html>
      `;
    }
  }
  
  public get onMessage() {
    return this._eventEmitter.event;
  }
  
  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    console.log('AudioWebViewProvider: Resolving webview view');
    this._view = webviewView;
    
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        this._extensionUri
      ]
    };
    
    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
    
    webviewView.webview.onDidReceiveMessage(
      message => {
        console.log('AudioWebViewProvider: Received message from webview:', message.type);
        this._eventEmitter.fire(message);
      }
    );
    
    console.log('AudioWebViewProvider: Webview view resolved');
  }
  
  /**
   * Ensures the WebView is visible to the user, which is required for microphone permissions
   */
  public async ensureWebViewIsVisible(): Promise<void> {
    console.log('AudioWebViewProvider: Ensuring WebView is visible');
    
    // Try multiple approaches to make the WebView visible
    if (!this._view) {
      console.log('AudioWebViewProvider: WebView not yet created, trying to show it');
      
      try {
        // First try the focus command
        await vscode.commands.executeCommand('vibe-coder.audioInterface.focus');
        
        // Wait a bit for the view to be created and initialized
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // If still not created, try alternative approach
        if (!this._view) {
          console.log('AudioWebViewProvider: First attempt failed, trying alternative approach');
          
          // Try to show the view container directly
          await vscode.commands.executeCommand('workbench.view.extension.vibe-coder-audio-container');
          
          // Wait again
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // If still not created, create a temporary WebView panel as fallback
          if (!this._view) {
            console.log('AudioWebViewProvider: Creating fallback WebView panel');
            this._createFallbackWebView();
            
            // Wait for the fallback to initialize
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      } catch (error) {
        console.error('AudioWebViewProvider: Error showing WebView:', error);
      }
      
      // Final check if we have a view
      if (!this._view) {
        console.error('AudioWebViewProvider: Failed to create WebView after multiple attempts');
        throw new Error('Failed to create audio interface. Please try restarting VS Code or check the VS Code logs.');
      }
    }
    
    // Make sure the view is visible
    if (!this._view.visible) {
      console.log('AudioWebViewProvider: WebView not visible, showing it now');
      try {
        this._view.show(true); // true = preserve focus
      } catch (error) {
        console.error('AudioWebViewProvider: Error showing WebView:', error);
      }
      
      // Give the browser a moment to show the view
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('AudioWebViewProvider: WebView is now visible');
  }
  
  /**
   * Creates a fallback WebView panel if the regular WebView can't be created
   */
  private _createFallbackWebView() {
    // Create a temporary panel as a fallback
    const panel = vscode.window.createWebviewPanel(
      'vibe-coder.audioInterfaceFallback',
      'Audio Interface',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [this._extensionUri]
      }
    );
    
    panel.webview.html = this._getHtmlForWebview(panel.webview);
    
    panel.webview.onDidReceiveMessage(message => {
      console.log('AudioWebViewProvider: Received message from fallback webview:', message.type);
      this._eventEmitter.fire(message);
    });
    
    // Create a proxy object that mimics the WebviewView interface
    this._view = {
      webview: panel.webview,
      visible: true,
      show: () => panel.reveal(),
      // Add other required properties/methods
      description: 'Fallback Audio Interface',
      title: 'Audio Interface',
      badge: undefined,
      onDidChangeVisibility: panel.onDidChangeViewState,
      onDidDispose: panel.onDidDispose,
      dispose: () => panel.dispose()
    } as unknown as vscode.WebviewView;
    
    console.log('AudioWebViewProvider: Created fallback WebView panel');
  }
  
  public startRecording() {
    console.log('AudioWebViewProvider: Starting recording');
    if (this._view) {
      this._view.webview.postMessage({ command: 'startRecording' });
    } else {
      console.error('AudioWebViewProvider: Cannot start recording, WebView not initialized');
      this._eventEmitter.fire({ 
        type: 'error', 
        message: 'Cannot start recording, audio interface not initialized' 
      });
    }
  }
  
  public stopRecording() {
    console.log('AudioWebViewProvider: Stopping recording');
    if (this._view) {
      this._view.webview.postMessage({ command: 'stopRecording' });
    } else {
      console.log('AudioWebViewProvider: Cannot stop recording, WebView not initialized');
    }
  }
  
  public playAudio(data: string, format: string) {
    console.log('AudioWebViewProvider: Playing audio');
    if (this._view) {
      this._view.webview.postMessage({ 
        command: 'playAudio', 
        data, 
        format 
      });
    } else {
      console.error('AudioWebViewProvider: Cannot play audio, WebView not initialized');
      this._eventEmitter.fire({ 
        type: 'error', 
        message: 'Cannot play audio, audio interface not initialized' 
      });
    }
  }
  
  public async checkMicrophonePermission(): Promise<'granted' | 'denied' | 'prompt' | 'error'> {
    console.log('AudioWebViewProvider: Checking microphone permission');
    
    try {
      // Ensure the WebView is visible
      await this.ensureWebViewIsVisible();
      
      // Create a promise that will resolve with the permission status
      return new Promise((resolve) => {
        // Set up a one-time listener for the permission status
        const disposable = this._eventEmitter.event((message) => {
          if (message.type === 'permissionStatus') {
            console.log('AudioWebViewProvider: Received permission status:', message.status);
            disposable.dispose();
            resolve(message.status);
          }
        });
        
        // Send a message to check permissions
        if (this._view) {
          this._view.webview.postMessage({ command: 'checkPermission' });
        } else {
          console.error('AudioWebViewProvider: Cannot check permissions, WebView not initialized');
          resolve('error');
        }
        
        // Set a timeout in case we don't get a response
        setTimeout(() => {
          disposable.dispose();
          console.log('AudioWebViewProvider: Permission check timed out');
          resolve('error');
        }, 5000);
      });
    } catch (error) {
      console.error('AudioWebViewProvider: Error checking microphone permission:', error);
      return 'error';
    }
  }
  
  private _getHtmlForWebview(webview: vscode.Webview) {
    // Extract the content from the audio interface HTML
    // Remove the DOCTYPE, html, head, and body tags
    let content = this._audioInterfaceHtml;
    
    // Extract styles
    const styleMatch = content.match(/<style>([\s\S]*?)<\/style>/);
    const styles = styleMatch ? styleMatch[1] : '';
    
    // Extract script
    const scriptMatch = content.match(/<script>([\s\S]*?)<\/script>/);
    const script = scriptMatch ? scriptMatch[1] : '';
    
    // Create a new HTML document with proper CSP
    return `<!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; media-src blob: mediastream:; connect-src blob: mediastream:;">
        <title>Audio Interface</title>
        <style>
          ${styles}
        </style>
      </head>
      <body>
        <div id="status" class="status hidden">Ready</div>
        
        <script>
          ${script}
        </script>
      </body>
      </html>`;
  }
} 