// src/lib/telegram/voice.ts
// Download Telegram voice file and transcribe with OpenAI Whisper.

import { getFileUrl, downloadFile } from './client';

/**
 * Transcribe a Telegram voice message to text.
 * Returns the transcribed string, or throws on failure.
 */
export async function transcribeVoice(
    token: string,
    fileId: string
): Promise<string> {
    // 1. Get Telegram download URL for the voice file
    const fileUrl = await getFileUrl(token, fileId);

    // 2. Download raw audio bytes (.oga format)
    const audioBuffer = await downloadFile(fileUrl);

    // 3. Prepare multipart/form-data for Whisper API
    const formData = new FormData();
    const audioBlob = new Blob([audioBuffer], { type: 'audio/ogg' });
    formData.append('file', audioBlob, 'voice.ogg');
    formData.append('model', 'whisper-1');
    formData.append('language', 'es');

    // 4. Call OpenAI Whisper
    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: formData,
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`[Whisper] Transcription failed: ${err}`);
    }

    const data = (await res.json()) as { text: string };
    return data.text.trim();
}
