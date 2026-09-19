import * as migration_20260203_111507_init from './20260203_111507_init';
import * as migration_20260204_225235_optional_category_relationship from './20260204_225235_optional_category_relationship';
import * as migration_20260210_123514 from './20260210_123514';
import * as migration_20260213_071200_replace_slugField_with_payload_s from './20260213_071200_replace_slugField_with_payload_s';
import * as migration_20260213_185705_fix_img_full_url from './20260213_185705_fix_img_full_url';
import * as migration_20260214_144447_shop_analytics from './20260214_144447_shop_analytics';
import * as migration_20260214_211145_partner_content_cleanup from './20260214_211145_partner_content_cleanup';
import * as migration_20260215_184235 from './20260215_184235';
import * as migration_20260309_051932 from './20260309_051932';
import * as migration_20260310_100454 from './20260310_100454';
import * as migration_20260314_193220 from './20260314_193220';
import * as migration_20260316_140421 from './20260316_140421';
import * as migration_20260322_185733 from './20260322_185733';
import * as migration_20260418_214851 from './20260418_214851';
import * as migration_20260418_234555 from './20260418_234555';
import * as migration_20260517_100032 from './20260517_100032';
import * as migration_20260517_141537 from './20260517_141537';
import * as migration_20260517_232052 from './20260517_232052';
import * as migration_20260523_173532 from './20260523_173532';
import * as migration_20260608_004551_notification_cascade_delete from './20260608_004551_notification_cascade_delete';
import * as migration_20260608_013824_fix_notification_cascade from './20260608_013824_fix_notification_cascade';
import * as migration_20260620_215834 from './20260620_215834';
import * as migration_20260621_220355_reactions_to_polymorphic from './20260621_220355_reactions_to_polymorphic';
import * as migration_20260621_220614_fix_user_news_cascade from './20260621_220614_fix_user_news_cascade';
import * as migration_20260622_120000_comments_cascade_delete from './20260622_120000_comments_cascade_delete';
import * as migration_20260627_122202 from './20260627_122202';
import * as migration_20260627_131103 from './20260627_131103';
import * as migration_20260627_132437 from './20260627_132437';
import * as migration_20260702_095305 from './20260702_095305';
import * as migration_20260702_102512 from './20260702_102512';
import * as migration_20260718_071254 from './20260718_071254';
import * as migration_20260719_060000_backfill_comment_counts from './20260719_060000_backfill_comment_counts';
import * as migration_20260721_110118 from './20260721_110118';
import * as migration_20260811_093634 from './20260811_093634';
import * as migration_20260815_041656 from './20260815_041656';
import * as migration_20260815_091616 from './20260815_091616';
import * as migration_20260816_010657 from './20260816_010657';
import * as migration_20260818_171212 from './20260818_171212';
import * as migration_20260820_172902_scheduled_notification_timezone from './20260820_172902_scheduled_notification_timezone';
import * as migration_20260821_000000_fix_comments_news_cascade from './20260821_000000_fix_comments_news_cascade';
import * as migration_20260821_010000_reapply_cascade_fixes from './20260821_010000_reapply_cascade_fixes';
import * as migration_20260822_194144_drop_legacy_lottery from './20260822_194144_drop_legacy_lottery';
import * as migration_20260823_073220_partner_content_weight from './20260823_073220_partner_content_weight';
import * as migration_20260823_090000_delete_cascade_notifications from './20260823_090000_delete_cascade_notifications';
import * as migration_20260823_093000_delete_cascade_partners_giveaway from './20260823_093000_delete_cascade_partners_giveaway';
import * as migration_20260905_120000_analytics_retention_and_feed_indexes from './20260905_120000_analytics_retention_and_feed_indexes';

export const migrations = [
  {
    up: migration_20260203_111507_init.up,
    down: migration_20260203_111507_init.down,
    name: '20260203_111507_init',
  },
  {
    up: migration_20260204_225235_optional_category_relationship.up,
    down: migration_20260204_225235_optional_category_relationship.down,
    name: '20260204_225235_optional_category_relationship',
  },
  {
    up: migration_20260210_123514.up,
    down: migration_20260210_123514.down,
    name: '20260210_123514',
  },
  {
    up: migration_20260213_071200_replace_slugField_with_payload_s.up,
    down: migration_20260213_071200_replace_slugField_with_payload_s.down,
    name: '20260213_071200_replace_slugField_with_payload_s',
  },
  {
    up: migration_20260213_185705_fix_img_full_url.up,
    down: migration_20260213_185705_fix_img_full_url.down,
    name: '20260213_185705_fix_img_full_url',
  },
  {
    up: migration_20260214_144447_shop_analytics.up,
    down: migration_20260214_144447_shop_analytics.down,
    name: '20260214_144447_shop_analytics',
  },
  {
    up: migration_20260214_211145_partner_content_cleanup.up,
    down: migration_20260214_211145_partner_content_cleanup.down,
    name: '20260214_211145_partner_content_cleanup',
  },
  {
    up: migration_20260215_184235.up,
    down: migration_20260215_184235.down,
    name: '20260215_184235',
  },
  {
    up: migration_20260309_051932.up,
    down: migration_20260309_051932.down,
    name: '20260309_051932',
  },
  {
    up: migration_20260310_100454.up,
    down: migration_20260310_100454.down,
    name: '20260310_100454',
  },
  {
    up: migration_20260314_193220.up,
    down: migration_20260314_193220.down,
    name: '20260314_193220',
  },
  {
    up: migration_20260316_140421.up,
    down: migration_20260316_140421.down,
    name: '20260316_140421',
  },
  {
    up: migration_20260322_185733.up,
    down: migration_20260322_185733.down,
    name: '20260322_185733',
  },
  {
    up: migration_20260418_214851.up,
    down: migration_20260418_214851.down,
    name: '20260418_214851',
  },
  {
    up: migration_20260418_234555.up,
    down: migration_20260418_234555.down,
    name: '20260418_234555',
  },
  {
    up: migration_20260517_100032.up,
    down: migration_20260517_100032.down,
    name: '20260517_100032',
  },
  {
    up: migration_20260517_141537.up,
    down: migration_20260517_141537.down,
    name: '20260517_141537',
  },
  {
    up: migration_20260517_232052.up,
    down: migration_20260517_232052.down,
    name: '20260517_232052',
  },
  {
    up: migration_20260523_173532.up,
    down: migration_20260523_173532.down,
    name: '20260523_173532',
  },
  {
    up: migration_20260608_004551_notification_cascade_delete.up,
    down: migration_20260608_004551_notification_cascade_delete.down,
    name: '20260608_004551_notification_cascade_delete',
  },
  {
    up: migration_20260608_013824_fix_notification_cascade.up,
    down: migration_20260608_013824_fix_notification_cascade.down,
    name: '20260608_013824_fix_notification_cascade',
  },
  {
    up: migration_20260620_215834.up,
    down: migration_20260620_215834.down,
    name: '20260620_215834',
  },
  {
    up: migration_20260621_220355_reactions_to_polymorphic.up,
    down: migration_20260621_220355_reactions_to_polymorphic.down,
    name: '20260621_220355_reactions_to_polymorphic',
  },
  {
    up: migration_20260621_220614_fix_user_news_cascade.up,
    down: migration_20260621_220614_fix_user_news_cascade.down,
    name: '20260621_220614_fix_user_news_cascade',
  },
  {
    up: migration_20260622_120000_comments_cascade_delete.up,
    down: migration_20260622_120000_comments_cascade_delete.down,
    name: '20260622_120000_comments_cascade_delete',
  },
  {
    up: migration_20260627_122202.up,
    down: migration_20260627_122202.down,
    name: '20260627_122202',
  },
  {
    up: migration_20260627_131103.up,
    down: migration_20260627_131103.down,
    name: '20260627_131103',
  },
  {
    up: migration_20260627_132437.up,
    down: migration_20260627_132437.down,
    name: '20260627_132437',
  },
  {
    up: migration_20260702_095305.up,
    down: migration_20260702_095305.down,
    name: '20260702_095305',
  },
  {
    up: migration_20260702_102512.up,
    down: migration_20260702_102512.down,
    name: '20260702_102512',
  },
  {
    up: migration_20260718_071254.up,
    down: migration_20260718_071254.down,
    name: '20260718_071254',
  },
  {
    up: migration_20260719_060000_backfill_comment_counts.up,
    down: migration_20260719_060000_backfill_comment_counts.down,
    name: '20260719_060000_backfill_comment_counts',
  },
  {
    up: migration_20260721_110118.up,
    down: migration_20260721_110118.down,
    name: '20260721_110118',
  },
  {
    up: migration_20260811_093634.up,
    down: migration_20260811_093634.down,
    name: '20260811_093634',
  },
  {
    up: migration_20260815_041656.up,
    down: migration_20260815_041656.down,
    name: '20260815_041656',
  },
  {
    up: migration_20260815_091616.up,
    down: migration_20260815_091616.down,
    name: '20260815_091616',
  },
  {
    up: migration_20260816_010657.up,
    down: migration_20260816_010657.down,
    name: '20260816_010657',
  },
  {
    up: migration_20260818_171212.up,
    down: migration_20260818_171212.down,
    name: '20260818_171212',
  },
  {
    up: migration_20260820_172902_scheduled_notification_timezone.up,
    down: migration_20260820_172902_scheduled_notification_timezone.down,
    name: '20260820_172902_scheduled_notification_timezone',
  },
  {
    up: migration_20260821_000000_fix_comments_news_cascade.up,
    down: migration_20260821_000000_fix_comments_news_cascade.down,
    name: '20260821_000000_fix_comments_news_cascade',
  },
  {
    up: migration_20260821_010000_reapply_cascade_fixes.up,
    down: migration_20260821_010000_reapply_cascade_fixes.down,
    name: '20260821_010000_reapply_cascade_fixes',
  },
  {
    up: migration_20260822_194144_drop_legacy_lottery.up,
    down: migration_20260822_194144_drop_legacy_lottery.down,
    name: '20260822_194144_drop_legacy_lottery',
  },
  {
    up: migration_20260823_073220_partner_content_weight.up,
    down: migration_20260823_073220_partner_content_weight.down,
    name: '20260823_073220_partner_content_weight'
  },
  {
    up: migration_20260823_090000_delete_cascade_notifications.up,
    down: migration_20260823_090000_delete_cascade_notifications.down,
    name: '20260823_090000_delete_cascade_notifications',
  },
  {
    up: migration_20260823_093000_delete_cascade_partners_giveaway.up,
    down: migration_20260823_093000_delete_cascade_partners_giveaway.down,
    name: '20260823_093000_delete_cascade_partners_giveaway',
  },
  {
    up: migration_20260905_120000_analytics_retention_and_feed_indexes.up,
    down: migration_20260905_120000_analytics_retention_and_feed_indexes.down,
    name: '20260905_120000_analytics_retention_and_feed_indexes',
  },
];
