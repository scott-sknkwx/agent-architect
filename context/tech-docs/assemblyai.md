# AssemblyAI

Speech-to-text transcription API. High accuracy, speaker diarization, async processing.

## When Agent Architect Uses This

- Transcribing podcasts, calls, meetings
- Extracting speakers from multi-person audio
- Summarizing audio content

## Basic Transcription
```typescript
import { AssemblyAI } from 'assemblyai';

const client = new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY });

// Submit for transcription (async)
const transcript = await client.transcripts.transcribe({
  audio_url: 'https://example.com/podcast.mp3',
  speaker_labels: true,  // Who said what
});

// transcript.text = full text
// transcript.utterances = speaker-separated segments
```

## Key Features

| Feature | Use Case |
|---------|----------|
| `speaker_labels` | Identify different speakers |
| `auto_chapters` | Break into logical sections |
| `entity_detection` | Extract names, companies, etc. |
| `sentiment_analysis` | Tone of each segment |
| `summarization` | TL;DR of content |

## Response Format
```json
{
  "id": "transcript_id",
  "status": "completed",
  "text": "Full transcript text...",
  "utterances": [
    {
      "speaker": "A",
      "text": "Welcome to the show...",
      "start": 0,
      "end": 5000
    },
    {
      "speaker": "B", 
      "text": "Thanks for having me...",
      "start": 5000,
      "end": 8000
    }
  ],
  "chapters": [
    {
      "headline": "Introduction",
      "summary": "Host welcomes guest...",
      "start": 0,
      "end": 60000
    }
  ]
}
```

## Agent Patterns

### Async Processing
```
podcast.found → Transcriber agent submits job
                    ↓
              (AssemblyAI processes ~10-30min)
                    ↓
              Poll or webhook → transcript.ready
                    ↓
              podcast.transcribed event
```

### Extract Guest Info
```typescript
// Use entity_detection to find guest name/company
// Use utterances to get what the guest said specifically
```

## Limits

- Max file: 5GB
- Processing: ~15-30% of audio duration
- Rate limits vary by plan

## TODO: Add More

- [ ] Webhook callback setup
- [ ] LeMUR integration (Q&A over transcripts)
- [ ] Real-time streaming
