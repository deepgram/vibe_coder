import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'

interface ConversationEntry {
  timestamp: number
  role: 'user' | 'assistant'
  content: string
  sessionId: string
}

export class ConversationLoggerService {
  // Make these accessible for debugging
  public get logDir(): string {
    return this._logDir
  }

  public get currentSessionId(): string {
    return this._currentSessionId
  }

  private _logDir: string
  private _currentSessionId: string

  constructor(private context: vscode.ExtensionContext) {
    this._currentSessionId = new Date().toISOString().replace(/[:.]/g, '-')
    this._logDir = path.join(context.globalStorageUri.fsPath, 'conversations')
    if (!fs.existsSync(this._logDir)) fs.mkdirSync(this._logDir, { recursive: true })
    console.log('ConversationLogger: Initialized with directory:', this._logDir)
  }

  logEntry({ role, content }: { role: 'user' | 'assistant', content: string }) {
    console.log('ConversationLogger: Logging entry:', { role, content })
    console.log('ConversationLogger: Current session ID:', this._currentSessionId)
    
    const entry: ConversationEntry = {
      timestamp: Date.now(),
      role,
      content,
      sessionId: this._currentSessionId
    }

    const logFile = path.join(this._logDir, `${this._currentSessionId}.json`)
    console.log('ConversationLogger: Writing to log file:', logFile)
    
    let entries: ConversationEntry[] = []
    if (fs.existsSync(logFile)) {
      entries = JSON.parse(fs.readFileSync(logFile, 'utf8'))
      console.log('ConversationLogger: Existing entries:', entries.length)
    }
    
    entries.push(entry)
    fs.writeFileSync(logFile, JSON.stringify(entries, null, 2))
    console.log('ConversationLogger: Successfully wrote entry')
  }

  getLatestSession(): ConversationEntry[] {
    const logFile = path.join(this._logDir, `${this._currentSessionId}.json`)
    console.log('ConversationLogger: Getting latest session from:', logFile)
    console.log('ConversationLogger: Current session ID:', this._currentSessionId)
    
    if (!fs.existsSync(logFile)) {
      console.log('ConversationLogger: No log file found')
      return []
    }
    
    const entries = JSON.parse(fs.readFileSync(logFile, 'utf8'))
    console.log('ConversationLogger: Found entries:', entries.length)
    return entries
  }
} 