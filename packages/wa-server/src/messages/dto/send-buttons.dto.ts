import { IsString, IsNotEmpty, IsArray, ArrayMinSize, ArrayMaxSize, ValidateNested, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class ButtonItemDto {
  @ApiProperty({ description: 'Unique button ID (max 20 characters)', example: 'btn_yes' })
  @IsString() @IsNotEmpty() @MaxLength(20) id: string;

  @ApiProperty({ description: 'Button label shown to the user (max 20 characters)', example: 'Yes' })
  @IsString() @IsNotEmpty() @MaxLength(20) text: string;
}

export class SendButtonsDto {
  @ApiProperty({ description: 'Recipient phone number with country code (e.g. 923001234567) or full WhatsApp JID (e.g. 923001234567@s.whatsapp.net). Both formats are accepted.', example: '923001234567' })
  @IsString() @IsNotEmpty() @MaxLength(40) to: string;

  @ApiProperty({ description: 'Main message text (max 1024 characters)', example: 'Do you confirm your order?' })
  @IsString() @IsNotEmpty() @MaxLength(1024) text: string;

  @ApiProperty({ description: 'Footer text shown below the buttons (max 60 characters)', example: 'Reply with a button' })
  @IsString() @IsNotEmpty() @MaxLength(60) footer: string;

  @ApiProperty({ description: 'Array of buttons (1–3)', type: [ButtonItemDto] })
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(3)
  @ValidateNested({ each: true }) @Type(() => ButtonItemDto)
  buttons: ButtonItemDto[];
}
