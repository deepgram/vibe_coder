import * as assert from 'assert'
import { LLMService } from '../services/llm-service'
import { DictationPrompt } from '../services/prompt-management-service'

// Mock LLM client for testing
class MockLLMClient {
  constructor(
    private mockResponse: string,
    private shouldThrow = false
  ) {}

  async complete(messages: Array<{ role: string, content: string }>): Promise<string> {
    if (this.shouldThrow) throw new Error('API Error')
    // Validate messages format
    if (!messages.length) throw new Error('No messages provided')
    if (!messages[0].role || !messages[0].content) throw new Error('Invalid message format')
    return this.mockResponse
  }
}

// Mock VS Code extension context with different scenarios
const createMockContext = (apiKey?: string) => ({
  secrets: {
    get: async () => apiKey,
    store: async (key: string, value: string) => {}
  }
})

suite('LLM Service Test Suite', () => {
  const mockPrompt: DictationPrompt = {
    id: 'test',
    name: 'Test Prompt',
    prompt: 'Test system prompt'
  }

  test('Successfully processes text with existing API key', async () => {
    const expectedResponse = 'Processed text'
    const mockClient = new MockLLMClient(expectedResponse)
    const context = createMockContext('existing-api-key')
    const service = new LLMService(context as any, mockClient as any)

    const result = await service.processText({ 
      text: 'Test input', 
      prompt: mockPrompt 
    })

    assert.strictEqual(result.text, expectedResponse)
    assert.strictEqual(result.error, undefined)
  })

  test('Handles API errors gracefully', async () => {
    const mockClient = new MockLLMClient('', true)
    const context = createMockContext('test-api-key')
    const service = new LLMService(context as any, mockClient as any)

    const result = await service.processText({ 
      text: 'Test input', 
      prompt: mockPrompt 
    })

    assert.strictEqual(result.text, 'Test input')
    assert.strictEqual(result.error, 'Failed to process text: API Error')
  })

  test('Validates message format', async () => {
    const mockClient = new MockLLMClient('Response')
    const context = createMockContext('test-api-key')
    const service = new LLMService(context as any, mockClient as any)

    const result = await service.processText({ 
      text: '', // Empty text should still work
      prompt: mockPrompt 
    })

    assert.strictEqual(result.text, 'Response')
    assert.strictEqual(result.error, undefined)
  })

  test('Uses default client when none provided', async () => {
    const context = createMockContext('test-api-key')
    const service = new LLMService(context as any)

    assert.doesNotThrow(() => {
      // Service should initialize with default OpenAI client
      assert.ok(service)
    })
  })
}) 