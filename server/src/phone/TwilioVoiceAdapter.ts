export type OutboundCallRequest = {
  toPhone: string;
  fromPhone: string;
  voiceWebhookUrl: string;
  statusWebhookUrl: string;
};

export type OutboundCallResponse = {
  sid: string;
  status?: string;
};

export type TelephonyProvider = {
  createOutboundCall: (input: OutboundCallRequest) => Promise<OutboundCallResponse>;
};

class TwilioVoiceAdapter implements TelephonyProvider {
  private readonly accountSid: string;
  private readonly authToken: string;

  constructor(params: { accountSid: string; authToken: string }) {
    this.accountSid = params.accountSid;
    this.authToken = params.authToken;
  }

  async createOutboundCall(input: OutboundCallRequest): Promise<OutboundCallResponse> {
    const form = new URLSearchParams({
      To: input.toPhone,
      From: input.fromPhone,
      Url: input.voiceWebhookUrl,
      Method: "POST",
      StatusCallback: input.statusWebhookUrl,
      StatusCallbackMethod: "POST",
      StatusCallbackEvent: "initiated ringing answered completed busy no-answer failed canceled"
    });

    const basic = Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64");

    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Calls.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: form.toString()
    });

    const payload: any = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message = typeof payload?.message === "string" ? payload.message : "Failed to initiate outbound call";
      throw new Error(message);
    }

    return {
      sid: payload.sid,
      status: payload.status
    };
  }
}

let adapterOverride: TelephonyProvider | null = null;

export const setTelephonyProviderForTests = (provider: TelephonyProvider | null) => {
  adapterOverride = provider;
};

export const getTelephonyProvider = (): TelephonyProvider => {
  if (adapterOverride) return adapterOverride;

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    throw new Error("Twilio credentials are not configured");
  }

  return new TwilioVoiceAdapter({ accountSid, authToken });
};
