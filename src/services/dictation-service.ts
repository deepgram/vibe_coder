import * as vscode from 'vscode'
import { Deepgram } from '@deepgram/sdk'
import MicrophoneStream from 'microphone-stream'
import WebSocket from 'ws'

interface DictationState {
  isActive: boolean
  micStream: MicrophoneStream | null
  wsConnection: WebSocket | null
  statusBarItem: vscode.StatusBarItem
}

// Add types for the Deepgram response
interface DeepgramTranscription {
  channel?: {
    alternatives?: Array<{
      transcript?: string
    }>
  }
}

// Add types for microphone options
interface MicrophoneOptions {
  sampleRate: number
  channels: number
  verbose: boolean
}

export class DictationService {
  private state: DictationState = {
    isActive: false,
    micStream: null,
    wsConnection: null,
    statusBarItem: vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100)
  }

  constructor(private deepgramClient: Deepgram) {
    this.state.statusBarItem.text = '$(unmute) Dictation: Off'
    this.state.statusBarItem.command = 'vibe-coder.startDictation'
    this.state.statusBarItem.show()
  }

  async startDictation(): Promise<void> {
    if (this.state.isActive) {
      await this.stopDictation()
      return
    }

    try {
      // Create and cast the stream to any to bypass type checking
      // This is necessary because the types are incomplete
      const stream = new MicrophoneStream() as any
      await stream.start({
        sampleRate: 16000,
        channels: 1,
        verbose: false
      } as MicrophoneOptions)

      // Cast deepgramClient.listen to any to bypass type checking
      const connection = await (this.deepgramClient as any).listen.live({
        language: 'en-US',
        smart_format: true,
        punctuate: true,
        interim_results: false
      })

      connection.on('open', () => {
        this.state.isActive = true
        this.state.statusBarItem.text = '$(megaphone) Dictation: On'
        vscode.window.showInformationMessage('Dictation started')
      })

      connection.on('close', () => {
        this.stopDictation()
      })

      connection.on('transcription', (data: DeepgramTranscription) => {
        const transcript = data?.channel?.alternatives?.[0]?.transcript || ''
        if (transcript) {
          this.insertText(transcript)
        }
      })

      connection.on('error', (error: Error) => {
        vscode.window.showErrorMessage(`Dictation error: ${error.message}`)
        this.stopDictation()
      })

      stream.on('data', (chunk: Buffer) => {
        if (connection.getReadyState() === WebSocket.OPEN) {
          connection.send(chunk)
        }
      })

      this.state.micStream = stream
      this.state.wsConnection = connection
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to start dictation: ${(error as Error).message}`)
      await this.stopDictation()
    }
  }

  private async insertText(text: string): Promise<void> {
    const editor = vscode.window.activeTextEditor
    if (!editor) return

    await editor.edit((editBuilder) => {
      const position = editor.selection.active
      editBuilder.insert(position, text + ' ')
    })
  }

  async stopDictation(): Promise<void> {
    if (this.state.micStream) {
      this.state.micStream.stop()
      this.state.micStream = null
    }

    if (this.state.wsConnection) {
      this.state.wsConnection.close()
      this.state.wsConnection = null
    }

    this.state.isActive = false
    this.state.statusBarItem.text = '$(unmute) Dictation: Off'
    vscode.window.showInformationMessage('Dictation stopped')
  }

  dispose(): void {
    this.stopDictation()
    this.state.statusBarItem.dispose()
  }
} 