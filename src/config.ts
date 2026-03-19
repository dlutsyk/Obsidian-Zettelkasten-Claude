/**
 * Centralized configuration constants.
 */
export const CONFIG = {
  /** Max connection candidates returned by findConnections() */
  MAX_CONNECTIONS: 15,
  /** Min word length for keyword matching */
  KEYWORD_MIN_LENGTH: 4,
  /** Long keyword threshold — scores +2 instead of +1 */
  KEYWORD_LONG_LENGTH: 6,
  /** Points per shared tag */
  TAG_SCORE: 2,
  /** Min score to be included as connection candidate */
  MIN_CONNECTION_SCORE: 2,
  /** Shared MOC bonus points */
  MOC_BONUS: 2,
  /** Min notes per tag to form a cluster */
  MIN_CLUSTER_SIZE: 3,
  /** Default tree render depth */
  DEFAULT_TREE_DEPTH: 5,
  /** Max summary length in chars */
  MAX_SUMMARY_LENGTH: 500,
} as const;
