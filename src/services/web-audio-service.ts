import * as vscode from 'vscode';
import { AudioWebViewProvider } from '../webview/audio-webview-provider';

export interface MessageHandler {
  postMessage(message: unknown): Thenable<boolean> | undefined;
  ensureVisible(): Promise<void>;
}

export class WebAudioService {
  private messageHandler: MessageHandler | undefined;
  private audioProvider: AudioWebViewProvider | undefined;
  private eventEmitter = new vscode.EventEmitter<any>();
  
  constructor(audioProvider?: AudioWebViewProvider) {
    console.log('WebAudioService: Initializing');
    
    if (audioProvider) {
      this.audioProvider = audioProvider;
      
      // Listen for messages from the audio interface
      this.audioProvider.onMessage(message => {
        this.handleMessage(message);
      });
    }
  }
  
  // Set the message handler that will receive events
  public setMessageHandler(handler: MessageHandler) {
    console.log('WebAudioService: Setting message handler');
    this.messageHandler = handler;
  }
  
  // Handle messages from the audio interface
  public handleMessage(message: any) {
    console.log('WebAudioService: Received message:', message.type);
    
    // Forward the message to the handler if set
    if (this.messageHandler) {
      this.messageHandler.postMessage(message);
    }
    
    // Also emit the message for direct listeners
    if (message.type === 'audioData') {
      this.eventEmitter.fire({ type: 'audioData', data: message.data });
    }
  }
  
  /**
   * Register a callback to receive audio data
   * @param callback Function to call when audio data is received
   * @returns A function to remove the listener
   */
  public onAudioData(callback: (data: string) => void): () => void {
    console.log('WebAudioService: Registering onAudioData listener');
    
    const listener = (event: any) => {
      if (event.type === 'audioData') {
        callback(event.data);
      }
    };
    
    const subscription = this.eventEmitter.event(listener);
    
    return () => {
      console.log('WebAudioService: Removing onAudioData listener');
      subscription.dispose();
    };
  }
  
  // Start recording audio
  public async startRecording(): Promise<void> {
    console.log('WebAudioService: Starting recording');
    
    try {
      // Check if we have an audio provider
      if (!this.audioProvider) {
        throw new Error('No audio provider available');
      }
      
      // Ensure the WebView is visible before requesting microphone access
      await this.audioProvider.ensureWebViewIsVisible();
      
      // Start recording
      this.audioProvider.startRecording();
    } catch (error) {
      console.error('WebAudioService: Error starting recording:', error);
      throw new Error(`Failed to start recording: ${(error as Error).message}`);
    }
  }
  
  // Stop recording audio
  public stopRecording(): Promise<void> {
    console.log('WebAudioService: Stopping recording');
    
    if (!this.audioProvider) {
      console.log('WebAudioService: No audio provider available');
      return Promise.resolve();
    }
    
    this.audioProvider.stopRecording();
    return Promise.resolve();
  }
  
  // Play audio from base64 data
  public playAudio(data: string, format: string = 'audio/wav'): void {
    console.log('WebAudioService: Playing audio');
    this.audioProvider?.playAudio(data, format);
  }
  
  /**
   * Check microphone permission status
   * @returns Promise<'granted' | 'denied' | 'prompt' | 'error'>
   */
  public async checkMicrophonePermission(): Promise<'granted' | 'denied' | 'prompt' | 'error'> {
    console.log('WebAudioService: Checking microphone permission');
    
    try {
      // If no audio provider, return error
      if (!this.audioProvider) {
        console.error('WebAudioService: No audio provider available for permission check');
        return 'error';
      }
      
      // Ensure the WebView is visible to check permissions
      await this.audioProvider.ensureWebViewIsVisible();
      
      // Create a promise that will resolve with the permission status
      return new Promise((resolve) => {
        // Set up a one-time listener for the permission status
        const disposable = this.audioProvider!.onMessage((message) => {
          if (message.type === 'permissionStatus') {
            console.log('WebAudioService: Received permission status:', message.status);
            disposable.dispose();
            resolve(message.status);
          }
        });
        
        // Send a message to the WebView to check permissions
        this.audioProvider!.startRecording();
        
        // Set a timeout in case we don't get a response
        setTimeout(() => {
          disposable.dispose();
          console.log('WebAudioService: Permission check timed out');
          resolve('error');
        }, 5000);
      });
    } catch (error) {
      console.error('WebAudioService: Error checking microphone permission:', error);
      return 'error';
    }
  }
} 