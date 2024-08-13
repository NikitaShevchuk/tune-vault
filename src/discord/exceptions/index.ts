export class InvalidLinkError extends Error {
  constructor(message = 'Invalid track URL') {
    super(message);
  }
}

export class NotVoiceChannelMemberError extends Error {
  constructor(message = 'User must be a member of a voice channel to play audio') {
    super(message);
  }
}

export class InvalidPlayerActionError extends Error {
  constructor(message = 'Invalid player action') {
    super(message);
  }
}

export class NoTextChannelFound extends Error {
  constructor(guildId: string, message = 'No active text-based channel found for guild with id: ') {
    super(message + guildId);
  }
}
