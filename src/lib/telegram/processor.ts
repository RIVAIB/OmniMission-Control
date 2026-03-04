// src/lib/telegram/processor.ts
// Async message processor: parses update, routes to agent or LLM, replies.
// Adapted for SQLite (OmniMission-Control) — Supabase removed.

import { sendMessage } from './client';
import { transcribeVoice } from './voice';
import { detectAgentMention } from './agent-parser';
import { processMessage, processMessageWithAgent, createConversation, getAgentByName } from '@/lib/ai/agent-service';
import { getDatabase } from '@/lib/db';
import { callClaud } from './claud';
import { callGem } from './gem';
import { downloadTelegramFile } from './media';
import type { TelegramUpdate, BotIdentity } from './types';

// ── CLAWDIO orchestrator report ───────────────────────────────────────────────

async function clawdioReport(
    userMessage: string,
    contactId: string,
    imageBase64?: string
): Promise<string> {
    // Query active tasks from MC's SQLite tasks table (replaces Supabase missions)
    const db = getDatabase();
    const activeTasks = db
        .prepare(
            `SELECT title, status, assignee
             FROM tasks
             WHERE status IN ('assigned', 'in_progress', 'review')
             ORDER BY priority DESC, updated_at DESC
             LIMIT 10`
        )
        .all() as { title: string; status: string; assignee?: string }[];

    const taskSummary = activeTasks.length
        ? activeTasks
              .map((t) => `• [${t.status.toUpperCase()}] ${t.title} — agente: ${t.assignee ?? 'Sin asignar'}`)
              .join('\n')
        : 'No hay tareas activas.';

    const convId = createConversation('telegram', contactId);
    let context = `Resumen de tareas activas:\n${taskSummary}\n\nPregunta del usuario: ${userMessage}`;
    if (imageBase64) {
        context += '\n[El usuario compartió una imagen.]';
    }
    const { response } = await processMessage('CLAWDIO', convId, context, contactId);
    return response;
}

// ── Group mention guard ───────────────────────────────────────────────────────

/**
 * In groups, each bot only responds if its name is explicitly mentioned.
 * Prevents all bots from responding to every message when privacy mode is off.
 */
function isBotAddressed(text: string, bot: BotIdentity): boolean {
    const name =
        bot.kind === 'agent'  ? bot.agentName :
        bot.kind === 'claude' ? 'CLAUD' :
        /* gemini */            'GEM';
    return new RegExp(`\\b${name}\\b`, 'i').test(text);
}

// ── Main processor ────────────────────────────────────────────────────────────

export async function processUpdate(
    update: TelegramUpdate,
    bot: BotIdentity,
    token: string
): Promise<void> {
    const msg = update.message;
    if (!msg) return;

    const chatId = msg.chat.id;
    const contactId = msg.from?.id ? String(msg.from.id) : `channel-${chatId}`;

    // In groups: every bot only responds when its own name is explicitly mentioned.
    // Applies to all bot kinds (agent, claude, gemini) — prevents cross-bot noise.
    const isGroup = msg.chat.type === 'group' || msg.chat.type === 'supergroup';
    if (isGroup) {
        const textToCheck = msg.text ?? msg.caption ?? '';
        if (!isBotAddressed(textToCheck, bot)) return;
    }

    // 1. Extract text and media from the message
    let text: string;
    let imageBase64: string | undefined;
    let imageMimeType: string | undefined;
    let mediaBase64: string | undefined;
    let mediaMimeType: string | undefined;

    try {
        if (msg.voice) {
            // Voice → transcribe
            text = await transcribeVoice(token, msg.voice.file_id);
        } else if (msg.video) {
            // Video message — only download for GEM; other bots get a redirect
            text = msg.caption ?? msg.text ?? '';
            if (bot.kind === 'gemini') {
                const media = await downloadTelegramFile(token, msg.video.file_id);
                mediaBase64 = media.base64;
                mediaMimeType = media.mimeType;
            }
            // For non-GEM bots we do not download; routing section handles the redirect
        } else if (msg.photo) {
            // Photo — download the largest size (last element in array)
            if (msg.photo.length === 0) return;
            const largest = msg.photo[msg.photo.length - 1];
            const media = await downloadTelegramFile(token, largest.file_id);
            imageBase64 = media.base64;
            imageMimeType = media.mimeType;
            // Text is the caption, or a default prompt when none is provided
            text = msg.caption ?? msg.text ?? 'Analiza esta imagen.';
        } else if (msg.text) {
            text = msg.text;
        } else {
            // Unsupported message type — silently ignore
            return;
        }
    } catch (err) {
        console.error('[Processor] Failed to get message text/media:', err);
        try {
            await sendMessage(token, chatId, '⚠️ No pude procesar el mensaje. Intenta de nuevo.');
        } catch (err) {
            console.error('[Processor] sendMessage failed:', err);
        }
        return;
    }

    // 2. Route based on bot identity
    let reply: string;
    try {
        if (bot.kind === 'claude') {
            reply = await callClaud(text, imageBase64, imageMimeType);

        } else if (bot.kind === 'gemini') {
            if (mediaBase64) {
                // Video (or other media) — pass explicit mime type
                reply = await callGem(text, mediaBase64, mediaMimeType);
            } else {
                // Image or plain text — imageBase64 may be undefined
                reply = await callGem(text, imageBase64, imageMimeType);
            }

        } else {
            // ERP agent bots
            const agentName = bot.agentName;

            if (msg.video && bot.kind === 'agent') {
                // Videos are not processed by ERP agents — redirect to GEM
                reply = '🎥 No proceso video. Para análisis de video, usa @Gem_ERP_Bot.';

            } else if (agentName === 'CLAWDIO') {
                reply = await clawdioReport(text, contactId, imageBase64);

            } else {
                const mentionedAgent = detectAgentMention(text);
                const targetAgent = mentionedAgent ?? agentName;

                const fetchedAgent = getAgentByName(targetAgent);

                const convId = createConversation('telegram', contactId);

                // processMessage does not support vision — append a note if an image was shared
                const messageWithContext = imageBase64
                    ? `${text}\n[El usuario adjuntó una imagen]`
                    : text;

                // Skip second lookup when agent row is already available
                const result = fetchedAgent
                    ? await processMessageWithAgent(fetchedAgent, convId, messageWithContext, contactId)
                    : await processMessage(agentName, convId, messageWithContext, contactId);
                reply = result.response;
            }
        }
    } catch (err) {
        console.error('[Processor] Agent error:', err);
        reply = '⚠️ Hubo un error procesando tu mensaje. El equipo fue notificado.';
    }

    // 3. Send reply
    try {
        await sendMessage(token, chatId, reply);
    } catch (err) {
        console.error('[Processor] sendMessage failed:', err);
    }
}
