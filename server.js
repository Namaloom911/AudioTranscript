const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises; 
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

async function clearUploadFolder() {
    const dir = path.join(__dirname, 'uploads');
    try {
        const files = await fs.readdir(dir);
        await Promise.all(files.map(file => fs.unlink(path.join(dir, file))));
        console.log('All files in the uploads folder have been deleted.');
    } catch (err) {
        console.error(`Error clearing upload folder: ${err.message}`);
    }
}

app.post('/upload', upload.array('files'), async (req, res) => {
    const files = req.files;
    const totalFiles = files.length;
    const batchSize = 2; 
    const promises = [];

    if (totalFiles === 0) {
        return res.status(400).json({ error: 'Please select MP3 files.' });
    }

    console.log(`Total files to process: ${totalFiles}`);

    for (let i = 0; i < totalFiles; i++) {
        const file = files[i];
        const filePath = path.join(__dirname, file.path);
        console.log(`Processing file ${i + 1} of ${totalFiles}: ${file.originalname}`);

        const startTime = Date.now();

    
        console.log(`File created: ${filePath}`);

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
            });

        promises.push(promise);

        if (promises.length === batchSize || i === totalFiles - 1) {
            await Promise.all(promises);
            promises.length = 0; 
        }
    }

    console.log(`All files processed.`);
    clients.forEach(client => client.write('event: complete\n\n'));

    
    await clearUploadFolder();

    res.status(200).json({ message: 'Files are being processed in real-time.' });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
