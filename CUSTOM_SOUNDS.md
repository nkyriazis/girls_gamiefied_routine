# Custom Alarm Sounds

You can now use custom uploaded MP3 files for alarm sounds!

## How to Use

### 1. Upload Your Sound File

**Option A: Via Parent Dashboard (Easiest)**

1. Navigate to the Parent Dashboard (append `?parent=true` to your URL)
2. Go to the "Dashboard" tab
3. Find the "Uploads" section
4. Click the file input and select your MP3 file
5. After upload, the filename will be automatically copied to your clipboard
6. Use this filename in step 2 below

**Option B: Via Command Line**

```bash
curl -X POST http://localhost:3000/api/admin/upload \
  -F "file=@your-alarm.mp3"
```

The response will include the filename (e.g., `1734567890-your-alarm.mp3`).

### 2. Update Your Flow Configuration

In `backend/data.json`, update the alarm step in your flow:

#### Option A: Built-in Sounds (Default)

```json
{
  "id": "u1-morning-flow",
  "steps": [
    {
      "type": "alarm",
      "props": {
        "sound": "melody"
      }
    }
  ]
}
```

Built-in options:
- `"melody"` - Pleasant wake-up tune (default)
- `"beep"` - Simple alarm beep

#### Option B: Custom Uploaded MP3

```json
{
  "id": "u1-morning-flow",
  "steps": [
    {
      "type": "alarm",
      "props": {
        "sound": {
          "type": "upload",
          "value": "1234567890-your-alarm.mp3"
        }
      }
    }
  ]
}
```

### 3. Example: Different Sounds for Each Child

```json
{
  "flows": [
    {
      "id": "u1-morning-flow",
      "steps": [
        {
          "type": "alarm",
          "props": {
            "sound": {
              "type": "upload",
              "value": "electra-favorite-song.mp3"
            }
          }
        },
        {
          "type": "parallel",
          "actions": [
            {
              "type": "routine",
              "userId": "u1",
              "routineId": "u1-assign-morning"
            }
          ]
        }
      ]
    },
    {
      "id": "u2-morning-flow",
      "steps": [
        {
          "type": "alarm",
          "props": {
            "sound": {
              "type": "upload",
              "value": "ifigenia-favorite-song.mp3"
            }
          }
        },
        {
          "type": "parallel",
          "actions": [
            {
              "type": "routine",
              "userId": "u2",
              "routineId": "u2-assign-morning"
            }
          ]
        }
      ]
    }
  ]
}
```

## Recommended Audio Format

- **Format**: MP3
- **Bitrate**: 128-192 kbps (balance between quality and file size)
- **Length**: 30-60 seconds (it will loop automatically)
- **Volume**: Normalize your audio to avoid too loud/quiet alarms

## Tips

1. **Test your sound first**: Upload and trigger manually using the "Trigger Actions" section in Parent Dashboard
2. **Keep files small**: Large files may take longer to load (aim for under 5MB)
3. **Use appropriate content**: Choose pleasant wake-up music for the children
4. **Fallback**: If the file fails to load, the alarm will be silent (always test before scheduling!)
5. **File naming**: The system automatically prefixes filenames with a timestamp to prevent conflicts

## Testing Your Alarm Sound

After uploading and configuring:

1. Go to Parent Dashboard → "Trigger Actions (Test)" section
2. Find your flow (e.g., "🔄 u1-morning-flow")
3. Click to trigger it immediately
4. The alarm will play with your custom sound
5. Dismiss it to confirm everything works
