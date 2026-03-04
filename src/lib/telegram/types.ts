// src/lib/telegram/types.ts
// Minimal Telegram Bot API types — only what we use.

export interface TelegramUser {
    id: number;
    is_bot: boolean;
    first_name: string;
    username?: string;
}

export interface TelegramChat {
    id: number;
    type: 'private' | 'group' | 'supergroup' | 'channel';
    title?: string;
}

export interface TelegramVoice {
    file_id: string;
    file_unique_id: string;
    duration: number;
    mime_type?: string;
    file_size?: number;
}

export interface TelegramPhotoSize {
    file_id: string;
    file_unique_id: string;
    width: number;
    height: number;
    file_size?: number;
}

export interface TelegramVideo {
    file_id: string;
    file_unique_id: string;
    duration: number;
    mime_type?: string;
    file_size?: number;
}

export interface TelegramMessage {
    message_id: number;
    from?: TelegramUser;
    chat: TelegramChat;
    date: number;
    text?: string;
    voice?: TelegramVoice;
    photo?: TelegramPhotoSize[];
    video?: TelegramVideo;
    caption?: string;
}

export interface TelegramUpdate {
    update_id: number;
    message?: TelegramMessage;
}

// Internal bot identity — maps token env var names to agent/model names
export type BotIdentity =
    | { kind: 'agent'; agentName: string; token: string }
    | { kind: 'claude'; token: string }
    | { kind: 'gemini'; token: string };
