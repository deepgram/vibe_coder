# Contributing to Vibe Coder

Thank you for your interest in contributing to Vibe Coder! This guide will help you get started with contributing to the project.

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct. Please be respectful and considerate of others when participating in discussions, submitting issues, or contributing code.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** to your local machine
3. **Create a new branch** for your feature or bugfix
4. **Make your changes** following our coding standards
5. **Test your changes** thoroughly
6. **Commit your changes** with clear, descriptive commit messages
7. **Push your branch** to your fork on GitHub
8. **Submit a pull request** to the main repository

## Reporting Issues

When reporting issues, please include:

- A clear and descriptive title
- A detailed description of the issue
- Steps to reproduce the problem
- Expected behavior
- Actual behavior
- Screenshots or error logs if applicable
- Your environment details (OS, VS Code version, etc.)

Use the issue templates provided in the repository when available.

## Pull Request Process

1. Ensure your code follows the project's coding standards
2. Update documentation as necessary
3. Include tests for new features or bug fixes
4. Link any relevant issues in your pull request description
5. Wait for a maintainer to review your pull request
6. Address any feedback from code reviews
7. Once approved, a maintainer will merge your pull request

## Development Setup

To set up the development environment:

```bash
# Clone the repository
git clone https://github.com/yourusername/vibe-coder.git
cd vibe-coder

# Install dependencies
npm install

# Compile and watch for changes
npm run watch
```

To test the extension in VS Code:
1. Press F5 to open a new window with your extension loaded
2. Run your commands from the command palette by pressing (Ctrl+Shift+P or Cmd+Shift+P on Mac)
3. Set breakpoints in your code for debugging

## Coding Standards

- Use TypeScript for all code
- Follow the existing code style and formatting
- Write descriptive variable and function names
- Include JSDoc comments for public APIs
- Write unit tests for new functionality
- Ensure your code passes linting (`npm run lint`)

## Working with Deepgram API

When working with the Deepgram API:
- Never commit API keys to the repository
- Use the extension's secret storage for API keys
- Test your changes with your own Deepgram API key

## Documentation

- Update the README.md with details of changes to the interface
- Update any relevant documentation in the `/docs` directory
- Include code examples for new features

## Release Process

The maintainers will handle the release process, which includes:
1. Updating the version number
2. Creating release notes
3. Publishing to the VS Code Marketplace

## Questions?

If you have any questions about contributing, please open an issue with the "question" label or reach out to the maintainers.

Thank you for contributing to Vibe Coder! 