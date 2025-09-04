#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import 'dotenv/config';
import { z } from 'zod';

console.error(`${Date.now()} - MCP Odoo server main entry being loaded`);

// Odoo JSON-RPC config (edit as needed)
const ODOO_URL = process.env.ODOO_URL || 'http://localhost:8069/jsonrpc';
const ODOO_DB = process.env.ODOO_DB || 'your_db';
const ODOO_USER = process.env.ODOO_USER || 'admin';
const ODOO_PASSWORD = process.env.ODOO_PASSWORD || 'admin';

async function odooJsonRpc(method: string, params: any) {
  const body = {
    jsonrpc: '2.0',
    method: 'call',
    params,
    id: Math.floor(Math.random() * 100000)
  };
  const res = await fetch(ODOO_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const json = await res.json();
  if (json.error) {
    console.error(`${Date.now()} - Odoo JSON-RPC error: ${JSON.stringify(json.error)}`);
    throw new Error(JSON.stringify(json.error));
  }
  console.error(`${Date.now()} - Odoo JSON-RPC response: ${JSON.stringify(json)}`);
  return json.result;
}

// Session cache for Odoo uid
let odooSessionUid: number | null = null;

async function getOdooUid() {
  if (odooSessionUid !== null) return odooSessionUid;
  const uid = await odooJsonRpc('call', {
    service: 'common',
    method: 'login',
    args: [ODOO_DB, ODOO_USER, ODOO_PASSWORD]
  });
  odooSessionUid = uid;
  console.error(`${Date.now()} - Odoo session uid: ${odooSessionUid} (user: ${ODOO_USER})`);
  return uid;
}

const server = new McpServer({
  name: 'odoo-model-explorer',
  version: '1.0.0',
  capabilities: { tools: {}, resources: {} }
});

server.tool(
  'list-odoo-models',
  'List all Odoo models in the configured database.',
  {},
  async () => {
    const uid = await getOdooUid();
    // List models
    const models = await odooJsonRpc('call', {
      service: 'object',
      method: 'execute_kw',
      args: [
        ODOO_DB,
        uid,
        ODOO_PASSWORD,
        'ir.model',
        'search_read',
        [],
        { fields: ['model', 'name'] }
      ]
    });
    return {
      content: [
        {
          type: 'text',
          text: models.map((m: any) => `${m.model}: ${m.name}`).join('\n')
        }
      ]
    };
  }
);

server.tool(
  'get-model-fields',
  'Get all fields and their properties for a given Odoo model.',
  {
    model: z.string().describe('Technical name of the Odoo model (e.g. res.partner)')
  },
  async ({ model }) => {
    const uid = await getOdooUid();
    const fields = await odooJsonRpc('call', {
      service: 'object',
      method: 'execute_kw',
      args: [
        ODOO_DB,
        uid,
        ODOO_PASSWORD,
        model,
        'fields_get',
        [],
        {
          attributes: ['string', 'type', 'required', 'readonly', 'help', 'relation']
        }
      ]
    });
    return {
      content: [
        {
          type: 'text',
          text: Object.entries(fields)
            .map(
              ([name, f]: [string, any]) =>
                `${name}: ${f.string} (${f.type})${
                  f.required ? ' [required]' : ''
                }${f.relation ? ` → ${f.relation}` : ''}${f.help ? `\n  help: ${f.help}` : ''}`
            )
            .join('\n')
        }
      ]
    };
  }
);

server.tool(
  'get-model-records',
  'Get a sample of records for a given Odoo model.',
  {
    model: z.string().describe('Technical name of the Odoo model (e.g. res.partner)'),
    limit: z.number().describe('Number of records to return'),
    fields: z.array(z.string()).optional().describe('List of fields to fetch (optional)')
  },
  async ({ model, limit, fields }) => {
    const uid = await getOdooUid();
    const records = await odooJsonRpc('call', {
      service: 'object',
      method: 'execute_kw',
      args: [
        ODOO_DB,
        uid,
        ODOO_PASSWORD,
        model,
        'search_read',
        [],
        { fields: fields || undefined, limit: limit || 5 }
      ]
    });
    return {
      content: [
        {
          type: 'text',
          text: records.map((rec: any) => JSON.stringify(rec)).join('\n')
        }
      ]
    };
  }
);

server.tool(
  'search-model',
  'Search Odoo models (ir.model) with a domain filter and return matching model records.',
  {
    domain: z
      .array(z.array(z.string()))
      .describe(
        'Odoo domain filter for ir.model (e.g. [["model", "=", "res.partner"]] or [["state", "ilike", "manual"]])'
      ),
    limit: z.coerce.number().describe('Number of model records to return'),
    fields: z
      .array(z.string())
      .optional()
      .describe('List of ir.model fields to fetch (optional, e.g. ["model", "name", "state"])')
  },
  async ({ domain, limit, fields }) => {
    const uid = await getOdooUid();
    const irModelFields = [
      'id',
      'model',
      'name',
      'state',
      'abstract',
      'transient',
      'modules',
      'info',
      'count',
      'create_date',
      'write_date',
      'display_name'
    ];
    const records = await odooJsonRpc('call', {
      service: 'object',
      method: 'execute_kw',
      args: [
        ODOO_DB,
        uid,
        ODOO_PASSWORD,
        'ir.model',
        'search_read',
        domain || [],
        {
          fields: fields && fields.length ? fields : irModelFields,
          limit: limit || 5
        }
      ]
    });
    return {
      content: [
        {
          type: 'text',
          text: records.map((rec: any) => JSON.stringify(rec)).join('\n')
        }
      ]
    };
  }
);

server.tool(
  'search-records',
  'Search for records in a given Odoo model with domain filters. Can fetch single or multiple records.',
  {
    model: z.string().describe('Technical name of the Odoo model (e.g. res.partner)'),
    domain: z
      .array(z.union([z.array(z.union([z.string(), z.number(), z.boolean()])), z.string()]))
      .optional()
      .describe('Odoo domain filter (e.g. [["name", "ilike", "John"], ["active", "=", true]] or empty for all records)'),
    fields: z.array(z.string()).optional().describe('List of fields to fetch (optional)'),
    limit: z.number().optional().describe('Number of records to return (default: 10)'),
    offset: z.number().optional().describe('Number of records to skip (default: 0)'),
    order: z.string().optional().describe('Sort order (e.g. "name ASC" or "create_date DESC")')
  },
  async ({ model, domain, fields, limit, offset, order }) => {
    try {
      const uid = await getOdooUid();
      const searchParams: any = {};
      
      if (fields && fields.length) {
        searchParams.fields = fields;
      }
      if (limit !== undefined) {
        searchParams.limit = Math.max(1, Math.min(1000, limit)); // Limit between 1 and 1000
      } else {
        searchParams.limit = 10;
      }
      if (offset !== undefined) {
        searchParams.offset = Math.max(0, offset); // Ensure non-negative offset
      }
      if (order) {
        searchParams.order = order;
      }

      const records = await odooJsonRpc('call', {
        service: 'object',
        method: 'execute_kw',
        args: [
          ODOO_DB,
          uid,
          ODOO_PASSWORD,
          model,
          'search_read',
          domain || [],
          searchParams
        ]
      });

      const resultText = records.length > 0 
        ? records.map((rec: any) => JSON.stringify(rec, null, 2)).join('\n---\n')
        : 'No records found matching the criteria.';

      return {
        content: [
          {
            type: 'text',
            text: `Found ${records.length} record(s):\n\n${resultText}`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error searching records in ${model}: ${error}`
          }
        ]
      };
    }
  }
);

server.tool(
  'count-records',
  'Count the number of records matching a domain filter in a given Odoo model.',
  {
    model: z.string().describe('Technical name of the Odoo model (e.g. res.partner)'),
    domain: z
      .array(z.union([z.array(z.union([z.string(), z.number(), z.boolean()])), z.string()]))
      .optional()
      .describe('Odoo domain filter (e.g. [["name", "ilike", "John"], ["active", "=", true]] or empty for all records)')
  },
  async ({ model, domain }) => {
    try {
      const uid = await getOdooUid();
      
      const count = await odooJsonRpc('call', {
        service: 'object',
        method: 'execute_kw',
        args: [
          ODOO_DB,
          uid,
          ODOO_PASSWORD,
          model,
          'search_count',
          domain || []
        ]
      });

      return {
        content: [
          {
            type: 'text',
            text: `Found ${count} record(s) in ${model}${domain && domain.length ? ' matching the domain filter' : ''}.`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error counting records in ${model}: ${error}`
          }
        ]
      };
    }
  }
);

server.tool(
  'get-record',
  'Fetch a specific record by ID from a given Odoo model.',
  {
    model: z.string().describe('Technical name of the Odoo model (e.g. res.partner)'),
    record_id: z.number().describe('ID of the record to fetch'),
    fields: z.array(z.string()).optional().describe('List of fields to fetch (optional, fetches all if not specified)')
  },
  async ({ model, record_id, fields }) => {
    const uid = await getOdooUid();
    const searchParams: any = {};
    
    if (fields && fields.length) {
      searchParams.fields = fields;
    }

    try {
      const records = await odooJsonRpc('call', {
        service: 'object',
        method: 'execute_kw',
        args: [
          ODOO_DB,
          uid,
          ODOO_PASSWORD,
          model,
          'read',
          [record_id],
          searchParams
        ]
      });

      if (records.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `No record found with ID ${record_id} in model ${model}`
            }
          ]
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(records[0], null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error fetching record ${record_id} from ${model}: ${error}`
          }
        ]
      };
    }
  }
);

server.tool(
  'get-related-models',
  'List all related models for a given Odoo model (via many2one, one2many, many2many fields).',
  {
    model: z.string().describe('Technical name of the Odoo model (e.g. res.partner)')
  },
  async ({ model }) => {
    const uid = await getOdooUid();
    const fields = await odooJsonRpc('call', {
      service: 'object',
      method: 'execute_kw',
      args: [
        ODOO_DB,
        uid,
        ODOO_PASSWORD,
        model,
        'fields_get',
        [],
        { attributes: ['string', 'type', 'relation'] }
      ]
    });
    const related = Object.entries(fields)
      .filter(
        ([, f]: [string, any]) =>
          ['many2one', 'one2many', 'many2many'].includes(f.type) && f.relation
      )
      .map(([name, f]: [string, any]) => `${name}: ${f.type} → ${f.relation}`);
    return {
      content: [
        {
          type: 'text',
          text: related.length ? related.join('\n') : 'No related models found.'
        }
      ]
    };
  }
);

server.tool(
  'get-model-methods',
  'List all public and private methods for a given Odoo model by searching the Odoo GitHub source.',
  {
    model: z.string().describe('Technical name of the Odoo model (e.g. res.partner)'),
    branch: z.string().optional().describe('Odoo branch to use (default: 18.0)')
  },
  async ({ model, branch }) => {
    // Map model name to Python class name (e.g. res.partner -> ResPartner)
    function modelToClassName(model: string) {
      return model
        .split('.')
        .map((part) =>
          part
            .split('_')
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join('')
        )
        .join('');
    }
    const className = modelToClassName(model);
    const odooBranch = branch || '18.0';
    // Step 1: Search for files containing the class definition using GitHub code search API
    const searchUrl = `https://api.github.com/search/code?q=repo:odoo/odoo+class+${className}+language:python`;
    let searchResults;
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (process.env.GITHUB_TOKEN) {
        headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
      }
      const resp = await fetch(searchUrl, { headers });
      if (!resp.ok) throw new Error(`GitHub search failed: ${resp.status} - ${await resp.text()}`);
      searchResults = await resp.json();
    } catch (e) {
      return {
        content: [
          {
            type: 'text',
            text: `Could not search for class ${className} in Odoo repo: ${e}`
          }
        ]
      };
    }
    if (!searchResults.items || !searchResults.items.length) {
      return {
        content: [
          {
            type: 'text',
            text: `No files found for class ${className} in Odoo repo.`
          }
        ]
      };
    }
    // Step 2: For each file, fetch and extract methods
    const results = [];
    for (const item of searchResults.items) {
      const rawUrl = item.html_url
        .replace('github.com', 'raw.githubusercontent.com')
        .replace('/blob/', '/');
      let pySource = '';
      try {
        const resp = await fetch(rawUrl);
        if (resp.ok) {
          pySource = await resp.text();
        } else {
          continue;
        }
      } catch (e) {
        continue;
      }
      // Find the class definition
      const classRegex = new RegExp(
        `class\\s+${className}\\b[^{:]*:[\\s\\S]*?(?=^class |\n\\Z)`,
        'm'
      );
      const classMatch = pySource.match(classRegex);
      if (!classMatch) continue;
      const classBody = classMatch[0];
      // Extract method names
      const methodRegex = /^\s+def\s+([a-zA-Z0-9_]+)\s*\(/gm;
      let m;
      const publicMethods = [];
      const privateMethods = [];
      while ((m = methodRegex.exec(classBody))) {
        if (m[1].startsWith('_')) {
          privateMethods.push(m[1]);
        } else {
          publicMethods.push(m[1]);
        }
      }
      results.push({
        file: item.path,
        publicMethods,
        privateMethods
      });
    }
    if (results.length) {
      return {
        content: [
          {
            type: 'text',
            text: results
              .map(
                (r) =>
                  `${results.length} - Class: ${className}\nFile: ${r.file}\n` +
                  `Public methods:\n` +
                  (r.publicMethods.length ? r.publicMethods.join('\n') : '(none)') +
                  `\n\nPrivate methods:\n` +
                  (r.privateMethods.length ? r.privateMethods.join('\n') : '(none)')
              )
              .join('\n\n---\n\n')
          }
        ]
      };
    }
    return {
      content: [
        {
          type: 'text',
          text: `Class ${className} not found in any candidate files.`
        }
      ]
    };
  }
);

// To help debug MCP server startup in Claude, log to stderr
console.error(`${Date.now()} - MCP Odoo server main entry loaded`);

async function main() {
  console.error(`${Date.now()} - Starting Odoo MCP Server...`);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`${Date.now()} - Odoo MCP Server running on stdio`);
}

main().catch((err) => {
  console.error('Fatal error in main():', err);
  process.exit(1);
});
