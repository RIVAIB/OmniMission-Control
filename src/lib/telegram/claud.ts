// src/lib/telegram/claud.ts
// CLAUD — senior tech reviewer with GitHub access + Anthropic web search + vision.
// Implements the Claude tool-use loop for Telegram messages.

import Anthropic from '@anthropic-ai/sdk';
import type { WebSearchTool20250305 } from '@anthropic-ai/sdk/resources/messages/messages';
import { CLAUDE_MODEL } from '@/lib/ai/models';
import {
    githubListRepos,
    githubReadFile,
    githubListFiles,
    githubListCommits,
    githubListPRs,
} from '@/lib/github/client';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const GITHUB_OWNER = process.env.GITHUB_OWNER ?? 'RIVAIB';

const CLAUD_SYSTEM = `Eres CLAUD, el revisor técnico senior del proyecto RIVAIB ERP.
Tienes acceso de lectura completo a todos los repositorios GitHub de la organización ${GITHUB_OWNER}.
También tienes acceso a búsqueda en internet en tiempo real.

Tu rol:
- Revisar código, PRs, commits y arquitectura del sistema
- Identificar vulnerabilidades de seguridad, deuda técnica y oportunidades de mejora
- Dar opiniones técnicas fundamentadas en código real, no en suposiciones
- Colaborar con GEM (Gemini) que provee contexto tecnológico de internet

IMPORTANTE: Siempre busca en GitHub o en internet ANTES de responder preguntas técnicas.
Responde en español. Sé directo y específico.`;

const CLAUD_TOOLS: Anthropic.Tool[] = [
    {
        name: 'github_list_repos',
        description: 'Lista todos los repositorios de un usuario u organización GitHub.',
        input_schema: {
            type: 'object' as const,
            properties: {
                username: { type: 'string', description: 'Usuario u organización GitHub.' },
            },
            required: ['username'],
        },
    },
    {
        name: 'github_read_file',
        description: 'Lee el contenido de un archivo en un repositorio GitHub.',
        input_schema: {
            type: 'object' as const,
            properties: {
                owner: { type: 'string', description: 'Propietario del repo.' },
                repo: { type: 'string', description: 'Nombre del repo.' },
                path: { type: 'string', description: 'Ruta al archivo (ej: src/lib/ai/agent-service.ts).' },
            },
            required: ['owner', 'repo', 'path'],
        },
    },
    {
        name: 'github_list_files',
        description: 'Lista los archivos en un directorio de un repositorio GitHub.',
        input_schema: {
            type: 'object' as const,
            properties: {
                owner: { type: 'string', description: 'Propietario del repo.' },
                repo: { type: 'string', description: 'Nombre del repo.' },
                path: { type: 'string', description: 'Ruta del directorio (ej: src/lib).' },
            },
            required: ['owner', 'repo', 'path'],
        },
    },
    {
        name: 'github_list_commits',
        description: 'Lista los commits recientes de un repositorio GitHub.',
        input_schema: {
            type: 'object' as const,
            properties: {
                owner: { type: 'string', description: 'Propietario del repo.' },
                repo: { type: 'string', description: 'Nombre del repo.' },
                limit: { type: 'number', description: 'Número de commits a retornar (default 10).' },
            },
            required: ['owner', 'repo'],
        },
    },
    {
        name: 'github_list_prs',
        description: 'Lista los pull requests de un repositorio GitHub.',
        input_schema: {
            type: 'object' as const,
            properties: {
                owner: { type: 'string', description: 'Propietario del repo.' },
                repo: { type: 'string', description: 'Nombre del repo.' },
                state: { type: 'string', enum: ['open', 'closed', 'all'], description: 'Estado de los PRs.' },
            },
            required: ['owner', 'repo'],
        },
    },
];

// Web search tool — typed via the SDK's WebSearchTool20250305 interface
const WEB_SEARCH_TOOL: WebSearchTool20250305 = {
    type: 'web_search_20250305',
    name: 'web_search',
    max_uses: 3,
};

// GitHub tool dispatcher — delegates to shared client (no Supabase logging for Telegram flow)
async function runGitHubTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    switch (name) {
        case 'github_list_repos':
            return githubListRepos(args.username as string);
        case 'github_read_file':
            return githubReadFile(args.owner as string, args.repo as string, args.path as string);
        case 'github_list_files':
            return githubListFiles(args.owner as string, args.repo as string, args.path as string);
        case 'github_list_commits':
            return githubListCommits(args.owner as string, args.repo as string, args.limit as number | undefined);
        case 'github_list_prs':
            return githubListPRs(args.owner as string, args.repo as string, args.state as 'open' | 'closed' | 'all' | undefined);
        default:
            return { error: `Tool ${name} not implemented` };
    }
}

type AnthropicImageMime = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

// Build the user content block — text + optional image
function buildUserContent(
    text: string,
    imageBase64?: string,
    imageMimeType: string = 'image/jpeg'
): Anthropic.MessageParam['content'] {
    if (!imageBase64) return text;
    const validMimes: AnthropicImageMime[] = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const mimeType: AnthropicImageMime = validMimes.includes(imageMimeType as AnthropicImageMime)
        ? (imageMimeType as AnthropicImageMime)
        : 'image/jpeg';
    return [
        {
            type: 'image',
            source: { type: 'base64', media_type: mimeType, data: imageBase64 },
        },
        { type: 'text', text: text || 'Analiza esta imagen.' },
    ];
}

/**
 * CLAUD agent handler — tool-use loop with GitHub + web search + vision.
 * @param text          User message text
 * @param imageBase64   Optional base64-encoded image from Telegram
 * @param imageMimeType MIME type of the image (default: image/jpeg)
 */
export async function callClaud(text: string, imageBase64?: string, imageMimeType?: string): Promise<string> {
    const messages: Anthropic.MessageParam[] = [
        { role: 'user', content: buildUserContent(text, imageBase64, imageMimeType) },
    ];

    // Tool-use loop — max 5 iterations to prevent infinite loops
    for (let i = 0; i < 5; i++) {
        const response = await client.messages.create({
            model: CLAUDE_MODEL,
            max_tokens: 2048,
            system: CLAUD_SYSTEM,
            tools: [WEB_SEARCH_TOOL, ...CLAUD_TOOLS],
            messages,
        });

        // If no tool calls, return the text response
        if (response.stop_reason === 'end_turn') {
            const textBlock = response.content.find(b => b.type === 'text');
            return textBlock ? (textBlock as Anthropic.TextBlock).text : '(sin respuesta)';
        }

        // Append assistant turn
        messages.push({ role: 'assistant', content: response.content });

        // Execute all tool calls in this turn
        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const block of response.content) {
            if (block.type !== 'tool_use') continue;
            let output: unknown;
            try {
                output = await runGitHubTool(block.name, block.input as Record<string, unknown>);
            } catch (err) {
                output = { error: String(err) };
            }
            toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: JSON.stringify(output),
            });
        }

        // Append tool results and loop
        messages.push({ role: 'user', content: toolResults });
    }

    return '(CLAUD alcanzó el límite de iteraciones de herramientas)';
}
