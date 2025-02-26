import * as vscode from 'vscode'
import { EventEmitter } from 'events'
import { createClient, LiveTranscriptionEvents, ListenLiveClient } from '@deepgram/sdk'
import { MicrophoneWrapper } from '../utils/native-module-wrapper'

interface DictationState {
  isActive: boolean
  mic: MicrophoneWrapper | null
  wsConnection: ListenLiveClient | null
  statusBarItem: vscode.StatusBarItem
}

export class DictationService {
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
      console.log('Creating microphone wrapper...')
      const mic = new MicrophoneWrapper()
      console.log('Microphone wrapper instance created')
      
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
        
        // Show error message to user if it's a command not found error
        if (error.message?.includes('command') && error.message?.includes('not')) {
          vscode.window.showErrorMessage(error.message)
        }
      })

      audioStream.on('data', (chunk: Buffer) => {
        if (connection.isConnected()) {
          connection.send(chunk)
        } else {
          console.log('Connection not ready, chunk dropped')
        }
      })

      // Handle transcripts with isFinal flag
      connection.on(LiveTranscriptionEvents.Transcript, (data: any) => {
        const transcript = data?.channel?.alternatives?.[0]?.transcript || ''
        const isFinal = data?.is_final || false
        
        if (transcript) {
          console.log('Processing transcript:', transcript, 'isFinal:', isFinal)
          this.eventEmitter.emit('transcript', transcript, isFinal)
        }
      })

      console.log('All handlers set up successfully')
    } catch (error) {
      console.error('Error in startDictation:', error)
      // Show error message to user
      if (error instanceof Error) {
        vscode.window.showErrorMessage(`Failed to start dictation: ${error.message}`)
      }
      throw error
    }
  }

  async stopDictation(): Promise<void> {
    console.log('stopDictation called')

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
  }

  onTranscript(callback: (text: string, isFinal: boolean) => void) {
    this.eventEmitter.on('transcript', callback)
    return () => this.eventEmitter.off('transcript', callback)
  }

  /**
   * Update the Deepgram client instance
   */
  updateClient(client: ReturnType<typeof createClient>): void {
    this.deepgramClient = client
  }
} 