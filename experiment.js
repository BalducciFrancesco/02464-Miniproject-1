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
        // Show each sample for 500ms
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
    guesses = [];
    experimentContainer.innerHTML = guessFragment;
}

function handleGuess(event) {
    if (event.key != 'Enter') return;
    event.preventDefault();
    const guess = event.target.value.trim().toUpperCase();
    guesses.push(guess);
    // Check if more guesses are needed
    if (guesses.length < samples.length) {
        event.target.value = '';
    } else {
        downloadCSV();
    }
}

function downloadCSV() {
    let csv = 'sample,guess\n' + samples.map((s, i) => `${s},${guesses[i] || 'null'}`).join('\n');
    let blob = new Blob([csv], { type: 'text/csv' });
    let a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    let f = `${formData.studentId || 'unknown'}_${formData.recallType || 'unknown'}`;
    if (formData.delay) f += '_delay';
    if (formData.rate) f += '_rate';
    if (formData.task) f += '_task';
    a.download = f + '.csv';
    a.click();
    document.body.innerHTML = '<p>Experiment complete! CSV downloaded.</p>';
}