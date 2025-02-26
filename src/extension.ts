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
import { MicrophoneWrapper } from './utils/native-module-wrapper';

// Add type for QuickPick items
interface PromptQuickPickItem extends vscode.QuickPickItem {
	id: 'new' | 'select' | 'modify' | 'delete'
}

interface PromptSelectItem extends vscode.QuickPickItem {
	id: string
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
	console.log('Activating Vibe Coder extension...')
	
	// Register the API key command first, before any initialization
	context.subscriptions.push(
		vscode.commands.registerCommand('vibe-coder.configureDeepgramApiKey', async () => {
			try {
				const key = await vscode.window.showInputBox({
					prompt: 'Enter your Deepgram API key',
					password: true,
					placeHolder: 'Deepgram API key is required for voice features',
					ignoreFocusOut: true
				})
				
				if (key) {
					await context.secrets.store('deepgram.apiKey', key)
					vscode.window.showInformationMessage('Deepgram API key saved successfully')
					
					// Reload the window to apply the new API key
					const reload = await vscode.window.showInformationMessage(
						'API key saved. Reload window to apply changes?',
						'Reload Window'
					)
					
					if (reload === 'Reload Window') {
						await vscode.commands.executeCommand('workbench.action.reloadWindow')
					}
				}
			} catch (error) {
				console.error('Failed to save API key:', error)
				vscode.window.showErrorMessage('Failed to save API key: ' + (error as Error).message)
			}
		})
	)
	
	const modeManager = new ModeManagerService(context)
	
	try {
		console.log('Initializing mode manager...')
		await modeManager.initialize()
		console.log('Mode manager initialized successfully')
	} catch (error) {
		console.error('Failed to initialize services:', error)
		vscode.window.showErrorMessage(
			'Failed to initialize Vibe Coder: ' + (error as Error).message + 
			'. Please set your Deepgram API key using the "Configure Deepgram API Key" command.'
		)
		
		// Show the command palette with our command pre-filled
		vscode.commands.executeCommand('workbench.action.quickOpen', '>Configure Deepgram API Key')
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
		}),

		vscode.commands.registerCommand('vibe-coder.managePrompts', async () => {
			const items: PromptQuickPickItem[] = [
				{ label: '$(add) Create New Prompt', id: 'new' },
				{ label: '$(list-selection) Select Active Prompt', id: 'select' },
				{ label: '$(edit) Modify Prompt', id: 'modify' },
				{ label: '$(trash) Delete Prompt', id: 'delete' }
			]

			const choice = await vscode.window.showQuickPick(items, {
				placeHolder: 'Manage Dictation Prompts'
			})

			if (!choice) return

			switch (choice.id) {
				case 'new': {
					const name = await vscode.window.showInputBox({
						prompt: 'Enter a name for the new prompt'
					})
					if (!name) return

					// Create a temp file for the new prompt
					const tmpFile = vscode.Uri.file(
						`${context.globalStorageUri.fsPath}/prompt-new.md`
					)

					// Ensure the directory exists
					await vscode.workspace.fs.createDirectory(context.globalStorageUri)

					// Write initial content with template
					await vscode.workspace.fs.writeFile(tmpFile, Buffer.from(
						`// Prompt: ${name}
// Edit the prompt below and save to create
// Lines starting with // are ignored

You are an AI assistant helping with...

Key responsibilities:
1. 
2. 
3. 

Guidelines:
- 
- 
- 

Example input: "..."
Example output: "..."
`
					))

					const doc = await vscode.workspace.openTextDocument(tmpFile)
					const editor = await vscode.window.showTextDocument(doc, {
						preview: false,
						viewColumn: vscode.ViewColumn.Beside
					})

					// Add save handler
					const disposable = vscode.workspace.onDidSaveTextDocument(async (savedDoc) => {
						if (savedDoc.uri.toString() === tmpFile.toString()) {
							// Extract prompt content (ignore comment lines)
							const content = savedDoc.getText()
								.split('\n')
								.filter(line => !line.trim().startsWith('//'))
								.join('\n')
								.trim()

							// Create the new prompt
							await modeManager.promptManager.addPrompt(name, content)

							vscode.window.showInformationMessage(`Prompt "${name}" created successfully`)
							
							// Clean up
							disposable.dispose()
							await vscode.workspace.fs.delete(tmpFile)
						}
					})

					// Also clean up if the editor is closed without saving
					const closeDisposable = vscode.workspace.onDidCloseTextDocument(async (closedDoc) => {
						if (closedDoc.uri.toString() === tmpFile.toString()) {
							closeDisposable.dispose()
							try {
								await vscode.workspace.fs.delete(tmpFile)
							} catch (e) {
								// File might already be deleted, ignore
							}
						}
					})
					break
				}

				case 'select': {
					const prompts = modeManager.promptManager.getAllPrompts()
					const selected = await vscode.window.showQuickPick<PromptSelectItem>(
						prompts.map(p => ({ label: p.name, id: p.id })),
						{ placeHolder: 'Select prompt to use' }
					)
					if (selected) {
						await modeManager.promptManager.setCurrentPrompt(selected.id)
					}
					break
				}

				case 'modify': {
					const prompts = modeManager.promptManager.getAllPrompts()
					const selected = await vscode.window.showQuickPick<PromptSelectItem>(
						prompts.map(p => ({ label: p.name, id: p.id })),
						{ placeHolder: 'Select prompt to modify' }
					)
					
					if (selected) {
						const prompt = prompts.find(p => p.id === selected.id)
						if (prompt) {
							// Create a temp file in the system temp directory
							const tmpFile = vscode.Uri.file(
								`${context.globalStorageUri.fsPath}/prompt-${prompt.id}.md`
							)

							// Ensure the directory exists
							await vscode.workspace.fs.createDirectory(context.globalStorageUri)

							// Write initial content
							await vscode.workspace.fs.writeFile(tmpFile, Buffer.from(
								`// Prompt: ${prompt.name}
// ID: ${prompt.id}
// Edit the prompt below and save to update
// Lines starting with // are ignored

${prompt.prompt}`
							))

							const doc = await vscode.workspace.openTextDocument(tmpFile)
							const editor = await vscode.window.showTextDocument(doc, {
								preview: false,
								viewColumn: vscode.ViewColumn.Beside
							})

							// Add save handler
							const disposable = vscode.workspace.onDidSaveTextDocument(async (savedDoc) => {
								if (savedDoc.uri.toString() === tmpFile.toString()) {
									// Extract prompt content (ignore comment lines)
									const content = savedDoc.getText()
										.split('\n')
										.filter(line => !line.trim().startsWith('//'))
										.join('\n')
										.trim()

									// Update the prompt
									await modeManager.promptManager.updatePrompt(prompt.id, {
										...prompt,
										prompt: content
									})

									vscode.window.showInformationMessage(`Prompt "${prompt.name}" updated successfully`)
									
									// Clean up
									disposable.dispose()
									await vscode.workspace.fs.delete(tmpFile)
								}
							})

							// Also clean up if the editor is closed without saving
							const closeDisposable = vscode.workspace.onDidCloseTextDocument(async (closedDoc) => {
								if (closedDoc.uri.toString() === tmpFile.toString()) {
									closeDisposable.dispose()
									try {
										await vscode.workspace.fs.delete(tmpFile)
									} catch (e) {
										// File might already be deleted, ignore
									}
								}
							})
						}
					}
					break
				}

				case 'delete': {
					const prompts = modeManager.promptManager.getAllPrompts()
						.filter(p => p.id !== 'default')
					const selected = await vscode.window.showQuickPick<PromptSelectItem>(
						prompts.map(p => ({ label: p.name, id: p.id })),
						{ placeHolder: 'Select prompt to delete' }
					)
					if (selected) {
						await modeManager.promptManager.deletePrompt(selected.id)
					}
					break
				}
			}
		}),

		vscode.commands.registerCommand('vibeCoder.listMicrophoneDevices', async () => {
			try {
				const micWrapper = new MicrophoneWrapper()
				await micWrapper.listAvailableDevices()
			} catch (error) {
				vscode.window.showErrorMessage(
					`Failed to list microphone devices: ${error instanceof Error ? error.message : String(error)}`
				)
			}
		}),

		vscode.commands.registerCommand('vibeCoder.testMicrophone', async () => {
			try {
				vscode.window.withProgress({
					location: vscode.ProgressLocation.Notification,
					title: 'Testing microphone...',
					cancellable: false
				}, async (progress) => {
					const micWrapper = new MicrophoneWrapper()
					
					progress.report({ message: 'Recording test audio...' })
					
					try {
						await micWrapper.testMicrophone()
						vscode.window.showInformationMessage('Microphone test successful! Audio is being captured correctly.')
					} catch (error) {
						vscode.window.showErrorMessage(
							`Microphone test failed: ${error instanceof Error ? error.message : String(error)}`
						)
						
						// Check if this might be a device-related error
						const errorMessage = error instanceof Error ? error.message : String(error)
						if (errorMessage.includes('device') || errorMessage.includes('Device')) {
							vscode.window.showInformationMessage(
								'This might be a microphone device issue. Would you like to list available devices?',
								'List Devices'
							).then(selection => {
								if (selection === 'List Devices') {
									micWrapper.listAvailableDevices()
								}
							})
						}
					} finally {
						micWrapper.dispose()
					}
				})
			} catch (error) {
				vscode.window.showErrorMessage(
					`Failed to test microphone: ${error instanceof Error ? error.message : String(error)}`
				)
			}
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
