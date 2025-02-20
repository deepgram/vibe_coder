import * as vscode from 'vscode'
import WebSocket from 'ws'
import { createClient } from '@deepgram/sdk'
import { AgentPanel } from './agent-panel'
import Microphone from 'node-microphone'
import Speaker from 'speaker'
import { PromptManagementService } from './prompt-management-service'
import { env, window, workspace } from 'vscode'
import { LLMService } from './llm-service'

interface AgentConfig {
  type: 'SettingsConfiguration'
  audio: {
    input: {
      encoding: string
      sample_rate: number
    }
    output: {
      encoding: string
      sample_rate: number
      container: string
    }
  }
  agent: {
    listen: {     
      model: string
    }
    think: {
      provider: {
        type: string
      }
      model: string
      instructions: string
      functions: Array<{
        name: string
        description: string
        url: string
        method: string
        headers: Array<{
          key: string
          value: string
        }>
        parameters: {
          type: string
          properties: {
            [key: string]: {
              type: string
              description: string
            }
          }
          required: string[]
        }
      }>
    }
    speak: {
      model: string
    }
  }
}

interface AgentMessage {
  type: string
  session_id?: string
  text?: string
  is_final?: boolean
  audio?: {
    data: string
    encoding: string
    sample_rate: number
    container?: string
    bitrate?: number
  }
  message?: string
  function_call_id?: string
  function?: {
    name: string
    arguments: string
    url?: string
    method?: string
    headers?: Array<{
      key: string
      value: string
    }>
  }
}

export class VoiceAgentService {
  private agentPanel: AgentPanel
  private client!: ReturnType<typeof createClient>
  private ws: WebSocket | null = null
  private isInitialized = false
  private keepAliveInterval: NodeJS.Timeout | null = null
  private audioBuffers: Buffer[] = []
  private audioPlayer: AudioPlayer | null = null
  private readonly AGENT_SAMPLE_RATE = 24000  // Agent's output sample rate
  private promptManager: PromptManagementService
  private llmService: LLMService

  constructor(private context: vscode.ExtensionContext) {
    this.agentPanel = new AgentPanel(context)
    this.promptManager = new PromptManagementService(context)
    this.llmService = new LLMService(context)
  }

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
    this.isInitialized = true
  }

  async startAgent(): Promise<void> {
    if (!this.isInitialized) 
      throw new Error('Voice Agent not initialized')

    try {
      this.agentPanel.setListening(true)
      this.agentPanel.updateStatus('Connecting to agent...')

      const apiKey = await this.context.secrets.get('deepgram.apiKey')
      if (!apiKey) throw new Error('Deepgram API key is required')

      this.ws = new WebSocket('wss://agent.deepgram.com/agent', 
        ['token'],
        {
          headers: {
            'Authorization': `Token ${apiKey}`
          }
        }
      )

      this.ws.on('open', () => {
        console.log('WebSocket connection opened')
      })

      this.ws.on('message', async (data: WebSocket.Data) => {
        // First try to parse as JSON
        try {
          const message = JSON.parse(data.toString()) as AgentMessage
          console.log('Parsed message:', JSON.stringify(message, null, 2))
          
          switch (message.type) {
            case 'Welcome':
              console.log('Received Welcome, sending configuration...')
              const config = this.getAgentConfig()
              console.log('Sending configuration:', JSON.stringify(config, null, 2))
              this.ws?.send(JSON.stringify(config))
              this.setupMicrophone()
              this.agentPanel.updateStatus('Connected! Start speaking...')
              break
            case 'Ready':
              console.log('Agent ready to receive audio')
              this.agentPanel.updateStatus('Ready! Start speaking...')
              break
            case 'Speech':
              this.agentPanel.updateTranscript(message.text || '')
              break
            case 'AgentResponse':
              this.agentPanel.updateTranscript(message.text || '')
              if (message.audio) {
                this.playAudioResponse(message.audio)
              }
              break
            case 'FunctionCall':
              console.log('Function call requested:', message.function)
              if (!message.function || !message.function_call_id) {
                console.error('Invalid function call message')
                break
              }
              try {
                const result = await this.handleFunctionCall(
                  message.function_call_id, 
                  message.function
                )
                // Send the response back to the agent
                const response = {
                  type: 'FunctionCallResponse',
                  function_call_id: message.function_call_id,
                  response: JSON.stringify(result)
                }
                this.ws?.send(JSON.stringify(response))
              } catch (error) {
                console.error('Function call failed:', error)
                // Send error response to agent
                const errorResponse = {
                  type: 'FunctionCallResponse',
                  function_call_id: message.function_call_id,
                  error: (error as Error).message
                }
                this.ws?.send(JSON.stringify(errorResponse))
              }
              break
            case 'Error':
              console.error('Agent error:', message)
              vscode.window.showErrorMessage(`Agent error: ${message.message}`)
              this.agentPanel.updateStatus('Error occurred')
              break
            case 'Close':
              console.log('Agent requested close')
              this.cleanup()
              break
            default:
              console.log('Unknown message type:', message.type)
          }
        } catch (e) {
          // If it's not JSON, it's raw audio data
          if (data instanceof Buffer) {
            this.handleRawAudio(data)
          }
        }
      })

      this.ws.on('error', (error: Error) => {
        console.error('WebSocket error:', error)
        vscode.window.showErrorMessage(`WebSocket error: ${error.message}`)
        this.cleanup()
      })

      this.ws.on('close', () => {
        this.cleanup()
      })

      // Setup keep-alive after successful connection
      this.setupKeepAlive()

      // Initialize audio player with correct sample rate
      this.audioPlayer = new AudioPlayer(this.AGENT_SAMPLE_RATE)  // Match agent's rate

    } catch (error) {
      this.cleanup()
      vscode.window.showErrorMessage(
        `Failed to start agent: ${(error as Error).message}`
      )
    }
  }

  private setupMicrophone() {
    const mic = new Microphone()
    const audioStream = mic.startRecording()

    audioStream.on('data', (chunk: Buffer) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(chunk)
      }
    })

    audioStream.on('error', (error: Error) => {
      vscode.window.showErrorMessage(`Microphone error: ${error.message}`)
      this.cleanup()
    })
  }

  private async playAudioResponse(audio: { data: string, encoding: string, sample_rate: number }) {
    this.agentPanel.playAudio(audio)
  }

  private setupKeepAlive() {
    // Send keep-alive message every 30 seconds
    this.keepAliveInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'KeepAlive' }))
      }
    }, 30000)
  }

  private cleanup() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval)
      this.keepAliveInterval = null
    }
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.agentPanel.setListening(false)
    this.agentPanel.updateStatus('Disconnected')
    if (this.audioPlayer) {
      this.audioPlayer.stop()
      this.audioPlayer = null
    }
  }

  async updateInstructions(instructions: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Agent not connected')
    }

    const updateMessage = {
      type: 'UpdateInstructions',
      instructions
    }

    this.ws.send(JSON.stringify(updateMessage))
  }

  async updateSpeakModel(model: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Agent not connected')
    }

    const updateMessage = {
      type: 'UpdateSpeak',
      model
    }

    this.ws.send(JSON.stringify(updateMessage))
  }

  async injectAgentMessage(message: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Agent not connected')
    }

    const injectMessage = {
      type: 'InjectAgentMessage',
      message
    }

    this.ws.send(JSON.stringify(injectMessage))
  }

  async handleFunctionCall(functionCallId: string, func: any) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Agent not connected')
    }

    if (func.name === 'process_dictation') {
      const args = JSON.parse(func.arguments)
      const prompt = args.promptId 
        ? this.promptManager.getPromptById(args.promptId)
        : this.promptManager.getPromptById('default-code')

      if (!prompt) throw new Error('Prompt not found')

      const result = await this.llmService.processText({ 
        text: args.text,
        prompt 
      })
      
      if (result.error) {
        window.showWarningMessage(result.error)
        await env.clipboard.writeText(args.text)
        return { success: false, error: result.error }
      }

      await env.clipboard.writeText(result.text)
      return { success: true, text: result.text }
    }

    throw new Error(`Unknown function: ${func.name}`)
  }

  private handleRawAudio(data: Buffer) {
    console.log('Received raw audio data, length:', data.length, 
      'sample rate:', this.AGENT_SAMPLE_RATE)
    this.audioPlayer?.play(data)
  }

  private getAgentConfig(): AgentConfig {
    return {
      type: 'SettingsConfiguration',
      audio: {
        input: {
          encoding: 'linear16',
          sample_rate: 16000
        },
        output: {
          encoding: 'linear16',
          sample_rate: 24000,
          container: 'none'
        }
      },
      agent: {
        listen: {
          model: 'nova-2'
        },
        think: {
          provider: {
            type: 'open_ai'
          },
          model: 'gpt-4o-mini',
          instructions: 'You are a coding assistant. Help users write, modify, and understand code. When you detect that the user is dictating content (rather than asking a question or giving a command), use the process_dictation function.',
          functions: [{
            name: 'process_dictation',
            description: 'Process user speech as formatted text using context-aware prompts. Use this when the user is dictating content that needs to be formatted.',
            url: 'local://process_dictation',
            method: 'post',
            headers: [],
            parameters: {
              type: 'object',
              properties: {
                text: {
                  type: 'string',
                  description: 'The text to process from user speech'
                },
                promptId: {
                  type: 'string',
                  description: 'Optional ID of the prompt to use for formatting'
                }
              },
              required: ['text']
            }
          }]
        },
        speak: {
          model: 'aura-asteria-en'
        }
      }
    }
  }

  dispose(): void {
    this.cleanup()
    this.agentPanel.dispose()
  }
}

// Add AudioPlayer class
class AudioPlayer {
  private speaker: SpeakerWrapper
  private bufferedAudio: Buffer[] = []
  private targetSpeakerAudioMs = 400
  private refillInterval: NodeJS.Timeout

  constructor(sampleRate: number) {
    console.log('Initializing speaker with sample rate:', sampleRate)
    this.speaker = new SpeakerWrapper(sampleRate)
    this.refillInterval = setInterval(() => this.refillSpeaker(), 200)
  }

  play(audio: Buffer) {
    this.bufferedAudio.push(audio)
    this.refillSpeaker()
  }

  stop() {
    clearInterval(this.refillInterval)
    this.bufferedAudio = []
  }

  private refillSpeaker() {
    while (this.bufferedAudio.length && 
           this.speaker.getBufferedMs() < this.targetSpeakerAudioMs) {
      this.speaker.write(this.bufferedAudio.shift()!)
    }
  }
}

class SpeakerWrapper {
  private speaker: Speaker
  private msPerSample: number
  private lastWriteTime: number
  private bufferedMsAtLastWrite: number

  constructor(sampleRate: number) {
    this.speaker = new Speaker({ 
      channels: 1,       // Mono
      bitDepth: 16,      // 16-bit PCM
      sampleRate,        // Match agent's rate (24kHz)
    })
    this.msPerSample = 1000 / sampleRate
    this.lastWriteTime = Date.now()
    this.bufferedMsAtLastWrite = 0
  }

  write(audio: Buffer) {
    this.bufferedMsAtLastWrite = this.getBufferedMs() + 
      this.getAudioDurationMs(audio)
    this.lastWriteTime = Date.now()
    this.speaker.write(audio)
  }

  getBufferedMs(): number {
    const msSinceLastWrite = Date.now() - this.lastWriteTime
    return Math.max(this.bufferedMsAtLastWrite - msSinceLastWrite, 0)
  }

  private getAudioDurationMs(audio: Buffer): number {
    const numSamples = audio.length / 2  // 16-bit = 2 bytes per sample
    return this.msPerSample * numSamples
  }
} 