// ============================================================================
// ARIS Academy — Unit Tests: BBB Client
// Tests checksum generation, URL building, XML parsing, retry logic.
// Uses mock fetch — no real BigBlueButton server needed.
// ============================================================================
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHash } from 'crypto';
import { BBBClient } from '../../../packages/academy-live/src/services/bbb-client';

// ---------------------------------------------------------------------------
// Mock global fetch
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// XML response helpers
// ---------------------------------------------------------------------------

function xmlResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/xml' },
  });
}

const SUCCESS_CREATE_XML = `
<response>
  <returncode>SUCCESS</returncode>
  <meetingID>test-meeting-001</meetingID>
  <attendeePW>att-pw</attendeePW>
  <moderatorPW>mod-pw</moderatorPW>
  <internalMeetingID>internal-123</internalMeetingID>
</response>`;

const SUCCESS_INFO_XML = `
<response>
  <returncode>SUCCESS</returncode>
  <running>true</running>
  <participantCount>15</participantCount>
  <moderatorCount>2</moderatorCount>
  <startTime>1711234567890</startTime>
</response>`;

const FAILED_XML = `
<response>
  <returncode>FAILED</returncode>
  <messageKey>notFound</messageKey>
  <message>Meeting not found</message>
</response>`;

const SUCCESS_RUNNING_TRUE_XML = `
<response><returncode>SUCCESS</returncode><running>true</running></response>`;

const SUCCESS_RUNNING_FALSE_XML = `
<response><returncode>SUCCESS</returncode><running>false</running></response>`;

const SUCCESS_RECORDINGS_XML = `
<response>
  <returncode>SUCCESS</returncode>
  <recordings>
    <recording>
      <recordID>rec-001</recordID>
      <format><type>presentation</type></format>
      <url>https://bbb.test.org/rec/001</url>
      <length>45</length>
    </recording>
    <recording>
      <recordID>rec-002</recordID>
      <format><type>video</type></format>
      <url>https://bbb.test.org/rec/002</url>
      <length>90</length>
    </recording>
  </recordings>
</response>`;

// ===========================================================================
// Tests
// ===========================================================================

describe('BBBClient', () => {
  const BBB_URL = 'https://bbb.test.org/bigbluebutton/';
  const BBB_SECRET = 'test-secret';
  const client = new BBBClient(BBB_URL, BBB_SECRET);

  // -------------------------------------------------------------------------
  // Checksum generation (SHA-1)
  // -------------------------------------------------------------------------

  describe('checksum generation', () => {
    it('generates a join URL with a valid 40-char hex SHA-1 checksum', () => {
      const url = client.joinMeeting('meeting-123', 'Test User', 'MODERATOR');

      expect(url).toContain('https://bbb.test.org/bigbluebutton/api/join');
      expect(url).toContain('meetingID=meeting-123');
      expect(url).toContain('fullName=Test+User');
      expect(url).toContain('role=MODERATOR');
      expect(url).toContain('checksum=');

      const checksumMatch = url.match(/checksum=([a-f0-9]+)/);
      expect(checksumMatch).toBeTruthy();
      expect(checksumMatch![1]).toHaveLength(40); // SHA-1 = 40 hex chars
    });

    it('generates a deterministic checksum for the same parameters', () => {
      const url1 = client.joinMeeting('meeting-abc', 'Alice', 'VIEWER');
      const url2 = client.joinMeeting('meeting-abc', 'Alice', 'VIEWER');

      const checksum1 = url1.match(/checksum=([a-f0-9]+)/)![1];
      const checksum2 = url2.match(/checksum=([a-f0-9]+)/)![1];

      expect(checksum1).toBe(checksum2);
    });

    it('produces different checksums for different meeting IDs', () => {
      const url1 = client.joinMeeting('meeting-A', 'User', 'VIEWER');
      const url2 = client.joinMeeting('meeting-B', 'User', 'VIEWER');

      const cs1 = url1.match(/checksum=([a-f0-9]+)/)![1];
      const cs2 = url2.match(/checksum=([a-f0-9]+)/)![1];

      expect(cs1).not.toBe(cs2);
    });

    it('matches manual SHA-1 computation (apiCall + queryString + secret)', () => {
      const params: Record<string, string> = {
        meetingID: 'verify-test',
        fullName: 'Verifier',
        role: 'MODERATOR',
      };
      const qs = new URLSearchParams(params).toString();
      const expected = createHash('sha1')
        .update('join' + qs + BBB_SECRET)
        .digest('hex');

      const url = client.joinMeeting('verify-test', 'Verifier', 'MODERATOR');
      const actual = url.match(/checksum=([a-f0-9]+)/)![1];

      expect(actual).toBe(expected);
    });

    it('includes userID parameter when provided', () => {
      const url = client.joinMeeting('meeting-123', 'Test User', 'VIEWER', 'user-001');

      expect(url).toContain('userID=user-001');
    });

    it('omits userID parameter when not provided', () => {
      const url = client.joinMeeting('meeting-123', 'Test User', 'VIEWER');

      expect(url).not.toContain('userID');
    });
  });

  // -------------------------------------------------------------------------
  // URL building
  // -------------------------------------------------------------------------

  describe('URL building', () => {
    it('constructs URL with base path + api/ + apiCall', () => {
      const url = client.joinMeeting('m-1', 'User', 'VIEWER');
      expect(url).toMatch(/^https:\/\/bbb\.test\.org\/bigbluebutton\/api\/join\?/);
    });

    it('normalizes base URL with trailing slash', () => {
      const clientNoSlash = new BBBClient('https://bbb.test.org/bigbluebutton', BBB_SECRET);
      const url = clientNoSlash.joinMeeting('m-1', 'User', 'VIEWER');
      expect(url).toContain('https://bbb.test.org/bigbluebutton/api/join');
    });

    it('properly URL-encodes special characters in fullName', () => {
      const url = client.joinMeeting('m-1', 'Jean-Pierre Doe', 'VIEWER');
      // URLSearchParams encodes spaces as + and hyphens stay as-is
      expect(url).toContain('fullName=Jean-Pierre+Doe');
    });
  });

  // -------------------------------------------------------------------------
  // createMeeting
  // -------------------------------------------------------------------------

  describe('createMeeting', () => {
    it('parses a successful create meeting XML response', async () => {
      mockFetch.mockResolvedValueOnce(xmlResponse(SUCCESS_CREATE_XML));

      const result = await client.createMeeting({
        meetingID: 'test-meeting-001',
        name: 'ARIS Session',
      });

      expect(result.meetingId).toBe('test-meeting-001');
      expect(result.attendeePassword).toBe('att-pw');
      expect(result.moderatorPassword).toBe('mod-pw');
      expect(result.internalMeetingId).toBe('internal-123');
      expect(mockFetch).toHaveBeenCalledOnce();
    });

    it('sends correct parameters in the request URL', async () => {
      mockFetch.mockResolvedValueOnce(xmlResponse(SUCCESS_CREATE_XML));

      await client.createMeeting({
        meetingID: 'session-xyz',
        name: 'My Session',
        record: true,
        maxParticipants: 50,
      });

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('meetingID=session-xyz');
      expect(calledUrl).toContain('name=My+Session');
      expect(calledUrl).toContain('record=true');
      expect(calledUrl).toContain('maxParticipants=50');
    });

    it('defaults record to true and maxParticipants to 300', async () => {
      mockFetch.mockResolvedValueOnce(xmlResponse(SUCCESS_CREATE_XML));

      await client.createMeeting({
        meetingID: 'defaults-test',
        name: 'Defaults',
      });

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('record=true');
      expect(calledUrl).toContain('maxParticipants=300');
    });
  });

  // -------------------------------------------------------------------------
  // getMeetingInfo
  // -------------------------------------------------------------------------

  describe('getMeetingInfo', () => {
    it('parses meeting info XML correctly', async () => {
      mockFetch.mockResolvedValueOnce(xmlResponse(SUCCESS_INFO_XML));

      const info = await client.getMeetingInfo('test-meeting-001');

      expect(info.running).toBe(true);
      expect(info.participantCount).toBe(15);
      expect(info.moderatorCount).toBe(2);
      expect(info.startTime).toBe(1711234567890);
    });

    it('defaults counts to 0 when XML tags are empty', async () => {
      mockFetch.mockResolvedValueOnce(xmlResponse(`
        <response>
          <returncode>SUCCESS</returncode>
          <running>false</running>
        </response>
      `));

      const info = await client.getMeetingInfo('empty-info');

      expect(info.running).toBe(false);
      expect(info.participantCount).toBe(0);
      expect(info.moderatorCount).toBe(0);
      expect(info.startTime).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------

  describe('error handling', () => {
    it('throws on BBB API error (FAILED returncode) with messageKey and message', async () => {
      mockFetch.mockResolvedValueOnce(xmlResponse(FAILED_XML));

      await expect(client.getMeetingInfo('nonexistent'))
        .rejects.toThrow('BBB API error [notFound]: Meeting not found');
    });

    it('does NOT retry on BBB logical errors (only 1 fetch call)', async () => {
      mockFetch.mockResolvedValueOnce(xmlResponse(FAILED_XML));

      await expect(client.endMeeting('nonexistent'))
        .rejects.toThrow('BBB API error');

      expect(mockFetch).toHaveBeenCalledOnce();
    });

    it('throws on HTTP errors after retries', async () => {
      mockFetch
        .mockResolvedValueOnce(new Response('', { status: 500 }))
        .mockResolvedValueOnce(new Response('', { status: 502 }))
        .mockResolvedValueOnce(new Response('', { status: 503 }));

      await expect(client.getMeetingInfo('server-error'))
        .rejects.toThrow(/BBB HTTP/);

      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  // -------------------------------------------------------------------------
  // Retry logic (exponential backoff)
  // -------------------------------------------------------------------------

  describe('retry logic', () => {
    it('retries on network failure and succeeds on third attempt', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(xmlResponse(SUCCESS_INFO_XML));

      const info = await client.getMeetingInfo('retry-test');

      expect(info.running).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('throws after exhausting all 3 retry attempts', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('fail1'))
        .mockRejectedValueOnce(new Error('fail2'))
        .mockRejectedValueOnce(new Error('fail3'));

      await expect(client.getMeetingInfo('fail-test'))
        .rejects.toThrow('fail3');

      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('retries on HTTP error status codes', async () => {
      mockFetch
        .mockResolvedValueOnce(new Response('', { status: 502, statusText: 'Bad Gateway' }))
        .mockResolvedValueOnce(xmlResponse(SUCCESS_INFO_XML));

      const info = await client.getMeetingInfo('http-retry-test');

      expect(info.running).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('succeeds on first attempt without unnecessary retries', async () => {
      mockFetch.mockResolvedValueOnce(xmlResponse(SUCCESS_INFO_XML));

      await client.getMeetingInfo('first-try');

      expect(mockFetch).toHaveBeenCalledOnce();
    });
  });

  // -------------------------------------------------------------------------
  // isMeetingRunning
  // -------------------------------------------------------------------------

  describe('isMeetingRunning', () => {
    it('returns true when the meeting is running', async () => {
      mockFetch.mockResolvedValueOnce(xmlResponse(SUCCESS_RUNNING_TRUE_XML));

      const running = await client.isMeetingRunning('active-meeting');

      expect(running).toBe(true);
    });

    it('returns false when the meeting is not running', async () => {
      mockFetch.mockResolvedValueOnce(xmlResponse(SUCCESS_RUNNING_FALSE_XML));

      const running = await client.isMeetingRunning('stopped-meeting');

      expect(running).toBe(false);
    });

    it('returns false gracefully on network errors (does not throw)', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'));

      const running = await client.isMeetingRunning('unreachable-meeting');

      expect(running).toBe(false);
    });

    it('returns false gracefully on BBB API errors', async () => {
      mockFetch.mockResolvedValueOnce(xmlResponse(FAILED_XML));

      const running = await client.isMeetingRunning('error-meeting');

      expect(running).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // endMeeting
  // -------------------------------------------------------------------------

  describe('endMeeting', () => {
    it('calls the end API successfully', async () => {
      mockFetch.mockResolvedValueOnce(xmlResponse(`
        <response><returncode>SUCCESS</returncode></response>
      `));

      await expect(client.endMeeting('meeting-to-end')).resolves.toBeUndefined();

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('/api/end');
      expect(calledUrl).toContain('meetingID=meeting-to-end');
    });
  });

  // -------------------------------------------------------------------------
  // getRecordings
  // -------------------------------------------------------------------------

  describe('getRecordings', () => {
    it('parses a recording list with multiple recordings', async () => {
      mockFetch.mockResolvedValueOnce(xmlResponse(SUCCESS_RECORDINGS_XML));

      const recordings = await client.getRecordings('meeting-with-recs');

      expect(recordings).toHaveLength(2);

      expect(recordings[0].recordId).toBe('rec-001');
      expect(recordings[0].url).toBe('https://bbb.test.org/rec/001');
      expect(recordings[0].length).toBe(45);

      expect(recordings[1].recordId).toBe('rec-002');
      expect(recordings[1].url).toBe('https://bbb.test.org/rec/002');
      expect(recordings[1].length).toBe(90);
    });

    it('returns an empty array when there are no recordings', async () => {
      mockFetch.mockResolvedValueOnce(xmlResponse(`
        <response>
          <returncode>SUCCESS</returncode>
          <recordings></recordings>
        </response>
      `));

      const recordings = await client.getRecordings('no-recordings');

      expect(recordings).toHaveLength(0);
    });

    it('sends the correct meetingID parameter', async () => {
      mockFetch.mockResolvedValueOnce(xmlResponse(`
        <response>
          <returncode>SUCCESS</returncode>
          <recordings></recordings>
        </response>
      `));

      await client.getRecordings('specific-meeting');

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('meetingID=specific-meeting');
      expect(calledUrl).toContain('/api/getRecordings');
    });
  });

  // -------------------------------------------------------------------------
  // Constructor normalization
  // -------------------------------------------------------------------------

  describe('constructor', () => {
    it('appends trailing slash to base URL if missing', () => {
      const c = new BBBClient('https://bbb.example.org/bigbluebutton', 'secret');
      const url = c.joinMeeting('m', 'U', 'VIEWER');
      expect(url).toContain('https://bbb.example.org/bigbluebutton/api/join');
    });

    it('does not double trailing slash', () => {
      const c = new BBBClient('https://bbb.example.org/bigbluebutton/', 'secret');
      const url = c.joinMeeting('m', 'U', 'VIEWER');
      expect(url).not.toContain('//api');
    });
  });
});
