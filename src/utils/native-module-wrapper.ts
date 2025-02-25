import * as vscode from 'vscode'
import { loadNativeModule } from './binary-loader'
import * as cp from 'child_process'
import * as os from 'os'
import * as fs from 'fs'
import * as path from 'path'

/**
 * A wrapper for the node-microphone module
 * Note: node-microphone is not a native module but a JavaScript wrapper around command-line tools
 */
export class MicrophoneWrapper {
  private microphone: any | null = null
  private commandAvailable: boolean = false
  private commandName: string = ''
  private platform: string = os.platform()
  private EventEmitter = require('events')

  constructor() {
    // Determine which command-line tool is needed based on platform
    if (this.platform === 'darwin') {
      this.commandName = 'rec'
    } else if (this.platform === 'win32') {
      this.commandName = 'sox'
    } else {
      this.commandName = 'arecord'
    }
    
    console.log(`MicrophoneWrapper: Initializing for platform ${this.platform}, checking for ${this.commandName}`)
    
    // Check if the command is available
    try {
      if (this.platform === 'win32') {
        cp.execSync(`where ${this.commandName}`, { stdio: 'ignore' })
      } else {
        cp.execSync(`which ${this.commandName}`, { stdio: 'ignore' })
      }
      this.commandAvailable = true
      console.log(`MicrophoneWrapper: Found ${this.commandName} command`)
    } catch (e) {
      this.commandAvailable = false
      console.warn(`MicrophoneWrapper: The "${this.commandName}" command required by node-microphone is not available`)
      
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
                cp.exec('open -a Terminal');
              }
            });
            return;
          }
        } catch (err) {
          // Ignore errors in this additional check
        }
      }
      
      // Show installation instructions
      this.showInstallationInstructions();
    }
    
    // IMPORTANT: Don't try to require node-microphone directly
    // Instead, create our own implementation
    if (this.commandAvailable) {
      console.log('MicrophoneWrapper: Command available, creating custom microphone implementation');
      this.microphone = this.createMicrophoneImplementation();
    } else {
      console.log('MicrophoneWrapper: Command not available, creating dummy microphone');
      this.microphone = this.createDummyMicrophone();
    }
  }

  private createDummyMicrophone() {
    const self = this;
    return new class DummyMicrophone extends this.EventEmitter {
      constructor() {
        super();
        console.log('MicrophoneWrapper: Initialized dummy microphone');
      }
      
      startRecording() {
        console.log('MicrophoneWrapper: Dummy microphone startRecording called');
        const stream = new self.EventEmitter();
        setTimeout(() => {
          const error = new Error(`Microphone requires the "${self.commandName}" command which is not installed`);
          this.emit('error', error);
          stream.emit('error', error);
        }, 500);
        return stream;
      }
      
      stopRecording() {
        console.log('MicrophoneWrapper: Dummy microphone stopRecording called');
        // No-op
      }
    }();
  }

  private createMicrophoneImplementation() {
    const self = this;
    return new class MicrophoneImplementation extends this.EventEmitter {
      private ps: cp.ChildProcess | null = null;
      private options: any = {};
      
      constructor(options?: any) {
        super();
        this.ps = null;
        this.options = options || {};
      }
      
      startRecording() {
        if (this.ps === null) {
          let audioOptions: string[] = [];
          
          if (self.commandName === 'rec') {
            // macOS
            audioOptions = [
              '-q',
              '-b', this.options.bitwidth || '16',
              '-c', this.options.channels || '1',
              '-r', this.options.rate || '16000',
              '-e', this.options.encoding || 'signed-integer',
              '-t', 'wav',
              '-',
            ];
          } else if (self.commandName === 'sox') {
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
            ];
          } else {
            // Linux
            const formatEncoding = this.options.encoding === 'unsigned-integer' ? 'U' : 'S';
            const formatEndian = this.options.endian === 'big' ? 'BE' : 'LE';
            const format = `${formatEncoding}${this.options.bitwidth || '16'}_${formatEndian}`;
            
            audioOptions = [
              '-c', this.options.channels || '1',
              '-r', this.options.rate || '16000',
              '-f', format,
              '-D', this.options.device || 'plughw:1,0',
            ];
          }
          
          if (this.options.additionalParameters) {
            audioOptions = audioOptions.concat(this.options.additionalParameters);
          }
          
          try {
            this.ps = cp.spawn(self.commandName, audioOptions);
            
            if (this.ps) {
              this.ps.on('error', (error) => {
                this.emit('error', error);
              });
              
              if (this.ps.stderr) {
                this.ps.stderr.on('error', (error) => {
                  this.emit('error', error);
                });
                
                this.ps.stderr.on('data', (info) => {
                  this.emit('info', info);
                });
              }
              
              if (this.ps.stdout) {
                if (this.options.useDataEmitter) {
                  this.ps.stdout.on('data', (data) => {
                    this.emit('data', data);
                  });
                }
                
                return this.ps.stdout;
              }
            }
            
            throw new Error(`Failed to start ${self.commandName} process`);
          } catch (error) {
            this.emit('error', error);
            throw error;
          }
        }
        
        return this.ps?.stdout || null;
      }
      
      stopRecording() {
        if (this.ps) {
          this.ps.kill();
          this.ps = null;
        }
      }
    }();
  }

  private showInstallationInstructions() {
    if (this.platform === 'darwin') {
      vscode.window.showWarningMessage(
        'Microphone requires SoX. Install with: brew install sox',
        'Install SoX',
        'Copy Command'
      ).then(selection => {
        if (selection === 'Install SoX') {
          vscode.env.openExternal(vscode.Uri.parse('https://brew.sh/'));
        } else if (selection === 'Copy Command') {
          vscode.env.clipboard.writeText('brew install sox');
          vscode.window.showInformationMessage('Command copied to clipboard: brew install sox');
        }
      });
    } else if (this.platform === 'win32') {
      vscode.window.showWarningMessage(
        'Microphone requires SoX for Windows',
        'Download SoX',
        'Learn More'
      ).then(selection => {
        if (selection === 'Download SoX') {
          vscode.env.openExternal(vscode.Uri.parse('https://sourceforge.net/projects/sox/'));
        } else if (selection === 'Learn More') {
          vscode.env.openExternal(vscode.Uri.parse('https://github.com/deepgram/vibe_coder#prerequisites'));
        }
      });
    } else {
      vscode.window.showWarningMessage(
        'Microphone requires ALSA tools. Install with: sudo apt-get install alsa-utils',
        'Copy Command',
        'Learn More'
      ).then(selection => {
        if (selection === 'Copy Command') {
          vscode.env.clipboard.writeText('sudo apt-get install alsa-utils');
          vscode.window.showInformationMessage('Command copied to clipboard: sudo apt-get install alsa-utils');
        } else if (selection === 'Learn More') {
          vscode.env.openExternal(vscode.Uri.parse('https://wiki.archlinux.org/title/Advanced_Linux_Sound_Architecture'));
        }
      });
    }
  }

  startRecording() {
    console.log('MicrophoneWrapper: startRecording called');
    if (!this.microphone) {
      console.error('MicrophoneWrapper: Microphone is not available');
      throw new Error('Microphone is not available on this platform');
    }
    
    try {
      console.log('MicrophoneWrapper: Calling microphone.startRecording()');
      const stream = this.microphone.startRecording();
      console.log('MicrophoneWrapper: Got stream from microphone.startRecording()');
      return stream;
    } catch (error) {
      console.error('MicrophoneWrapper: Microphone start recording error:', error);
      
      if (!this.commandAvailable) {
        vscode.window.showErrorMessage(`Microphone requires the "${this.commandName}" command which is not installed.`);
        this.showInstallationInstructions();
      } else {
        vscode.window.showErrorMessage('Failed to start recording from microphone.');
      }
      
      throw error;
    }
  }

  stopRecording() {
    console.log('MicrophoneWrapper: stopRecording called');
    if (!this.microphone) {
      console.log('MicrophoneWrapper: No microphone to stop');
      return;
    }
    
    try {
      console.log('MicrophoneWrapper: Calling microphone.stopRecording()');
      this.microphone.stopRecording();
      console.log('MicrophoneWrapper: microphone.stopRecording() completed');
    } catch (error) {
      console.error('MicrophoneWrapper: Microphone stop recording error:', error);
    }
  }
} 