import { Module } from '@nestjs/common';
import { EnrollmentFormService } from './enrollment-form.service';

@Module({
  providers: [EnrollmentFormService],
  exports: [EnrollmentFormService],
})
export class EnrollmentModule {}
