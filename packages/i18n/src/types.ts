/**
 * i18n type definitions
 */

export const SUPPORTED_LANGUAGES = ['de', 'en'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: SupportedLanguage = 'de';

export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  de: 'Deutsch',
  en: 'English',
};

/**
 * Translation key structure
 */
export interface TranslationKeys {
  common: {
    loading: string;
    error: string;
    back: string;
    confirm: string;
    cancel: string;
    copy: string;
    share: string;
    leave: string;
    retry: string;
    reload: string;
    connected: string;
    disconnected: string;
    player: string;
    players: string;
    you: string;
  };
  home: {
    title: string;
    subtitle: string;
    createGame: string;
    joinGame: string;
    newGame: string;
    nickname: string;
    nicknamePlaceholder: string;
    playerCount: string;
    gameCode: string;
    gameCodePlaceholder: string;
    create: string;
    join: string;
  };
  waitingRoom: {
    title: string;
    gameCode: string;
    shareMessage: string;
    waitingForPlayers: string;
    waitingForPlayersCount: string;
    waitingForHost: string;
    startGame: string;
    host: string;
  };
  game: {
    phase: string;
    currentBid: string;
    bid: string;
    pass: string;
    yourBid: string;
    waitingForOtherPlayers: string;
    takeDabb: string;
    takeDabbCards: string;
    discardCards: string;
    selectCardsToDiscard: string;
    selectedCount: string;
    discard: string;
    chooseTrump: string;
    waitingForTrump: string;
    declareMelds: string;
    confirmMelds: string;
    noMelds: string;
    points: string;
    total: string;
    roundOver: string;
    nextRoundStarting: string;
    gameOver: string;
    wins: string;
    connectingToServer: string;
    yourTurn: string;
    tapAgainToPlay: string;
    score: string;
    scoreBoard: string;
    targetScore: string;
    trump: string;
    waitingForPlayer: string;
    choosingTrump: string;
    waitingForGameStart: string;
    dealing: string;
    round: string;
    bidWinner: string;
    bidNotMet: string;
    showHistory: string;
    hideHistory: string;
    melds: string;
    tricks: string;
    gameWinner: string;
  };
  phases: {
    waiting: string;
    dealing: string;
    bidding: string;
    dabb: string;
    trump: string;
    melding: string;
    tricks: string;
    scoring: string;
    finished: string;
  };
  errors: {
    enterNickname: string;
    enterGameCode: string;
    createFailed: string;
    joinFailed: string;
    unknownError: string;
    somethingWentWrong: string;
    unexpectedError: string;
  };
}

/**
 * Full translation resource type
 */
export type TranslationResource = {
  translation: TranslationKeys;
};
