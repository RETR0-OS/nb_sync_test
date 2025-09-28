import { URLExt } from '@jupyterlab/coreutils';

import { ServerConnection } from '@jupyterlab/services';

/**
 * Call the API extension
 *
 * @param endPoint API REST end point for the extension
 * @param init Initial values for the request
 * @returns The response body interpreted as JSON
 */
export async function requestAPI<T>(
  endPoint = '',
  init: RequestInit = {}
): Promise<T> {
  // Make request to Jupyter API
  const settings = ServerConnection.makeSettings();
  const requestUrl = URLExt.join(
    settings.baseUrl,
    'notebook-sync', // API Namespace - matches backend
    endPoint
  );

  let response: Response;
  try {
    response = await ServerConnection.makeRequest(requestUrl, init, settings);
  } catch (error) {
    throw new ServerConnection.NetworkError(error as any);
  }

  let data: any = await response.text();

  if (data.length > 0) {
    try {
      data = JSON.parse(data);
    } catch (error) {
      console.log('Not a JSON response body.', response);
    }
  }

  if (!response.ok) {
    throw new ServerConnection.ResponseError(response, data.message || data);
  }

  return data;
}

/**
 * New Hash-based APIs
 */
export interface HashKeysResponse {
  type: 'hash_keys';
  items: string[]; // full keys like 'cell_hash:<hash>'
  next_cursor: number;
}

export interface CellHashContentResponse {
  type: 'hash_key_content';
  key: string; // '<hash>' (without prefix)
  content: string;
  created_at: string;
}

export interface PushCellHashResponse {
  type: 'push_confirmed_hash';
  cell_id: string;
  created_at: string;
  hash_key: string; // first 8 chars in response are preview only
  teacher_id: string;
}

export interface INetworkInfoResponse {
  type: 'network_info';
  hostname: string;
  ip_addresses: string[];
}

/**
 * List available hash keys from backend. Supports teacher_ip, cursor, count, match.
 */
export async function listHashKeys(params: {
  teacher_ip?: string;
  cursor?: number;
  count?: number;
  match?: string;
} = {}): Promise<HashKeysResponse> {
  const qp = new URLSearchParams();
  if (params.teacher_ip) qp.set('teacher_ip', params.teacher_ip);
  if (typeof params.cursor === 'number') qp.set('cursor', String(params.cursor));
  if (typeof params.count === 'number') qp.set('count', String(params.count));
  if (params.match) qp.set('match', params.match);

  return requestAPI<HashKeysResponse>(`hash/keys${qp.toString() ? '?' + qp.toString() : ''}`, {
    method: 'GET'
  });
}

/**
 * Fetch cell content by hash. Provide only the hash (without prefix) and optional teacher_ip.
 */
export async function getCellByHash(hash: string, teacher_ip?: string): Promise<CellHashContentResponse> {
  const qp = new URLSearchParams();
  if (teacher_ip) qp.set('teacher_ip', teacher_ip);
  return requestAPI<CellHashContentResponse>(`hash/key/${hash}${qp.toString() ? '?' + qp.toString() : ''}`, {
    method: 'GET'
  });
}

/**
 * Publish a cell using hash-based storage (teacher only).
 */
export async function pushCellByHash(params: {
  cell_id: string;
  created_at: string;
  content: string;
  ttl_seconds?: number;
}): Promise<PushCellHashResponse> {
  return requestAPI<PushCellHashResponse>('hash/push-cell', {
    method: 'POST',
    body: JSON.stringify({
      cell_id: params.cell_id,
      created_at: params.created_at,
      content: params.content,
      ttl_seconds: params.ttl_seconds ?? 86400
    })
  });
}

/**
 * Session API wrappers
 */
export async function createSession(): Promise<{ session_code: string }> {
  return requestAPI<{ session_code: string }>('sessions', {
    method: 'POST'
  });
}

export async function joinSession(code: string): Promise<any> {
  return requestAPI<any>(`sessions/${code}/join`, {
    method: 'POST'
  });
}

export async function endSession(code: string): Promise<void> {
  await requestAPI<void>(`sessions/${code}`, {
    method: 'DELETE'
  });
}

export async function pushCellToSession(code: string, cell_id: string, content: any, metadata: any): Promise<any> {
  return requestAPI<any>(`sessions/${code}/cells/${cell_id}/push`, {
    method: 'POST',
    body: JSON.stringify({
      content,
      metadata
    })
  });
}

export async function toggleCellSync(code: string, cell_id: string, sync_allowed: boolean): Promise<any> {
  return requestAPI<any>(`sessions/${code}/cells/${cell_id}/toggle`, {
    method: 'POST',
    body: JSON.stringify({
      sync_allowed
    })
  });
}

export async function getPendingStatus(code: string, cell_id: string): Promise<any> {
  return requestAPI<any>(`sessions/${code}/cells/${cell_id}/pending`, {
    method: 'GET'
  });
}

export async function requestCellSync(code: string, cell_id: string): Promise<any> {
  return requestAPI<any>(`sessions/${code}/cells/${cell_id}/request-sync`, {
    method: 'POST'
  });
}

export async function listNotifications(code: string, since: number): Promise<any> {
  const qp = new URLSearchParams();
  qp.set('since', String(since));
  return requestAPI<any>(`sessions/${code}/notifications?${qp.toString()}`, {
    method: 'GET'
  });
}

export async function fetchNetworkInfo(): Promise<INetworkInfoResponse> {
  return requestAPI<INetworkInfoResponse>('network/info', { method: 'GET' });
}
