import * as vscode from 'vscode'
import {
  createClient,
  LiveTranscriptionEvents,
  ListenLiveClient
} from '@deepgram/sdk'
import Microphone from 'node-microphone'
import WebSocket from 'ws'
import { EventEmitter } from 'events'
import { DictationService } from './dictation-service'

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

  /**
   * Provide a callback that receives (text, isFinal).
   */
  onTranscript(callback: (text: string, isFinal: boolean) => void) {
    console.log('Setting up transcript listener')
    if (!this.dictationService) {
      console.error('Dictation service not initialized in onTranscript')
      throw new Error('Dictation service not initialized')
    }
    return this.dictationService.onTranscript(callback)
  }
} 