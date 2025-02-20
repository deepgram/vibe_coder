import * as vscode from 'vscode'
import * as path from 'path'

export interface FileTreeNode {
  name: string
  type: 'file' | 'directory'
  path: string
  children?: FileTreeNode[]
}

export class WorkspaceService {
  async getFileTree(): Promise<FileTreeNode[]> {
    const workspaceFolders = vscode.workspace.workspaceFolders

    if (!workspaceFolders) return []

    const trees = await Promise.all(
      workspaceFolders.map(folder => this.buildFileTree(folder.uri))
    )

    return trees
  }

  private async buildFileTree(uri: vscode.Uri): Promise<FileTreeNode> {
    const stat = await vscode.workspace.fs.stat(uri)
    const name = path.basename(uri.fsPath)
    const relativePath = vscode.workspace.asRelativePath(uri.fsPath)

    if (stat.type === vscode.FileType.File) {
      return {
        name,
        type: 'file',
        path: relativePath
      }
    }

    const entries = await vscode.workspace.fs.readDirectory(uri)
    const children = await Promise.all(
      entries
        .filter(([name]) => !name.startsWith('.')) // Skip hidden files
        .map(async ([name]) => {
          const childUri = vscode.Uri.joinPath(uri, name)
          return this.buildFileTree(childUri)
        })
    )

    return {
      name,
      type: 'directory',
      path: relativePath,
      children
    }
  }

  formatFileTree(tree: FileTreeNode[], indent = ''): string {
    return tree.map(node => {
      if (node.type === 'file') 
        return `${indent}📄 ${node.path}`
      
      return [
        `${indent}📁 ${node.path}`,
        ...(node.children || []).map(child => 
          this.formatFileTree([child], `${indent}  `)
        )
      ].join('\n')
    }).join('\n')
  }
} 