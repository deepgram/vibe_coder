import * as vscode from 'vscode'
import * as path from 'path'

export interface FileTreeNode {
  name: string
  type: 'file' | 'directory'
  path: string
  children?: FileTreeNode[]
}

export class WorkspaceService {
  // Add an array of directories to ignore
  private readonly ignoredDirectories = [
    'node_modules',
    'venv',
    '.venv',
    'env',
    '.env',
    'dist',
    'build',
    '.git',
    '.github',
    '.idea',
    '.vscode',
    '__pycache__',
    'coverage',
    '.next',
    '.nuxt',
    'out',
    'target',
    'vendor',
    'tmp',
    'temp',
    '.DS_Store'
  ]

  async getFileTree(): Promise<vscode.Uri[]> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]
    if (!workspaceRoot) return []

    const pattern = new vscode.RelativePattern(workspaceRoot, '**/*')
    const files = await vscode.workspace.findFiles(pattern)

    // Filter out files from ignored directories
    return files.filter(file => {
      const relativePath = vscode.workspace.asRelativePath(file)
      return !this.ignoredDirectories.some(dir => 
        relativePath.startsWith(dir + '/') || relativePath === dir
      )
    })
  }

  formatFileTree(files: vscode.Uri[]): string {
    if (!files.length) return 'No files found'

    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]
    if (!workspaceRoot) return 'No workspace root found'

    // Create a tree structure
    const tree: { [key: string]: any } = {}
    
    files.forEach(file => {
      const relativePath = vscode.workspace.asRelativePath(file)
      const parts = relativePath.split('/')
      let current = tree
      
      parts.forEach((part, i) => {
        if (i === parts.length - 1) {
          current[part] = null // leaf node
        } else {
          current[part] = current[part] || {}
          current = current[part]
        }
      })
    })

    // Format the tree as a string
    const formatNode = (node: any, prefix = ''): string => {
      if (!node) return ''
      
      return Object.entries(node).map(([name, children]) => {
        if (children === null) {
          return `${prefix}${name}`
        }
        return `${prefix}${name}/\n${formatNode(children, prefix + '  ')}`
      }).join('\n')
    }

    return formatNode(tree)
  }
} 