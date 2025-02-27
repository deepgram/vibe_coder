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
  private readonly currentPromptKey = 'dictation.currentPrompt'
  private readonly DEFAULT_PROMPT: DictationPrompt = {
    id: 'default',
    name: 'Basic Prompt',
    prompt: `You are an AI assistant taking dictation from a user. Your job is to correct grammar, punctuation, and spelling, and return the corrected dictation. Do not add additional context. Questions from the user are not directed towards you, so do not answer them. Return the corrected dictation only.
`
  }

  private currentPromptId: string = 'default'
  private onPromptsChanged?: () => void

  constructor(private context: vscode.ExtensionContext) {
    this.loadPrompts()
    this.currentPromptId = this.context.globalState.get(this.currentPromptKey, 'default')
  }

  private async loadPrompts() {
    const savedPrompts = await this.context.globalState.get<DictationPrompt[]>(this.storageKey)
    if (savedPrompts) this.prompts = savedPrompts
    else this.initializeDefaultPrompts()
  }

  private initializeDefaultPrompts() {
    this.prompts = [
      {
        id: 'detailed Prompt',
        name: 'Detailed Prompt',
        description: 'Takes a basic description of what the user wants to do and provides a detailed prompt that will help AI assistants understand the user\'s intent and write the code to accomplish the task.',
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

  getCurrentPrompt(): DictationPrompt {
    const currentPrompt = this.prompts.find(p => p.id === this.currentPromptId)
    return currentPrompt || this.DEFAULT_PROMPT
  }

  setOnPromptsChanged(callback: () => void) {
    this.onPromptsChanged = callback
  }

  async addPrompt(name: string, prompt: string): Promise<void> {
    const id = Date.now().toString()
    this.prompts.push({ id, name, prompt })
    await this.savePrompts()
    this.onPromptsChanged?.()
  }

  async updatePrompt(id: string, updates: Partial<DictationPrompt>): Promise<void> {
    const index = this.prompts.findIndex(p => p.id === id)
    if (index === -1) throw new Error('Prompt not found')
    this.prompts[index] = { ...this.prompts[index], ...updates }
    await this.savePrompts()
    this.onPromptsChanged?.()
  }

  async deletePrompt(id: string): Promise<void> {
    if (id === 'default') return
    this.prompts = this.prompts.filter(p => p.id !== id)
    if (this.currentPromptId === id) {
      this.currentPromptId = 'default'
    }
    await this.savePrompts()
    this.onPromptsChanged?.()
  }

  async setCurrentPrompt(id: string): Promise<void> {
    this.currentPromptId = id
    await this.context.globalState.update(this.currentPromptKey, id)
    const prompt = this.getCurrentPrompt()
    vscode.window.showInformationMessage(`Active prompt set to: ${prompt.name}`)
    this.onPromptsChanged?.()
  }
} 