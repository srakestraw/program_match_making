export type OutboundSmsRequest = {
  toPhone: string;
  body: string;
  statusWebhookUrl?: string;
  fromPhone?: string;
  messagingServiceSid?: string;
};

export type OutboundSmsResponse = {
  sid: string;
  status?: string;
  errorCode?: string | null;
  errorMessage?: string | null;
};

export type SmsProvider = {
  sendMessage: (input: OutboundSmsRequest) => Promise<OutboundSmsResponse>;
};

class TwilioSmsAdapter implements SmsProvider {
  private readonly accountSid: string;
  private readonly authToken: string;

  constructor(params: { accountSid: string; authToken: string }) {
    this.accountSid = params.accountSid;
    this.authToken = params.authToken;
  }

  async sendMessage(input: OutboundSmsRequest): Promise<OutboundSmsResponse> {
    const form = new URLSearchParams({
      To: input.toPhone,
      Body: input.body
    });

    if (input.messagingServiceSid) {
      form.set("MessagingServiceSid", input.messagingServiceSid);
    } else if (input.fromPhone) {
      form.set("From", input.fromPhone);
    } else {
      throw new Error("SMS requires TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER");
    }

    if (input.statusWebhookUrl) {
      form.set("StatusCallback", input.statusWebhookUrl);
    }

    const basic = Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64");

    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: form.toString()
    });

    const payload: any = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message = typeof payload?.message === "string" ? payload.message : "Failed to send SMS";
      throw new Error(message);
    }

    return {
      sid: String(payload.sid),
      status: typeof payload.status === "string" ? payload.status : undefined,
      errorCode: payload.error_code ? String(payload.error_code) : null,
      errorMessage: payload.error_message ? String(payload.error_message) : null
    };
  }
}

let adapterOverride: SmsProvider | null = null;

export const setSmsProviderForTests = (provider: SmsProvider | null) => {
  adapterOverride = provider;
};

export const getSmsProvider = (): SmsProvider => {
  if (adapterOverride) return adapterOverride;

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    throw new Error("Twilio credentials are not configured");
  }

  return new TwilioSmsAdapter({ accountSid, authToken });
};
