import * as vscode from 'vscode'
import {
  createClient,
  LiveTranscriptionEvents,
  ListenLiveClient
} from '@deepgram/sdk'
import MicrophoneStream from 'microphone-stream'
import WebSocket from 'ws'

/**
 * If you have extension-specific config, define it here.
 */
export interface DeepgramConfig {
  apiKey: string
}

interface DictationState {
  isActive: boolean
  micStream: MicrophoneStream | null
  wsConnection: ListenLiveClient | null
  statusBarItem: vscode.StatusBarItem
}

export class DeepgramService {
  // Use definite assignment (!) for client since we initialize in `initialize()`
  private client!: ReturnType<typeof createClient>
  private isInitialized = false
  private dictationService: DictationService | null = null

  constructor(private context: vscode.ExtensionContext) {}

  async initialize(): Promise<void> {
    const apiKey = await this.context.secrets.get('deepgram.apiKey')
    if (!apiKey) {
      const key = await vscode.window.showInputBox({
        prompt: 'Enter your Deepgram API key',
        password: true
      })
      if (!key) throw new Error('Deepgram API key is required')
      await this.context.secrets.store('deepgram.apiKey', key)
    }

    this.client = createClient(apiKey || '')
    this.dictationService = new DictationService(this.client)
    this.isInitialized = true
  }

  async startAgent(): Promise<void> {
    vscode.window.showInformationMessage('Agent mode coming soon!')
  }

  async startDictation(): Promise<void> {
    if (!this.isInitialized)
      throw new Error('Deepgram service not initialized')

    if (!this.dictationService)
      throw new Error('Dictation service not initialized')

    await this.dictationService.startDictation()
  }

  dispose(): void {
    this.dictationService?.stopDictation()
  }
}

class DictationService {
  private state: DictationState

  constructor(
    private deepgramClient: ReturnType<typeof createClient>
  ) {
    this.state = {
      isActive: false,
      micStream: null,
      wsConnection: null,
      statusBarItem: vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right)
    }
    this.state.statusBarItem.text = '$(unmute) Dictation: Off'
    this.state.statusBarItem.show()
  }

  async startDictation(): Promise<void> {
    if (this.state.isActive) {
      await this.stopDictation()
      return
    }

    try {
      // Start microphone stream
      const stream = new MicrophoneStream() as any
      await stream.start({
        sampleRate: 16000,
        channels: 1,
        verbose: false
      })

      // Create a live transcription connection
      const connection = this.deepgramClient.listen.live({
        model: 'nova-2',
        smart_format: true,
        punctuate: true,
        interim_results: false
      })

      // Handle events
      connection.on(LiveTranscriptionEvents.Open, () => {
        this.state.isActive = true
        this.state.statusBarItem.text = '$(megaphone) Dictation: On'
        vscode.window.showInformationMessage('Dictation started')
      })

      connection.on(LiveTranscriptionEvents.Close, () => {
        this.stopDictation()
      })

      connection.on(LiveTranscriptionEvents.Transcript, (data: any) => {
        const transcript = data?.channel?.alternatives?.[0]?.transcript || ''
        if (transcript) {
          this.insertText(transcript)
        }
      })

      // Add an explicit type for error parameter
      connection.on(LiveTranscriptionEvents.Error, (error: Error) => {
        vscode.window.showErrorMessage(`Dictation error: ${error.message}`)
        this.stopDictation()
      })

      // Forward mic data to deepgram
      stream.on('data', (chunk: Buffer) => {
        // If the connection is still open, send the mic data
        if (connection.isConnected()) {
          connection.send(chunk)
        }
      })

      this.state.micStream = stream
      this.state.wsConnection = connection
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to start dictation: ${(error as Error).message}`
      )
      await this.stopDictation()
    }
  }

  async stopDictation(): Promise<void> {
    if (this.state.micStream) {
      this.state.micStream.stop()
      this.state.micStream = null
    }

    if (this.state.wsConnection) {
      this.state.wsConnection.disconnect()
      this.state.wsConnection = null
    }

    this.state.isActive = false
    this.state.statusBarItem.text = '$(unmute) Dictation: Off'
    vscode.window.showInformationMessage('Dictation stopped')
  }

  async insertText(text: string): Promise<void> {
    const editor = vscode.window.activeTextEditor
    if (!editor) return

    await editor.edit((editBuilder) => {
      const position = editor.selection.active
      editBuilder.insert(position, text + ' ')
    })
  }
} 