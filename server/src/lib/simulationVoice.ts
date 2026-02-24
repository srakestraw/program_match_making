import { fetchOpenAiWithRetry } from "./openai.js";

const defaultVoice = "alloy";
const defaultModel = process.env.OPENAI_TTS_MODEL ?? "gpt-4o-mini-tts";

const buildFallbackWavDataUri = (durationSeconds = 1, sampleRate = 8000) => {
  const numChannels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const numSamples = Math.max(1, Math.floor(durationSeconds * sampleRate));
  const dataSize = numSamples * numChannels * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * bytesPerSample, 28);
  buffer.writeUInt16LE(numChannels * bytesPerSample, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  return `data:audio/wav;base64,${buffer.toString("base64")}`;
};

export const synthesizeVoiceSample = async (input: {
  text: string;
  voiceName?: string | null;
}): Promise<{ provider: string; audioUrl: string }> => {
  const apiKey = process.env.OPENAI_API_KEY;
  const text = input.text.trim().slice(0, 2000);

  if (!apiKey || text.length === 0) {
    return { provider: "stub", audioUrl: buildFallbackWavDataUri() };
  }

  try {
    const response = await fetchOpenAiWithRetry("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: defaultModel,
        voice: input.voiceName?.trim() || defaultVoice,
        input: text,
        format: "mp3"
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI TTS failed: ${response.status}`);
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length === 0) {
      throw new Error("OpenAI TTS returned empty audio payload");
    }

    return {
      provider: "openai",
      audioUrl: `data:audio/mpeg;base64,${bytes.toString("base64")}`
    };
  } catch {
    return { provider: "stub", audioUrl: buildFallbackWavDataUri() };
  }
};
