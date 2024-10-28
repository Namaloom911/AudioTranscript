const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Worker } = require('worker_threads');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');

ffmpeg.setFfmpegPath(ffmpegPath);

function getAudioDuration(filePath) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) {
                return reject(err);
            }
            const duration = metadata.format.duration;
            resolve(duration);
        });
    });
}

const app = express();
const PORT = 3000;
app.use(express.static(path.join(__dirname, 'public')));

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); 
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname); 
    },
});

const upload = multer({ storage: storage });

function runTranscriberWorker(filePath) {
    return new Promise((resolve, reject) => {
        const worker = new Worker(path.join(__dirname, 'transcriber.js'), {
            workerData: filePath,
        });

        worker.on('message', resolve);
        worker.on('error', reject);
        worker.on('exit', (code) => {
            if (code !== 0) {
                reject(new Error(`Worker stopped with exit code ${code}`));
            }
        });
    });
}

const clients = [];

app.get('/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    clients.push(res);

    req.on('close', () => {
        const index = clients.indexOf(res);
        if (index !== -1) {
            clients.splice(index, 1);
        }
    });
});

function sendTranscriptionUpdate(fileName, transcription) {
    clients.forEach(client => {
        client.write(`data: ${JSON.stringify({ fileName, transcription })}\n\n`);
    });
}

app.post('/upload', upload.array('files'), async (req, res) => {
    const files = req.files;
    const totalFiles = files.length;
    const batchSize =2; // Adjust batch size based on memory capacity
    const promises = [];

    if (totalFiles === 0) {
        return res.status(400).json({ error: 'Please select MP3 files.' });
    }

    console.log(`Total files to process: ${totalFiles}`);

    for (let i = 0; i < totalFiles; i++) {
        const file = files[i];
        console.log(`Processing file ${i + 1} of ${totalFiles}: ${file.originalname}`);
        const filePath = path.join(__dirname, file.path);

        const startTime = Date.now();

        try {
            const duration = await getAudioDuration(filePath);
            console.log(`Duration: ${duration.toFixed(2)} seconds`);
        } catch (err) {
            console.error(`Error getting duration for ${file.originalname}: ${err.message}`);
        }

        const promise = runTranscriberWorker(filePath)
            .then(transcription => {
                console.log(`Completed processing: ${file.originalname}`);
                sendTranscriptionUpdate(file.originalname, transcription || 'Transcription failed');
            })
            .catch(error => {
                console.error(`Error processing file ${file.originalname}: ${error.message}`);
                sendTranscriptionUpdate(file.originalname, null);
            })
            .finally(() => {
                fs.unlinkSync(filePath);

                const endTime = Date.now();
                const timeTaken = (endTime - startTime) / 60000;
                console.log(`Processing time for ${file.originalname}: ${timeTaken.toFixed(2)} minutes`);
            });

        promises.push(promise);

        // Process batch
        if (promises.length === batchSize || i === totalFiles - 1) {
            await Promise.all(promises);
            promises.length = 0; // Clear the promises array for the next batch
        }
    }

    console.log(`All files processed.`);
    clients.forEach(client => client.write('event: complete\n\n'));

    res.status(200).json({ message: 'Files are being processed in real-time.' });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
