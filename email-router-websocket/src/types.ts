export interface CloudflareBindings {
  ROOM: DurableObjectNamespace;
  ASSETS: Fetcher;
  MASTER_KEY: string;
}

export interface Message {
  content: string;
  audioFileLink?: string;
  videoFileLink?: string;
  imageFileLink?: string;
  documentFileLink?: string;
  sender: string;
  timestamp: string;
}

export interface WebhookPayload {
  content: string;
  audioFileLink?: string;
  videoFileLink?: string;
  imageFileLink?: string;
  documentFileLink?: string;
  sender: string;
}
