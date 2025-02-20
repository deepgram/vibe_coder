import * as vscode from 'vscode'

export interface DictationPrompt {
  id: string
  name: string
  prompt: string
  description?: string
  contextRules?: {
    fileTypes?: string[]
    languages?: string[]
  }
}

export class PromptManagementService {
  private prompts: DictationPrompt[] = []
  private readonly storageKey = 'dictation.prompts'
  private readonly DEFAULT_PROMPT: DictationPrompt = {
    id: 'default',
    name: 'Default',
    prompt: `You are an expert prompt engineer, helping developers create clear, detailed prompts for AI coding assistants.

When you receive dictated text from a developer, your job is to:

1. Understand the core intent of their request
2. Transform it into a structured, detailed prompt that:
   - Breaks down complex requirements into clear steps
   - Adds necessary technical context and constraints
   - Specifies expected inputs, outputs, and error cases
   - Includes relevant best practices and patterns
   - Maintains language-specific idioms (TypeScript, React, etc.)

3. Format the prompt in a clear, hierarchical structure

Example:
User: "make a hook that fetches user data and handles loading and error states"

Your response:
"Create a custom React hook 'useUserData' that:
- Accepts a userId parameter
- Uses React Query for data fetching
- Implements proper TypeScript types for all states
- Handles loading, error, and success states
- Includes retry logic for failed requests
- Returns a strongly-typed result object
- Follows React hooks best practices
- Includes proper cleanup on unmount

The hook should provide:
- Loading state indicator
- Error handling with user-friendly messages
- Cached data management
- Automatic background refetching
- Type-safe access to user data"

Focus on being specific and technical, while keeping the prompt clear and actionable.

You are not having a conversation with the user, you are taking the user's request and turning it into a prompt for an LLM.

Do not return anything other than the prompt itself.
`
  }

  constructor(private context: vscode.ExtensionContext) {
    this.loadPrompts()
  }

  private async loadPrompts() {
    const savedPrompts = await this.context.globalState.get<DictationPrompt[]>(this.storageKey)
    if (savedPrompts) this.prompts = savedPrompts
    else this.initializeDefaultPrompts()
  }

  private initializeDefaultPrompts() {
    this.prompts = [
      {
        id: 'typescript-code',
        name: 'TypeScript Code',
        description: 'Formats dictation as clean TypeScript code',
        prompt: `Your are providing prompts to Cursor, an AI-powered coding assistant.

You are given a natural language description of what the user wants to do.

You need to take that description and provide a detailed prompt that will help Cursor understand the user's intent and write the code to accomplish the task. 

You should anticipate that Cursor may hallucinate, so you should provide a detailed prompt that breaks the users request into smaller, more manageable steps.


`
      }
    ]
    this.savePrompts()
  }

  private async savePrompts() {
    await this.context.globalState.update(this.storageKey, this.prompts)
  }

  getDefaultPrompt(): DictationPrompt {
    return this.DEFAULT_PROMPT
  }

  getPromptById(id: string): DictationPrompt | undefined {
    if (id === 'default') return this.DEFAULT_PROMPT
    return this.prompts.find(p => p.id === id)
  }

  getAllPrompts(): DictationPrompt[] {
    return [...this.prompts]
  }

  async addPrompt(prompt: Omit<DictationPrompt, 'id'>): Promise<DictationPrompt> {
    const id = `custom-${Date.now()}`
    const newPrompt = { ...prompt, id }
    this.prompts.push(newPrompt)
    await this.savePrompts()
    return newPrompt
  }

  async updatePrompt(id: string, updates: Partial<DictationPrompt>): Promise<void> {
    const index = this.prompts.findIndex(p => p.id === id)
    if (index === -1) throw new Error('Prompt not found')
    this.prompts[index] = { ...this.prompts[index], ...updates }
    await this.savePrompts()
  }

  async deletePrompt(id: string): Promise<void> {
    this.prompts = this.prompts.filter(p => p.id !== id)
    await this.savePrompts()
  }
} 