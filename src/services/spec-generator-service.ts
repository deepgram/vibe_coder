import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'
import { LLMService } from './llm-service'
import { ConversationLoggerService } from './conversation-logger-service'

export class SpecGeneratorService {
  constructor(
    private llmService: LLMService,
    private conversationLogger: ConversationLoggerService
  ) {}

  async generateSpec(): Promise<void> {
    console.log('SpecGenerator: Starting spec generation')
    try {
      const conversation = this.conversationLogger.getLatestSession()
      console.log('SpecGenerator: Got conversation entries:', conversation.length)
      console.log('SpecGenerator: Log directory:', this.conversationLogger.logDir)
      console.log('SpecGenerator: Current session ID:', this.conversationLogger.currentSessionId)
      
      if (!conversation.length) {
        console.log('SpecGenerator: No conversation found')
        throw new Error('No conversation found to generate spec from')
      }

      console.log('SpecGenerator: First few conversation entries:', conversation.slice(0, 3))

      const prompt = `
        Based on the following conversation, create a clear and structured project specification in markdown format.
        Include these sections:
        - Project Overview
        - Requirements
        - Technical Architecture
        - Implementation Details
        - Next Steps

        Format the output as clean markdown with proper headers and bullet points.
        
        Conversation:
        ${conversation.map(entry => `${entry.role}: ${entry.content}`).join('\n')}
      `

      const response = await this.llmService.streamProcessText({
        text: prompt,
        prompt: {
          id: 'spec-generator',
          name: 'Spec Generator',
          prompt: 'Generate a project specification'
        },
        onToken: () => {}
      })

      if (response.error) throw new Error(response.error)

      const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
      if (!workspaceFolder) throw new Error('No workspace folder found')

      const specUri = vscode.Uri.joinPath(workspaceFolder.uri, 'project_spec.md')
      
      // Use VS Code's filesystem API
      await vscode.workspace.fs.writeFile(
        specUri,
        Buffer.from(response.text, 'utf8')
      )

      // Use "vscode.open" command so it's consistent with other commands
      await vscode.commands.executeCommand('vscode.open', specUri)

      return
    } catch (error) {
      console.error('SpecGenerator: Error during spec generation:', error)
      throw error // Re-throw to maintain error handling chain
    }
  }
} 