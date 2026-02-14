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
    addAIPlayer: string;
    removeAI: string;
    aiPlayer: string;
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
    exitGame: string;
    exitGameConfirmTitle: string;
    exitGameConfirmMessage: string;
    gameTerminated: string;
    gameTerminatedMessage: string;
    backToHome: string;
    goOut: string;
    goOutIn: string;
    orGoOut: string;
    goOutConfirmTitle: string;
    goOutConfirmMessage: string;
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
    terminated: string;
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
  gameLog: {
    title: string;
    showMore: string;
    showLess: string;
    noEntries: string;
    yourTurn: string;
    // Event messages
    gameStarted: string;
    roundStarted: string;
    bidPlaced: string;
    playerPassed: string;
    biddingWon: string;
    goingOut: string;
    trumpDeclared: string;
    meldsDeclared: string;
    meldsNone: string;
    cardPlayed: string;
    trickWon: string;
    roundScored: string;
    gameFinished: string;
    gameTerminated: string;
  };
  rules: {
    title: string;
  };
  serverErrors: {
    // Session errors
    SESSION_NOT_FOUND: string;
    SESSION_FULL: string;
    SESSION_CODE_GENERATION_FAILED: string;
    // Game start errors
    NOT_ENOUGH_PLAYERS: string;
    GAME_ALREADY_STARTED: string;
    // General game errors
    NOT_YOUR_TURN: string;
    GAME_STATE_NOT_INITIALIZED: string;
    // Bidding phase errors
    NOT_IN_BIDDING_PHASE: string;
    NOT_YOUR_TURN_TO_BID: string;
    INVALID_BID_AMOUNT: string;
    FIRST_BIDDER_MUST_BID: string;
    // Dabb phase errors
    NOT_IN_DABB_PHASE: string;
    ONLY_BID_WINNER_CAN_TAKE_DABB: string;
    ONLY_BID_WINNER_CAN_DISCARD: string;
    MUST_DISCARD_EXACT_COUNT: string;
    CARD_NOT_IN_HAND: string;
    // Going out errors
    ONLY_BID_WINNER_CAN_GO_OUT: string;
    MUST_TAKE_DABB_BEFORE_GOING_OUT: string;
    // Trump phase errors
    NOT_IN_TRUMP_PHASE: string;
    ONLY_BID_WINNER_CAN_DECLARE_TRUMP: string;
    // Melding phase errors
    NOT_IN_MELDING_PHASE: string;
    CANNOT_MELD_WHEN_GOING_OUT: string;
    ALREADY_DECLARED_MELDS: string;
    // Tricks phase errors
    NOT_IN_TRICKS_PHASE: string;
    INVALID_PLAY: string;
    // Game termination errors
    CANNOT_TERMINATE_IN_CURRENT_PHASE: string;
    // AI player errors
    CANNOT_ADD_AI_WHEN_GAME_STARTED: string;
    CANNOT_REMOVE_AI_WHEN_GAME_STARTED: string;
    PLAYER_NOT_AI: string;
    NO_AVAILABLE_SLOTS: string;
    NOT_HOST: string;
    // Generic fallback
    UNKNOWN_ERROR: string;
  };
}

/**
 * Full translation resource type
 */
export type TranslationResource = {
  translation: TranslationKeys;
};
