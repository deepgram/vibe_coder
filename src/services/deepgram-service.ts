import * as vscode from 'vscode'
import {
  createClient,
  LiveTranscriptionEvents,
  ListenLiveClient
} from '@deepgram/sdk'
import Microphone from 'node-microphone'
import WebSocket from 'ws'
import { FloatingPreview } from './floating-preview'

/**
 * If you have extension-specific config, define it here.
 */
export interface DeepgramConfig {
  apiKey: string
}

interface DictationState {
  isActive: boolean
  mic: Microphone | null
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
    this.dictationService = new DictationService(this.client, this.context)
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

  async stopDictation(): Promise<void> {
    if (!this.dictationService)
      throw new Error('Dictation service not initialized')

    await this.dictationService.stopDictation()
  }

  dispose(): void {
    this.dictationService?.stopDictation()
  }
}

class DictationService {
  private state: DictationState
  private preview: FloatingPreview

  constructor(
    private deepgramClient: ReturnType<typeof createClient>,
    private context: vscode.ExtensionContext
  ) {
    this.state = {
      isActive: false,
      mic: null,
      wsConnection: null,
      statusBarItem: vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right)
    }
    this.state.statusBarItem.text = '$(unmute) Dictation: Off'
    this.state.statusBarItem.show()
    
    this.preview = new FloatingPreview(context)
    this.setupPreviewHandlers()
  }

  private setupPreviewHandlers() {
    // Use the new public method instead of accessing panel directly
    this.preview.onDidReceiveMessage(async message => {
      switch (message.type) {
        case 'insertRaw':
          await this.insertText(message.text)
          break
        case 'convertToCode':
          // TODO: Implement code conversion
          vscode.window.showInformationMessage('Code conversion coming soon!')
          break
        case 'executeCommand':
          // TODO: Implement command execution
          vscode.window.showInformationMessage('Command execution coming soon!')
          break
      }
    })
  }

  async startDictation(): Promise<void> {
    console.log('DictationService.startDictation called')
    if (this.state.isActive) {
      console.log('Dictation already active, stopping first...')
      await this.stopDictation()
      return
    }

    try {
      console.log('Creating microphone...')
      const mic = new Microphone()
      const audioStream = mic.startRecording()
      console.log('Microphone started')

      console.log('Creating Deepgram connection...')
      const connection = this.deepgramClient.listen.live({
        model: 'nova-2',
        smart_format: true,
        punctuate: true,
        interim_results: false,
        encoding: 'linear16',
        sample_rate: 16000
      })

      connection.on(LiveTranscriptionEvents.Open, () => {
        console.log('Deepgram connection opened')
        this.state.isActive = true
        this.state.statusBarItem.text = '$(megaphone) Dictation: On'
        vscode.window.showInformationMessage('Dictation started')
      })

      connection.on(LiveTranscriptionEvents.Close, () => {
        console.log('Deepgram connection closed')
        this.stopDictation()
      })

      connection.on(LiveTranscriptionEvents.Transcript, (data: any) => {
        const transcript = data?.channel?.alternatives?.[0]?.transcript || ''
        if (transcript) {
          this.preview.updateTranscription(transcript)
        }
      })

      audioStream.on('data', (chunk: Buffer) => {
        if (connection.isConnected()) {
          console.log('Sending audio chunk of size:', chunk.length)
          connection.send(chunk)
        }
      })

      // Store references
      this.state.mic = mic
      this.state.wsConnection = connection
      console.log('Dictation setup complete')
    } catch (error) {
      console.error('Error in startDictation:', error)
      vscode.window.showErrorMessage(
        `Failed to start dictation: ${(error as Error).message}`
      )
      await this.stopDictation()
    }
  }

  async stopDictation(): Promise<void> {
    if (this.state.mic) {
      this.state.mic.stopRecording()
      this.state.mic = null
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