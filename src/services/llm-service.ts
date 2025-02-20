import * as vscode from 'vscode'
import { env } from 'vscode'
import { DictationPrompt } from './prompt-management-service'

interface LLMConfig {
  apiKey: string
  model: string
  baseUrl: string
}

interface LLMResponse {
  text: string
  error?: string
}

interface LLMClient {
  complete(messages: Array<{ role: string, content: string }>): Promise<string>
}

export interface ILLMService {
  processText(params: { text: string, prompt: DictationPrompt }): Promise<LLMResponse>
}

// OpenAI implementation of LLMClient
class OpenAIClient implements LLMClient {
  constructor(private config: LLMConfig) {}

  updateApiKey(apiKey: string) {
    this.config = { ...this.config, apiKey }
  }

  async complete(messages: Array<{ role: string, content: string }>): Promise<string> {
    const response = await fetch(`${this.config.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify({
        model: this.config.model,
        messages
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`LLM API error: ${error}`)
    }

    const data = await response.json()
    return data.choices[0].message.content
  }
}

export class LLMService implements ILLMService {
  private client: LLMClient

  constructor(
    private context: vscode.ExtensionContext,
    client?: LLMClient
  ) {
    this.client = client || new OpenAIClient({
      apiKey: '',  // Will be updated before each request
      model: 'gpt-4o',
      baseUrl: 'https://api.openai.com'
    })
  }

  async processText({ text, prompt }: { 
    text: string, 
    prompt: DictationPrompt 
  }): Promise<LLMResponse> {
    try {
      const apiKey = await this.getApiKey()
      
      // Update client config with API key
      if (this.client instanceof OpenAIClient) {
        this.client.updateApiKey(apiKey)
      }
      
      const result = await this.client.complete([
        { role: 'system', content: prompt.prompt },
        { role: 'user', content: text }
      ])

      return { text: result }
    } catch (error) {
      if ((error as Error).message.includes('API key')) {
        // If API key error, clear the stored key so it will be requested again
        await this.context.secrets.delete('openai.apiKey')
      }
      return { 
        text: text,
        error: `Failed to process text: ${(error as Error).message}`
      }
    }
  }

  private async getApiKey(): Promise<string> {
    const apiKey = await this.context.secrets.get('openai.apiKey')
    if (!apiKey) {
      const key = await vscode.window.showInputBox({
        prompt: 'Enter your OpenAI API key',
        password: true,
        placeHolder: 'sk-...',
        ignoreFocusOut: true, // Keep the input box open when focus is lost
        validateInput: (value) => {
          if (!value) return 'API key is required'
          if (!value.startsWith('sk-')) return 'Invalid API key format'
          return null
        }
      })
      if (!key) throw new Error('OpenAI API key is required')
      await this.context.secrets.store('openai.apiKey', key)
      return key
    }
    return apiKey
  }
} 