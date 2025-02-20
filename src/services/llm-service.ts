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

// Add new streaming interfaces
interface StreamProcessParams {
  text: string
  prompt: DictationPrompt
  onToken: (token: string) => void
}

interface StreamResponse extends LLMResponse {
  text: string
  error?: string
}

export class LLMService implements ILLMService {
  private client: OpenAIClient

  constructor(private context: vscode.ExtensionContext) {
    this.client = new OpenAIClient({
      apiKey: '',
      model: 'gpt-4o',
      baseUrl: 'https://api.openai.com/v1'
    })
  }

  // Add new streaming method
  async streamProcessText(params: StreamProcessParams): Promise<StreamResponse> {
    try {
      const apiKey = await this.getApiKey()
      this.client.updateApiKey(apiKey)

      const messages = [
        { role: 'system', content: params.prompt.prompt },
        { role: 'user', content: params.text }
      ]

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4-turbo-preview',
          messages,
          stream: true
        })
      })

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('Failed to get response reader')

      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        // Parse the SSE data
        const chunk = new TextDecoder().decode(value)
        const lines = chunk.split('\n')
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue

            try {
              const json = JSON.parse(data)
              const token = json.choices[0]?.delta?.content || ''
              if (token) {
                fullText += token
                params.onToken(token)
              }
            } catch (e) {
              console.error('Failed to parse streaming response:', e)
            }
          }
        }
      }

      return { text: fullText }
    } catch (error) {
      console.error('Stream processing error:', error)
      if ((error as Error).message.includes('API key')) {
        await this.context.secrets.delete('openai.apiKey')
      }
      return { 
        text: '',
        error: `Failed to process text: ${(error as Error).message}`
      }
    }
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