import * as os from 'os'
import * as path from 'path'
import * as fs from 'fs'
import * as vscode from 'vscode'
import * as cp from 'child_process'

// The actual extension ID based on package.json
const EXTENSION_ID = 'Deepgram.vibe-coder'

/**
 * Loads a native module from pre-compiled binaries based on the current platform
 * @param moduleName The name of the native module to load
 * @returns The loaded native module
 */
export function loadNativeModule(moduleName: string) {
  const platform = os.platform()
  const arch = os.arch()
  
  // Special case for node-microphone which is not a native module
  if (moduleName === 'node-microphone') {
    return loadNodeMicrophone()
  }
  
  // Get the extension path to locate prebuilds directory
  const extensionPath = vscode.extensions.getExtension(EXTENSION_ID)?.extensionPath
  
  if (!extensionPath) {
    console.error(`Could not determine extension path for ${EXTENSION_ID}`)
    // Try to find the extension directory by searching all extensions
    const allExtensions = vscode.extensions.all
    console.log(`Available extensions: ${allExtensions.map(ext => ext.id).join(', ')}`)
    
    // Try to use the current directory as fallback
    const fallbackPath = path.resolve(__dirname, '..', '..')
    console.log(`Using fallback path: ${fallbackPath}`)
    
    // Check if prebuilds directory exists in fallback path
    const prebuildsPath = path.join(fallbackPath, 'prebuilds')
    if (fs.existsSync(prebuildsPath)) {
      console.log(`Found prebuilds directory at fallback path: ${prebuildsPath}`)
      
      // Path to the prebuilt module for the current platform
      const prebuiltPath = path.join(prebuildsPath, `${platform}-${arch}`, `${moduleName}.node`)
      
      if (fs.existsSync(prebuiltPath)) {
        console.log(`Found prebuilt module at fallback path: ${prebuiltPath}`)
        try {
          return require(prebuiltPath)
        } catch (error) {
          console.error(`Error loading prebuilt module from fallback path: ${error instanceof Error ? error.message : String(error)}`)
        }
      }
    }
    
    throw new Error(`Could not determine extension path for ${EXTENSION_ID}. Available extensions: ${allExtensions.map(ext => ext.id).join(', ')}`)
  }
  
  // Path to the prebuilt module for the current platform
  const prebuiltPath = path.join(extensionPath, 'prebuilds', `${platform}-${arch}`, `${moduleName}.node`)
  
  // Log information for debugging
  console.log(`Looking for native module at: ${prebuiltPath}`)
  
  if (fs.existsSync(prebuiltPath)) {
    console.log(`Found prebuilt module for ${moduleName} (${platform}-${arch})`)
    try {
      // Load the native module from the prebuilt path
      return require(prebuiltPath)
    } catch (error) {
      console.error(`Error loading prebuilt module: ${error instanceof Error ? error.message : String(error)}`)
      throw new Error(`Failed to load prebuilt module ${moduleName} for ${platform}-${arch}`)
    }
  } else {
    console.warn(`No prebuilt module found for ${moduleName} (${platform}-${arch})`)
    
    // Try to load via normal require as fallback (will likely fail if no compilation environment)
    try {
      console.log(`Attempting to load ${moduleName} via normal require as fallback`)
      return require(moduleName)
    } catch (error) {
      const errorMessage = `Native module ${moduleName} is not available for your platform (${platform}-${arch}).`
      console.error(errorMessage)
      throw new Error(errorMessage)
    }
  }
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
 * Creates a dummy microphone implementation that will show appropriate errors
 */
function createDummyMicrophone() {
  const EventEmitter = require('events')
  
  // This is a simplified version of the node-microphone API that will show errors
  return class DummyMicrophone extends EventEmitter {
    constructor() {
      super()
      console.warn('Using dummy microphone implementation - audio input will not work')
    }
    
    startRecording() {
      const stream = new EventEmitter()
      
      // Emit an error after a short delay
      setTimeout(() => {
        const error = new Error('Microphone is not available on this platform')
        this.emit('error', error)
        stream.emit('error', error)
      }, 500)
      
      return stream
    }
    
    stopRecording() {
      // No-op
    }
  }
}

/**
 * Creates a microphone implementation that uses the specified command
 */
function createMicrophoneImplementation(commandName: string) {
  const EventEmitter = require('events')
  const spawn = cp.spawn
  
  // This is a simplified version of the node-microphone implementation
  return class MicrophoneImplementation extends EventEmitter {
    private ps: cp.ChildProcess | null = null
    private options: any
    
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
          this.ps = spawn(commandName, audioOptions)
          
          // Add null checks before accessing properties
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
          
          // If we couldn't set up the process properly, throw an error
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
  }
}

/**
 * Check if all required native modules are available for the current platform
 * @returns Object indicating compatibility status
 */
export function checkNativeModulesCompatibility() {
  const platform = os.platform()
  const arch = os.arch()
  const requiredModules = ['speaker', 'node-microphone']
  const missingModules: string[] = []
  const warnings: string[] = []
  
  // Get the extension path
  const extensionPath = vscode.extensions.getExtension(EXTENSION_ID)?.extensionPath
  
  if (!extensionPath) {
    console.error(`Could not determine extension path for ${EXTENSION_ID}`)
    // Try to find the extension directory by searching all extensions
    const allExtensions = vscode.extensions.all
    console.log(`Available extensions: ${allExtensions.map(ext => ext.id).join(', ')}`)
    
    return {
      compatible: false,
      platform,
      arch,
      missingModules: requiredModules,
      message: `Could not determine extension path for ${EXTENSION_ID}. Available extensions: ${allExtensions.map(ext => ext.id).join(', ')}`
    }
  }
  
  // Check speaker module (native)
  const speakerPath = path.join(extensionPath, 'prebuilds', `${platform}-${arch}`, 'speaker.node')
  if (!fs.existsSync(speakerPath)) {
    missingModules.push('speaker')
  }
  
  // Check node-microphone (special case - it's a JS wrapper)
  // We need to check if the required command-line tool is available
  let microphoneAvailable = true
  let commandName = ''
  
  if (platform === 'darwin') {
    commandName = 'rec'
  } else if (platform === 'win32') {
    commandName = 'sox'
  } else {
    commandName = 'arecord'
  }
  
  try {
    if (platform === 'win32') {
      cp.execSync(`where ${commandName}`, { stdio: 'ignore' })
    } else {
      cp.execSync(`which ${commandName}`, { stdio: 'ignore' })
    }
  } catch (e) {
    microphoneAvailable = false
    warnings.push(`The "${commandName}" command required by node-microphone is not available.`)
    
    if (platform === 'darwin') {
      warnings.push('Install SoX on macOS: brew install sox')
    } else if (platform === 'win32') {
      warnings.push('Install SoX for Windows: https://sourceforge.net/projects/sox/')
    } else {
      warnings.push('Install ALSA tools on Linux: sudo apt-get install alsa-utils')
    }
  }
  
  if (!microphoneAvailable) {
    missingModules.push('node-microphone (command-line tool)')
  }
  
  return {
    compatible: missingModules.length === 0,
    platform,
    arch,
    missingModules,
    warnings,
    message: missingModules.length > 0
      ? `Missing components for your platform (${platform}-${arch}): ${missingModules.join(', ')}`
      : 'All components are available for your platform'
  }
} 