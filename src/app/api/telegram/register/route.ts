// src/app/api/telegram/register/route.ts
// POST once after deploy to register all bot webhooks with Telegram.

import { NextRequest, NextResponse } from 'next/server';
import { registerWebhook } from '@/lib/telegram/client';

const BOT_TOKENS: Record<string, string> = {
    CLAUD:   'TELEGRAM_CLAUD_TOKEN',
    GEM:     'TELEGRAM_GEM_TOKEN',
    CLAWDIO: 'TELEGRAM_CLAWDIO_TOKEN',
    JESSY:   'TELEGRAM_JESSY_TOKEN',
    NEXUS:   'TELEGRAM_NEXUS_TOKEN',
    APEX:    'TELEGRAM_APEX_TOKEN',
    AXIOM:   'TELEGRAM_AXIOM_TOKEN',
    FORGE:   'TELEGRAM_FORGE_TOKEN',
};

export async function POST(request: NextRequest): Promise<NextResponse> {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${process.env.TELEGRAM_WEBHOOK_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
        ?? `https://${request.headers.get('host')}`;

    const results: Record<string, boolean> = {};

    for (const [name, envKey] of Object.entries(BOT_TOKENS)) {
        const token = process.env[envKey];
        if (!token) {
            console.warn(`[Register] Missing env var: ${envKey}`);
            results[name] = false;
            continue;
        }

        const webhookUrl = `${baseUrl}/api/telegram/webhook?token=${token}`;
        const ok = await registerWebhook(
            token,
            webhookUrl,
            process.env.TELEGRAM_WEBHOOK_SECRET!
        );
        results[name] = ok;
        console.log(`[Register] ${name}: ${ok ? '✓' : '✗'}`);
    }

    return NextResponse.json({ results });
}
