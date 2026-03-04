// src/lib/telegram/client.ts
// Thin wrapper over Telegram Bot API REST calls.

const TG_BASE = 'https://api.telegram.org/bot';
const TG_FILE_BASE = 'https://api.telegram.org/file/bot';

/**
 * Send a text message to a Telegram chat.
 */
export async function sendMessage(
    token: string,
    chatId: number,
    text: string
): Promise<void> {
    const url = `${TG_BASE}${token}/sendMessage`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: 'Markdown',
        }),
    });

    if (!res.ok) {
        const body = await res.text();
        console.error('[Telegram] sendMessage failed:', body);
    }
}

/**
 * Get the download URL for a Telegram file (voice, etc.)
 */
export async function getFileUrl(
    token: string,
    fileId: string
): Promise<string> {
    const url = `${TG_BASE}${token}/getFile?file_id=${fileId}`;
    const res = await fetch(url);

    if (!res.ok) throw new Error(`[Telegram] getFile failed: ${res.status}`);

    const data = (await res.json()) as { ok: boolean; result: { file_path: string } };
    if (!data.ok) throw new Error('[Telegram] getFile returned ok:false');

    return `${TG_FILE_BASE}${token}/${data.result.file_path}`;
}

/**
 * Download raw bytes from a Telegram file URL.
 */
export async function downloadFile(fileUrl: string): Promise<ArrayBuffer> {
    const res = await fetch(fileUrl);
    if (!res.ok) throw new Error(`[Telegram] downloadFile failed: ${res.status}`);
    return res.arrayBuffer();
}

/**
 * Register a webhook URL for a bot token.
 * secret_token is sent as X-Telegram-Bot-Api-Secret-Token header on every update.
 */
export async function registerWebhook(
    token: string,
    webhookUrl: string,
    secretToken: string
): Promise<boolean> {
    const url = `${TG_BASE}${token}/setWebhook`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            url: webhookUrl,
            secret_token: secretToken,
            allowed_updates: ['message'],
        }),
    });

    const data = (await res.json()) as { ok: boolean; description?: string };
    if (!data.ok) console.error('[Telegram] registerWebhook failed:', data.description);
    return data.ok;
}
