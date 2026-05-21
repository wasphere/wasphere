import { IsEnum } from 'class-validator';

export enum GroupSetting {
  Announcement = 'announcement',
  NotAnnouncement = 'not_announcement',
  Locked = 'locked',
  Unlocked = 'unlocked',
}

export class UpdateSettingsDto {
  @IsEnum(GroupSetting) setting: GroupSetting;
}
