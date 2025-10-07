'use strict';

let experimentContainer;

let sampleFragment;
const SAMPLE_FRAGMENT = "components/sample.html"
const SAMPLE_OPTIONS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&';
const SAMPLE_COUNT = 20;
const SAMPLE_COUNT_MOD = 5;

let guessFragment;
const GUESS_FRAGMENT = "components/guess.html"

let formContainer;
let formData = {};

const SAMPLE_RATE = 500; 
const SAMPLE_RATE_MOD = 1000; 
const SAMPLE_DELAY = 10000;

document.addEventListener('DOMContentLoaded', async () => {
    experimentContainer = document.getElementById('experiment-container');
    formContainer = document.getElementById('setup-form');
    sampleFragment = await (await fetch(SAMPLE_FRAGMENT)).text();
    guessFragment = await (await fetch(GUESS_FRAGMENT)).text();
});

async function startExperiment(e) {
    formData = Object.fromEntries(new FormData(e.target).entries());

    if (!formData.studentId) {
        alert('Please enter your Student ID.');
        return;
    }

    let samples = generateSamples()

    formContainer.style.display = 'none';
    await showSamples(samples);
    if(formData.task)
        await showTask();
    if(formData.delay)
        await showDelay();
    let guesses = await showGuesses(samples);
    downloadCSV(samples, guesses);
}

// Generate 20 unique random samples
function generateSamples(amount = SAMPLE_COUNT) {
    const optionsArr = SAMPLE_OPTIONS.split('');
    const shuffled = optionsArr.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, amount);
}

function showSamples(samples) {
    return new Promise(resolve => {
        async function showSample(character, idx, total) {
            experimentContainer.innerHTML = sampleFragment
                .replace('{{ number }}', character)
                .replace('{{ idx }}', idx)
                .replace('{{ total }}', total);
        }

        let i = 0;
        experimentContainer.innerHTML = '<article aria-busy="true"></article>';
        const interval = setInterval(() => {
            if (i < samples.length) {
                showSample(samples[i], i + 1, samples.length);
                i++;
            } else {
                clearInterval(interval);
                resolve();
            }
        }, formData.rate ? SAMPLE_RATE_MOD : SAMPLE_RATE);
    });
}

function showGuesses(samples, customText) {
    return new Promise(resolve => {
        const guesses = [];
        const instructionText = customText 
            ? `${customText} <br/><small>Press Enter to submit each guess</small>`
            : (formData.recallType === 'serial'
            ? `Write the characters in the SAME order as they were presented. <br/><small>Press Enter to submit each guess</small>`
            : `Write the characters in ANY order. <br/><small>Press Enter to submit each guess</small>`);
        experimentContainer.innerHTML = guessFragment.replace('{{ text }}', instructionText);

        experimentContainer.querySelector('input').addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' || event.target.value.trim().length !== 1)
                return;
            event.preventDefault();
            guesses.push(event.target.value.trim().toUpperCase());
            if (guesses.length < samples.length) { // check if more guesses are needed
                event.target.value = '';
            } else {
                resolve(guesses);
            }
        });
        experimentContainer.querySelector('button').addEventListener('click', (event) => {
            resolve(guesses);
        });
    });
}


function showDelay() {
    return new Promise(resolve => {
        experimentContainer.innerHTML = '<article aria-busy="true"></article>';
        setTimeout(() => {
            resolve();
        }, SAMPLE_DELAY);
    });
}

async function showTask() {
    const fakeSamples = generateSamples(SAMPLE_COUNT_MOD);
    experimentContainer.innerHTML = '<p>But first, try to recall these +' + SAMPLE_COUNT_MOD + ' characters in REVERSE order:</p>';
    await new Promise(resolve => setTimeout(resolve, 5000));
    await showSamples(fakeSamples);
    await showGuesses(fakeSamples, `Write the last ${SAMPLE_COUNT_MOD} seen characters in REVERSE order.`);
    experimentContainer.innerHTML = '<p>Great! Now, try to recall the original characters.</p>';
    await new Promise(resolve => setTimeout(resolve, 2000));
}

function downloadCSV(samples, guesses) {
    const csv = 'sample,guess\n' + samples.map((s, i) => `${s},${guesses[i] || 'null'}`).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    let f = `${formData.studentId || 'unknown'}_${formData.recallType || 'unknown'}`;
    if (formData.delay) f += '_delay';
    if (formData.rate) f += '_rate';
    if (formData.task) f += '_task';
    a.download = f + '.csv';
    a.click();
    document.body.innerHTML = '<p>Experiment complete! CSV downloaded.</p>';
}