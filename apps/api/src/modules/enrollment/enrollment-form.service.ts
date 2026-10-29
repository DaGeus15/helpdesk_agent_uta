import { Injectable, Logger } from '@nestjs/common';
import {
  buildPrefilledUrl,
  parseFormFields,
  type FormField,
  type LeadProfileLike,
  type PrefillExtras,
} from './enrollment-form.logic';

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

interface FieldsCacheEntry {
  fields: FormField[];
  expiresAt: number;
}

@Injectable()
export class EnrollmentFormService {
  private readonly logger = new Logger(EnrollmentFormService.name);
  private readonly cache = new Map<string, FieldsCacheEntry>();

  /**
   * Download the public form HTML and parse FB_PUBLIC_LOAD_DATA_.
   * Cached for 6 h. On any failure returns [].
   */
  async getFields(formUrl: string): Promise<FormField[]> {
    if (!formUrl) return [];
    const key = formUrl.split('?')[0];
    const hit = this.cache.get(key);
    if (hit && Date.now() < hit.expiresAt) {
      return hit.fields;
    }

    try {
      const res = await fetch(formUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; CTT-FISEI-helpdesk/1.0; +https://uta.edu.ec)',
          Accept: 'text/html',
        },
        redirect: 'follow',
      });
      if (!res.ok) {
        this.logger.warn(`getFields HTTP ${res.status} for ${key}`);
        this.cache.set(key, { fields: [], expiresAt: Date.now() + CACHE_TTL_MS });
        return [];
      }
      const html = await res.text();
      const fields = parseFormFields(html);
      this.cache.set(key, {
        fields,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });
      return fields;
    } catch (err) {
      this.logger.warn(`getFields failed for ${key}: ${String(err)}`);
      this.cache.set(key, { fields: [], expiresAt: Date.now() + CACHE_TTL_MS });
      return [];
    }
  }

  /**
   * Map lead profile → prefilled Google Form URL. Falls back to the bare
   * viewform URL when fields cannot be loaded or nothing maps.
   */
  async buildPrefilledUrl(
    formUrl: string,
    profile: LeadProfileLike,
    extras: PrefillExtras = {},
  ): Promise<string> {
    const fields = await this.getFields(formUrl);
    return buildPrefilledUrl(formUrl, fields, profile, extras);
  }
}

export { buildPrefilledUrl, parseFormFields };
