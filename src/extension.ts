process.env.DEBUG = '*';
console.log('=== VIBE CODER EXTENSION ===');
console.log('Extension loading at:', __dirname);
console.log('Extension file:', __filename);
console.log('Process cwd:', process.cwd());
console.log('Environment:', process.env.VSCODE_ENV);
console.log('=== END VIBE CODER INFO ===');

console.log('Loading Vibe Coder extension...');

// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { DeepgramService } from './services/deepgram-service'
import { VoiceAgentService } from './services/voice-agent-service'

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
	console.log('Activating Vibe Coder extension...')
	
	const deepgramService = new DeepgramService(context)
	const voiceAgentService = new VoiceAgentService(context)
	
	try {
		console.log('Initializing Deepgram service...')
		await deepgramService.initialize()
		console.log('Deepgram service initialized successfully')
	} catch (error) {
		console.error('Failed to initialize Deepgram service:', error)
		vscode.window.showErrorMessage('Failed to initialize Vibe Coder: ' + (error as Error).message)
		return
	}

	try {
		await voiceAgentService.initialize()
	} catch (error) {
		console.error('Failed to initialize voice agent:', error)
		return
	}

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "vibe-coder" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	context.subscriptions.push(
		vscode.commands.registerCommand('vibe-coder.startAgent', async () => {
			console.log('Starting agent...')
			try {
				await voiceAgentService.startAgent()
			} catch (error) {
				console.error('Failed to start voice agent:', error)
				vscode.window.showErrorMessage(
					`Failed to start voice agent: ${(error as Error).message}`
				)
			}
		}),

		vscode.commands.registerCommand('vibe-coder.startDictation', async () => {
			console.log('Starting dictation...')
			try {
				await deepgramService.startDictation()
			} catch (error) {
				console.error('Failed to start dictation:', error)
				vscode.window.showErrorMessage('Failed to start dictation: ' + (error as Error).message)
			}
		}),

		vscode.commands.registerCommand('vibe-coder.stopDictation', async () => {
			console.log('Stopping dictation...')
			try {
				await deepgramService.stopDictation()
			} catch (error) {
				console.error('Failed to stop dictation:', error)
				vscode.window.showErrorMessage('Failed to stop dictation: ' + (error as Error).message)
			}
		}),

		vscode.commands.registerCommand('vibe-coder.test', () => {
			console.log('Test command executed')
			vscode.window.showInformationMessage('Vibe Coder test command works!')
		})
	)

	// Add service to subscriptions for cleanup
	context.subscriptions.push({ 
		dispose: () => {
			deepgramService.dispose()
			voiceAgentService.dispose()
		} 
	})

	console.log('Vibe Coder extension activated successfully')
}

// This method is called when your extension is deactivated
export function deactivate() {
	console.log('Deactivating Vibe Coder extension')
}
