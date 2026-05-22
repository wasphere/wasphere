import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum GroupSetting {
  Announcement = 'announcement',
  NotAnnouncement = 'not_announcement',
  Locked = 'locked',
  Unlocked = 'unlocked',
}

export class UpdateSettingsDto {
  @ApiProperty({ description: 'Group setting to apply', enum: GroupSetting, example: GroupSetting.Announcement })
  @IsEnum(GroupSetting) setting: GroupSetting;
}
