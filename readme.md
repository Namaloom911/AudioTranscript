# Audio Transcript Application

This project processes and transcribes audio files, with a focus on stereo audio where the left and right channels are transcribed separately. It uses the [Whisper](https://github.com/openai/whisper) model for transcription and allows real-time feedback via server-sent events.

## Features

- **Stereo Audio Transcription**: Transcribes left and right audio channels separately.
- **Batch Processing**: Processes multiple files in batches to reduce server load.
- **Real-Time Updates**: Clients can receive real-time updates during the transcription process.

## Prerequisites

Before setting up this project, ensure you have the following installed:

- **Node.js** (for the server-side code)
- **Python 3** (for `transcribe.py` script)
- **ffmpeg** (for audio processing)

You can install ffmpeg with:
```bash
sudo apt-get install ffmpeg
```

## Setup

1. Clone the repository:

```bash
git clone https://github.com/Namaloom911/AudioTranscript.git
cd AudioTranscript
```

2. Install server dependencies:

```bash
npm install
```

3. Install Python dependencies (for Whisper transcription):

```bash
pip install torch pydub whisper
```

4. Ensure `ffmpeg` is installed and accessible from your system's PATH.

5. Start the server:

```bash
node server.js
```

The server will start at [http://localhost:3000](http://localhost:3000).

## Uploading Audio Files

You can upload audio files via the `/upload` endpoint. The application processes MP3 files and transcribes them. If the file is stereo, the left and right channels are processed separately.

## Transcription Model

This project uses the **Whisper** model by OpenAI for transcription. By default, the `base` model is used. However, you can switch to a larger model for better transcription accuracy. Available models include:

- `tiny`
- `base`
- `small`
- `medium`
- `large`

To change the model, modify the `model_name` in `transcribe.py`:

```python
model_name = "medium"  # Change to the desired model
```

Larger models like `medium` or `large` will give better results but may take longer to run and require more GPU memory.

## Batch Processing

The server processes files in batches to prevent overloading the system. The batch size is set in `server.js`. By default, the batch size is set to `2`. You can change this in the `app.post('/upload')` function:

```javascript
const batchSize = 2;  // Adjust batch size for better performance
```

### Reducing Workload

To reduce workload:

- **Increase the batch size**: This will reduce the number of times the server processes files concurrently, potentially improving throughput if your system has enough resources.
  
  For example, to increase the batch size to 4:

  ```javascript
  const batchSize = 4;
  ```

- **Use a smaller Whisper model**: Smaller models like `tiny` or `base` are faster and use less memory but may have lower transcription accuracy.

## How to Improve Transcription Accuracy

For better transcription accuracy, use larger Whisper models. In `transcribe.py`, modify this line:

```python
model_name = "large"
```

Note that larger models require more GPU memory. If your system doesn't have a GPU, this could be slow, so make sure to balance speed and accuracy based on your hardware.

## Handling Stereo Audio

When stereo audio is detected, the application splits the left and right channels and transcribes them separately. The left channel is typically labeled as **Agent**, and the right channel as **Customer** in the output.

## Example Transcription

Here’s an example of a stereo transcription:

```
Agent (Left): Hello, how can I assist you today?
Customer (Right): I’m having trouble with my order. Can you help?
```

## Contributing

If you want to contribute to this project, feel free to submit pull requests or open issues.

## License

This project is licensed under the MIT License.
