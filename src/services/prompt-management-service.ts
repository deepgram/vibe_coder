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

  constructor(private context: vscode.ExtensionContext) {
    this.loadPrompts()
  }

  private async loadPrompts() {
    const savedPrompts = await this.context.globalState.get<DictationPrompt[]>(this.storageKey)
    if (savedPrompts) this.prompts = savedPrompts
    else this.initializeDefaultPrompts()
  }

  private initializeDefaultPrompts() {
    this.prompts = [{
      id: 'default-code',
      name: 'Code',
      description: 'Formats dictation as clean, well-documented code',
      prompt: 'Convert this natural language description into clean, well-documented code. Maintain proper formatting and include helpful comments.'
    }, {
      id: 'default-docs',
      name: 'Documentation',
      description: 'Formats dictation as technical documentation',
      prompt: 'Convert this natural language input into clear technical documentation using proper markdown formatting.'
    }]
    this.savePrompts()
  }

  private async savePrompts() {
    await this.context.globalState.update(this.storageKey, this.prompts)
  }

  getPromptById(id: string): DictationPrompt | undefined {
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