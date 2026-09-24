// Bilingual translation dictionary for JEV vs LAYA Tetris AI Platform

export const TRANSLATIONS = {
  zh: {
    // Header & Dock
    brand_sub: '俄罗斯方块 AI 决战平台',
    dock_laya_title: '点击配置 LAYA 本地引擎',
    dock_jev_title: '点击配置 JEV 云端模型',
    dock_llm_title: '点击配置 Gemini 解说席',
    dock_laya_name: 'LAYA 引擎',
    dock_jev_name: 'JEV 模型',
    dock_llm_name: 'AI 解说席',
    dock_offline: '离线/未连接',
    dock_wait_key: '待配置密钥',
    btn_settings: '模型服务设置',
    lang_btn_text: 'EN',

    // VS Screen
    left_tag_cloud: 'CLOUD AI · TypeSafe Jev',
    left_tag_human: 'HUMAN · 人类玩家',
    left_blurb_jev: 'TypeSafe 云端 System 1 决策大模型。善于深谋远虑，全盘评估局势，规划 Back-to-Back 连锁与 T-Spin Double 战术打击。',
    vs_title: '俄罗斯方块 AI 决战平台',
    mode_label: '对战模式 (Match Mode)',
    mode_jev_laya: '🔥 Jev vs Laya (AI巅峰双雄战)',
    mode_human_laya: '人类玩家 vs Laya (挑战超低延迟GPU)',
    mode_human_jev: '人类玩家 vs Jev (挑战云端战术大模型)',
    speed_label: '对战落子速度 (Battle Speed)',
    speed_0_8: '0.8 块/秒 · 慢速热身 (Warmup)',
    speed_1_2: '1.2 块/秒 · 休闲对局 (Casual)',
    speed_1_8: '1.8 块/秒 · 标准对战 (Standard)',
    speed_2_5: '2.5 块/秒 · 高阶电竞 (Fast)',
    speed_3_5: '3.5 块/秒 · 极速交锋 (Extreme)',
    speed_unlimited: '0 延迟限制 (Unlimited)',
    speed_max: 'MAX · GPU 超人类极速 (~36ms)',
    btn_start: '开始对决 (Start Battle)',
    vs_hint: '按 Enter 开始 · Esc 暂停',
    vs_checking: '检测服务连接状态中…',
    right_tag_laya: 'LOCAL GPU · Laya ModernBERT',
    right_blurb_laya: '部署于 172.24.0.5 服务器的本地 GPU 决策引擎 (NVIDIA TITAN RTX)。决策耗时仅 35-45ms，以极速下落与严密防守见长。',

    // Keys
    key_move: '左右移动',
    key_soft_drop: '软降',
    key_hard_drop: '硬降 (直接锁定)',
    key_rot_cw: '顺时针旋转',
    key_rot_ccw: '逆时针旋转',
    key_rot_180: '180°旋转',
    key_hold: '暂存方块 (Hold)',

    // Match Screen
    commentary_badge: '🎙️ Gemini AI 实时解说',
    commentary_waiting: '正在连线 AI 赛况解说席，对局即将开始...',
    footer_esc_hint: '按 Esc 暂停对战',
    footer_rules: 'Jev (TypeSafe 云端大模型) VS Laya (本地 GPU ModernBERT) · TETR.IO 竞赛规则',
    stat_pieces: '落块数',
    stat_lines: '消除行',
    stat_attack: '攻击行',
    stat_spins: 'T-Spins',
    stat_combo: '连击',

    // Paused & Results
    paused_title: '对决已暂停 (Paused)',
    btn_resume: '继续对战 (Resume)',
    btn_menu: '返回菜单 (Menu)',
    btn_rematch: '再来一局 (Rematch)',
    rematch_hint: '按 Enter 快速重赛',
    result_kicker_win: 'VICTORY',
    result_kicker_defeat: 'DEFEAT',
    result_kicker_over: 'MATCH OVER',
    table_pieces: '落块数 (pieces)',
    table_pps: '落块速度 (PPS)',
    table_attack: '攻击行数 (attack)',
    table_apm: '攻击速率 (APM)',
    table_lines: '消除行数 (lines)',
    table_spins: 'T-Spins 旋转',
    table_duration: '对决时长',

    // Settings Drawer
    drawer_title: '模型与服务配置',
    drawer_subtitle: '实时调配 LAYA、JEV 决策基座及 Gemini 电竞战况解说席',
    tab_laya: '⚡ LAYA 本地引擎',
    tab_jev: '☁️ JEV 云端大模型',
    tab_llm: '🎙️ GEMINI 解说席',

    // Top Alert Banner
    alert_btn_configure: '立即配置',
    alert_missing_jev: '⚠️ 当前模式需要 JEV 云端大模型，但尚未配置有效 API Key (Secret Key)。',
    alert_missing_laya: '⚠️ 当前模式需要 LAYA 本地 GPU 引擎，但尚未连接到服务 (127.0.0.1:8300)。',
    alert_missing_both: '⚠️ 当前对战所需模型 (JEV & LAYA) 均未配置或处于离线状态。',
    alert_offline: '⚠️ 后端模型服务尚未启动或无法访问，可点击右侧配置服务地址或填入 Key。',
    
    label_laya_url: '服务基础地址 (Base URL)',
    label_laya_model: '模型标识 (Model)',
    label_laya_path: '预测接口路径 (Path)',
    preset_label: '快捷预设:',
    preset_local: '本地环回 127.0.0.1:8300',
    preset_remote: '内网 172.24.0.5:8300',
    btn_ping: '测试连通',

    label_jev_key: 'TypeSafe API Key (Secret Key / SK)',
    label_jev_url: 'API 基础地址 (Base URL)',
    label_jev_model: '模型版本 (Model)',
    placeholder_sk_keep: '留空保持原配置秘钥',

    label_llm_key: 'API 密钥 (Secret Key / SK)',
    label_llm_url: '代理服务端点 (Endpoint)',
    label_llm_model: '模型名称 (Model)',

    btn_cancel: '取消',
    btn_save: '保存配置并即时热更新',
    msg_saving: '正在保存并热重载配置...',
    msg_saved: '✅ 配置已即时热更新生效！',
    toast_saved_title: '配置已更新',
    toast_saved_body: '模型与服务基座已实时重载生效',
    toast_preset_title: '预设已载入',
    toast_preset_body: '已自动填入服务地址',
  },

  en: {
    // Header & Dock
    brand_sub: 'Tetris AI Battle Arena',
    dock_laya_title: 'Click to configure LAYA Local Engine',
    dock_jev_title: 'Click to configure JEV Cloud Model',
    dock_llm_title: 'Click to configure Gemini Commentary',
    dock_laya_name: 'LAYA Engine',
    dock_jev_name: 'JEV Model',
    dock_llm_name: 'AI Commentary',
    dock_offline: 'Offline',
    dock_wait_key: 'Key Needed',
    btn_settings: 'Model Settings',
    lang_btn_text: '中文',

    // VS Screen
    left_tag_cloud: 'CLOUD AI · TypeSafe Jev',
    left_tag_human: 'HUMAN PLAYER',
    left_blurb_jev: 'TypeSafe Cloud System 1 Decision Model. Masters tactical foresight, board risk assessment, and Back-to-Back / T-Spin Double strikes.',
    vs_title: 'Tetris AI Battle Arena',
    mode_label: 'Match Mode',
    mode_jev_laya: '🔥 Jev vs Laya (AI Dual Titans)',
    mode_human_laya: 'Human Player vs Laya (Low-Latency GPU)',
    mode_human_jev: 'Human Player vs Jev (Cloud Strategic LLM)',
    speed_label: 'Battle Speed',
    speed_0_8: '0.8 PPS · Warmup',
    speed_1_2: '1.2 PPS · Casual',
    speed_1_8: '1.8 PPS · Standard Match',
    speed_2_5: '2.5 PPS · Fast Esports',
    speed_3_5: '3.5 PPS · Extreme Speed',
    speed_unlimited: '0 Delay · Unlimited',
    speed_max: 'MAX · GPU Superhuman (~36ms)',
    btn_start: 'Start Battle',
    vs_hint: 'Press Enter to Start · Esc to Pause',
    vs_checking: 'Checking service connectivity…',
    right_tag_laya: 'LOCAL GPU · Laya ModernBERT',
    right_blurb_laya: 'On-premise GPU decision engine on 172.24.0.5 (NVIDIA TITAN RTX). Ultra-low 35-45ms latency with rapid drops and rock-solid defense.',

    // Keys
    key_move: 'Left / Right Move',
    key_soft_drop: 'Soft Drop',
    key_hard_drop: 'Hard Drop (Lock)',
    key_rot_cw: 'Rotate Clockwise',
    key_rot_ccw: 'Rotate Counter-CW',
    key_rot_180: '180° Rotate',
    key_hold: 'Hold Piece',

    // Match Screen
    commentary_badge: '🎙️ Gemini AI Live Commentary',
    commentary_waiting: 'Connecting to AI commentary desk, match starting soon...',
    footer_esc_hint: 'Press Esc to Pause',
    footer_rules: 'Jev (TypeSafe Cloud) VS Laya (Local GPU ModernBERT) · TETR.IO Rules',
    stat_pieces: 'pieces',
    stat_lines: 'lines',
    stat_attack: 'attack',
    stat_spins: 'spins',
    stat_combo: 'combo',

    // Paused & Results
    paused_title: 'Match Paused',
    btn_resume: 'Resume Match',
    btn_menu: 'Menu',
    btn_rematch: 'Rematch',
    rematch_hint: 'Press Enter for Rematch',
    result_kicker_win: 'VICTORY',
    result_kicker_defeat: 'DEFEAT',
    result_kicker_over: 'MATCH OVER',
    table_pieces: 'Pieces Placed',
    table_pps: 'Pieces Per Second (PPS)',
    table_attack: 'Garbage Sent (Attack)',
    table_apm: 'Attack Per Minute (APM)',
    table_lines: 'Lines Cleared',
    table_spins: 'T-Spins',
    table_duration: 'Match Time',

    // Settings Drawer
    drawer_title: 'Model & Service Config',
    drawer_subtitle: 'Configure LAYA, JEV decision engines and Gemini commentary proxy',
    tab_laya: '⚡ LAYA Local',
    tab_jev: '☁️ JEV Cloud',
    tab_llm: '🎙️ GEMINI Commentary',

    // Top Alert Banner
    alert_btn_configure: 'Configure Now',
    alert_missing_jev: '⚠️ Current mode requires JEV Cloud Model, but API Key (Secret Key) is not configured.',
    alert_missing_laya: '⚠️ Current mode requires LAYA GPU Engine, but cannot connect to service (127.0.0.1:8300).',
    alert_missing_both: '⚠️ Required models (JEV & LAYA) for current battle are offline or not configured.',
    alert_offline: '⚠️ Backend model service is unreachable. Click to configure service URL or API Key.',

    label_laya_url: 'Base URL',
    label_laya_model: 'Model Identifier',
    label_laya_path: 'Inference Endpoint Path',
    preset_label: 'Presets:',
    preset_local: 'Localhost 127.0.0.1:8300',
    preset_remote: 'LAN 172.24.0.5:8300',
    btn_ping: 'Ping Test',

    label_jev_key: 'TypeSafe API Key (Secret Key / SK)',
    label_jev_url: 'Base URL',
    label_jev_model: 'Model Version',
    placeholder_sk_keep: 'Leave empty to preserve existing key',

    label_llm_key: 'API Key (Secret Key / SK)',
    label_llm_url: 'Proxy Endpoint',
    label_llm_model: 'Model Name',

    btn_cancel: 'Cancel',
    btn_save: 'Save & Hot Reload',
    msg_saving: 'Saving and hot-reloading...',
    msg_saved: '✅ Configuration applied successfully!',
    toast_saved_title: 'Config Saved',
    toast_saved_body: 'Model engines have been hot-reloaded',
    toast_preset_title: 'Preset Loaded',
    toast_preset_body: 'URL has been filled into input',
  }
}

let currentLang = localStorage.getItem('tetris_lang') || 'zh'

export function getLang() {
  return currentLang
}

export function setLang(lang) {
  if (lang !== 'zh' && lang !== 'en') lang = 'zh'
  currentLang = lang
  localStorage.setItem('tetris_lang', lang)
  applyTranslations()
  return currentLang
}

export function t(key) {
  return TRANSLATIONS[currentLang]?.[key] ?? TRANSLATIONS['zh'][key] ?? key
}

export function applyTranslations() {
  const dict = TRANSLATIONS[currentLang]
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n
    if (dict[key]) {
      el.textContent = dict[key]
    }
  })

  document.querySelectorAll('[data-i18n-ph]').forEach((el) => {
    const key = el.dataset.i18nPh
    if (dict[key]) {
      el.setAttribute('placeholder', dict[key])
    }
  })

  document.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const key = el.dataset.i18nTitle
    if (dict[key]) {
      el.setAttribute('title', dict[key])
    }
  })

  const langLabel = document.getElementById('lang-label')
  if (langLabel) {
    langLabel.textContent = currentLang === 'zh' ? 'EN' : '中文'
  }
}
