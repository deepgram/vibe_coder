import * as vscode from 'vscode'
import {
  createClient,
  LiveTranscriptionEvents,
  ListenLiveClient
} from '@deepgram/sdk'
import Microphone from 'node-microphone'
import WebSocket from 'ws'
import { EventEmitter } from 'events'

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
  private client!: ReturnType<typeof createClient>
  private isInitialized = false
  private dictationService: DictationService | null = null

  constructor(private context: vscode.ExtensionContext) {
    console.log('DeepgramService constructor')
  }

  async initialize(): Promise<void> {
    console.log('DeepgramService initializing...')
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
    console.log('DeepgramService initialized successfully')
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

  onTranscript(callback: (text: string) => void) {
    console.log('Setting up transcript listener')
    if (!this.dictationService) {
      console.error('Dictation service not initialized in onTranscript')
      throw new Error('Dictation service not initialized')
    }
    return this.dictationService.onTranscript(callback)
  }
}

class DictationService {
  private state: DictationState
  private eventEmitter = new EventEmitter()

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
  }

  async startDictation(): Promise<void> {
    console.log('DictationService.startDictation called')
    if (this.state.isActive) {
      console.log('Dictation already active, stopping first...')
      await this.stopDictation()
      console.log('Previous dictation stopped')
    }

    try {
      console.log('Creating microphone...')
      const mic = new Microphone()
      console.log('Microphone instance created')
      
      const audioStream = mic.startRecording()
      console.log('Microphone recording started')

      console.log('Creating Deepgram connection...')
      const connection = this.deepgramClient.listen.live({
        model: 'nova-2',
        smart_format: true,
        punctuate: true,
        interim_results: true,
        encoding: 'linear16',
        sample_rate: 16000
      })
      console.log('Deepgram connection created')

      connection.on(LiveTranscriptionEvents.Open, () => {
        console.log('Deepgram connection opened')
        this.state.isActive = true
        this.state.statusBarItem.text = '$(megaphone) Dictation: On'
      })

      // Store references before setting up other handlers
      this.state.mic = mic
      this.state.wsConnection = connection
      console.log('References stored')

      // Add error event handlers with more detail
      connection.on(LiveTranscriptionEvents.Error, (error) => {
        console.error('Deepgram connection error:', error)
        console.error('Connection state:', {
          isConnected: connection.isConnected(),
          error: error
        })
      })

      audioStream.on('error', (error: any) => {
        console.error('Microphone stream error:', error)
        console.error('Microphone state:', {
          isActive: this.state.isActive,
          hasStream: !!audioStream,
          error: error
        })
      })

      // Add data monitoring
      audioStream.on('data', (chunk: Buffer) => {
        console.log('Audio chunk received:', {
          size: chunk.length,
          isConnected: connection.isConnected(),
          timestamp: new Date().toISOString()
        })
        if (connection.isConnected()) {
          connection.send(chunk)
        } else {
          console.log('Connection not ready, chunk dropped')
        }
      })

      // Also, we're missing the transcript handler! Add this back:
      connection.on(LiveTranscriptionEvents.Transcript, (data: any) => {
        console.log('Received transcript data:', data)
        const transcript = data?.channel?.alternatives?.[0]?.transcript || ''
        if (transcript) {
          console.log('Processing transcript:', transcript)
          this.handleTranscript(transcript)
        }
      })

      console.log('All handlers set up successfully')
    } catch (error) {
      console.error('Error in startDictation:', error)
      if (error instanceof Error) {
        console.error('Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        })
      }
      throw error
    }
  }

  async stopDictation(): Promise<void> {
    console.log('stopDictation called, current state:', {
      isActive: this.state.isActive,
      hasMic: !!this.state.mic,
      hasConnection: !!this.state.wsConnection
    })

    if (this.state.mic) {
      console.log('Stopping microphone recording...')
      this.state.mic.stopRecording()
      this.state.mic = null
      console.log('Microphone stopped and cleared')
    }

    if (this.state.wsConnection) {
      console.log('Disconnecting Deepgram...')
      this.state.wsConnection.disconnect()
      this.state.wsConnection = null
      console.log('Deepgram disconnected and cleared')
    }

    this.state.isActive = false
    this.state.statusBarItem.text = '$(unmute) Dictation: Off'
    console.log('Dictation service state reset')
  }

  async insertText(text: string): Promise<void> {
    const editor = vscode.window.activeTextEditor
    if (!editor) return

    await editor.edit((editBuilder) => {
      const position = editor.selection.active
      editBuilder.insert(position, text + ' ')
    })
  }

  handleTranscript(transcript: string) {
    this.eventEmitter.emit('transcript', transcript)
  }

  onTranscript(callback: (text: string) => void) {
    this.eventEmitter.on('transcript', callback)
    return () => this.eventEmitter.off('transcript', callback)
  }
} 