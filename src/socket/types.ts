export interface WebSocketEventPayload<Action extends string, Payload = undefined> {
  event: Action;
  data: {
    action: Action;
    payload?: Payload;
  };
}
