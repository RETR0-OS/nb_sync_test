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
