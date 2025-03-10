import * as vscode from 'vscode'
import WebSocket from 'ws'
import { createClient } from '@deepgram/sdk'
// import { AgentPanel } from './agent-panel'
// Remove these direct imports
// import Microphone from 'node-microphone'
// import Speaker from 'speaker'
// Import our wrappers instead
import { MicrophoneWrapper } from '../utils/native-module-wrapper'
import { PromptManagementService } from './prompt-management-service'
import { env, window, workspace } from 'vscode'
import { LLMService } from './llm-service'
import { EventEmitter } from 'events'
import { CommandRegistryService } from './command-registry-service'
import { WorkspaceService } from './workspace-service'
import { ConversationLoggerService } from './conversation-logger-service'
import { SpecGeneratorService } from './spec-generator-service'
import { checkNativeModulesCompatibility } from '../utils/binary-loader'

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
            name?: {
              type: string
              description: string
            }
            args?: {
              type: 'array'
              description: string
              items: {
                type: string
              }
            }
            format?: {
              type: string
              enum?: string[]
              description: string
            }
          }
          required: string[]
        }
      }>
    }
    speak: {
      model: string
      temp?: number
      rep_penalty?: number
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
    | 'SettingsApplied'
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
  private readonly AGENT_SAMPLE_RATE = 24000
  private promptManager: PromptManagementService
  private llmService: LLMService
  private eventEmitter = new EventEmitter()
  private commandRegistry: CommandRegistryService
  private workspaceService: WorkspaceService
  private agentPanel: MessageHandler | undefined = undefined
  private conversationLogger: ConversationLoggerService
  private specGenerator: SpecGeneratorService
  private context: vscode.ExtensionContext
  private updateStatus: (status: string) => void
  private updateTranscript: (text: string) => void

  constructor({
    context,
    updateStatus,
    updateTranscript,
    conversationLogger
  }: {
    context: vscode.ExtensionContext
    updateStatus: (status: string) => void
    updateTranscript: (text: string) => void
    conversationLogger: ConversationLoggerService
  }) {
    this.context = context
    this.updateStatus = updateStatus
    this.updateTranscript = updateTranscript
    this.conversationLogger = conversationLogger

    // Assign llmService first
    this.llmService = new LLMService(context)

    // Then create specGenerator
    this.specGenerator = new SpecGeneratorService(this.llmService, this.conversationLogger)

    this.promptManager = new PromptManagementService(context)
    this.commandRegistry = new CommandRegistryService()
    this.workspaceService = new WorkspaceService()

    // Comment out or remove agentPanel if unused
    // this.agentPanel = agentPanel

    // Use the public method to register the command
    this.commandRegistry.registerCommand({
      name: 'generateProjectSpec',
      command: 'vibe-coder.generateProjectSpec',
      category: 'workspace',
      description: 'Generate a structured project specification from our conversation',
      parameters: {
        type: 'object',
        properties: {
          format: {
            type: 'string',
            enum: ['markdown'],
            description: 'Output format (currently only supports markdown)'
          }
        },
        required: ['format']
      }
    })
  }

  async initialize(): Promise<void> {
    // Check if native modules are available for this platform
    const compatibility = checkNativeModulesCompatibility()
    if (!compatibility.compatible) {
      vscode.window.showWarningMessage(compatibility.message)
      console.warn('Native module compatibility check failed:', compatibility)
    }

    // Check for API key but don't require it for initialization
    const apiKey = await this.context.secrets.get('deepgram.apiKey')
    // We'll mark as initialized even without an API key
    this.isInitialized = true
  }

  async startAgent(): Promise<void> {
    if (!this.isInitialized) 
      throw new Error('Voice Agent not initialized')

    // Ensure cleanup of any existing connection first
    this.cleanup()

    try {
      this.updateStatus('Connecting to agent...')

      const apiKey = await this.context.secrets.get('deepgram.apiKey')
      if (!apiKey) {
        const key = await vscode.window.showInputBox({
          prompt: 'Enter your Deepgram API key',
          password: true,
          placeHolder: 'Deepgram API key is required for voice agent',
          ignoreFocusOut: true
        })
        if (!key) {
          this.updateStatus('API key required')
          vscode.window.showErrorMessage('Deepgram API key is required for voice agent')
          throw new Error('Deepgram API key is required')
        }
        await this.context.secrets.store('deepgram.apiKey', key)
      }

      this.ws = new WebSocket('wss://agent.deepgram.com/agent', 
        ['token'],
        {
          headers: {
            'Authorization': `Token ${apiKey || ''}`
          }
        }
      )

      // Wait for connection to be established
      await new Promise<void>((resolve, reject) => {
        if (!this.ws) return reject(new Error('WebSocket not initialized'))
        
        this.ws.on('open', () => {
          console.log('WebSocket connection opened')
          resolve()
        })
        
        this.ws.on('error', (error) => {
          console.error('WebSocket connection error:', error)
          reject(error)
        })
      })

      // Set up message handler after connection is established
      this.ws.on('message', async (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString()) as AgentMessage
          console.log('WebSocket received message:', message)

          switch (message.type) {
            case 'Welcome':
              console.log('Received Welcome, sending configuration...')
              const config = await this.getAgentConfig()
              console.log('Sending configuration:', JSON.stringify(config, null, 2))
              this.ws?.send(JSON.stringify(config))
              this.updateStatus('Configuring agent...')
              break

            case 'SettingsApplied':
              console.log('Settings applied, setting up microphone...')
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
              console.log('Agent response received:', message)
              if (message.text) {
                console.log('Logging agent response from WebSocket')
                this.conversationLogger.logEntry({
                  role: 'assistant',
                  content: message.text
                })
              }
              this.updateTranscript(message.text || '')
              if (message.audio) {
                this.playAudioResponse(message.audio)
              }
              break
            case 'FunctionCallRequest':
              console.log('Function call requested:', message)
              try {
                const result = await this.handleFunctionCall(
                  message.function_call_id!,
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
                console.log('Sending function call response:', response)
                this.ws?.send(JSON.stringify(response))
              } catch (error) {
                console.error('Function call failed:', error)
                const errorResponse = {
                  type: 'FunctionCallResponse',
                  function_call_id: message.function_call_id,
                  output: JSON.stringify({
                    success: false,
                    error: (error as Error).message
                  })
                }
                this.ws?.send(JSON.stringify(errorResponse))
              }
              break
            case 'FunctionCalling':
              // Debug message from server about function calling workflow
              console.log('Function calling debug:', message)
              break
            case 'ConversationText':
              console.log('Conversation text received:', message)
              if (message.role && message.content) {
                console.log('Logging conversation entry from WebSocket')
                this.conversationLogger.logEntry({
                  role: message.role,
                  content: message.content
                })
              }
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
              
              // Send a message to the webview to stop all audio playback
              if (this.agentPanel) {
                this.agentPanel.postMessage({
                  type: 'stopAudio'
                });
              }
              
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
          console.error('Error handling WebSocket message:', e)
          // If it's not JSON, it's raw audio data
          if (data instanceof Buffer) {
            this.handleRawAudio(data)
          }
        }
      })

      // Set up keep-alive interval
      this.keepAliveInterval = setInterval(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.ping()
        }
      }, 30000)

    } catch (error) {
      console.error('Failed to start agent:', error)
      this.cleanup() // Cleanup on error
      throw error
    }
  }

  private setupMicrophone() {
    // Use our wrapper instead of direct microphone
    const mic = new MicrophoneWrapper()
    try {
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
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to start microphone: ${error instanceof Error ? error.message : String(error)}`)
      this.cleanup()
    }
  }

  private async playAudioResponse(audio: { data: string, encoding: string, sample_rate: number }) {
    // Instead of playing audio through the native speaker, send it to the webview
    if (!this.agentPanel) {
      console.warn('No agent panel available for audio playback')
      return
    }

    console.log('Sending audio data to webview for playback')
    
    // Send the audio data to the webview
    this.agentPanel.postMessage({
      type: 'playAudio',
      audio: {
        data: audio.data,
        encoding: audio.encoding,
        sampleRate: audio.sample_rate
      }
    })
    
    // Also update the transcript if available
    this.updateTranscript(audio.data)
  }

  public cleanup(): void {
    console.log('Cleaning up voice agent...')
    
    // Close WebSocket connection
    if (this.ws) {
      console.log('Closing WebSocket connection...')
      this.ws.removeAllListeners() // Remove all event listeners
      this.ws.close()
      this.ws = null
    }

    // Clear keep-alive interval
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval)
      this.keepAliveInterval = null
    }

    // Update UI status
    this.updateStatus('Disconnected')
    
    console.log('Voice agent cleanup complete')
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

    console.log('Injecting agent message:', message)
    
    const injectMessage = {
      type: 'InjectAgentMessage',
      message
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(injectMessage))
    } else {
      console.warn('VoiceAgentService: Cannot send message - WebSocket is not open')
    }
  }

  async handleFunctionCall(functionCallId: string, func: any) {
    console.log('Handling function call:', { functionCallId, func })

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Agent not connected')
    }

    // Inject a message to let the user know we're working on their request
    try {
      await this.injectAgentMessage("Let me work on that, standby.")
      console.log('Injected standby message')
    } catch (error) {
      console.warn('Could not inject standby message:', error)
      // Continue with function execution even if message injection fails
    }

    if (func.name === 'generateProjectSpec') {
      console.log('Generating project spec...')
      try {
        await this.specGenerator.generateSpec()
        const successMessage = 'Project specification has been generated and saved to project_spec.md'
        this.updateTranscript(successMessage)
        this.conversationLogger.logEntry({
          role: 'assistant',
          content: successMessage
        })
        return { 
          success: true,
          message: successMessage
        }
      } catch (error) {
        console.error('Failed to generate project spec:', error)
        const errorMessage = `Failed to generate project specification: ${(error as Error).message}`
        this.updateTranscript(errorMessage)
        this.conversationLogger.logEntry({
          role: 'assistant',
          content: errorMessage
        })
        return { 
          success: false, 
          error: errorMessage
        }
      }
    }

    if (func.name === 'execute_command') {
      console.log('Handling execute_command function call:', func)
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

    console.error('Unknown function:', func.name)
    return { 
      success: false, 
      error: `Unknown function: ${func.name}` 
    }
  }

  private handleRawAudio(data: Buffer) {
    console.log('Received raw audio data, length:', data.length, 
      'sample rate:', this.AGENT_SAMPLE_RATE)
    
    // Instead of using the native speaker, send the raw audio data to the webview
    if (!this.agentPanel) {
      console.warn('No agent panel available for audio playback')
      return
    }
    
    // Convert the raw PCM buffer to base64 for sending to the webview
    const base64Audio = data.toString('base64')
    
    // Send the audio data to the webview with explicit sample rate info
    this.agentPanel.postMessage({
      type: 'playAudio',
      audio: {
        data: base64Audio,
        encoding: 'linear16',
        sampleRate: this.AGENT_SAMPLE_RATE,
        isRaw: true
      }
    })
    
    // Update speaking state
    this.sendSpeakingStateUpdate('speaking')
    
    // Set a timeout to update the speaking state back to idle
    // This is a simple approach; a more sophisticated approach would track when playback ends
    setTimeout(() => {
      this.sendSpeakingStateUpdate('idle')
    }, 1000) // Adjust timeout based on typical audio length
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
          instructions: `You are a coding mentor and VS Code assistant. You help users navigate and control VS Code through voice commands. You also help users think through their product and application. You ask questions, one at a time, using the socratic method to help the user think critically, unless the user explicitly asks you for suggestions or ideas.

          Everything you say will be spoken out load through a TTS system, so do not use markdown or other formatting, and keep your responses concise.
          
          Current Workspace Structure:
          ${formattedTree}

          When a user requests an action that matches a VS Code command, use the execute_command function.
          You can help users navigate the file structure and open files using the paths shown above.
          You can also generate project specifications from our conversation using the generateProjectSpec function.
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
                    description: 'Arguments for the command',
                    items: {
                      type: 'string'
                    }
                  }
                },
                required: ['name']
              }
            },
            {
              name: 'generateProjectSpec',
              description: 'Generate a project specification document from the conversation history',
              parameters: {
                type: 'object',
                properties: {
                  format: {
                    type: 'string',
                    enum: ['markdown'],
                    description: 'Output format (currently only supports markdown)'
                  }
                },
                required: ['format']
              }
            }
          ]
        },
        speak: {
          model: 'aura-2-speaker-180',
          temp: 0.45,
          rep_penalty: 2.0
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

  private async handleMessage(message: any) {
    if (message.type === 'text') {
      console.log('VoiceAgent: Received user message:', message.text)
      
      // Log user messages
      this.conversationLogger.logEntry({ 
        role: 'user', 
        content: message.text 
      })
      console.log('VoiceAgent: Logged user message to conversation')
      
      // Send to agent and handle response
      const response = await this.sendToAgent(message.text)
      console.log('VoiceAgent: Got response from agent:', response)
      
      // Log assistant responses
      if (response.text) {
        console.log('VoiceAgent: Logging assistant response')
        this.conversationLogger.logEntry({ 
          role: 'assistant', 
          content: response.text 
        })
      }
      
      // Update UI with response
      this.updateTranscript(response.text || 'No response from agent')
    }
    // ... rest of the message handling
  }

  private async handleAgentResponse(response: any) {
    console.log('VoiceAgent: Handling agent response:', response)
    
    // Log the agent's response before handling function calls
    if (response.text) {
      console.log('VoiceAgent: Logging agent response to conversation')
      this.conversationLogger.logEntry({
        role: 'assistant',
        content: response.text
      })
    }

    if (response.function_call?.name === 'generateProjectSpec') {
      try {
        await this.specGenerator.generateSpec()
        const successMessage = 'Project specification has been generated and saved to project_spec.md'
        this.updateTranscript(successMessage)
        // Log the success message as well
        this.conversationLogger.logEntry({
          role: 'assistant',
          content: successMessage
        })
      } catch (err) {
        const error = err as Error
        const errorMessage = `Error generating spec: ${error?.message || 'Unknown error'}`
        this.updateTranscript(errorMessage)
        // Log the error message
        this.conversationLogger.logEntry({
          role: 'assistant',
          content: errorMessage
        })
      }
    }
  }

  private async sendToAgent(text: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Agent not connected')
    }

    const message = {
      type: 'UserText',
      text
    }

    this.ws.send(JSON.stringify(message))

    // Return a promise that resolves when we get a response
    return new Promise<{ text?: string }>((resolve) => {
      const messageHandler = (data: WebSocket.Data) => {
        const response = JSON.parse(data.toString())
        if (response.type === 'AgentResponse') {
          // Use optional chaining and ensure ws exists before removing listener
          this.ws?.off('message', messageHandler)
          resolve({ text: response.text })
        }
      }
      // Add null check before adding event listener
      if (this.ws) {
        this.ws.on('message', messageHandler)
      } else {
        resolve({ text: 'Error: WebSocket connection lost' })
      }
    })
  }
} 