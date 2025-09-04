# MCP Odoo Model Explorer

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Odoo](https://img.shields.io/badge/Odoo-Compatible-purple)](https://www.odoo.com/)

A Model Context Protocol (MCP) server that provides AI assistants with tools to explore and analyze Odoo models, fields, relationships, and methods. Connect to any Odoo instance to inspect database structure, search models, fetch sample records, and discover related entities for ERP development.

## Table of Contents

- [Features](#-features)
- [Usage](#️-usage)
  - [With Claude Code (CLI)](#with-claude-code-cli)
  - [With Claude Desktop](#with-claude-desktop)
  - [With VS Code + MCP Extension](#with-vs-code--mcp-extension)
- [Available Tools](#-available-tools)
- [Development](#️-development)
- [Contributing](#-contributing)
- [License](#-license)
- [Resources](#-resources)

## 🚀 Features

- **📋 List Models**: Get all Odoo models in your database with descriptions
- **🔍 Model Fields**: Inspect field properties, types, relationships, and constraints
- **📊 Sample Records**: Fetch sample data from any model with custom field selection
- **🔗 Related Models**: Discover model relationships via many2one, one2many, many2many fields
- **🧩 Model Methods**: Search Odoo GitHub source for model methods and implementations
- **🔎 Advanced Search**: Filter models with domain queries and custom criteria

## 🛠️ Usage

First, configure access to GitHub Packages:

```bash
npm config set @yourit:registry https://npm.pkg.github.com
```

### With Claude Code (CLI)

```bash
claude mcp add-json mcp-odoo-model-explorer '{
  "command": "npx",
  "args": ["@yourit/mcp-odoo-model-explorer"],
  "env": {
    "ODOO_URL": "${ODOO_URL}",
    "ODOO_DB": "${ODOO_DB}",
    "ODOO_USER": "${ODOO_USER}",
    "ODOO_PASSWORD": "${ODOO_PASSWORD}",
    "GITHUB_TOKEN": "${GITHUB_TOKEN}"
  }
}'
```

### With Claude Desktop

Add to your Claude Desktop configuration (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "odoo-model-explorer": {
      "command": "npx",
      "args": ["@yourit/mcp-odoo-model-explorer"],
      "env": {
        "ODOO_URL": "${ODOO_URL}",
        "ODOO_DB": "${ODOO_DB}",
        "ODOO_USER": "${ODOO_USER}",
        "ODOO_PASSWORD": "${ODOO_PASSWORD}",
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```

### With VS Code + MCP Extension

Add to your `.vscode/mcp.json`:

```json
{
  "servers": {
    "odoo-model-explorer": {
      "type": "stdio",
      "command": "npx",
      "args": ["@yourit/mcp-odoo-model-explorer"],
      "env": {
        "ODOO_URL": "${input:odoo-url}",
        "ODOO_DB": "${input:odoo-db}",
        "ODOO_USER": "${input:odoo-user}",
        "ODOO_PASSWORD": "${input:odoo-password}",
        "GITHUB_TOKEN": "${input:github-token}"
      }
    }
  }
}
```

## 🔧 Available Tools

| Tool                 | Description                             | Parameters                                    |
| -------------------- | --------------------------------------- | --------------------------------------------- |
| `list-odoo-models`   | List all models in database             | None                                          |
| `get-model-fields`   | Get field details for a model           | `model`                                       |
| `get-model-records`  | Fetch sample records                    | `model`, `limit`, `fields?`                   |
| `search-model`       | Search models with domain filters       | `domain`, `limit`, `fields?`                  |
| `search-records`     | Search records in a model               | `model`, `domain?`, `fields?`, `limit?`, `offset?`, `order?` |
| `count-records`      | Count records matching domain filter    | `model`, `domain?`                            |
| `get-record`         | Fetch a specific record by ID           | `model`, `record_id`, `fields?`               |
| `get-related-models` | Find related models                     | `model`                                       |
| `get-model-methods`  | Find model methods in Odoo source       | `model`, `branch?`                            |

## 🛠️ Development

```bash
pnpm install    # Install dependencies
pnpm dev        # Development mode
pnpm build      # Build for production
pnpm start      # Run built version
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🔗 Resources

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Odoo Documentation](https://www.odoo.com/documentation/)
- [Issues & Support](https://github.com/yourit/mcp-odoo-model-explorer/issues)
