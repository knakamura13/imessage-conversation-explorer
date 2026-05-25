export interface Person {
  legal_name: string;
  display_name: string;
  phone_numbers: string[];
  emails: string[];
}

export interface ParticipantsConfig {
  me: Person;
  spouse: Person;
  timezone: string;
}

export interface FileHash {
  sha256: string;
  bytes: number;
}

export interface Provenance {
  tool_version: string;
  snapshot_timestamp: string;
  source_path: string;
  files: Record<string, FileHash>;
  counts: {
    message: number;
    handle: number;
    chat: number;
  };
}

export interface Attachment {
  rowid: number;
  transfer_name: string | null;
  mime_type: string | null;
  total_bytes: number | null;
  local_path: string | null;
  missing: boolean;
  reason: string | null;
}

export interface MessageRow {
  rowid: number;
  guid: string;
  date_utc: string | null;
  is_from_me: boolean;
  handle_address: string | null;
  service: string | null;
  body: string | null;
  raw_text_present: boolean;
  raw_attributed_body_present: boolean;
  associated_message_guid: string | null;
  associated_message_type: number | null;
  has_summary_info: boolean;
  attachments: Attachment[];
}

export type ReactionKind = 'love' | 'like' | 'dislike' | 'laugh' | 'emphasis' | 'question';

export interface Reaction {
  rowid: number;
  guid: string;
  kind: ReactionKind;
  from_me: boolean;
  date_utc: string | null;
  removed: boolean;
}

export type MsgType =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'reaction'
  | 'reply'
  | 'attachment'
  | 'unknown';

export interface EnrichedRow extends MessageRow {
  msg_type: MsgType;
  sender_display: string;
  reactions: Reaction[];
  reply_to_guid: string | null;
  has_edit: boolean;
}

export interface Stats {
  total_visible: number;
  by_sender: Record<string, number>;
  by_month: Record<string, number>;
  by_type: Record<string, number>;
  attachment_count: number;
  first_date: string | null;
  last_date: string | null;
  longest_gap_days: number;
}
