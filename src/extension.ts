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
import { ModeManagerService } from './services/mode-manager-service'

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
	console.log('Activating Vibe Coder extension...')
	
	const modeManager = new ModeManagerService(context)
	
	try {
		console.log('Initializing mode manager...')
		await modeManager.initialize()
		console.log('Mode manager initialized successfully')
	} catch (error) {
		console.error('Failed to initialize services:', error)
		vscode.window.showErrorMessage('Failed to initialize Vibe Coder: ' + (error as Error).message)
		return
	}

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "vibe-coder" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	context.subscriptions.push(
		vscode.commands.registerCommand('vibe-coder.openPanel', async () => {
			try {
				console.log('Opening panel...')
				modeManager.show()
			} catch (error) {
				console.error('Failed to open panel:', error)
				vscode.window.showErrorMessage('Failed to open panel: ' + (error as Error).message)
			}
		}),

		vscode.commands.registerCommand('vibe-coder.startAgent', async () => {
			modeManager.show()
			await modeManager.setMode('vibe')
		}),

		vscode.commands.registerCommand('vibe-coder.startDictation', async () => {
			try {
				modeManager.show()
				if (modeManager.currentMode !== 'code') {
					await modeManager.setMode('code')
				}
				await modeManager.toggleDictation()
			} catch (error) {
				console.error('Failed to toggle dictation:', error)
				vscode.window.showErrorMessage('Failed to toggle dictation: ' + (error as Error).message)
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
			modeManager.dispose()
		} 
	})

	console.log('Vibe Coder extension activated successfully')
}

// This method is called when your extension is deactivated
export function deactivate() {
	console.log('Deactivating Vibe Coder extension')
}
