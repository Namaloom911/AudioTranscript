const { workerData, parentPort } = require('worker_threads');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

function runTranscriptionWorker(audioPath) {
    return new Promise((resolve, reject) => {
        const process = spawn('python', [path.join(__dirname, 'transcriber.py'), audioPath]);

        let transcription = '';

        process.stdout.on('data', (data) => {
            transcription += data.toString();
        });

        process.stderr.on('data', (data) => {
            console.error(`Error: ${data}`);
            reject(new Error(`Transcription error: ${data}`));
        });

        process.on('close', (code) => {
            if (code === 0) {
                resolve(transcription);
            } else {
                reject(new Error(`Transcription process exited with code ${code}`));
            }
        });
    });
}

runTranscriptionWorker(workerData)
    .then(transcription => {
        parentPort.postMessage(transcription);
    })
    .catch(err => {
        console.error(`Error transcribing audio: ${err.message}`);
        parentPort.postMessage(null); // Return null in case of error
    });
