import * as vscode from 'vscode'
import WebSocket from 'ws'
import { createClient } from '@deepgram/sdk'
// import { AgentPanel } from './agent-panel'
import Microphone from 'node-microphone'
import Speaker from 'speaker'
import { PromptManagementService } from './prompt-management-service'
import { env, window, workspace } from 'vscode'
import { LLMService } from './llm-service'
import { EventEmitter } from 'events'
import { CommandRegistryService } from './command-registry-service'
import { WorkspaceService } from './workspace-service'

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
        parameters: {
          type: 'object'
          properties: {
            name: {
              type: string
              description: string
            }
            args: {
              type: 'array'
              description: string
              items: {
                type: string
              }
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
  type: 
    | 'Welcome' 
    | 'Ready'
    | 'Speech'
    | 'AgentResponse'
    | 'FunctionCallRequest'
    | 'FunctionCalling'
    | 'ConversationText'
    | 'UserStartedSpeaking'
    | 'AgentStartedSpeaking'
    | 'AgentAudioDone'
    | 'Error'
    | 'Close'
  session_id?: string
  text?: string
  is_final?: boolean
  role?: 'assistant' | 'user'
  content?: string
  audio?: {
    data: string
    encoding: string
    sample_rate: number
    container?: string
    bitrate?: number
  }
  message?: string
  function_name?: string
  function_call_id?: string
  input?: any
  tts_latency?: number
  ttt_latency?: number
  total_latency?: number
}

export interface MessageHandler {
  postMessage(message: unknown): Thenable<boolean>
}

export class VoiceAgentService {
  private ws: WebSocket | null = null
  private isInitialized = false
  private keepAliveInterval: NodeJS.Timeout | null = null
  private audioBuffers: Buffer[] = []
  private audioPlayer: AudioPlayer | null = null
  private readonly AGENT_SAMPLE_RATE = 24000
  private promptManager: PromptManagementService
  private llmService: LLMService
  private eventEmitter = new EventEmitter()
  private commandRegistry: CommandRegistryService
  private workspaceService: WorkspaceService
  private agentPanel: MessageHandler | undefined = undefined

  constructor(
    private context: vscode.ExtensionContext,
    private updateStatus: (status: string) => void,
    private updateTranscript: (text: string) => void,
    agentPanel?: MessageHandler
  ) {
    this.promptManager = new PromptManagementService(context)
    this.llmService = new LLMService(context)
    this.commandRegistry = new CommandRegistryService()
    this.workspaceService = new WorkspaceService()
    this.agentPanel = agentPanel
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

    this.isInitialized = true
  }

  async startAgent(): Promise<void> {
    if (!this.isInitialized) 
      throw new Error('Voice Agent not initialized')

    try {
      this.updateStatus('Connecting to agent...')

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
              const config = await this.getAgentConfig()
              console.log('Sending configuration:', JSON.stringify(config, null, 2))
              this.ws?.send(JSON.stringify(config))
              this.setupMicrophone()
              this.updateStatus('Connected! Start speaking...')
              break
            case 'Ready':
              console.log('Agent ready to receive audio')
              this.updateStatus('Ready! Start speaking...')
              break
            case 'Speech':
              this.updateTranscript(message.text || '')
              break
            case 'AgentResponse':
              this.updateTranscript(message.text || '')
              if (message.audio) {
                this.playAudioResponse(message.audio)
              }
              break
            case 'FunctionCallRequest':
              console.log('Function call requested:', message)
              if (!message.function_name || !message.function_call_id) {
                console.error('Invalid function call message')
                break
              }
              try {
                const result = await this.handleFunctionCall(
                  message.function_call_id,
                  {
                    name: message.function_name,
                    arguments: JSON.stringify(message.input)
                  }
                )
                const response = {
                  type: 'FunctionCallResponse',
                  function_call_id: message.function_call_id,
                  output: JSON.stringify(result)
                }
                this.ws?.send(JSON.stringify(response))
              } catch (error) {
                console.error('Function call failed:', error)
                const errorResponse = {
                  type: 'FunctionCallResponse',
                  function_call_id: message.function_call_id,
                  error: (error as Error).message
                }
                this.ws?.send(JSON.stringify(errorResponse))
              }
              break
            case 'FunctionCalling':
              // Debug message from server about function calling workflow
              console.log('Function calling debug:', message)
              break
            case 'ConversationText':
              if (message.role === 'assistant') {
                this.agentPanel?.postMessage({
                  type: 'updateTranscript',
                  text: message.content || '',
                  target: 'agent-transcript',
                  animate: true
                })
              }
              this.eventEmitter.emit('transcript', message.content || '')
              break
            case 'UserStartedSpeaking':
              console.log('User started speaking, stopping audio playback')
              this.audioPlayer?.stop()
              this.sendSpeakingStateUpdate('idle')
              break
            case 'AgentStartedSpeaking':
              console.log('Agent started speaking')
              this.sendSpeakingStateUpdate('speaking')
              break
            case 'AgentAudioDone':
              console.log('Agent audio done')
              this.sendSpeakingStateUpdate('idle')
              break
            case 'Error':
              console.error('Agent error:', message)
              vscode.window.showErrorMessage(`Agent error: ${message.message}`)
              this.updateStatus('Error occurred')
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
      throw error
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
    this.updateTranscript(audio.data)
  }

  private setupKeepAlive() {
    // Send keep-alive message every 30 seconds
    this.keepAliveInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'KeepAlive' }))
      }
    }, 30000)
  }

  public cleanup(): void {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval)
      this.keepAliveInterval = null
    }
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.updateStatus('Disconnected')
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

    if (func.name === 'execute_command') {
      const args = JSON.parse(func.arguments)
      try {
        await this.commandRegistry.executeCommand(args.name, args.args)
        return { success: true }
      } catch (error) {
        console.error('Command execution failed:', error)
        return { 
          success: false, 
          error: (error as Error).message 
        }
      }
    }

    if (func.name === 'process_dictation') {
      const args = JSON.parse(func.arguments)
      let prompt
      
      try {
        // First try to get the specified prompt
        if (args.promptId) {
          prompt = this.promptManager.getPromptById(args.promptId)
        }
        
        // If no promptId specified or prompt not found, use default
        if (!prompt) {
          prompt = {
            id: 'default',
            name: 'Default',
            prompt: `You are providing prompts to Cursor, an AI-powered coding assistant.

You are given a natural language description of what the user wants to do.

You need to take that description and provide a detailed prompt that will help Cursor understand the user's intent and write the code to accomplish the task. 

You should anticipate that Cursor may hallucinate, so you should provide a detailed prompt that breaks the users request into smaller, more manageable steps.`
          }
        }

        const result = await this.llmService.processText({ 
          text: args.text,
          prompt 
        })
        
        if (result.error) {
          window.showErrorMessage(result.error)
          await env.clipboard.writeText(args.text)
          this.updateTranscript(`Error: ${result.error}\nFalling back to original text:\n${args.text}`)
          return { success: false, error: result.error }
        }

        await env.clipboard.writeText(result.text)
        this.updateTranscript(result.text)
        return { success: true, text: result.text }
      } catch (error) {
        console.error('Error processing dictation:', error)
        return { 
          success: false, 
          error: `Failed to process dictation: ${(error as Error).message}` 
        }
      }
    }

    throw new Error(`Unknown function: ${func.name}`)
  }

  private handleRawAudio(data: Buffer) {
    console.log('Received raw audio data, length:', data.length, 
      'sample rate:', this.AGENT_SAMPLE_RATE)
    
    // Initialize audio player if needed
    if (!this.audioPlayer) {
      this.audioPlayer = new AudioPlayer(this.AGENT_SAMPLE_RATE)
      this.audioPlayer.onPlaybackStarted(() => {
        this.sendSpeakingStateUpdate('speaking')
      })
      this.audioPlayer.onPlaybackStopped(() => {
        this.sendSpeakingStateUpdate('idle')
      })
    }
    
    this.audioPlayer.play(data)
  }

  private async getAgentConfig(): Promise<AgentConfig> {
    const commands = this.commandRegistry.getCommandDefinitions()
    const fileTree = await this.workspaceService.getFileTree()
    const formattedTree = this.workspaceService.formatFileTree(fileTree)
    
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
          instructions: `You are a coding mentor and VS Code assistant. You help users navigate and control VS Code through voice commands.
          
          Current Workspace Structure:
          ${formattedTree}

          When a user requests an action that matches a VS Code command, use the execute_command function.
          You can help users navigate the file structure and open files using the paths shown above.
          Provide helpful feedback about what you're doing and guide users if they need help.`,
          functions: [
            {
              name: 'execute_command',
              description: 'Execute a VS Code command',
              parameters: {
                type: 'object',
                properties: {
                  name: {
                    type: 'string',
                    description: 'Name of the command to execute'
                  },
                  args: {
                    type: 'array',
                    description: 'Optional arguments for the command',
                    items: {
                      type: 'string'
                    }
                  }
                },
                required: ['name']
              }
            }
          ]
        },
        speak: {
          model: 'aura-asteria-en'
        }
      }
    }
  }

  dispose(): void {
    this.cleanup()
  }

  onTranscript(callback: (text: string) => void) {
    this.eventEmitter.on('transcript', callback)
    return () => this.eventEmitter.off('transcript', callback)
  }

  private sendSpeakingStateUpdate(state: 'speaking' | 'idle') {
    console.log('Sending speaking state update:', state)
    if (!this.agentPanel) {
      console.warn('No agent panel available for state update')
      return
    }
    
    // Send status text instead of animation state
    this.agentPanel.postMessage({
      type: 'updateStatus',
      text: state === 'speaking' ? 'Agent Speaking...' : 'Ready',
      target: 'vibe-status'
    })
  }

  public setAgentPanel(handler: MessageHandler | undefined) {
    this.agentPanel = handler
  }
}

// Add AudioPlayer class
class AudioPlayer {
  private speaker: SpeakerWrapper
  private bufferedAudio: Buffer[] = []
  private targetSpeakerAudioMs = 400
  private eventEmitter = new EventEmitter()

  constructor(sampleRate: number) {
    console.log('Initializing speaker with sample rate:', sampleRate)
    this.speaker = new SpeakerWrapper(sampleRate)
    setInterval(() => this.checkAndRefillSpeaker(), 200)
  }

  play(audio: Buffer) {
    const wasEmpty = this.bufferedAudio.length === 0
    this.bufferedAudio.push(audio)
    if (wasEmpty) {
      this.eventEmitter.emit('playbackStarted')
    }
    this.checkAndRefillSpeaker()
  }

  stop() {
    this.bufferedAudio = []
    this.eventEmitter.emit('playbackStopped')
  }

  onPlaybackStarted(callback: () => void) {
    this.eventEmitter.on('playbackStarted', callback)
  }

  onPlaybackStopped(callback: () => void) {
    this.eventEmitter.on('playbackStopped', callback)
  }

  private checkAndRefillSpeaker() {
    const wasPlaying = this.bufferedAudio.length > 0
    this.refillSpeaker()
    // If we just ran out of audio, emit stopped event
    if (wasPlaying && this.bufferedAudio.length === 0) {
      this.eventEmitter.emit('playbackStopped')
    }
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