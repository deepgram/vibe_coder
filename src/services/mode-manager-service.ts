import * as vscode from 'vscode'
import { DeepgramService } from './deepgram-service'
import { VoiceAgentService } from './voice-agent-service'
import { LLMService } from './llm-service'
import { PromptManagementService } from './prompt-management-service'
import { CommandRegistryService } from './command-registry-service'
import { ConversationLoggerService } from './conversation-logger-service'
import { SpecGeneratorService } from './spec-generator-service'

export type Mode = 'vibe' | 'code'

export class ModeManagerService {
  public readonly deepgramService: DeepgramService
  public readonly voiceAgentService: VoiceAgentService
  private readonly llmService: LLMService
  public readonly promptManager: PromptManagementService
  public currentMode: Mode = 'code'
  private panel: vscode.WebviewPanel | undefined
  private isInitialized = false
  private finalTranscripts: string[] = []
  private interimTranscript = ''
  private isDictationActive = false
  private commandRegistry: CommandRegistryService
  private readonly conversationLogger: ConversationLoggerService
  private readonly specGenerator: SpecGeneratorService

  constructor(private context: vscode.ExtensionContext) {
    console.log('ModeManagerService constructor')
    this.conversationLogger = new ConversationLoggerService(context)
    this.llmService = new LLMService(context)
    this.specGenerator = new SpecGeneratorService(this.llmService, this.conversationLogger)
    
    // Initialize new services
    this.deepgramService = new DeepgramService(context)
    this.voiceAgentService = new VoiceAgentService({
      context,
      updateStatus: (status: string) => {
        this.panel?.webview.postMessage({ 
          type: 'updateStatus', 
          text: status,
          target: 'vibe-status'
        })
      },
      updateTranscript: (text: string) => {
        this.conversationLogger.logEntry({ role: 'assistant', content: text })
        this.panel?.webview.postMessage({ 
          type: 'updateTranscript', 
          text,
          target: 'agent-transcript'
        })
      },
      conversationLogger: this.conversationLogger
    })
    
    this.promptManager = new PromptManagementService(context)
    this.promptManager.setOnPromptsChanged(() => this.refreshWebviewPrompts())

    // Register toggle command
    context.subscriptions.push(
      vscode.commands.registerCommand('vibe-coder.toggleDictation', async () => {
        if (this.currentMode !== 'code') return
        await this.toggleDictation()
      })
    )

    this.commandRegistry = new CommandRegistryService()
  }

  async initialize(): Promise<void> {
    console.log('ModeManagerService initializing...')
    try {
      await this.deepgramService.initialize()
    } catch (error) {
      console.warn('Failed to initialize Deepgram service:', error)
      // Continue initialization even if Deepgram fails
    }
    
    try {
      await this.voiceAgentService.initialize()
    } catch (error) {
      console.warn('Failed to initialize Voice Agent service:', error)
      // Continue initialization even if Voice Agent fails
    }
    
    this.setupTranscriptListeners()
    this.isInitialized = true
    console.log('ModeManagerService initialized successfully')
  }

  private setupTranscriptListeners() {
    console.log('Setting up transcript listeners')
    this.deepgramService.onTranscript((text: string, isFinal: boolean) => {
      console.log('Received transcript in mode manager:', text, 'isFinal:', isFinal, 'Mode:', this.currentMode, 'Dictation Active:', this.isDictationActive)
      if (this.currentMode === 'code' && this.isDictationActive) {
        if (isFinal) {
          this.finalTranscripts.push(text)
          this.interimTranscript = ''
        } else {
          this.interimTranscript = text
        }
        const displayTranscript = this.finalTranscripts.join(' ') + (this.interimTranscript ? ' ' + this.interimTranscript : '')
        this.panel?.webview.postMessage({ 
          type: 'updateTranscript', 
          text: displayTranscript,
          target: 'transcript'
        })
      }
    })
  }

  private createPanel() {
    const editor = vscode.window.activeTextEditor
    const columnWidth = editor?.visibleRanges[0]?.end.character || 120
    const panelColumn = Math.floor(columnWidth * 0.4)

    this.panel = vscode.window.createWebviewPanel(
      'vibeCoder.panel',
      'Vibe Coder',
      {
        viewColumn: vscode.ViewColumn.Beside,
        preserveFocus: true
      },
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    )

    this.panel.webview.html = this.getWebviewContent()
    this.setupMessageHandling()
    
    this.voiceAgentService.setAgentPanel({
      postMessage: (message: unknown): Thenable<boolean> => {
        console.log('Forwarding message to webview:', message)
        return this.panel?.webview.postMessage(message) || Promise.resolve(false)
      }
    })

    if (this.panel) {
      this.panel.onDidChangeViewState(e => {
        if (e.webviewPanel.visible) {
          vscode.commands.executeCommand('workbench.action.setEditorLayoutSize', {
            id: this.panel?.viewColumn,
            size: panelColumn
          })
        }
      })
    }

    this.panel.onDidDispose(() => {
      this.cleanup()
    })
  }

  private getWebviewContent() {
    const matrixGreen = '#00FF41'
    const matrixDarkGreen = '#003B00'
    const matrixBlack = '#0D0208'

    const styles = `
      .terminal-text {
        font-family: 'Courier New', monospace;
        color: ${matrixGreen};
        white-space: pre-wrap;
        line-height: 1.4;
        position: relative;
        z-index: 1;
        min-height: 20px;
      }

      .terminal-text::after {
        content: '▋';
        animation: blink 1s step-end infinite;
        margin-left: 2px;
      }

      @keyframes blink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0; }
      }
    `

    // Use single quotes for the JS to avoid backtick conflicts
    const audioPlayerJs = `
    // Audio processing utilities
    function createAudioBuffer(audioContext, data, sampleRate = 24000) {
      const audioDataView = new Int16Array(data);
      if (audioDataView.length === 0) {
        console.error("Received audio data is empty.");
        return null;
      }

      const buffer = audioContext.createBuffer(1, audioDataView.length, sampleRate);
      const channelData = buffer.getChannelData(0);

      // Convert linear16 PCM to float [-1, 1]
      for (let i = 0; i < audioDataView.length; i++) {
        channelData[i] = audioDataView[i] / 32768;
      }

      return buffer;
    }

    function playAudioBuffer(audioContext, buffer, startTime, gainNode) {
      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(gainNode);
      
      const currentTime = audioContext.currentTime;
      if (startTime < currentTime) {
        startTime = currentTime;
      }

      source.start(startTime);
      return {
        source,
        endTime: startTime + buffer.duration
      };
    }

    function downsample(buffer, fromSampleRate, toSampleRate) {
      if (fromSampleRate === toSampleRate) {
        return buffer;
      }
      const sampleRateRatio = fromSampleRate / toSampleRate;
      const newLength = Math.round(buffer.length / sampleRateRatio);
      const result = new Float32Array(newLength);
      let offsetResult = 0;
      let offsetBuffer = 0;
      while (offsetResult < result.length) {
        const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
        let accum = 0,
          count = 0;
        for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
          accum += buffer[i];
          count++;
        }
        result[offsetResult] = accum / count;
        offsetResult++;
        offsetBuffer = nextOffsetBuffer;
      }
      return result;
    }

    // Audio player implementation with explicit sample rate handling
    class AudioPlayer {
      constructor() {
        this.audioContext = null;
        this.gainNode = null;
        this.activeSources = [];
        this.initialized = false;
        this.audioQueue = [];
        this.isProcessing = false;
        this.nextStartTime = 0;
      }
      
      init() {
        if (this.initialized) return;
        
        try {
          this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
          console.log('Audio context initialized:', this.audioContext.state, 
            'Sample rate:', this.audioContext.sampleRate + 'Hz');
          
          this.gainNode = this.audioContext.createGain();
          this.gainNode.connect(this.audioContext.destination);
          this.gainNode.gain.value = 0.8; // Slightly reduced volume to avoid clipping
          
          if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
          }
          
          this.initialized = true;
        } catch (error) {
          console.error('Failed to initialize audio context:', error);
          vscode.postMessage({ 
            type: 'error', 
            message: 'Failed to initialize audio playback: ' + error.message 
          });
        }
      }
      
      base64ToArrayBuffer(base64) {
        try {
          const binaryString = window.atob(base64);
          const bytes = new Uint8Array(binaryString.length);
          
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          
          return bytes.buffer;
        } catch (error) {
          console.error('Error converting base64 to ArrayBuffer:', error);
          throw error;
        }
      }
      
      stopAllAudio() {
        console.log('Stopping all audio (' + this.activeSources.length + ' sources)');
        
        // Stop all currently playing sources
        this.activeSources.forEach(source => {
          try {
            source.stop(0);
          } catch (e) {
            // Ignore errors if source already stopped
          }
        });
        
        this.activeSources = [];
        
        // Clear the audio queue
        this.audioQueue = [];
        this.isProcessing = false;
        this.nextStartTime = 0;
        
        console.log('All audio stopped');
      }
      
      async processAudioData(rawData, srcSampleRate) {
        if (!this.initialized) this.init();
        
        try {
          // Convert raw data to Int16Array
          const int16Data = new Int16Array(rawData);
          
          // Create audio buffer directly from the PCM data
          const audioBuffer = createAudioBuffer(this.audioContext, int16Data, srcSampleRate);
          
          if (!audioBuffer) {
            throw new Error('Failed to create audio buffer: empty data');
          }
          
          console.log('Successfully created audio buffer: ' + 
            audioBuffer.duration.toFixed(2) + 's, ' + 
            audioBuffer.numberOfChannels + ' channels, ' + 
            audioBuffer.sampleRate + 'Hz');
          
          return audioBuffer;
        } catch (error) {
          console.error('Failed to process audio data:', error);
          throw error;
        }
      }
      
      playAudioBuffer(audioBuffer) {
        if (!this.initialized) this.init();
        
        try {
          const result = playAudioBuffer(
            this.audioContext, 
            audioBuffer, 
            this.nextStartTime,
            this.gainNode
          );
          
          const source = result.source;
          this.nextStartTime = result.endTime;
          
          // Track all active sources
          this.activeSources.push(source);
          
          source.onended = () => {
            const index = this.activeSources.indexOf(source);
            if (index !== -1) {
              this.activeSources.splice(index, 1);
            }
            console.log('Audio playback ended, active sources: ' + this.activeSources.length);
            
            // Notify when all audio has finished
            if (this.activeSources.length === 0) {
              vscode.postMessage({ type: 'audioEnded' });
              this.processQueue();
            }
          };
          
          console.log('Started audio playback, duration: ' + audioBuffer.duration.toFixed(2) + 's');
          
          return true;
        } catch (error) {
          console.error('Error playing audio:', error);
          return false;
        }
      }
      
      // Process audio queue to avoid overlapping playback
      async processQueue() {
        if (this.isProcessing || this.audioQueue.length === 0) return;
        
        this.isProcessing = true;
        
        try {
          const nextAudio = this.audioQueue.shift();
          await this.playAudio(nextAudio, true);
        } finally {
          this.isProcessing = false;
          
          // Continue processing the queue if there are more items
          if (this.audioQueue.length > 0) {
            this.processQueue();
          }
        }
      }
      
      async playAudio(audioData, bypassQueue = false) {
        // If we're already processing audio and this isn't a bypass call, queue it
        if (!bypassQueue && (this.isProcessing || this.activeSources.length > 0)) {
          console.log('Audio already playing, queueing new audio');
          this.audioQueue.push(audioData);
          return;
        }
        
        this.isProcessing = true;
        
        if (!this.initialized) this.init();
        
        try {
          console.log('Processing audio data:', {
            encoding: audioData.encoding,
            sampleRate: audioData.sampleRate,
            isRaw: audioData.isRaw
          });
          
          const rawData = this.base64ToArrayBuffer(audioData.data);
          
          if (audioData.isRaw) {
            // For raw PCM data, create an audio buffer directly
            const audioBuffer = await this.processAudioData(
              rawData, 
              audioData.sampleRate
            );
            
            // Play the buffer
            this.playAudioBuffer(audioBuffer);
          } else {
            // For encoded audio data (MP3, WAV, etc.), use the browser's decoder
            try {
              const audioBuffer = await this.audioContext.decodeAudioData(rawData);
              this.playAudioBuffer(audioBuffer);
            } catch (error) {
              console.error('Failed to decode audio data:', error);
              vscode.postMessage({ 
                type: 'error', 
                message: 'Failed to decode audio: ' + error.message 
              });
            }
          }
        } catch (error) {
          console.error('Audio playback error:', error);
          vscode.postMessage({ 
            type: 'error', 
            message: 'Audio playback error: ' + error.message 
          });
        } finally {
          this.isProcessing = false;
          this.processQueue();
        }
      }
    }
    
    // Create the audio player
    const audioPlayer = new AudioPlayer();
    `

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              padding: 20px;
              font-family: 'Courier New', monospace;
              color: ${matrixGreen};
              background-color: ${matrixBlack};
              margin: 0;
              min-height: 100vh;
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
              z-index: 1;
            }
            .mode-button {
              padding: 8px 24px;
              border-radius: 20px;
              border: none;
              cursor: pointer;
              font-size: 14px;
              text-transform: uppercase;
              letter-spacing: 1px;
              transition: all 0.3s ease;
              background: transparent;
              color: ${matrixGreen};
            }
            .mode-button.active {
              background: ${matrixDarkGreen};
              text-shadow: 0 0 8px ${matrixGreen}, 0 0 12px ${matrixGreen};
              box-shadow: 0 0 12px rgba(0, 255, 65, 0.3);
            }
            .mode-button:not(.active) {
              opacity: 0.7;
            }
            .content-container {
              width: 100%;
              height: calc(100vh - 100px);
              display: flex;
              flex-direction: column;
              position: relative;
            }
            .vibe-section, .code-section {
              position: relative;
              padding: 20px;
              box-sizing: border-box;
              overflow: hidden;
              background: rgba(0, 0, 0, 0.05);
            }
            .vibe-section {
              height: 40%;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
            }
            .code-section {
              height: 60%;
              overflow-y: auto;
            }
            .section-overlay {
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              background: rgba(0, 0, 0, 0.5);
              pointer-events: none;
              opacity: 0;
              transition: opacity 0.3s ease;
              backdrop-filter: blur(4px);
              -webkit-backdrop-filter: blur(4px);
              z-index: 1000;
            }
            .section-overlay.inactive {
              opacity: 0.8;
            }
            .matrix-canvas {
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              z-index: 0;
            }
            .status {
              z-index: 1;
              color: ${matrixGreen};
              margin-bottom: 10px;
            }
            .transcription-container {
              background: rgba(0, 59, 0, 0.3);
              border: 1px solid ${matrixGreen};
              border-radius: 4px;
              margin-top: 24px;
              position: relative;
              overflow: hidden;
            }
            .container-label {
              color: ${matrixGreen};
              font-size: 12px;
              text-transform: uppercase;
              letter-spacing: 1px;
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
            .processing-container {
              display: flex;
              flex-direction: column;
              align-items: center;
              padding: 4px 0;
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
            }
            .success-message.visible {
              opacity: 0.8;
            }
            .prompt-container {
              background: rgba(0, 59, 0, 0.2);
              border: 1px solid ${matrixGreen};
              border-radius: 4px;
              padding: 20px;
              padding-bottom: 70px;
              position: relative;
              height: auto;
              min-height: 150px;
              max-height: 250px;
              margin-top: 20px;
              margin-bottom: 20px;
              overflow: hidden;
              display: flex;
              flex-direction: column;
              transition: max-height 0.3s ease;
            }
            
            .prompt-container:hover {
              max-height: 350px;
            }
            
            #prompt-output {
              color: ${matrixGreen};
              font-size: 13px;
              line-height: 1.5;
              white-space: pre-wrap;
              height: auto;
              max-height: 100%;
              overflow-y: auto;
              padding-right: 10px;
              scrollbar-width: thin;
              scrollbar-color: ${matrixDarkGreen} ${matrixBlack};
            }
            
            #prompt-output::-webkit-scrollbar {
              width: 6px;
            }
            
            #prompt-output::-webkit-scrollbar-track {
              background: ${matrixBlack};
            }
            
            #prompt-output::-webkit-scrollbar-thumb {
              background-color: ${matrixDarkGreen};
              border-radius: 3px;
            }
            .controls {
              position: fixed;
              bottom: 20px;
              right: 20px;
              z-index: 1000;
              display: flex;
              align-items: center;
              gap: 10px;
              background: rgba(0, 0, 0, 0.7);
              padding: 8px 12px;
              border-radius: 6px;
              backdrop-filter: blur(3px);
              -webkit-backdrop-filter: blur(3px);
              box-shadow: 0 0 15px rgba(0, 0, 0, 0.6);
            }
            #dictation-toggle {
              background: linear-gradient(to bottom, ${matrixDarkGreen}, rgba(0, 20, 0, 0.8));
              border: 1px solid ${matrixGreen};
              color: ${matrixGreen};
              padding: 10px 20px;
              cursor: pointer;
              font-size: 14px;
              font-weight: bold;
              text-transform: uppercase;
              letter-spacing: 1.5px;
              transition: all 0.3s ease;
              border-radius: 4px;
              box-shadow: 0 0 8px rgba(0, 255, 65, 0.2);
              text-shadow: 0 0 5px rgba(0, 255, 65, 0.5);
              margin-right: 10px;
            }
            
            #dictation-toggle:hover {
              background: linear-gradient(to bottom, rgba(0, 59, 0, 0.9), ${matrixDarkGreen});
              box-shadow: 0 0 12px rgba(0, 255, 65, 0.4);
              text-shadow: 0 0 8px rgba(0, 255, 65, 0.7);
              transform: translateY(-1px);
            }
            
            #dictation-toggle:active {
              transform: translateY(1px);
              box-shadow: 0 0 6px rgba(0, 255, 65, 0.3);
            }
            
            .hotkey-hint {
              color: ${matrixGreen};
              opacity: 0.7;
              font-size: 12px;
              text-transform: uppercase;
              letter-spacing: 1px;
              margin-right: 15px;
            }
            .icon-button {
              background: rgba(0, 20, 0, 0.6);
              border: 1px solid ${matrixGreen};
              color: ${matrixGreen};
              padding: 10px;
              cursor: pointer;
              font-size: 16px;
              transition: all 0.3s ease;
              border-radius: 4px;
              display: flex;
              align-items: center;
              justify-content: center;
              width: 38px;
              height: 38px;
              box-shadow: 0 0 6px rgba(0, 255, 65, 0.15);
            }
            .settings-modal {
              display: none;
              position: fixed;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              background: rgba(0, 0, 0, 0.8);
              z-index: 2000;
              justify-content: center;
              align-items: center;
            }
            .settings-modal.visible {
              display: flex;
            }
            .modal-content {
              background: ${matrixBlack};
              border: 1px solid ${matrixGreen};
              border-radius: 4px;
              padding: 20px;
              width: 80%;
              max-width: 500px;
              max-height: 80vh;
              overflow-y: auto;
            }
            .modal-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 20px;
              border-bottom: 1px solid ${matrixDarkGreen};
              padding-bottom: 10px;
            }
            .modal-title {
              color: ${matrixGreen};
              font-size: 18px;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            .close-button {
              background: transparent;
              border: none;
              color: ${matrixGreen};
              font-size: 20px;
              cursor: pointer;
            }
            .api-key-section {
              margin-bottom: 20px;
            }
            .api-key-input {
              display: flex;
              align-items: center;
              gap: 10px;
              margin-top: 10px;
            }
            .api-key-input input {
              flex: 1;
              background: ${matrixBlack};
              color: ${matrixGreen};
              border: 1px solid ${matrixGreen};
              border-radius: 4px;
              padding: 8px;
            }
            .api-key-input button {
              background: transparent;
              border: 1px solid ${matrixGreen};
              color: ${matrixGreen};
              padding: 8px;
              cursor: pointer;
              font-size: 12px;
              text-transform: uppercase;
              letter-spacing: 1px;
              border-radius: 4px;
            }
            .api-key-input button:hover {
              box-shadow: 0 0 12px rgba(0, 255, 65, 0.3);
            }
            .prompt-selection {
              margin: 20px 0 22px 0;
              display: flex;
              align-items: center;
              gap: 10px;
            }
            #prompt-select {
              flex: 1;
              background: ${matrixBlack};
              color: ${matrixGreen};
              border: 1px solid ${matrixGreen};
              border-radius: 4px;
              padding: 8px;
              cursor: pointer;
              transition: all 0.3s ease;
            }
            #prompt-select:hover {
              box-shadow: 0 0 12px rgba(0, 255, 65, 0.3);
            }
            #prompt-select option {
              background: ${matrixBlack};
              color: ${matrixGreen};
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

          <div class="content-container">
            <div class="vibe-section">
              <div class="status">
                <span id="vibe-status">Ready</span>
              </div>
              <canvas class="matrix-canvas" id="matrix-canvas"></canvas>
              <div id="agent-transcript" class="terminal-text"></div>
              <div class="section-overlay" id="vibe-overlay"></div>
            </div>
            
            <div class="code-section">
              <div class="prompt-selection">
                <label for="prompt-select" class="container-label">Select Prompt:</label>
                <select id="prompt-select"></select>
              </div>
              <div class="transcription-container">
                <div class="container-label">LIVE TRANSCRIPTION</div>
                <div id="transcript"></div>
              </div>
              <div class="processing-container">
                <div class="status-display">
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
                <button id="settings-button" class="icon-button" onclick="openSettings()">⚙️</button>
              </div>
              <div class="section-overlay" id="code-overlay"></div>
            </div>
          </div>

          <div class="settings-modal" id="settings-modal">
            <div class="modal-content">
              <div class="modal-header">
                <div class="modal-title">API Key Management</div>
                <button class="close-button" onclick="closeSettings()">×</button>
              </div>
              <div class="api-key-section">
                <div class="container-label">Deepgram API Key</div>
                <div class="api-key-input">
                  <input type="password" id="deepgram-key" placeholder="Enter Deepgram API key">
                  <button onclick="saveApiKey('deepgram')">Save</button>
                  <button onclick="clearApiKey('deepgram')">Clear</button>
                </div>
              </div>
              <div class="api-key-section">
                <div class="container-label">OpenAI API Key</div>
                <div class="api-key-input">
                  <input type="password" id="openai-key" placeholder="Enter OpenAI API key">
                  <button onclick="saveApiKey('openai')">Save</button>
                  <button onclick="clearApiKey('openai')">Clear</button>
                </div>
              </div>
            </div>
          </div>

          <script>
            const vscode = acquireVsCodeApi();
            let currentMode = '${this.currentMode}';
            let currentState = 'disabled'; // 'speaking', 'idle', 'disabled'
            
            ${audioPlayerJs}
            
            // Event listener for messages from the extension
            window.addEventListener('message', async event => {
              const message = event.data;
              
              switch (message.type) {
                case 'playAudio':
                  // Initialize audio context on first audio playback request
                  if (!audioPlayer.initialized) {
                    audioPlayer.init();
                  }
                  
                  // Play the audio
                  audioPlayer.playAudio(message.audio);
                  break;
                  
                case 'stopAudio':
                  // Stop all audio when requested
                  audioPlayer.stopAllAudio();
                  break;
                  
                case 'updateVisualizerState':
                  currentState = message.state;
                  // If state changes to 'speaking', we're receiving audio
                  if (currentMode === 'vibe' && !animationFrame) {
                    animateMatrix();
                  } else if (currentState === 'disabled') {
                    cancelAnimationFrame(animationFrame);
                    animationFrame = null;
                  }
                  break;
                
                case 'updateMode':
                  currentMode = message.mode;
                  updateModeUI(message.mode);
                  if (message.mode === 'vibe' && !animationFrame) {
                    animateMatrix();
                  } else if (message.mode === 'code') {
                    cancelAnimationFrame(animationFrame);
                    animationFrame = null;
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
                      }
                      if (isRecording && successMsg) {
                        successMsg.classList.remove('visible');
                      }
                    }
                  }
                  break;
                  
                case 'updateTranscript':
                  if (message.target === 'transcript') {
                    document.getElementById('transcript').textContent = message.text;
                  } else if (message.target === 'prompt-output') {
                    const promptEl = document.getElementById('prompt-output');
                    promptEl.textContent = message.text;
                    promptEl.scrollTop = promptEl.scrollHeight;
                  } else if (message.target === 'agent-transcript') {
                    const agentEl = document.getElementById('agent-transcript');
                    if (message.animate) {
                      typeText(message.text, agentEl);
                    } else {
                      agentEl.textContent = message.text;
                    }
                  }
                  break;
                  
                case 'appendTranscript':
                  if (message.target === 'prompt-output') {
                    const promptEl = document.getElementById('prompt-output');
                    promptEl.textContent += message.text;
                    promptEl.scrollTop = promptEl.scrollHeight;
                  }
                  break;
                  
                case 'showSuccess':
                  document.getElementById('success-message').classList.add('visible');
                  break;
                  
                case 'populatePrompts':
                  populatePromptDropdown(message.prompts);
                  break;
                  
                case 'setCurrentPrompt':
                  document.getElementById('prompt-select').value = message.id;
                  break;
                case 'apiKeyStatus':
                  if (message.hasDeepgramKey) {
                    document.getElementById('deepgram-key').placeholder = '••••••••••••••••••••••';
                  } else {
                    document.getElementById('deepgram-key').placeholder = 'No API key set';
                  }
                  if (message.hasOpenAIKey) {
                    document.getElementById('openai-key').placeholder = '••••••••••••••••••••••';
                  } else {
                    document.getElementById('openai-key').placeholder = 'No API key set';
                  }
                  break;
              }
            });

            function updateModeUI(mode) {
              document.querySelectorAll('.mode-button').forEach(btn => {
                btn.classList.toggle('active', btn.textContent.toLowerCase() === mode);
              });
              const vibeOverlay = document.getElementById('vibe-overlay');
              const codeOverlay = document.getElementById('code-overlay');
              vibeOverlay.classList.toggle('inactive', mode !== 'vibe');
              codeOverlay.classList.toggle('inactive', mode !== 'code');
            }

            function populatePromptDropdown(prompts) {
              const select = document.getElementById('prompt-select');
              select.innerHTML = '';
              prompts.forEach(prompt => {
                const option = document.createElement('option');
                option.value = prompt.id;
                option.textContent = prompt.name;
                select.appendChild(option);
              });
              select.addEventListener('change', () => {
                vscode.postMessage({ type: 'setPrompt', id: select.value });
              });
            }

            // Typing animation
            function typeText(text, element, speed = 5) {
              let i = 0;
              element.textContent = '';
              let buffer = '';
              
              function type() {
                if (i < text.length) {
                  buffer += text.charAt(i);
                  element.textContent = buffer;
                  i++;
                  requestAnimationFrame(type);
                }
              }
              
              requestAnimationFrame(type);
            }

            // Matrix Rain Animation
            const canvas = document.getElementById('matrix-canvas');
            const ctx = canvas.getContext('2d');
            let animationFrame;

            function resizeCanvas() {
              canvas.width = canvas.offsetWidth;
              canvas.height = canvas.offsetHeight;
            }
            window.addEventListener('resize', resizeCanvas);
            resizeCanvas();

            const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*()';
            const fontSize = 16;
            const columns = Math.floor(canvas.width / fontSize);
            const drops = Array(columns).fill(0);

            function drawMatrix() {
              ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              ctx.fillStyle = '${matrixGreen}';
              ctx.font = fontSize + 'px monospace';

              for (let i = 0; i < drops.length; i++) {
                const speed = currentState === 'speaking' ? 0.1 : 0.05;
                const active = currentMode === 'vibe' && currentState !== 'disabled';
                if (active && Math.random() > (currentState === 'speaking' ? 0.95 : 0.98)) {
                  const char = characters[Math.floor(Math.random() * characters.length)];
                  ctx.fillText(char, i * fontSize, drops[i] * fontSize);
                }
                if (active && drops[i] * fontSize < canvas.height) {
                  drops[i] += speed;
                } else if (active && Math.random() > 0.95) {
                  drops[i] = 0;
                }
              }
            }

            function animateMatrix() {
              if (currentMode === 'vibe' && currentState !== 'disabled') {
                drawMatrix();
                animationFrame = requestAnimationFrame(animateMatrix);
              } else {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
              }
            }

            // Initialize audio context on first user interaction
            document.addEventListener('click', () => {
              if (!audioPlayer.initialized) audioPlayer.init();
            });

            // Switch between Vibe and Code modes
            function switchMode(mode) {
              vscode.postMessage({ type: 'switchMode', mode });
            }

            // Toggle dictation in Code mode
            function toggleDictation() {
              vscode.postMessage({ type: 'toggleDictation' });
            }
            
            function openSettings() {
              document.getElementById('settings-modal').classList.add('visible');
              // Request current API key status
              vscode.postMessage({ type: 'getApiKeyStatus' });
            }

            function closeSettings() {
              document.getElementById('settings-modal').classList.remove('visible');
            }

            function saveApiKey(service) {
              const inputId = service === 'deepgram' ? 'deepgram-key' : 'openai-key';
              const key = document.getElementById(inputId).value.trim();
              if (key) {
                vscode.postMessage({ 
                  type: 'saveApiKey', 
                  service, 
                  key 
                });
                document.getElementById(inputId).value = '';
              }
            }

            function clearApiKey(service) {
              vscode.postMessage({ 
                type: 'clearApiKey', 
                service 
              });
            }

            updateModeUI('${this.currentMode}');
          </script>
        </body>
      </html>
    `
  }

  private setupMessageHandling() {
    if (!this.panel) return
    
    this.refreshPrompts()
    this.panel.webview.onDidReceiveMessage(async message => {
      console.log('Received message:', message)
      switch (message.type) {
        case 'error':
          // Handle error messages from the webview
          console.error('Webview error:', message.message)
          vscode.window.showErrorMessage(message.message)
          break
          
        case 'audioEnded':
          // Handle audio playback ended event
          console.log('Audio playback ended')
          break
          
        case 'switchMode':
          await this.setMode(message.mode as Mode)
          break
        case 'toggleDictation':
          await this.toggleDictation()
          break
        case 'setPrompt':
          await this.promptManager.setCurrentPrompt(message.id)
          this.refreshPrompts()
          break
        
        case 'getApiKeyStatus':
          const hasDeepgramKey = !!(await this.context.secrets.get('deepgram.apiKey'))
          const hasOpenAIKey = !!(await this.context.secrets.get('openai.apiKey'))
          this.panel?.webview.postMessage({ 
            type: 'apiKeyStatus', 
            hasDeepgramKey,
            hasOpenAIKey
          })
          break
          
        case 'saveApiKey':
          if (message.service === 'deepgram') {
            await this.context.secrets.store('deepgram.apiKey', message.key)
            vscode.window.showInformationMessage('Deepgram API key saved')
            // Reinitialize the service with the new key
            try {
              this.deepgramService.updateApiKey(message.key)
            } catch (error) {
              console.error('Failed to update Deepgram API key:', error)
            }
          } else if (message.service === 'openai') {
            await this.context.secrets.store('openai.apiKey', message.key)
            vscode.window.showInformationMessage('OpenAI API key saved')
          }
          break
          
        case 'clearApiKey':
          if (message.service === 'deepgram') {
            await this.context.secrets.delete('deepgram.apiKey')
            vscode.window.showInformationMessage('Deepgram API key cleared')
          } else if (message.service === 'openai') {
            await this.context.secrets.delete('openai.apiKey')
            vscode.window.showInformationMessage('OpenAI API key cleared')
          }
          break
      }
    })
  }

  async setMode(mode: Mode) {
    console.log('Setting mode to:', mode)
    
    // Clean up previous mode
    if (this.currentMode === 'vibe' && mode === 'code') {
      console.log('Cleaning up vibe mode...')
      // Stop the voice agent and audio
      this.voiceAgentService.cleanup()
    } else if (this.currentMode === 'code' && this.isDictationActive) {
      await this.stopDictation()
    }

    // Set up new mode
    if (mode === 'vibe') {
      console.log('Starting vibe mode...')
      await this.voiceAgentService.startAgent()
      console.log('Vibe mode started')
    }

    this.currentMode = mode
    this.panel?.webview.postMessage({ type: 'updateMode', mode })
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
    if (this.currentMode === 'vibe') {
      this.voiceAgentService.setAgentPanel(undefined)
      this.voiceAgentService.cleanup()
    } else if (this.isDictationActive)
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
      this.finalTranscripts = []
      this.interimTranscript = ''
      console.log('Starting dictation in DeepgramService...')
      await this.deepgramService.startDictation()
      console.log('Dictation started successfully')
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
      const haveAnyTranscript = this.finalTranscripts.length > 0 || this.interimTranscript.trim()
      if (haveAnyTranscript) {
        this.panel?.webview.postMessage({ 
          type: 'updateStatus', 
          text: 'Processing...',
          target: 'code-status'
        })
        this.panel?.webview.postMessage({
          type: 'updateTranscript',
          text: '',
          target: 'prompt-output'
        })
        const userText = this.finalTranscripts.join(' ') + ' ' + this.interimTranscript
        this.conversationLogger.logEntry({ role: 'user', content: userText })
        const streamResponse = await this.llmService.streamProcessText({
          text: this.finalTranscripts.join(' ') + ' ' + this.interimTranscript,
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
          this.panel?.webview.postMessage({ type: 'showSuccess' })
        }
      }
    } catch (error) {
      console.error('Failed to stop dictation:', error)
    } finally {
      this.finalTranscripts = []
      this.interimTranscript = ''
      this.panel?.webview.postMessage({ 
        type: 'updateStatus', 
        text: 'Ready',
        target: 'code-status'
      })
    }
  }

  private refreshPrompts() {
    if (!this.panel) return
    this.panel.webview.postMessage({
      type: 'populatePrompts',
      prompts: [this.promptManager.getDefaultPrompt(), ...this.promptManager.getAllPrompts()]
    })
    this.panel.webview.postMessage({
      type: 'setCurrentPrompt',
      id: this.promptManager.getCurrentPrompt().id
    })
  }

  public refreshWebviewPrompts() {
    this.refreshPrompts()
  }
}