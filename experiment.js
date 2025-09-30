'use strict';

let experimentContainer;

let samples = []; 
let sampleFragment;
const SAMPLE_FRAGMENT = "components/sample.html"
const SAMPLE_OPTIONS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&';

let guesses = []; 
let guessFragment;
const GUESS_FRAGMENT = "components/guess.html"

let formContainer;
let formData = {};

document.addEventListener('DOMContentLoaded', async () => {
    experimentContainer = document.getElementById('experiment-container');
    formContainer = document.getElementById('setup-form');
    sampleFragment = await (await fetch(SAMPLE_FRAGMENT)).text();
    guessFragment = await (await fetch(GUESS_FRAGMENT)).text();
    // document.addEventListener('keydown', handleKeyPress);
});

async function startExperiment(e) {
    formData = Object.fromEntries(new FormData(e.target).entries());

    if (!formData.studentId) {
        alert('Please enter your Student ID.');
        return;
    }

    formContainer.style.display = 'none';
    await showSamples();
    await showGuesses();
}

// Generate 20 unique random samples
function generateSamples() {
    const optionsArr = SAMPLE_OPTIONS.split('');
    const shuffled = optionsArr.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 20);
}

function showSamples() {
    return new Promise(resolve => {
        async function showSample(character, idx, total) {
            let fragment = sampleFragment
                .replace('{{ number }}', character)
                .replace('{{ idx }}', idx)
                .replace('{{ total }}', total);
            experimentContainer.innerHTML = fragment;
        }

        let i = 0;
        samples = generateSamples();
        const interval = setInterval(() => {
            if (i < samples.length) {
                showSample(samples[i], i + 1, samples.length);
                i++;
            } else {
                clearInterval(interval);
                resolve();
            }
        }, 500);
    });
}

function showGuesses() {
    return new Promise(resolve => {
        async function showGuess(character, idx, total) {
            experimentContainer.innerHTML = guessFragment;
        }

        let i = 0;
        guesses = [];
        const interval = setInterval(() => {
            if (i < guesses.length) {
                showGuess(guesses[i], i + 1, guesses.length);
                i++;
            } else {
                clearInterval(interval);
                resolve();
            }
        }, 500);
    });
}

// --------
// --------
// --------

function downloadCSV() {
    // Build CSV data from imageScores
    let csvData = ['Image,Score1,Score2\n'];
    
    for (const [image, scores] of Object.entries(guesses)) {
        const score1 = scores[0] || '';
        const score2 = scores[1] || '';
        csvData.push(`${image},${score1},${score2}\n`);
    }
    
    let csvContent = csvData.join('');
    let blob = new Blob([csvContent], { type: 'text/csv' });
    let url = window.URL.createObjectURL(blob);
    let a = document.createElement('a');
    a.href = url;
    a.download = `${studentId}.csv`;
    a.click();
    
    document.body.innerHTML = '<p>Experiment complete! CSV file downloaded.</p>';
}