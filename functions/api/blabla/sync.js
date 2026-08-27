const API_BASE = 'https://api.blablalink.com';
const GLOBAL_GAME_ID = '29080';
const HMT_GAME_ID = '29157';
const SESSION_INVALID_CODE = 300001;
const VERSION = '34.7.11';

const REGION_MAP = Object.freeze({
  [GLOBAL_GAME_ID]: Object.freeze({ JP: 81, NA: 82, KR: 83, GLOBAL: 84, SEA: 85 }),
  [HMT_GAME_ID]: Object.freeze({ HK: 91, TW: 91, HMT: 91, MC: 91 }),
});

export class SyncError extends Error {
  constructor(code, message, status = 400, details = undefined) {
    super(message);
    this.name = 'SyncError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function cleanText(value) {
  return String(value ?? '').trim();
}

function decodeUrlSafeBase64(value) {
  const normalized = cleanText(value)
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .replace(/\s+/g, '');
  if (!normalized || !/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) return '';
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  try {
    if (typeof atob === 'function') {
      const binary = atob(padded);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    }
    return Buffer.from(padded, 'base64').toString('utf8');
  } catch {
    return '';
  }
}

function extractQueryCandidate(raw) {
  const normalized = cleanText(raw);
  if (!normalized) return '';
  const variants = [normalized];
  try {
    const decoded = decodeURIComponent(normalized);
    if (decoded !== normalized) variants.push(decoded);
  } catch {
    // Keep the original input.
  }
  for (const candidate of variants) {
    try {
      const url = new URL(candidate);
      for (const key of ['openid', 'uid', 'intl_open_id', 'open_id']) {
        const value = cleanText(url.searchParams.get(key));
        if (value) return value;
      }
    } catch {
      // Raw ids and base64 values are handled below.
    }
  }
  const match = normalized.match(/(?:^|[?&#\s])(?:openid|uid|intl_open_id|open_id)=([^&#\s]+)/i);
  return match?.[1] ? cleanText(match[1]) : normalized;
}

export function parseProfileInput(input) {
  const original = cleanText(input);
  if (!original || original.length > 2048) {
    throw new SyncError('INVALID_PROFILE_URL', 'BlaBla 공개 프로필 URL 또는 uid/openid를 입력해 주세요.');
  }

  let candidate = extractQueryCandidate(original);
  try {
    candidate = decodeURIComponent(candidate);
  } catch {
    // Already decoded or not percent-encoded.
  }

  const decoded = decodeUrlSafeBase64(candidate);
  if (/^\d{5}-\d{9,30}$/.test(decoded)) candidate = decoded;

  let intlGameId = GLOBAL_GAME_ID;
  let intlOpenId = candidate;
  const prefixed = candidate.match(/^(\d{5})-(\d{9,30})$/);
  if (prefixed) {
    intlGameId = prefixed[1];
    intlOpenId = prefixed[2];
  }

  if (!/^\d{9,30}$/.test(intlOpenId)) {
    throw new SyncError(
      'INVALID_PROFILE_URL',
      '공개 링크의 uid/openid를 해석하지 못했습니다. BlaBlaLink의 “나의 니케” 공유 URL 전체를 붙여넣어 주세요.'
    );
  }
  if (![GLOBAL_GAME_ID, HMT_GAME_ID].includes(intlGameId)) {
    throw new SyncError('UNSUPPORTED_GAME_ID', `지원하지 않는 BlaBla 게임 식별자입니다: ${intlGameId}`);
  }

  return Object.freeze({ intlGameId, intlOpenId, encodedValue: candidate });
}

export function areaCandidates(intlGameId, serverHint = '') {
  const gameId = cleanText(intlGameId) || GLOBAL_GAME_ID;
  const map = REGION_MAP[gameId];
  if (!map) throw new SyncError('UNSUPPORTED_GAME_ID', `지원하지 않는 게임 식별자입니다: ${gameId}`);
  const hint = cleanText(serverHint).toUpperCase();
  const all = [...new Set(Object.values(map))];
  const preferred = map[hint];
  return preferred ? [preferred, ...all.filter((area) => area !== preferred)] : all;
}

function configuredCookie(env, intlGameId) {
  const prefix = intlGameId === HMT_GAME_ID ? 'BLABLA_29157_' : 'BLABLA_29080_';
  const genericAllowed = intlGameId === GLOBAL_GAME_ID;
  const rawCookie = cleanText(env?.[`${prefix}COOKIE`] || (genericAllowed ? env?.BLABLA_COOKIE : ''));
  const token = cleanText(env?.[`${prefix}GAME_TOKEN`] || (genericAllowed ? env?.BLABLA_GAME_TOKEN : ''));
  const gameOpenId = cleanText(env?.[`${prefix}GAME_OPENID`] || (genericAllowed ? env?.BLABLA_GAME_OPENID : ''));
  const channelId = cleanText(env?.[`${prefix}GAME_CHANNELID`] || (genericAllowed ? env?.BLABLA_GAME_CHANNELID : '') || '131');

  let cookie = rawCookie;
  if (!cookie && token && gameOpenId) {
    cookie = `game_token=${token}; game_openid=${gameOpenId}`;
  }
  if (!cookie) {
    throw new SyncError(
      'BLABLA_SESSION_MISSING',
      `${intlGameId}용 BlaBla 서비스 세션이 설정되지 않았습니다. Cloudflare 비밀값에 ${prefix}GAME_TOKEN과 ${prefix}GAME_OPENID를 등록해 주세요.`,
      503
    );
  }
  if (!/(?:^|;\s*)game_token=/.test(cookie) || !/(?:^|;\s*)game_openid=/.test(cookie)) {
    throw new SyncError(
      'BLABLA_SESSION_INCOMPLETE',
      'BlaBla 세션에는 서로 다른 game_token과 game_openid 쿠키가 모두 필요합니다.',
      503
    );
  }
  if (!/(?:^|;\s*)game_gameid=/.test(cookie)) cookie += `; game_gameid=${intlGameId}`;
  if (!/(?:^|;\s*)game_channelid=/.test(cookie)) cookie += `; game_channelid=${channelId}`;
  return cookie;
}

function commonParams(intlGameId, language = 'ko') {
  return JSON.stringify({
    game_id: '16',
    area_id: 'global',
    source: 'pc_web',
    intl_game_id: intlGameId,
    language,
    env: 'prod',
    data_statistics_scene: 'outer',
    data_statistics_page_id: 'https://www.blablalink.com/shiftyspad/nikke-list',
    data_statistics_client_type: 'pc_web',
    data_statistics_lang: language,
  });
}

export function buildUpstreamHeaders(env, intlGameId) {
  return {
    Accept: 'application/json, text/plain, */*',
    'Content-Type': 'application/json',
    Origin: 'https://www.blablalink.com',
    Referer: 'https://www.blablalink.com/',
    'x-channel-type': '2',
    'x-language': 'ko',
    'x-common-params': commonParams(intlGameId),
    Cookie: configuredCookie(env, intlGameId),
  };
}

function messageOf(payload) {
  return cleanText(payload?.msg || payload?.message || payload?.error?.message || '');
}

function apiCode(payload) {
  const raw = payload?.code ?? payload?.retcode ?? payload?.ret_code;
  const value = Number(raw);
  return Number.isFinite(value) ? value : raw;
}

async function postGameProxy(method, body, env, intlGameId, fetchImpl = fetch) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort('timeout'), 15000);
  try {
    const response = await fetchImpl(`${API_BASE}/api/game/proxy/Game/${method}`, {
      method: 'POST',
      headers: buildUpstreamHeaders(env, intlGameId),
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await response.text();
    let payload;
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      throw new SyncError('BLABLA_BAD_RESPONSE', `BlaBla ${method} 응답을 JSON으로 해석하지 못했습니다.`, 502);
    }
    if (!response.ok) {
      throw new SyncError('BLABLA_HTTP_ERROR', `BlaBla ${method} HTTP ${response.status}`, 502, { upstreamStatus: response.status });
    }
    return payload;
  } catch (error) {
    if (error instanceof SyncError) throw error;
    if (error?.name === 'AbortError') {
      throw new SyncError('BLABLA_TIMEOUT', `BlaBla ${method} 응답 시간이 초과되었습니다.`, 504);
    }
    throw new SyncError('BLABLA_NETWORK_ERROR', `BlaBla ${method} 연결 실패: ${cleanText(error?.message || error)}`, 502);
  } finally {
    clearTimeout(timeout);
  }
}

function detailArrays(payload) {
  const data = payload?.data || {};
  return {
    details: Array.isArray(data.character_details) ? data.character_details : Array.isArray(data.details) ? data.details : [],
    stateEffects: Array.isArray(data.state_effects) ? data.state_effects : Array.isArray(data.stateEffects) ? data.stateEffects : [],
  };
}

export async function syncPublicRoster({ profileInput, serverHint = '', env = {}, fetchImpl = fetch }) {
  const profile = parseProfileInput(profileInput);
  const candidates = areaCandidates(profile.intlGameId, serverHint);
  const areas = [];
  const attempts = [];

  for (const area of candidates) {
    const rosterPayload = await postGameProxy(
      'GetUserCharacters',
      { intl_open_id: profile.intlOpenId, nikke_area_id: area },
      env,
      profile.intlGameId,
      fetchImpl
    );
    const code = apiCode(rosterPayload);
    const message = messageOf(rosterPayload);
    if (Number(code) === SESSION_INVALID_CODE) {
      throw new SyncError(
        'BLABLA_SESSION_EXPIRED',
        'BlaBla 브리지의 로그인 세션이 만료되었거나 잘못되었습니다. Cloudflare의 game_token·game_openid 비밀값을 갱신해 주세요.',
        503,
        { upstreamCode: code }
      );
    }
    const characters = Array.isArray(rosterPayload?.data?.characters) ? rosterPayload.data.characters : [];
    attempts.push({ area, code, count: characters.length, message: message.slice(0, 120) });
    if (Number(code) !== 0 || characters.length === 0) continue;

    const details = [];
    const stateEffects = [];
    for (let index = 0; index < characters.length; index += 60) {
      const nameCodes = characters.slice(index, index + 60).map((row) => Number(row?.name_code)).filter(Number.isFinite);
      if (!nameCodes.length) continue;
      const detailPayload = await postGameProxy(
        'GetUserCharacterDetails',
        { intl_open_id: profile.intlOpenId, nikke_area_id: area, name_codes: nameCodes },
        env,
        profile.intlGameId,
        fetchImpl
      );
      const detailCode = apiCode(detailPayload);
      if (Number(detailCode) === SESSION_INVALID_CODE) {
        throw new SyncError('BLABLA_SESSION_EXPIRED', 'BlaBla 브리지 세션이 상세 조회 중 만료되었습니다.', 503);
      }
      if (Number(detailCode) !== 0) {
        throw new SyncError(
          'BLABLA_DETAILS_FAILED',
          messageOf(detailPayload) || `캐릭터 상세 조회 실패 · code ${detailCode}`,
          502,
          { area, upstreamCode: detailCode }
        );
      }
      const arrays = detailArrays(detailPayload);
      details.push(...arrays.details);
      stateEffects.push(...arrays.stateEffects);
    }
    if (!details.length) {
      throw new SyncError('BLABLA_DETAILS_EMPTY', '공개 로스터 요약은 확인됐지만 캐릭터 상세 데이터를 받지 못했습니다.', 502, { area, characterCount: characters.length });
    }
    areas.push({ area, characters, details, stateEffects });
  }

  if (!areas.length) {
    throw new SyncError(
      'ROSTER_PRIVATE_OR_EMPTY',
      '공개 로스터를 찾지 못했습니다. BlaBlaLink의 방패 설정에서 “My Nikkes/나의 니케”를 전체 공개했는지와 링크의 서버를 확인해 주세요.',
      404,
      { attempts }
    );
  }

  return {
    ok: true,
    version: VERSION,
    profile: {
      intlGameId: profile.intlGameId,
      maskedOpenId: `${profile.intlOpenId.slice(0, 4)}…${profile.intlOpenId.slice(-4)}`,
    },
    observedAt: new Date().toISOString(),
    areas,
    diagnostics: { attempts },
  };
}

function allowedOrigins(env, requestUrl) {
  const current = new URL(requestUrl).origin;
  const configured = cleanText(env?.BLABLA_ALLOWED_ORIGINS)
    .split(',')
    .map((value) => cleanText(value))
    .filter(Boolean);
  return new Set([current, ...configured]);
}

function requestOrigin(request) {
  return cleanText(request.headers.get('Origin'));
}

function corsHeaders(request, env) {
  const origin = requestOrigin(request);
  const headers = {
    Vary: 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, x-nikke-sync-key',
    'Access-Control-Max-Age': '86400',
  };
  if (origin && allowedOrigins(env, request.url).has(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

function assertOriginAllowed(request, env) {
  const origin = requestOrigin(request);
  const allowed = allowedOrigins(env, request.url);
  if (origin && !allowed.has(origin)) {
    throw new SyncError('ORIGIN_NOT_ALLOWED', '허용되지 않은 출처에서 호출했습니다.', 403);
  }
}

function assertRequestAccess(request, env) {
  assertOriginAllowed(request, env);
  const requiredKey = cleanText(env?.BLABLA_SYNC_KEY);
  const supplied = cleanText(request.headers.get('x-nikke-sync-key'));
  if (requiredKey && (!supplied || supplied !== requiredKey)) {
    throw new SyncError('SYNC_KEY_INVALID', 'BlaBla 브리지 키가 올바르지 않습니다.', 401);
  }
  if (request.method === 'POST' && !requestOrigin(request) && !requiredKey) {
    throw new SyncError('ORIGIN_REQUIRED', 'Origin 없는 POST 요청은 BLABLA_SYNC_KEY 없이 허용되지 않습니다.', 403);
  }
}

function jsonResponse(body, status, request, env) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...corsHeaders(request, env),
    },
  });
}

function configuredGames(env) {
  const games = [];
  for (const gameId of [GLOBAL_GAME_ID, HMT_GAME_ID]) {
    try {
      configuredCookie(env, gameId);
      games.push(gameId);
    } catch {
      // Report only configured games.
    }
  }
  return games;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  try {
    assertRequestAccess(request, env);
    const games = configuredGames(env);
    return jsonResponse({ ok: true, version: VERSION, configured: games.length > 0, games }, 200, request, env);
  } catch (error) {
    const syncError = error instanceof SyncError ? error : new SyncError('INTERNAL_ERROR', cleanText(error?.message || error), 500);
    return jsonResponse({ ok: false, code: syncError.code, error: syncError.message }, syncError.status, request, env);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    assertRequestAccess(request, env);
    const length = Number(request.headers.get('Content-Length') || 0);
    if (length > 8192) throw new SyncError('PAYLOAD_TOO_LARGE', '요청이 너무 큽니다.', 413);
    const payload = await request.json().catch(() => null);
    if (!payload || typeof payload !== 'object') throw new SyncError('INVALID_JSON', 'JSON 요청 본문이 필요합니다.');
    const fetchImpl = typeof env?.__TEST_FETCH === 'function' ? env.__TEST_FETCH : fetch;
    const result = await syncPublicRoster({
      profileInput: payload.profileUrl || payload.uid || payload.openid,
      serverHint: payload.serverHint || payload.server,
      env,
      fetchImpl,
    });
    return jsonResponse(result, 200, request, env);
  } catch (error) {
    const syncError = error instanceof SyncError ? error : new SyncError('INTERNAL_ERROR', cleanText(error?.message || error), 500);
    return jsonResponse(
      { ok: false, code: syncError.code, error: syncError.message, details: syncError.details },
      syncError.status,
      request,
      env
    );
  }
}

export async function onRequestOptions(context) {
  const { request, env } = context;
  try {
    assertOriginAllowed(request, env);
    return new Response(null, { status: 204, headers: corsHeaders(request, env) });
  } catch (error) {
    const syncError = error instanceof SyncError ? error : new SyncError('INTERNAL_ERROR', cleanText(error?.message || error), 500);
    return jsonResponse({ ok: false, code: syncError.code, error: syncError.message }, syncError.status, request, env);
  }
}
