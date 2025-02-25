import * as vscode from 'vscode'
import * as os from 'os'
import * as path from 'path'
import * as fs from 'fs'
import * as cp from 'child_process'

// Update the extension ID to match your actual extension ID
const EXTENSION_ID = 'deepgram.vibe-coder'

/**
 * Loads a native module from pre-compiled binaries based on the current platform
 * @param moduleName The name of the native module to load
 * @returns The loaded native module
 */
export function loadNativeModule(moduleName: string) {
  const platform = os.platform()
  const arch = os.arch()
  
  console.log(`loadNativeModule: Loading ${moduleName} for ${platform}-${arch}`)
  
  // Special case for node-microphone which is not a native module
  if (moduleName === 'node-microphone') {
    console.log('loadNativeModule: Using special loader for node-microphone')
    return loadNodeMicrophone()
  }
  
  // Note: Speaker module loading has been removed as part of the migration to browser-based audio playback
  console.warn(`loadNativeModule: Native module ${moduleName} is not supported. Using browser-based audio playback instead.`)
  throw new Error(`Native module ${moduleName} is not supported. Using browser-based audio playback instead.`)
}

/**
 * Special loader for node-microphone which is a JavaScript wrapper around command-line tools
 * @returns A compatible node-microphone implementation
 */
function loadNodeMicrophone() {
  // First check if the required command-line tool is available
  const platform = os.platform()
  let commandName = ''
  
  if (platform === 'darwin') {
    commandName = 'rec'
  } else if (platform === 'win32') {
    commandName = 'sox'
  } else {
    commandName = 'arecord'
  }
  
  let commandAvailable = false
  try {
    if (platform === 'win32') {
      cp.execSync(`where ${commandName}`, { stdio: 'ignore' })
    } else {
      cp.execSync(`which ${commandName}`, { stdio: 'ignore' })
    }
    commandAvailable = true
    console.log(`Found ${commandName} command for ${platform}`)
  } catch (e) {
    console.warn(`The "${commandName}" command required by node-microphone is not available`)
    
    // On macOS, try to check if SoX is installed but in a different location
    if (platform === 'darwin') {
      try {
        // Check common Homebrew locations
        if (fs.existsSync('/usr/local/bin/sox') || fs.existsSync('/opt/homebrew/bin/sox')) {
          console.log('Found sox command, but rec command is missing. SoX might be installed but rec is not in PATH')
          
          // Show a more helpful message
          vscode.window.showWarningMessage(
            'SoX is installed but the "rec" command is not available. Try running "brew link --force sox" in Terminal.',
            'Open Terminal'
          ).then(selection => {
            if (selection === 'Open Terminal') {
              cp.exec('open -a Terminal');
            }
          });
        }
      } catch (err) {
        // Ignore errors in this additional check
      }
    }
  }
  
  // IMPORTANT: Don't try to require node-microphone directly
  // Instead, always use our own implementation or dummy
  console.log('Using custom microphone implementation')
  
  // If command is not available, return a dummy implementation
  if (!commandAvailable) {
    return createDummyMicrophone()
  }
  
  // If command is available, use our own implementation
  return createMicrophoneImplementation(commandName)
}

/**
 * Creates a dummy microphone implementation for when the command-line tool is not available
 * @returns A dummy microphone implementation
 */
function createDummyMicrophone() {
  const EventEmitter = require('events')
  const platform = os.platform()
  let commandName = ''
  
  if (platform === 'darwin') {
    commandName = 'rec'
  } else if (platform === 'win32') {
    commandName = 'sox'
  } else {
    commandName = 'arecord'
  }
  
  return new class DummyMicrophone extends EventEmitter {
    constructor() {
      super()
      console.log('Initialized dummy microphone')
    }
    
    startRecording() {
      console.log('Dummy microphone startRecording called')
      const stream = new EventEmitter()
      setTimeout(() => {
        const error = new Error(`Microphone requires the "${commandName}" command which is not installed`)
        this.emit('error', error)
        stream.emit('error', error)
      }, 500)
      return stream
    }
    
    stopRecording() {
      console.log('Dummy microphone stopRecording called')
      // No-op
    }
  }()
}

/**
 * Creates a microphone implementation using the specified command-line tool
 * @param commandName The name of the command-line tool to use
 * @returns A microphone implementation
 */
function createMicrophoneImplementation(commandName: string) {
  const EventEmitter = require('events')
  
  return new class MicrophoneImplementation extends EventEmitter {
    private ps: cp.ChildProcess | null = null
    private options: any = {}
    
    constructor(options?: any) {
      super()
      this.ps = null
      this.options = options || {}
    }
    
    startRecording() {
      if (this.ps === null) {
        let audioOptions: string[] = []
        
        if (commandName === 'rec') {
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
        } else if (commandName === 'sox') {
          // Windows
          audioOptions = [
            '-b', this.options.bitwidth || '16',
            '--endian', this.options.endian || 'little',
            '-c', this.options.channels || '1',
            '-r', this.options.rate || '16000',
            '-e', this.options.encoding || 'signed-integer',
            '-t', 'waveaudio',
            this.options.device || 'default',
            '-p',
          ]
        } else {
          // Linux
          const formatEncoding = this.options.encoding === 'unsigned-integer' ? 'U' : 'S'
          const formatEndian = this.options.endian === 'big' ? 'BE' : 'LE'
          const format = `${formatEncoding}${this.options.bitwidth || '16'}_${formatEndian}`
          
          audioOptions = [
            '-c', this.options.channels || '1',
            '-r', this.options.rate || '16000',
            '-f', format,
            '-D', this.options.device || 'plughw:1,0',
          ]
        }
        
        if (this.options.additionalParameters) {
          audioOptions = audioOptions.concat(this.options.additionalParameters)
        }
        
        try {
          this.ps = cp.spawn(commandName, audioOptions)
          
          if (this.ps) {
            this.ps.on('error', (error) => {
              this.emit('error', error)
            })
            
            if (this.ps.stderr) {
              this.ps.stderr.on('error', (error) => {
                this.emit('error', error)
              })
              
              this.ps.stderr.on('data', (info) => {
                this.emit('info', info)
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
          }
          
          throw new Error(`Failed to start ${commandName} process`)
        } catch (error) {
          this.emit('error', error)
          throw error
        }
      }
      
      return this.ps?.stdout || null
    }
    
    stopRecording() {
      if (this.ps) {
        this.ps.kill()
        this.ps = null
      }
    }
  }()
}

/**
 * Checks if the required native modules are available for the current platform
 * @returns An object indicating compatibility status
 */
export function checkNativeModulesCompatibility() {
  const platform = os.platform()
  const arch = os.arch()
  
  // Define required modules
  const requiredModules = ['node-microphone']
  
  // Initialize arrays for missing modules and warnings
  const missingModules: string[] = []
  const warnings: string[] = []
  
  // Get the extension path
  const extensionPath = vscode.extensions.getExtension(EXTENSION_ID)?.extensionPath
  
  if (!extensionPath) {
    console.warn(`Could not determine extension path for ${EXTENSION_ID}`)
    const allExtensions = vscode.extensions.all
    console.log(`Available extensions: ${allExtensions.map(ext => ext.id).join(', ')}`)
    return {
      compatible: false,
      platform,
      arch,
      missingModules: requiredModules,
      warnings: [`Could not determine extension path for ${EXTENSION_ID}`],
      message: `Could not determine extension path for ${EXTENSION_ID}. Available extensions: ${allExtensions.map(ext => ext.id).join(', ')}`
    }
  }
  
  // Check for node-microphone command-line tool
  let microphoneCommandName = ''
  if (platform === 'darwin') {
    microphoneCommandName = 'rec'
  } else if (platform === 'win32') {
    microphoneCommandName = 'sox'
  } else {
    microphoneCommandName = 'arecord'
  }
  
  try {
    if (platform === 'win32') {
      cp.execSync(`where ${microphoneCommandName}`, { stdio: 'ignore' })
    } else {
      cp.execSync(`which ${microphoneCommandName}`, { stdio: 'ignore' })
    }
  } catch (e) {
    missingModules.push('node-microphone')
    
    // Add platform-specific installation instructions
    if (platform === 'darwin') {
      warnings.push(`The "${microphoneCommandName}" command required by node-microphone is not available. Install SoX with: brew install sox`)
    } else if (platform === 'win32') {
      warnings.push(`The "${microphoneCommandName}" command required by node-microphone is not available. Install SoX from: https://sourceforge.net/projects/sox/`)
    } else {
      warnings.push(`The "${microphoneCommandName}" command required by node-microphone is not available. Install ALSA tools with: sudo apt-get install alsa-utils`)
    }
  }
  
  // Determine overall compatibility
  const compatible = missingModules.length === 0
  
  // Create a message summarizing the compatibility status
  let message = ''
  if (compatible) {
    message = `All required modules are available for ${platform}-${arch}`
  } else {
    message = `Some required modules are missing for ${platform}-${arch}: ${missingModules.join(', ')}`
    if (warnings.length > 0) {
      message += `. ${warnings.join(' ')}`
    }
  }
  
  return {
    compatible,
    platform,
    arch,
    missingModules,
    warnings,
    message
  }
} 