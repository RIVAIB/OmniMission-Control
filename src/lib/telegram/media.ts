// src/lib/telegram/media.ts
// Download photos and videos from Telegram and convert to base64.

/**
 * Download a Telegram file and return as base64 string.
 * Uses the Telegram getFile API to resolve the file path, then downloads.
 */
export async function downloadTelegramFile(
    token: string,
    fileId: string
): Promise<{ base64: string; mimeType: string }> {
    // 1. Resolve file path
    const metaRes = await fetch(
        `https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`
    );
    const meta = await metaRes.json() as { ok: boolean; result?: { file_path: string } };
    if (!meta.ok || !meta.result?.file_path) {
        throw new Error(`Telegram getFile failed for file_id ${fileId}`);
    }

    // 2. Download file bytes
    const fileRes = await fetch(
        `https://api.telegram.org/file/bot${token}/${meta.result.file_path}`
    );
    if (!fileRes.ok) throw new Error(`Telegram file download failed: ${fileRes.status}`);

    const buffer = await fileRes.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    // 3. Infer MIME type from path extension
    const ext = meta.result.file_path.split('.').pop()?.toLowerCase() ?? 'jpg';
    const mimeMap: Record<string, string> = {
        jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
        gif: 'image/gif', webp: 'image/webp',
        mp4: 'video/mp4', mov: 'video/quicktime', avi: 'video/x-msvideo',
    };
    const mimeType = mimeMap[ext] ?? 'application/octet-stream';

    return { base64, mimeType };
}
