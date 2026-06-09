import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** Body for sending a published Meta WhatsApp Flow to a recipient. */
export class SendFlowDto {
  @ApiProperty({ description: 'Recipient phone (E.164 digits) or WhatsApp JID', example: '923001234567' })
  @IsString() @MinLength(5) @MaxLength(40)
  to: string;

  @ApiProperty({ description: 'Published flow id (from GET /sessions/:id/flows)', example: '1234567890' })
  @IsString() @MinLength(1)
  flowId: string;

  @ApiProperty({ description: 'Button label that opens the flow', example: 'Book now' })
  @IsString() @MinLength(1) @MaxLength(30)
  cta: string;

  @ApiProperty({ description: 'Body text shown above the button', example: 'Tap below to book your appointment.' })
  @IsString() @MinLength(1) @MaxLength(1024)
  body: string;

  @ApiPropertyOptional({ description: 'Optional header text', example: 'Appointments' })
  @IsOptional() @IsString() @MaxLength(60)
  header?: string;

  @ApiPropertyOptional({ description: 'Optional footer text' })
  @IsOptional() @IsString() @MaxLength(60)
  footer?: string;

  @ApiPropertyOptional({ description: 'First screen id — required for "navigate" flows', example: 'WELCOME' })
  @IsOptional() @IsString() @MaxLength(100)
  screen?: string;

  @ApiPropertyOptional({ description: 'Flow action mode', enum: ['navigate', 'data_exchange'] })
  @IsOptional() @IsIn(['navigate', 'data_exchange'])
  mode?: 'navigate' | 'data_exchange';
}
