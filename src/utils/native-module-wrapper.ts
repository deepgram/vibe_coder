import * as vscode from 'vscode'
import { loadNativeModule } from './binary-loader'
import * as cp from 'child_process'
import * as os from 'os'
import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'

interface MicrophoneCommandInfo {
  commandName: 'rec' | 'sox' | 'arecord' | null
  commandAvailable: boolean
  installInstructions: string
  defaultDevice: string
  deviceListCommand?: string
}

interface MicrophoneOptions {
  // Audio format options
  bitwidth?: string
  channels?: string
  rate?: string
  encoding?: 'signed-integer' | 'unsigned-integer'
  endian?: 'little' | 'big'
  
  // Device selection
  device?: string
  
  // Additional options
  additionalParameters?: string[]
  useDataEmitter?: boolean
}

function detectMicrophoneCommand(): MicrophoneCommandInfo {
  const currentPlatform = os.platform()
  let commandName: MicrophoneCommandInfo['commandName'] = null
  let commandAvailable = false
  let installInstructions = ''
  let defaultDevice = ''
  let deviceListCommand = ''

  try {
    switch (currentPlatform) {
      case 'darwin': {
        commandName = 'rec'
        defaultDevice = 'default'
        deviceListCommand = 'system_profiler SPAudioDataType | grep "Input Sources:"'
        try {
          execSync('which rec', { stdio: 'ignore' })
          commandAvailable = true
        } catch {
          installInstructions = 'Install SoX on macOS using: brew install sox'
        }
        break
      }
      case 'win32': {
        commandName = 'sox'
        defaultDevice = 'default'
        deviceListCommand = 'sox -h'
        try {
          execSync('where sox', { stdio: 'ignore' })
          commandAvailable = true
        } catch {
          installInstructions = 'Install SoX for Windows from: https://sourceforge.net/projects/sox/'
        }
        break
      }
      default: {
        // Linux and other Unix-like systems
        commandName = 'arecord'
        defaultDevice = 'plughw:1,0'
        deviceListCommand = 'arecord -L'
        try {
          execSync('which arecord', { stdio: 'ignore' })
          commandAvailable = true
        } catch {
          installInstructions = 'Install ALSA tools using: sudo apt-get install alsa-utils'
        }
      }
    }
  } catch (error) {
    console.error('Error detecting microphone command:', error)
  }

  return {
    commandName,
    commandAvailable,
    installInstructions,
    defaultDevice,
    deviceListCommand
  }
}

/**
 * A wrapper for the node-microphone module
 * Note: node-microphone is not a native module but a JavaScript wrapper around command-line tools
 */
export class MicrophoneWrapper {
  private microphone: any | null = null
  private ps: any | null = null
  private options: MicrophoneOptions
  private commandInfo: MicrophoneCommandInfo
  private platform: string = os.platform()
  private EventEmitter = require('events')

  // Add proper type declarations for previously missing properties
  private commandName: 'rec' | 'sox' | 'arecord' | null = null
  private commandAvailable: boolean = false

  constructor(options: MicrophoneOptions = {}) {
    this.options = options
    this.commandInfo = detectMicrophoneCommand()
    
    // Use the commandInfo instead of re-detecting
    this.commandName = this.commandInfo.commandName
    this.commandAvailable = this.commandInfo.commandAvailable

    // If no device is specified, use the default for this platform
    if (!this.options.device) {
      this.options.device = this.getConfiguredDevice() || this.commandInfo.defaultDevice
      console.log(`MicrophoneWrapper: Using device: ${this.options.device}`)
    }

    if (!this.commandAvailable) {
      console.warn(`Microphone command '${this.commandName}' not found.`)
      console.warn(`Installation instructions: ${this.commandInfo.installInstructions}`)
      
      // On macOS, check if SoX is installed but rec is not in PATH
      if (this.platform === 'darwin') {
        try {
          // Check common Homebrew locations for SoX
          if (fs.existsSync('/usr/local/bin/sox') || fs.existsSync('/opt/homebrew/bin/sox')) {
            console.log('MicrophoneWrapper: Found sox command, but rec command is missing')
            vscode.window.showWarningMessage(
              'SoX is installed but the "rec" command is not available. Try running "brew link --force sox" in Terminal.',
              'Open Terminal'
            ).then(selection => {
              if (selection === 'Open Terminal') {
                cp.exec('open -a Terminal')
              }
            })
            return
          }
        } catch (err) {
          // Ignore errors in this additional check
        }
      }
      
      // Show installation instructions
      this.showInstallationInstructions()
    }
    
    // Create microphone implementation based on command availability
    if (this.commandAvailable) {
      console.log('MicrophoneWrapper: Command available, creating custom microphone implementation')
      this.microphone = this.createMicrophoneImplementation()
    } else {
      console.log('MicrophoneWrapper: Command not available, creating dummy microphone')
      this.microphone = this.createDummyMicrophone()
    }
  }

  /**
   * Get the configured microphone device from VS Code settings
   */
  private getConfiguredDevice(): string | undefined {
    const config = vscode.workspace.getConfiguration('vibeCoder.microphone')
    
    switch (this.platform) {
      case 'darwin':
        return config.get<string>('deviceMacOS')
      case 'win32':
        return config.get<string>('deviceWindows')
      default:
        return config.get<string>('deviceLinux')
    }
  }

  /**
   * List available microphone devices
   * This is an async operation that will show the devices in the output channel
   */
  public async listAvailableDevices(): Promise<void> {
    if (!this.commandAvailable || !this.commandInfo.deviceListCommand) {
      vscode.window.showErrorMessage(
        `Cannot list devices: ${this.commandName} command not available.`
      )
      return
    }

    try {
      const outputChannel = vscode.window.createOutputChannel('Vibe-Coder Microphone Devices')
      outputChannel.show()
      outputChannel.appendLine(`Listing available microphone devices for ${this.platform}...`)
      outputChannel.appendLine('Command: ' + this.commandInfo.deviceListCommand)
      outputChannel.appendLine('-------------------------------------------')
      
      const output = cp.execSync(this.commandInfo.deviceListCommand, { encoding: 'utf-8' })
      outputChannel.appendLine(output)
      
      outputChannel.appendLine('-------------------------------------------')
      outputChannel.appendLine('To configure your microphone device, update settings:')
      outputChannel.appendLine('1. Open VS Code settings (File > Preferences > Settings)')
      outputChannel.appendLine('2. Search for "vibeCoder.microphone"')
      outputChannel.appendLine('3. Set the appropriate device for your platform')
      
    } catch (error) {
      console.error('Error listing microphone devices:', error)
      vscode.window.showErrorMessage(
        `Failed to list microphone devices: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  private createDummyMicrophone() {
    const self = this
    return new class DummyMicrophone extends this.EventEmitter {
      constructor() {
        super()
        console.log('MicrophoneWrapper: Initialized dummy microphone')
      }
      
      startRecording() {
        console.log('MicrophoneWrapper: Dummy microphone startRecording called')
        const stream = new self.EventEmitter()
        setTimeout(() => {
          const error = new Error(self.commandInfo.installInstructions)
          this.emit('error', error)
          stream.emit('error', error)
        }, 500)
        return stream
      }
      
      stopRecording() {
        console.log('MicrophoneWrapper: Dummy microphone stopRecording called')
        // No-op
      }
    }()
  }

  private createMicrophoneImplementation() {
    const self = this
    
    if (!this.commandName) {
      throw new Error('Cannot create microphone implementation: command not available')
    }

    return new class MicrophoneImplementation extends this.EventEmitter {
      private ps: cp.ChildProcess | null = null
      private options: MicrophoneOptions = {}
      
      constructor(options?: MicrophoneOptions) {
        super()
        this.ps = null
        this.options = options || self.options || {}
      }
      
      startRecording() {
        if (this.ps === null) {
          let audioOptions: string[] = []
          
          // Ensure we have a command name
          if (!self.commandName) {
            throw new Error('Cannot start recording: command not available')
          }
          
          switch (self.commandName) {
            case 'rec': {
              // macOS
              audioOptions = [
                '-q',
                '-b', this.options.bitwidth || '16',
                '-c', this.options.channels || '1',
                '-r', this.options.rate || '16000',
                '-e', this.options.encoding || 'signed-integer',
                '-t', 'wav',
                '-',
              ]
              break
            }
            case 'sox': {
              // Windows
              audioOptions = [
                '-b', this.options.bitwidth || '16',
                '--endian', this.options.endian || 'little',
                '-c', this.options.channels || '1',
                '-r', this.options.rate || '16000',
                '-e', this.options.encoding || 'signed-integer',
                '-t', 'waveaudio',
                this.options.device || self.commandInfo.defaultDevice,
                '-p',
              ]
              break
            }
            case 'arecord': {
              // Linux
              const formatEncoding = this.options.encoding === 'unsigned-integer' ? 'U' : 'S'
              const formatEndian = this.options.endian === 'big' ? 'BE' : 'LE'
              const format = `${formatEncoding}${this.options.bitwidth || '16'}_${formatEndian}`
              
              audioOptions = [
                '-c', this.options.channels || '1',
                '-r', this.options.rate || '16000',
                '-f', format,
                '-D', this.options.device || self.commandInfo.defaultDevice,
              ]
              break
            }
            default:
              throw new Error(`Unsupported command: ${self.commandName}`)
          }
          
          if (this.options.additionalParameters) {
            audioOptions = audioOptions.concat(this.options.additionalParameters)
          }
          
          try {
            console.log(`MicrophoneWrapper: Starting ${self.commandName} with device: ${this.options.device || self.commandInfo.defaultDevice}`)
            
            // We can safely assert commandName is string here due to the check above
            this.ps = cp.spawn(self.commandName, audioOptions)
            
            if (!this.ps) {
              throw new Error(`Failed to start ${self.commandName} process`)
            }
            
            this.ps.on('error', (error) => {
              console.error(`MicrophoneWrapper: Process error: ${error.message}`)
              this.emit('error', error)
            })
            
            if (this.ps.stderr) {
              this.ps.stderr.on('error', (error) => {
                console.error(`MicrophoneWrapper: stderr error: ${error.message}`)
                this.emit('error', error)
              })
              
              this.ps.stderr.on('data', (info) => {
                const infoStr = info.toString().trim()
                if (infoStr) {
                  console.log(`MicrophoneWrapper: Process info: ${infoStr}`)
                  this.emit('info', info)
                }
              })
            }
            
            if (this.ps.stdout) {
              if (this.options.useDataEmitter) {
                this.ps.stdout.on('data', (data) => {
                  this.emit('data', data)
                })
              }
              
              return this.ps.stdout
            }
            
            throw new Error('No stdout available from microphone process')
          } catch (error) {
            console.error(`MicrophoneWrapper: Failed to start recording: ${error instanceof Error ? error.message : String(error)}`)
            this.emit('error', error)
            throw error
          }
        }
        
        return this.ps?.stdout || null
      }
      
      stopRecording() {
        if (this.ps) {
          console.log('MicrophoneWrapper: Stopping recording')
          this.ps.kill()
          this.ps = null
        }
      }
    }()
  }

  private showInstallationInstructions() {
    // Use the installation instructions from commandInfo
    const message = `Microphone requires ${this.commandName}. ${this.commandInfo.installInstructions}`
    
    if (this.platform === 'darwin') {
      vscode.window.showWarningMessage(
        message,
        'Install SoX',
        'Copy Command'
      ).then(selection => {
        if (selection === 'Install SoX') {
          vscode.env.openExternal(vscode.Uri.parse('https://brew.sh/'))
        } else if (selection === 'Copy Command') {
          vscode.env.clipboard.writeText('brew install sox')
          vscode.window.showInformationMessage('Command copied to clipboard: brew install sox')
        }
      })
    } else if (this.platform === 'win32') {
      vscode.window.showWarningMessage(
        message,
        'Download SoX',
        'Learn More'
      ).then(selection => {
        if (selection === 'Download SoX') {
          vscode.env.openExternal(vscode.Uri.parse('https://sourceforge.net/projects/sox/'))
        } else if (selection === 'Learn More') {
          vscode.env.openExternal(vscode.Uri.parse('https://github.com/deepgram/vibe_coder#prerequisites'))
        }
      })
    } else {
      vscode.window.showWarningMessage(
        message,
        'Copy Command',
        'Learn More'
      ).then(selection => {
        if (selection === 'Copy Command') {
          vscode.env.clipboard.writeText('sudo apt-get install alsa-utils')
          vscode.window.showInformationMessage('Command copied to clipboard: sudo apt-get install alsa-utils')
        } else if (selection === 'Learn More') {
          vscode.env.openExternal(vscode.Uri.parse('https://wiki.archlinux.org/title/Advanced_Linux_Sound_Architecture'))
        }
      })
    }
  }

  /**
   * Start recording from the microphone
   * @returns A readable stream of audio data
   * @throws Error if the microphone is not available or fails to start
   */
  startRecording() {
    console.log('MicrophoneWrapper: startRecording called')
    if (!this.microphone) {
      console.error('MicrophoneWrapper: Microphone is not available')
      throw new Error('Microphone is not available on this platform')
    }
    
    try {
      console.log('MicrophoneWrapper: Calling microphone.startRecording()')
      const stream = this.microphone.startRecording()
      console.log('MicrophoneWrapper: Got stream from microphone.startRecording()')
      return stream
    } catch (error) {
      console.error('MicrophoneWrapper: Microphone start recording error:', error)
      
      if (!this.commandAvailable) {
        vscode.window.showErrorMessage(`Microphone requires the "${this.commandName}" command which is not installed.`)
        this.showInstallationInstructions()
      } else {
        const errorMessage = error instanceof Error ? error.message : String(error)
        vscode.window.showErrorMessage(`Failed to start recording from microphone: ${errorMessage}`)
        
        // Check if this might be a device-related error
        if (errorMessage.includes('device') || errorMessage.includes('Device')) {
          vscode.window.showInformationMessage(
            'This might be a microphone device issue. Would you like to list available devices?',
            'List Devices'
          ).then(selection => {
            if (selection === 'List Devices') {
              this.listAvailableDevices()
            }
          })
        }
      }
      
      throw error
    }
  }

  /**
   * Stop recording from the microphone
   */
  stopRecording() {
    console.log('MicrophoneWrapper: stopRecording called')
    if (!this.microphone) {
      console.log('MicrophoneWrapper: No microphone to stop')
      return
    }
    
    try {
      console.log('MicrophoneWrapper: Calling microphone.stopRecording()')
      this.microphone.stopRecording()
      console.log('MicrophoneWrapper: microphone.stopRecording() completed')
    } catch (error) {
      console.error('MicrophoneWrapper: Microphone stop recording error:', error)
    }
  }

  /**
   * Test the microphone by attempting to record a short sample
   * This is useful for verifying that the microphone is working
   * @returns A promise that resolves if the test is successful, or rejects with an error
   */
  public async testMicrophone(): Promise<void> {
    if (!this.commandAvailable) {
      throw new Error(`Microphone command '${this.commandName}' not found. ${this.commandInfo.installInstructions}`)
    }

    return new Promise<void>((resolve, reject) => {
      try {
        console.log('MicrophoneWrapper: Testing microphone...')
        const stream = this.startRecording()
        
        // Set up a timeout to stop the test after 2 seconds
        const timeout = setTimeout(() => {
          console.log('MicrophoneWrapper: Microphone test completed successfully')
          this.stopRecording()
          resolve()
        }, 2000)
        
        // Listen for data to confirm we're getting audio
        let dataReceived = false
        
        stream.on('data', (chunk: Buffer) => {
          if (!dataReceived) {
            console.log(`MicrophoneWrapper: Received first audio chunk (${chunk.length} bytes)`)
            dataReceived = true
          }
        })
        
        // Listen for errors
        stream.on('error', (error: Error) => {
          clearTimeout(timeout)
          this.stopRecording()
          console.error('MicrophoneWrapper: Microphone test failed:', error)
          reject(error)
        })
        
      } catch (error) {
        console.error('MicrophoneWrapper: Microphone test failed:', error)
        reject(error)
      }
    })
  }
  
  /**
   * Dispose of resources used by the microphone wrapper
   * This should be called when the wrapper is no longer needed
   */
  public dispose(): void {
    console.log('MicrophoneWrapper: Disposing resources')
    try {
      this.stopRecording()
    } catch (error) {
      console.error('MicrophoneWrapper: Error during disposal:', error)
    }
  }
} 