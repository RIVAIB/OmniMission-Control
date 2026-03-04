// src/lib/telegram/gem.ts
// GEM — tech advisor with Google Search grounding + vision + video.

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Part, Tool } from '@google/generative-ai';
import { GEMINI_MODEL } from '@/lib/ai/models';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);

const GEM_SYSTEM = `Eres GEM, el asesor tecnológico del proyecto RIVAIB ERP.
Tienes acceso a búsqueda en internet en tiempo real vía Google Search.

Tu rol:
- Proveer contexto tecnológico actualizado: comparativas de librerías, noticias de seguridad, mejores prácticas
- Asesorar a CLAUD (Claude) sobre decisiones tecnológicas con información actual del mercado
- Analizar imágenes y videos que se envíen en el grupo
- Responder preguntas de tecnología con fuentes reales y actualizadas

IMPORTANTE: Busca en internet ANTES de responder preguntas técnicas. Siempre cita tus fuentes.
Responde en español. Sé directo y cita los links relevantes.`;

/**
 * GEM agent handler — Google Search grounding + vision + video.
 * @param text          User message text (or image caption)
 * @param mediaBase64   Optional base64 media (image or video)
 * @param mediaMimeType MIME type of the media (image/jpeg, video/mp4, etc.)
 */
export async function callGem(
    text: string,
    mediaBase64?: string,
    mediaMimeType = 'image/jpeg'
): Promise<string> {
    const model = genAI.getGenerativeModel({
        model: GEMINI_MODEL,
        systemInstruction: GEM_SYSTEM,
    });

    const parts: Part[] = [];

    // Add media if present
    if (mediaBase64) {
        parts.push({
            inlineData: {
                mimeType: mediaMimeType,
                data: mediaBase64,
            },
        });
    }

    // Add text prompt
    parts.push({ text: text || (mediaBase64 ? 'Analiza este contenido.' : '') });

    const result = await model.generateContent({
        contents: [{ role: 'user', parts }],
        tools: [{ googleSearch: {} } as unknown as Tool],
    });

    return result.response.text();
}
