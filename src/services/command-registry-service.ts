import * as vscode from 'vscode'

export type VSCodeCommandCategory = 
  | 'navigation'    
  | 'editing'       
  | 'view'          
  | 'workspace'     
  | 'debug'         
  | 'git'          

export interface CommandDefinition {
  name: string
  command: string
  category: VSCodeCommandCategory
  description: string
  args?: {
    name: string
    type: string
    description: string
    required: boolean
  }[]
}

export class CommandRegistryService {
  private commands: CommandDefinition[] = [
    {
      name: "Open File",
      command: "vscode.open",
      category: "navigation",
      description: "Opens a file in the editor",
      args: [{
        name: "path",
        type: "string",
        description: "Path to the file",
        required: true
      }]
    },
    {
      name: "Find in Files",
      command: "workbench.action.findInFiles",
      category: "navigation",
      description: "Search across all files",
      args: [{
        name: "query",
        type: "string",
        description: "Search term",
        required: true
      }]
    },
    {
      name: "Toggle Terminal",
      command: "workbench.action.terminal.toggleTerminal",
      category: "view",
      description: "Show or hide the terminal"
    },
    {
      name: "Split Editor",
      command: "workbench.action.splitEditor",
      category: "view",
      description: "Split the editor"
    },
    {
      name: "New File",
      command: "workbench.action.files.newUntitledFile",
      category: "workspace",
      description: "Create a new file"
    },
    {
      name: "New Folder",
      command: "workbench.action.files.newFolder",
      category: "workspace",
      description: "Create a new folder"
    },
    {
      name: "Save",
      command: "workbench.action.files.save",
      category: "workspace",
      description: "Save the current file"
    },
    {
      name: "Save All",
      command: "workbench.action.files.saveAll",
      category: "workspace",
      description: "Save all open files"
    },
    {
      name: "Go to File",
      command: "workbench.action.quickOpen",
      category: "navigation",
      description: "Quick open file by name"
    },
    {
      name: "Go to Line",
      command: "workbench.action.gotoLine",
      category: "navigation",
      description: "Go to a specific line number"
    },
    {
      name: "Split Editor Right",
      command: "workbench.action.splitEditorRight",
      category: "view",
      description: "Split the editor to the right"
    },
    {
      name: "Split Editor Down",
      command: "workbench.action.splitEditorDown",
      category: "view",
      description: "Split the editor down"
    },
    {
      name: "New Terminal",
      command: "workbench.action.terminal.new",
      category: "view",
      description: "Create a new terminal"
    },
    {
      name: "Show Source Control",
      command: "workbench.view.scm",
      category: "git",
      description: "Open the source control panel"
    }
  ]

  async executeCommand(name: string, args?: any[]): Promise<void> {
    console.log('Executing command:', name, 'with args:', args)
    
    // First try exact match
    let command = this.commands.find(c => c.name.toLowerCase() === name.toLowerCase())
    
    // If no exact match, try matching the command ID directly
    if (!command) {
      command = this.commands.find(c => c.command.toLowerCase() === name.toLowerCase())
    }
    
    // If still no match, try fuzzy matching
    if (!command) {
      command = this.commands.find(c => 
        c.command.toLowerCase().includes(name.toLowerCase()) ||
        name.toLowerCase().includes(c.command.toLowerCase())
      )
    }

    if (!command) {
      console.error('Available commands:', this.commands.map(c => ({name: c.name, command: c.command})))
      throw new Error(`Command "${name}" not found`)
    }

    try {
      console.log('Executing VS Code command:', command.command)
      
      // Special handling for vscode.open command
      if (command.command === 'vscode.open' && args?.[0]) {
        // Convert file path to VS Code URI
        const uri = vscode.Uri.file(args[0])
        await vscode.commands.executeCommand(command.command, uri)
      } else {
        await vscode.commands.executeCommand(command.command, ...(args || []))
      }
    } catch (error) {
      console.error(`Failed to execute command ${name}:`, error)
      throw new Error(`Failed to execute command "${name}": ${(error as Error).message}`)
    }
  }

  getCommandDefinitions(): CommandDefinition[] {
    return this.commands
  }
} 