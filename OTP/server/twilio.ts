import twilio from "twilio";

/**
 * Create a Twilio REST client using environment credentials.
 */
export function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    throw new Error(
      "Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN environment variables",
    );
  }

  return twilio(accountSid, authToken);
}

/**
 * Generate an Access Token for the Twilio Voice JS SDK.
 */
export function generateTwilioToken(identity: string) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const apiKey = process.env.TWILIO_API_KEY;
  const apiSecret = process.env.TWILIO_API_SECRET;
  const appSid = process.env.TWILIO_APP_SID; // TwiML App SID

  if (!accountSid || !apiKey || !apiSecret || !appSid) {
    throw new Error(
      "Missing Twilio token configuration: TWILIO_ACCOUNT_SID, TWILIO_API_KEY, TWILIO_API_SECRET, TWILIO_APP_SID",
    );
  }

  const AccessToken = twilio.jwt.AccessToken;
  const VoiceGrant = AccessToken.VoiceGrant;

  const voiceGrant = new VoiceGrant({
    outgoingApplicationSid: appSid,
    incomingAllow: true,
  });

  const token = new AccessToken(accountSid, apiKey, apiSecret, {
    identity,
  });
  token.addGrant(voiceGrant);

  return token.toJwt();
}

/**
 * Create a TwiML voice response for outbound dialing.
 */
export function createVoiceResponse(to: string) {
  const callerId = process.env.TWILIO_PHONE_NUMBER || "+18778561719";
  const response = new twilio.twiml.VoiceResponse();

  const dial = response.dial({ callerId });
  dial.number(to);

  return response.toString();
}