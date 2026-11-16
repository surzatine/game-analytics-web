# Unity Game Analytics – MongoDB Database Schema

**Database Name:** `game_analytics`  
**Backend:** Node.js + Express.js  
**Database:** MongoDB  
**ODM:** Mongoose  
**Frontend:** React.js  
**Data Source:** Unity Game (C#)

---

# 1. Database Collections Overview

| No. | Collection | Purpose |
|---|---|---|
| 1 | `users` | Player information |
| 2 | `app_sessions` | Application session tracking |
| 3 | `game_sessions` | Gameplay session tracking |
| 4 | `events` | General event tracking |
| 5 | `inventory_events` | Inventory and item interactions |
| 6 | `item_purchases` | In-game item purchases |
| 7 | `currency_transactions` | Virtual currency transactions |
| 8 | `iap_transactions` | Real-money purchases |
| 9 | `ad_events` | Advertisement analytics |
| 10 | `level_events` | Level design and progression |
| 11 | `progression_events` | XP, missions and achievements |
| 12 | `performance_events` | Device and game performance |
| 13 | `experiments` | A/B testing configurations |
| 14 | `experiment_assignments` | Player experiment assignments |

# 2. Common ID Structure

| Property | Type | Description |
|---|---|---|
| `_id` | ObjectId | MongoDB document ID |
| `event_id` | String | Unique event UUID |
| `user_id` | String | Unique player UUID |
| `app_session_id` | String | Unique application session UUID |
| `game_session_id` | String | Unique gameplay session UUID |

### Session hierarchy

- One user can have multiple app sessions.
- One app session can have multiple game sessions.
- One game session can have multiple gameplay events.
- One app session can have multiple events.
- Every event has its own unique `event_id`.

# 3. Collection Schemas

## 3.1 users

**Purpose:** Stores player account and profile information.

| Property | Data Type | Description |
|---|---|---|
| `_id` | ObjectId | Primary key |
| `user_id` | String | Unique player ID |
| `username` | String | Player username |
| `email` | String | Optional player email |
| `platform` | String | Android, iOS, Windows |
| `country` | String | Player country |
| `account_created_at` | Date | Account registration date |
| `last_login_at` | Date | Last login timestamp |
| `is_active` | Boolean | Account status |
| `createdAt` | Date | Document creation time |
| `updatedAt` | Date | Last update time |

## 3.2 app_sessions

**Purpose:** Tracks application opening, loading, device information and session duration.

| Property | Data Type | Description |
|---|---|---|
| `_id` | ObjectId | Primary key |
| `app_session_id` | String | Unique app session ID |
| `user_id` | String | Player ID |
| `username` | String | Username snapshot |
| `device_name` | String | Device model |
| `device_os` | String | Operating system |
| `os_version` | String | OS version |
| `app_version` | String | Application version |
| `ip_address_anonymized` | String | Anonymised IP address |
| `available_storage_mb` | Number | Remaining storage |
| `graphics_setting` | String | Low, Medium, High, Ultra |
| `battery_percentage` | Number | Battery percentage |
| `charging_status` | Boolean | Charging status |
| `network_type` | String | Wi-Fi, 4G, 5G, Offline |
| `session_start` | Date | App opening timestamp |
| `loading_start` | Date | Loading start timestamp |
| `loading_complete` | Date | Loading completion timestamp |
| `session_end` | Date | App closing timestamp |
| `session_duration_ms` | Number | Total session duration |
| `session_status` | String | Active, Ended, Crashed |
| `createdAt` | Date | Document creation time |
| `updatedAt` | Date | Last update time |

## 3.3 game_sessions

**Purpose:** Tracks individual gameplay runs.

| Property | Data Type | Description |
|---|---|---|
| `_id` | ObjectId | Primary key |
| `game_session_id` | String | Unique gameplay session ID |
| `app_session_id` | String | Application session ID |
| `user_id` | String | Player ID |
| `game_id` | String | Game identifier |
| `game_mode_id` | String | Selected game mode |
| `level_id` | String | Level identifier |
| `character_id` | String | Selected character |
| `map_id` | String | Selected map |
| `difficulty` | String | Difficulty setting |
| `graphics_setting` | String | Graphics quality |
| `game_start_time` | Date | Gameplay start time |
| `game_end_time` | Date | Gameplay end time |
| `elapsed_time_ms` | Number | Gameplay duration |
| `game_outcome` | String | Win, Loss, Abandoned, Draw |
| `game_end_reason` | String | Death, Quit, Timeout, Disconnect |
| `death_count` | Number | Total player deaths |
| `respawn_count` | Number | Total respawns |
| `rage_quit` | Boolean | Behavioural classification |
| `createdAt` | Date | Document creation time |
| `updatedAt` | Date | Last update time |

## 3.4 events

**Purpose:** Stores general application and player interaction events.

| Property | Data Type | Description |
|---|---|---|
| `_id` | ObjectId | Primary key |
| `event_id` | String | Unique event ID |
| `event_name` | String | Event name |
| `user_id` | String | Player ID |
| `app_session_id` | String | Application session ID |
| `game_session_id` | String | Gameplay session ID, nullable |
| `event_timestamp_utc` | Date | UTC event timestamp |
| `elapsed_time_ms` | Number | Elapsed time |
| `event_sequence_number` | Number | Event sequence |
| `screen_name` | String | Current screen |
| `properties` | Object | Event-specific properties |
| `createdAt` | Date | Document creation time |

**Supported event examples:**

- `app_open`
- `loading_start`
- `loading_complete`
- `app_background`
- `app_foreground`
- `app_close`
- `button_click`
- `screen_view`
- `screen_exit`
- `game_mode_selected`
- `tutorial_start`
- `tutorial_complete`

## 3.5 inventory_events

**Purpose:** Tracks inventory views, item views and player preferences.

| Property | Data Type | Description |
|---|---|---|
| `_id` | ObjectId | Primary key |
| `event_id` | String | Unique event ID |
| `user_id` | String | Player ID |
| `app_session_id` | String | App session ID |
| `game_session_id` | String | Optional game session ID |
| `inventory_id` | String | Inventory identifier |
| `item_id` | String | Item identifier |
| `item_category` | String | Weapon, Skin, Character |
| `item_rarity` | String | Common, Rare, Epic, Legendary |
| `action_type` | String | View, Favourite, Equip, Unequip |
| `item_owned` | Boolean | Whether item is owned |
| `elapsed_time_ms` | Number | Elapsed time |
| `event_timestamp_utc` | Date | Event timestamp |

## 3.6 item_purchases

**Purpose:** Tracks virtual item purchases using in-game currency.

| Property | Data Type | Description |
|---|---|---|
| `_id` | ObjectId | Primary key |
| `purchase_id` | String | Unique purchase ID |
| `user_id` | String | Player ID |
| `app_session_id` | String | App session ID |
| `game_session_id` | String | Optional game session ID |
| `item_id` | String | Purchased item ID |
| `item_category` | String | Item category |
| `cost` | Number | Purchase cost |
| `currency_type` | String | Coins, Gems, Tokens |
| `purchase_source` | String | Shop, Inventory, Popup |
| `previous_view_event_id` | String | Related inventory event |
| `first_view_timestamp` | Date | First item view time |
| `purchase_timestamp` | Date | Purchase time |
| `decision_time_ms` | Number | Time between first view and purchase |
| `purchase_status` | String | Success, Failed, Cancelled |

## 3.7 currency_transactions

**Purpose:** Tracks virtual currency earned, spent and refunded.

| Property | Data Type | Description |
|---|---|---|
| `_id` | ObjectId | Primary key |
| `transaction_id` | String | Unique transaction ID |
| `user_id` | String | Player ID |
| `app_session_id` | String | App session ID |
| `game_session_id` | String | Optional game session ID |
| `currency_type` | String | Coins, Gems, Tokens |
| `transaction_type` | String | Earn, Spend, Refund |
| `amount` | Number | Transaction amount |
| `balance_before` | Number | Previous balance |
| `balance_after` | Number | Updated balance |
| `transaction_source` | String | Mission, Reward, Shop |
| `related_item_id` | String | Related item ID |
| `event_timestamp_utc` | Date | Transaction timestamp |

## 3.8 iap_transactions

**Purpose:** Tracks real-money in-app purchases.

| Property | Data Type | Description |
|---|---|---|
| `_id` | ObjectId | Primary key |
| `iap_id` | String | Unique IAP event ID |
| `user_id` | String | Player ID |
| `app_session_id` | String | App session ID |
| `product_id` | String | Store product ID |
| `product_name` | String | Product name |
| `product_category` | String | Coins, Gems, Bundle |
| `price` | Number | Purchase price |
| `price_currency` | String | USD, EUR, etc. |
| `store_platform` | String | Google Play, Apple |
| `store_transaction_id` | String | Store transaction ID |
| `purchase_status` | String | Success, Failed, Cancelled |
| `purchase_source` | String | Shop, Popup, Offer |
| `event_timestamp_utc` | Date | Purchase timestamp |

## 3.9 ad_events

**Purpose:** Tracks advertisement requests, impressions, clicks, closing and rewards.

| Property | Data Type | Description |
|---|---|---|
| `_id` | ObjectId | Primary key |
| `ad_event_id` | String | Unique ad event ID |
| `user_id` | String | Player ID |
| `app_session_id` | String | App session ID |
| `game_session_id` | String | Optional gameplay session |
| `ad_id` | String | Ad instance ID |
| `ad_network` | String | AdMob, Unity Ads |
| `ad_unit_id` | String | Ad placement ID |
| `ad_type` | String | Rewarded, Interstitial, Banner |
| `ad_placement` | String | Main Menu, Game Over, Shop |
| `ad_request_status` | String | Success, Failed |
| `ad_load_status` | String | Loaded, Failed |
| `ad_impression` | Boolean | Whether displayed |
| `ad_clicked` | Boolean | Whether clicked |
| `ad_opened_at` | Date | Opening timestamp |
| `ad_closed_at` | Date | Closing timestamp |
| `ad_duration_ms` | Number | Ad duration |
| `close_type` | String | User, SDK, Timeout |
| `force_close` | Boolean | Abnormal close indicator |
| `close_reason` | String | Closing reason |
| `reward_type` | String | Coins, Gems, Extra Life |
| `reward_amount` | Number | Reward amount |
| `reward_granted` | Boolean | Whether reward was granted |
| `ad_revenue` | Number | Advertising revenue |
| `revenue_currency` | String | Revenue currency |
| `event_timestamp_utc` | Date | Event timestamp |

## 3.10 level_events

**Purpose:** Tracks level difficulty, checkpoints, completion and failures.

| Property | Data Type | Description |
|---|---|---|
| `_id` | ObjectId | Primary key |
| `event_id` | String | Unique event ID |
| `user_id` | String | Player ID |
| `app_session_id` | String | App session ID |
| `game_session_id` | String | Gameplay session ID |
| `level_id` | String | Level identifier |
| `checkpoint_id` | String | Checkpoint identifier |
| `objective_id` | String | Objective identifier |
| `event_type` | String | Start, Complete, Fail, Restart |
| `attempt_number` | Number | Attempt number |
| `completion_status` | String | Complete, Failed, Abandoned |
| `death_count` | Number | Deaths in level |
| `time_to_complete_ms` | Number | Completion duration |
| `difficulty` | String | Difficulty setting |
| `event_timestamp_utc` | Date | Event timestamp |

## 3.11 progression_events

**Purpose:** Tracks player XP, missions, achievements and unlocks.

| Property | Data Type | Description |
|---|---|---|
| `_id` | ObjectId | Primary key |
| `event_id` | String | Unique event ID |
| `user_id` | String | Player ID |
| `app_session_id` | String | App session ID |
| `game_session_id` | String | Optional gameplay session |
| `event_type` | String | XP, Mission, Achievement |
| `progression_type` | String | LevelUp, XP, Unlock |
| `mission_id` | String | Mission identifier |
| `achievement_id` | String | Achievement identifier |
| `character_id` | String | Character identifier |
| `xp_amount` | Number | XP gained |
| `previous_level` | Number | Previous level |
| `new_level` | Number | New level |
| `event_timestamp_utc` | Date | Event timestamp |

## 3.12 performance_events

**Purpose:** Tracks game performance, device resources, FPS and technical issues.

| Property | Data Type | Description |
|---|---|---|
| `_id` | ObjectId | Primary key |
| `event_id` | String | Unique event ID |
| `user_id` | String | Player ID |
| `app_session_id` | String | App session ID |
| `game_session_id` | String | Gameplay session ID |
| `event_type` | String | FPS, Crash, Memory, Network |
| `device_name` | String | Device model |
| `graphics_setting` | String | Graphics setting |
| `fps_average` | Number | Average FPS |
| `fps_minimum` | Number | Minimum FPS |
| `memory_usage_mb` | Number | Memory consumption |
| `battery_percentage` | Number | Battery percentage |
| `charging_status` | Boolean | Charging status |
| `network_latency_ms` | Number | Network latency |
| `error_code` | String | Error identifier |
| `error_message` | String | Error details |
| `event_timestamp_utc` | Date | Event timestamp |

## 3.13 experiments

**Purpose:** Stores A/B testing configurations.

| Property | Data Type | Description |
|---|---|---|
| `_id` | ObjectId | Primary key |
| `experiment_id` | String | Experiment UUID |
| `experiment_name` | String | Experiment name |
| `description` | String | Experiment description |
| `variants` | Array | Available variants |
| `status` | String | Draft, Active, Completed |
| `start_date` | Date | Experiment start |
| `end_date` | Date | Experiment end |
| `createdAt` | Date | Creation timestamp |

## 3.14 experiment_assignments

**Purpose:** Tracks which experiment variant is assigned to each player.

| Property | Data Type | Description |
|---|---|---|
| `_id` | ObjectId | Primary key |
| `experiment_id` | String | Experiment ID |
| `user_id` | String | Player ID |
| `variant_id` | String | Assigned variant |
| `assigned_at` | Date | Assignment timestamp |

---

# 4. Standard Event Properties

The following properties should be included in relevant event documents.

| Property | Data Type | Description |
|---|---|---|
| `event_id` | String | Unique event UUID |
| `event_name` | String | Event name |
| `user_id` | String | Player UUID |
| `app_session_id` | String | Application session UUID |
| `game_session_id` | String | Gameplay session UUID, nullable |
| `event_timestamp_utc` | Date | UTC timestamp |
| `elapsed_time_ms` | Number | Elapsed time |
| `event_sequence_number` | Number | Event ordering |
| `platform` | String | Platform |
| `app_version` | String | Application version |
| `game_version` | String | Game version |

# 5. Recommended MongoDB Indexes

| Collection | Index |
|---|---|
| users | `user_id` (Unique) |
| app_sessions | `app_session_id` (Unique) |
| app_sessions | `user_id + session_start` |
| game_sessions | `game_session_id` (Unique) |
| game_sessions | `user_id + game_start_time` |
| events | `event_id` (Unique) |
| events | `user_id + event_timestamp_utc` |
| events | `event_name + event_timestamp_utc` |
| inventory_events | `user_id + item_id` |
| item_purchases | `user_id + purchase_timestamp` |
| currency_transactions | `user_id + event_timestamp_utc` |
| iap_transactions | `store_transaction_id` (Unique, when present) |
| ad_events | `user_id + event_timestamp_utc` |
| level_events | `level_id + event_type` |
| performance_events | `event_type + event_timestamp_utc` |
| experiment_assignments | `experiment_id + user_id` (Unique) |

# 6. Important Database Rules

1. Use UUID strings for Unity-generated identifiers.
2. Use MongoDB ObjectId for document primary keys.
3. Use UTC for all event timestamps.
4. Store elapsed time in milliseconds.
5. Keep `game_session_id` nullable for events occurring outside gameplay.
6. Avoid duplicating the same raw event across multiple collections.
7. Use separate transaction records for virtual currency and real-money purchases.
8. Use indexes for frequently queried fields.
9. Implement offline event queues in Unity.
10. Validate purchase transactions on the backend.
11. Use event IDs for duplicate prevention.
12. Apply privacy-conscious data collection and retention policies.

# 7. Main Analytics Dashboard Modules

| Dashboard | Data Collections |
|---|---|
| Overview | users, app_sessions, game_sessions |
| Player Analytics | users, events, app_sessions |
| Session Analytics | app_sessions, game_sessions |
| Button Analytics | events |
| Gameplay Analytics | game_sessions, events |
| Death Analytics | events |
| Respawn Analytics | events |
| Level Analytics | level_events |
| Inventory Analytics | inventory_events |
| Purchase Analytics | item_purchases |
| Currency Analytics | currency_transactions |
| IAP Analytics | iap_transactions |
| Advertisement Analytics | ad_events |
| Retention Analytics | users, app_sessions |
| Performance Analytics | performance_events |
| A/B Testing | experiments, experiment_assignments |

---

**End of Database Schema Documentation**

**Technology:** MongoDB + Mongoose + Express.js + React.js + Node.js  
**Project:** Unity Game Analytics Dashboard