// ============================================================================
// Topnet Solutions Academy — BigBlueButton API Client
// Centralized BBB interaction with checksum, retry, XML parsing
// ============================================================================
import { createHash } from 'crypto';

const BBB_URL = process.env.BBB_URL || 'https://bbb.topnet-solutions.com/bigbluebutton/';
const BBB_PUBLIC_URL = process.env.BBB_PUBLIC_URL || BBB_URL;
const BBB_SECRET = process.env.BBB_SECRET || 'bbb-shared-secret';

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 500;

// ---------------------------------------------------------------------------
// XML parsing helpers (lightweight, no external deps)
// ---------------------------------------------------------------------------

function getXmlTag(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`);
  const match = xml.match(re);
  return match ? match[1].trim() : '';
}

function getXmlTagAll(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'g');
  const results: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml)) !== null) {
    results.push(match[1].trim());
  }
  return results;
}

// ---------------------------------------------------------------------------
// BBBClient
// ---------------------------------------------------------------------------

export interface CreateMeetingResult {
  meetingId: string;
  attendeePassword: string;
  moderatorPassword: string;
  internalMeetingId: string;
}

export interface MeetingInfo {
  running: boolean;
  participantCount: number;
  moderatorCount: number;
  startTime: number;
}

export interface BBBRecording {
  recordId: string;
  format: string;
  url: string;
  length: number;
}

export class BBBClient {
  private baseUrl: string;
  private secret: string;

  constructor(baseUrl = BBB_URL, secret = BBB_SECRET) {
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
    this.secret = secret;
  }

  // -- Checksum ------------------------------------------------------------

  private checksum(apiCall: string, queryString: string): string {
    // BBB 3.0 requires SHA-256 (SHA-1 deprecated)
    return createHash('sha256')
      .update(apiCall + queryString + this.secret)
      .digest('hex');
  }

  private buildUrl(apiCall: string, params: Record<string, string> = {}): string {
    const qs = new URLSearchParams(params).toString();
    const checksum = this.checksum(apiCall, qs);
    return `${this.baseUrl}api/${apiCall}?${qs}&checksum=${checksum}`;
  }

  // -- HTTP with retry + exponential backoff --------------------------------

  private async request(apiCall: string, params: Record<string, string> = {}): Promise<string> {
    const url = this.buildUrl(apiCall, params);
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15_000);

        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);

        if (!res.ok) {
          throw new Error(`BBB HTTP ${res.status}: ${res.statusText}`);
        }

        const xml = await res.text();
        const returnCode = getXmlTag(xml, 'returncode');

        if (returnCode === 'FAILED') {
          const messageKey = getXmlTag(xml, 'messageKey');
          const message = getXmlTag(xml, 'message');
          throw new Error(`BBB API error [${messageKey}]: ${message}`);
        }

        return xml;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        // Don't retry on BBB logical errors (only on network/timeout)
        if (lastError.message.startsWith('BBB API error')) throw lastError;

        if (attempt < MAX_RETRIES - 1) {
          const delay = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('BBB request failed after retries');
  }

  // -- API methods ----------------------------------------------------------

  async createMeeting(params: {
    meetingID: string;
    name: string;
    record?: boolean;
    maxParticipants?: number;
    logoutURL?: string;
    welcomeMessage?: string;
  }): Promise<CreateMeetingResult> {
    const xml = await this.request('create', {
      meetingID: params.meetingID,
      name: params.name,
      record: params.record !== false ? 'true' : 'false',
      autoStartRecording: 'true',
      allowStartStopRecording: 'true',
      maxParticipants: String(params.maxParticipants || 300),
      logoutURL: params.logoutURL || 'https://learning.topnet-solutions.com/live',
      welcome: params.welcomeMessage || 'Bienvenue dans la session Topnet Solutions Academy!',
      meetingExpireIfNoUserJoinedInMinutes: '30',
      meetingExpireWhenLastUserLeftInMinutes: '5',
    });

    return {
      meetingId: getXmlTag(xml, 'meetingID'),
      attendeePassword: getXmlTag(xml, 'attendeePW'),
      moderatorPassword: getXmlTag(xml, 'moderatorPW'),
      internalMeetingId: getXmlTag(xml, 'internalMeetingID'),
    };
  }

  joinMeeting(meetingId: string, fullName: string, role: 'MODERATOR' | 'VIEWER', userId?: string): string {
    const params: Record<string, string> = {
      meetingID: meetingId,
      fullName,
      role,
      redirect: 'false',
    };
    if (userId) params.userID = userId;
    // Use public URL for join (user browser must access this directly)
    const qs = new URLSearchParams(params).toString();
    const checksum = this.checksum('join', qs);
    const publicBase = BBB_PUBLIC_URL.endsWith('/') ? BBB_PUBLIC_URL : BBB_PUBLIC_URL + '/';
    return `${publicBase}api/join?${qs}&checksum=${checksum}`;
  }

  async joinMeetingWithToken(meetingId: string, fullName: string, role: 'MODERATOR' | 'VIEWER', userId?: string): Promise<string> {
    const params: Record<string, string> = {
      meetingID: meetingId,
      fullName,
      role,
      redirect: 'false',
    };
    if (userId) params.userID = userId;
    const qs = new URLSearchParams(params).toString();
    const checksum = this.checksum('join', qs);
    // Call BBB API server-side to get session token
    const url = `${this.baseUrl}api/join?${qs}&checksum=${checksum}`;
    const res = await fetch(url, { redirect: 'manual' });
    const xml = await res.text();
    const sessionToken = getXmlTag(xml, 'session_token') || getXmlTag(xml, 'sessionToken');
    if (!sessionToken) {
      throw new Error('Failed to get BBB session token');
    }
    const publicBase = BBB_PUBLIC_URL.endsWith('/') ? BBB_PUBLIC_URL : BBB_PUBLIC_URL + '/';
    return `${publicBase}html5client/?sessionToken=${sessionToken}`;
  }

  async endMeeting(meetingId: string): Promise<void> {
    await this.request('end', { meetingID: meetingId });
  }

  async getMeetingInfo(meetingId: string): Promise<MeetingInfo> {
    const xml = await this.request('getMeetingInfo', { meetingID: meetingId });
    return {
      running: getXmlTag(xml, 'running') === 'true',
      participantCount: parseInt(getXmlTag(xml, 'participantCount') || '0', 10),
      moderatorCount: parseInt(getXmlTag(xml, 'moderatorCount') || '0', 10),
      startTime: parseInt(getXmlTag(xml, 'startTime') || '0', 10),
    };
  }

  async getRecordings(meetingId: string): Promise<BBBRecording[]> {
    const xml = await this.request('getRecordings', { meetingID: meetingId });
    const recordingBlocks = getXmlTagAll(xml, 'recording');

    return recordingBlocks.map(block => ({
      recordId: getXmlTag(block, 'recordID'),
      format: getXmlTag(getXmlTag(block, 'format') || block, 'type') || 'presentation',
      url: getXmlTag(block, 'url'),
      length: parseInt(getXmlTag(block, 'length') || '0', 10),
    }));
  }

  async isMeetingRunning(meetingId: string): Promise<boolean> {
    try {
      const xml = await this.request('isMeetingRunning', { meetingID: meetingId });
      return getXmlTag(xml, 'running') === 'true';
    } catch {
      return false;
    }
  }
}

// Singleton for shared use across the service
export const bbbClient = new BBBClient();
