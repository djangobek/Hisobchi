# Hisobchi — Voice AI upgrade

## Provider chain

### Speech-to-text (STT)
1. Gemini Audio — primary. Uses `GEMINI_API_KEY` and `GEMINI_STT_MODEL`.
2. ElevenLabs Scribe — secondary. Uses `ELEVENLABS_API_KEY`.
3. Muxlisa — tertiary fallback. Uses `MUXLISA_API_KEY`.

The STT chain keeps the original spoken language, retries transient failures, and continues to the next provider when a provider is unavailable or fails. Provider names are recorded in the bot logs without logging API secrets.

### Financial extraction (NLU)
1. Gemini models configured in `GEMINI_MODEL`.
2. Groq configured in `GROQ_MODEL`.
3. Local Uzbek/Russian parser.

The NLU prompt now explicitly distinguishes income, expense, borrowing, lending, and debt repayments; rejects negated/future intentions; and excludes transfers between the user's own accounts from income/expense.

## Accuracy and safety controls
- AI amounts are checked against amounts independently detected in the original transcript.
- An AI-generated amount that is not present in the transcript, or an amount repeated more times than spoken, is rejected.
- Local parsing supplements amounts that the LLM omitted, without duplicating already accepted operations.
- Existing user categories are preserved; the AI cannot create arbitrary categories.
- Voice operations remain drafts and are only saved after user confirmation.

## Environment setup

Copy `.env.example` to `.env`, then configure:
- `GEMINI_API_KEY` — required for primary Gemini audio and primary NLU.
- `GEMINI_STT_MODEL` — optional; defaults to `gemini-2.5-flash`.
- `ELEVENLABS_API_KEY` — optional secondary STT.
- `MUXLISA_API_KEY` — optional tertiary STT.
- `GROQ_API_KEY` — optional NLU fallback.

Never commit `.env` or expose provider keys in `NEXT_PUBLIC_*` variables.

## Verification notes

The source files were syntax-transpiled and the local parser was exercised against representative Uzbek voice-text examples, including multiple transactions, debt, incoming cash, negation, and future intentions. Full `npm test`, typecheck, and production build could not be completed in this environment because dependency installation timed out. Real provider calls also require the user's own API keys and should be verified after deployment.
