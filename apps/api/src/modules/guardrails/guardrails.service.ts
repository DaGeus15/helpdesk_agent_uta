import { Injectable, Logger } from '@nestjs/common';
import { CatalogService } from '../catalog/catalog.service';
import {
  postCheck as runPostCheck,
  preCheck as runPreCheck,
  type PostCheckResult,
  type PreCheckResult,
} from './guardrails.logic';

export type { PostCheckResult, PreCheckResult };

@Injectable()
export class GuardrailsService {
  private readonly logger = new Logger(GuardrailsService.name);

  constructor(private readonly catalog: CatalogService) {}

  preCheck(text: string): PreCheckResult {
    const result = runPreCheck(text);
    if (result.matches.length > 0) {
      this.logger.warn(
        `Injection preCheck flagged: [${result.matches.join(', ')}]`,
      );
    }
    return result;
  }

  async postCheck(reply: string): Promise<PostCheckResult> {
    const [allowedAmounts, allowedPercents] = await Promise.all([
      this.catalog.getAllowedAmounts(),
      this.catalog.getAllowedPercents(),
    ]);

    const result = runPostCheck(reply, allowedAmounts, allowedPercents);

    if (result.violations.length > 0) {
      this.logger.warn(
        `Guardrails postCheck blocked: [${result.violations.join(', ')}]`,
      );
    }

    return result;
  }
}
