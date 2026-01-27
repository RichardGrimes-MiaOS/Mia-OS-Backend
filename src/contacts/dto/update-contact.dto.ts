import { PartialType } from '@nestjs/swagger';
import { CreateContactDto } from './create-contact.dto';

/**
 * DTO for updating contact information
 *
 * Note: Pipeline stage updates use dedicated endpoint PATCH /contacts/:id/stage
 * This DTO does not include pipeline stage field
 */
export class UpdateContactDto extends PartialType(CreateContactDto) {}