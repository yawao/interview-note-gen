// 出典バッジシステムの閾値設定
export const CONF_STRONG = 0.70;
export const CONF_WEAK = 0.40;

// バッジの色とラベル
export const getBadgeTone = (confidence: number, sources: string[]): 'green' | 'yellow' | 'gray' => {
  if (!sources?.length || confidence < CONF_WEAK) return 'gray';
  if (confidence >= CONF_STRONG) return 'green';
  return 'yellow';
};

export const getBadgeLabel = (confidence: number, sources: string[]): string => {
  if (!sources?.length || confidence < CONF_WEAK) return '出典なし（下書き段階）';
  if (confidence >= CONF_STRONG) return '出典十分（自動判定）';
  return '出典薄い（自動判定・要確認）';
};