// src/app/api/telegram/webhook/route.ts
import { NextRequest, NextResponse, after } from 'next/server';
import { processUpdate } from '@/lib/telegram/processor';
import type { TelegramUpdate, BotIdentity } from '@/lib/telegram/types';

type BotIdentityNoToken =
    | { kind: 'agent'; agentName: string }
    | { kind: 'claude' }
    | { kind: 'gemini' };

function buildBotMap(): Map<string, { identity: BotIdentity; token: string }> {
    const map = new Map<string, { identity: BotIdentity; token: string }>();

    const entries: Array<{ envKey: string; identity: BotIdentityNoToken }> = [
        { envKey: 'TELEGRAM_CLAUD_TOKEN',   identity: { kind: 'claude' } },
        { envKey: 'TELEGRAM_GEM_TOKEN',     identity: { kind: 'gemini' } },
        { envKey: 'TELEGRAM_CLAWDIO_TOKEN', identity: { kind: 'agent', agentName: 'CLAWDIO' } },
        { envKey: 'TELEGRAM_JESSY_TOKEN',   identity: { kind: 'agent', agentName: 'JESSY' } },
        { envKey: 'TELEGRAM_NEXUS_TOKEN',   identity: { kind: 'agent', agentName: 'NEXUS' } },
        { envKey: 'TELEGRAM_APEX_TOKEN',    identity: { kind: 'agent', agentName: 'APEX' } },
        { envKey: 'TELEGRAM_AXIOM_TOKEN',   identity: { kind: 'agent', agentName: 'AXIOM' } },
        { envKey: 'TELEGRAM_FORGE_TOKEN',   identity: { kind: 'agent', agentName: 'FORGE' } },
    ];

    for (const { envKey, identity } of entries) {
        const token = process.env[envKey];
        if (token) {
            map.set(token, { identity: { ...identity, token } as BotIdentity, token });
        }
    }

    return map;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
    // 1. Validate secret token
    const secret = request.headers.get('x-telegram-bot-api-secret-token');
    if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
        return NextResponse.json({ ok: false }, { status: 403 });
    }

    // 2. Parse body
    let update: TelegramUpdate;
    try {
        update = (await request.json()) as TelegramUpdate;
    } catch {
        return NextResponse.json({ ok: false }, { status: 400 });
    }

    // 3. Identify bot via token query param
    const token = request.nextUrl.searchParams.get('token') ?? '';
    const botMap = buildBotMap();
    const bot = botMap.get(token);

    if (!bot) {
        console.warn('[Webhook] Unknown bot token in request');
        return NextResponse.json({ ok: true });
    }

    // 4. Security: only accept messages from allowed chats
    const chatId = update.message?.chat.id;
    const allowedIds = (process.env.TELEGRAM_ALLOWED_CHAT_IDS ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

    if (allowedIds.length > 0 && chatId && !allowedIds.includes(String(chatId))) {
        console.warn('[Webhook] Message from unauthorized chat:', chatId);
        return NextResponse.json({ ok: true });
    }

    // 5. Respond to Telegram immediately, process async
    after(async () => {
        try {
            await processUpdate(update, bot.identity, token);
        } catch (err) {
            console.error('[Webhook] processUpdate error:', err);
        }
    });

    return NextResponse.json({ ok: true });
}
